"""MongoDB access for Jevly. Each process connects with exactly one login, so the database enforces
who can read the answers:

  curator    reads reports, policies, memory; writes policies, memory (never assessments)
  scorer     reads assessments, runs; writes runs, gate_scores, heldout_scores
  dashboard  reads everything except assessments; writes nothing
  admin      setup and loading only (MONGODB_URI_ADMIN)

URIs come from MONGODB_URI_<LOGIN> in .env (written by mongo_setup.py for the local container).
"""

import os

import certifi
from pymongo import MongoClient

from jevlib import load_env

DB = "jevly"
LOGINS = ("curator", "scorer", "dashboard", "admin")


def connect(login: str):
    if login not in LOGINS:
        raise ValueError(f"login must be one of {LOGINS}")
    load_env()
    uri = os.environ.get(f"MONGODB_URI_{login.upper()}")
    if not uri:
        raise SystemExit(f"MONGODB_URI_{login.upper()} is not set; run python puzzle_draft/mongo_setup.py setup")
    return client(uri, f"jevly-{login}")[DB]


def client(uri: str, appname: str = "jevly") -> MongoClient:
    tls = {"tlsCAFile": certifi.where()} if uri.startswith("mongodb+srv") or "tls=true" in uri else {}
    return MongoClient(uri, appname=appname, serverSelectionTimeoutMS=8000, tz_aware=True, **tls)
