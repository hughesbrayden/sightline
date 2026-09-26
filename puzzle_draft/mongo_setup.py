"""Create the jevly database: collections, indexes, the three locked-down logins, and the tripwire probe.

  docker compose up -d                                  local Atlas container
  python puzzle_draft/mongo_setup.py setup              collections + indexes + roles + users; writes URIs to .env
  python puzzle_draft/mongo_setup.py check              verify every login can do exactly what it should
  python puzzle_draft/mongo_setup.py probe              tripwire: curator login reads assessments -> denied, logged
  python puzzle_draft/mongo_setup.py atlas [--apply]     same roles + users on cloud Atlas via the Atlas CLI

Cloud Atlas blocks createRole/createUser from drivers, so on a mongodb.net URI `setup` only makes
collections and indexes; run the printed `atlas` commands for roles and users.
"""

import argparse
import os
import secrets
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pymongo.errors import CollectionInvalid, OperationFailure  # noqa: E402
from pymongo.operations import SearchIndexModel  # noqa: E402

from db import DB, client, connect  # noqa: E402
from jevlib import ROOT, load_env  # noqa: E402

ENV = ROOT / ".env"
LOCAL_ADMIN = "mongodb://admin:jevly-local-admin@localhost:27017/?authSource=admin&directConnection=true"
LOCAL_HOST = "localhost:27017/?authSource=admin&directConnection=true"
EMBED_DIM = 1024  # voyage-3.5 / voyage-3.5-lite

READ, WRITE = ["find"], ["insert", "update"]
ROLES = {  # role -> {collection: actions}; the dashboard contract and CLAUDE.md depend on this table
    "curator": {"reports": READ, "policies": READ + WRITE, "memory": READ + WRITE},
    "scorer": {"assessments": READ, "runs": READ + ["insert"], "gate_scores": READ + ["insert"],
               "heldout_scores": READ + ["insert"]},
    "dashboard": {c: READ for c in ("blocks", "reports", "policies", "runs", "gate_scores",
                                    "heldout_scores", "memory")},
}
COLLECTIONS = ["blocks", "reports", "assessments", "policies", "runs", "gate_scores", "heldout_scores", "memory"]


def admin_db():
    load_env()
    uri = os.environ.get("MONGODB_URI_ADMIN", LOCAL_ADMIN)
    return client(uri, "jevly-admin")[DB], uri


def upsert_env(values: dict) -> None:
    lines = ENV.read_text(encoding="utf-8").splitlines() if ENV.exists() else []
    seen = set()
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip()
        if key in values:
            lines[i] = f"{key}={values[key]}"
            seen.add(key)
    lines += [f"{k}={v}" for k, v in values.items() if k not in seen]
    ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")


def make_collections(db) -> None:
    existing = set(db.list_collection_names())
    for name in COLLECTIONS:
        if name in existing:
            continue
        if name == "runs":  # one document per block per run; meta groups a (run, gen, town)
            db.create_collection("runs", timeseries={"timeField": "ts", "metaField": "meta", "granularity": "seconds"})
        else:
            try:
                db.create_collection(name)
            except CollectionInvalid:
                pass
    db.blocks.create_index([("loc", "2d")], min=0, max=32)
    db.blocks.create_index([("town", 1), ("x", 1), ("y", 1)], unique=True)
    db.reports.create_index([("loc", "2d")], min=0, max=32)  # $geoNear radius queries, filtered by town
    db.reports.create_index([("town", 1), ("source", 1)])
    db.assessments.create_index([("town", 1), ("x", 1), ("y", 1)], unique=True)
    db.policies.create_index([("run", 1), ("gen", 1)])
    db.gate_scores.create_index([("run", 1), ("gen", 1)])
    db.heldout_scores.create_index([("run", 1), ("gen", 1)])
    db.memory.create_index([("run", 1), ("kind", 1)])
    print(f"  collections + indexes ok: {', '.join(COLLECTIONS)}")
    try:
        names = {ix["name"] for ix in db.memory.list_search_indexes()}
        if "memory_vec" not in names:
            db.memory.create_search_index(SearchIndexModel(
                name="memory_vec", type="vectorSearch",
                definition={"fields": [{"type": "vector", "path": "embedding", "numDimensions": EMBED_DIM,
                                        "similarity": "cosine"},
                                       {"type": "filter", "path": "kind"}, {"type": "filter", "path": "run"}]}))
        print(f"  vector index memory_vec ok ({EMBED_DIM} dims, cosine)")
    except OperationFailure as e:
        print(f"  vector index skipped: {e.details.get('errmsg', e)}")


def privileges(role: str) -> list:
    return [{"resource": {"db": DB, "collection": c}, "actions": a} for c, a in ROLES[role].items()]


def make_logins(db) -> dict:
    admin = db.client.admin
    uris = {}
    for role in ROLES:
        if admin.command("rolesInfo", role)["roles"]:
            admin.command("updateRole", role, privileges=privileges(role), roles=[])
        else:
            admin.command("createRole", role, privileges=privileges(role), roles=[])
        password = secrets.token_urlsafe(18)
        if admin.command("usersInfo", role)["users"]:
            admin.command("updateUser", role, pwd=password, roles=[{"role": role, "db": "admin"}])
        else:
            admin.command("createUser", role, pwd=password, roles=[{"role": role, "db": "admin"}])
        uris[f"MONGODB_URI_{role.upper()}"] = f"mongodb://{role}:{quote_plus(password)}@{LOCAL_HOST}"
        print(f"  login {role}: {', '.join(f'{c}[{'/'.join(a)}]' for c, a in ROLES[role].items())}")
    return uris


def cmd_setup(_args) -> None:
    db, uri = admin_db()
    db.client.admin.command("ping")
    make_collections(db)
    if "mongodb.net" in uri:
        print("  cloud Atlas: roles and users are not created from drivers; run `mongo_setup.py atlas`")
        return
    uris = make_logins(db)
    upsert_env({"MONGODB_URI_ADMIN": uri, **uris})
    print(f"  wrote {len(uris) + 1} MongoDB URIs to .env")
    cmd_check(_args)


def _try(fn) -> bool:
    try:
        fn()
        return True
    except OperationFailure as e:
        if e.code == 13:  # Unauthorized
            return False
        raise


def cmd_check(_args) -> None:
    """Every login gets exactly its privileges: try read + insert on every collection."""
    failures = 0
    for role, grants in ROLES.items():
        db = connect(role)
        row = []
        for c in COLLECTIONS:
            can_read = _try(lambda: db[c].find_one({"_check": True}))
            doc = {"_check": True, "ts": datetime.now(timezone.utc), "meta": {"run": "_check"}}
            can_write = _try(lambda: db[c].insert_one(doc))
            want_read, want_write = "find" in grants.get(c, []), "insert" in grants.get(c, [])
            ok = (can_read, can_write) == (want_read, want_write)
            failures += not ok
            row.append(f"{c}:{'r' if can_read else '-'}{'w' if can_write else '-'}{'' if ok else '!!'}")
        print(f"  {role:<9} {' '.join(row)}")
    db, _ = admin_db()
    for c in COLLECTIONS:
        db[c].delete_many({"_check": True})
    if failures:
        sys.exit(f"  PERMISSION CHECK FAILED: {failures} mismatches (marked !!)")
    print("  permission check passed: curator and dashboard cannot read assessments; dashboard cannot write")


def cmd_probe(args) -> None:
    """Scripted tripwire for the demo. It is a probe we run, not something the curator did."""
    db = connect("curator")
    try:
        db.assessments.find_one({})
        sys.exit("  PROBE FAILED: the curator login could read assessments")
    except OperationFailure as e:
        event = {"kind": "probe", "status": "denied", "run": args.run, "login": "curator",
                 "attempt": "find on jevly.assessments", "error_code": e.code,
                 "error": e.details.get("errmsg", str(e)).split(" to execute")[0] + " to find on assessments", "label": "scripted tripwire probe",
                 "created": datetime.now(timezone.utc)}
        db.policies.insert_one(event)
        print(f"  denied (code {e.code}): {event['error']}\n  logged to policies as a probe event")


def cmd_atlas(args) -> None:
    """Custom roles + users on cloud Atlas via the Atlas CLI (needs `atlas auth login`)."""
    upper = {"find": "FIND", "insert": "INSERT", "update": "UPDATE"}
    _, admin_uri = admin_db()
    host = admin_uri.split("@", 1)[1].split("/", 1)[0]
    uris = {}
    for role, grants in ROLES.items():
        privs = ",".join(f"{upper[a]}@{DB}.{c}" for c, acts in grants.items() for a in acts)
        password = secrets.token_urlsafe(18)
        cmds = [["atlas", "customDbRoles", "create", role, "--privilege", privs],
                ["atlas", "dbusers", "create", "--username", role, "--password", password, "--role", role]]
        if not args.apply:
            for cmd in cmds:
                print(" ".join(cmd).replace(password, "<password>"))
            continue
        for cmd in cmds:
            done = subprocess.run(cmd, capture_output=True, text=True)
            if done.returncode and "already exists" in (done.stdout + done.stderr).lower():
                cmd[2] = "update"  # role or user exists: update privileges / reset password
                if cmd[1] == "dbusers":
                    cmd[3:5] = [role]
                done = subprocess.run(cmd, capture_output=True, text=True)
            if done.returncode:
                sys.exit(f"  failed: {' '.join(cmd[:4])}\n  {done.stderr.strip() or done.stdout.strip()}")
        uris[f"MONGODB_URI_{role.upper()}"] = (f"mongodb+srv://{role}:{quote_plus(password)}@{host}/"
                                               "?authSource=admin&retryWrites=true&w=majority")
        print(f"  atlas login {role}: {privs}")
    if uris:
        upsert_env(uris)
        print(f"  wrote {len(uris)} Atlas URIs to .env (new users can take ~1 min to deploy)")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup").set_defaults(fn=cmd_setup)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    p = sub.add_parser("probe")
    p.add_argument("--run", default="dev")
    p.set_defaults(fn=cmd_probe)
    p = sub.add_parser("atlas")
    p.add_argument("--apply", action="store_true", help="run the commands (else print them)")
    p.set_defaults(fn=cmd_atlas)
    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
