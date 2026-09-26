"""PRIVATE calibration sweep: Jev accuracy vs related-context depth, scope, filtering and summary style.

Verifies the v4 design property: the best input mix is a real, non-obvious peak (too little context
leaves tickets ambiguous, too much blurs boundaries). Results never go to the curator.

Run: python puzzle_draft/sweep.py P1
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "reference_genomes"
ROOT = HERE.parent

GLOSS = [
    {"op": "gloss_value", "source": "analytics-export", "map": {
        "payments": "billing or refunds", "orders-and-delivery": "shipping or returns",
        "identity": "account_access or security", "product-usage": "technical or integrations",
        "plans-and-opinions": "sales or feedback", "admin-and-compliance": "legal or no_action"}},
    {"op": "gloss_value", "source": "customer-form", "map": {
        "Something isn't working": "billing, shipping, account_access or technical",
        "I need you to do something": "refunds, returns, integrations or legal",
        "I have a question": "sales", "Just letting you know": "security, feedback or no_action"}},
    {"op": "gloss_value", "source": "event-log", "map": {
        "payment_page_error": "billing or technical", "order_or_return_page": "shipping or returns",
        "login_or_device_alert": "account_access or security", "data_export_requested": "integrations or legal",
        "pricing_or_survey_page": "sales or feedback", "reply_to_receipt_email": "refunds or no_action"}},
]


def rel(scope, radius, show="raw", filt="all", k=9, max_tickets=99):
    return {"op": "include_related", "scope": scope, "radius": radius, "show": show, "filter": filt,
            "k": k, "max_tickets": max_tickets}


OWN = {"op": "include_own", "k": 3}
VARIANTS = {
    "sw_own": ([OWN], "raw"),
    "sw_acct_r1": ([OWN, rel("same_account", 1)], "relative"),
    "sw_acct_r2": ([OWN, rel("same_account", 2)], "relative"),
    "sw_both_r1": ([OWN, rel("both", 1)], "relative"),
    "sw_both_r2": ([OWN, rel("both", 2)], "relative"),
    "sw_both_r2_absolute": ([OWN, rel("both", 2)], "raw"),
    "sw_box_r2_profile": ([OWN, rel("box", 2, show="profile", k=3)], "relative"),
    "sw_box_r4_profile": ([OWN, rel("box", 4, show="profile", k=3)], "relative"),
    "sw_both_r2_lookalike": ([OWN, rel("both", 2, filt="lookalike")], "relative"),
    "sw_gloss_own": (GLOSS + [OWN], "relative"),
    "sw_gloss_both_r1": (GLOSS + [OWN, rel("both", 1)], "relative"),
    "sw_gloss_box_r2_profile": (GLOSS + [OWN, rel("box", 2, show="profile", k=3)], "relative"),
}


GLOSS2 = [
    {"op": "gloss_value", "source": "analytics-export", "map": {
        "payments": "billing or refunds", "orders-and-delivery": "shipping or returns",
        "identity": "account_access or security", "product-usage": "technical or integrations",
        "plans-and-opinions": "sales or feedback",
        "admin-and-compliance": "usually no_action (nothing to route); sometimes legal"}},
    {"op": "gloss_value", "source": "customer-form", "map": {
        "Something isn't working": "billing, shipping, account_access or technical",
        "I need you to do something": "refunds, returns, integrations or legal",
        "I have a question": "sales",
        "Just letting you know": "usually no_action; otherwise security or feedback"}},
    {"op": "gloss_value", "source": "event-log", "map": {
        "payment_page_error": "billing or technical", "order_or_return_page": "shipping or returns",
        "login_or_device_alert": "account_access or security", "data_export_requested": "integrations or legal",
        "pricing_or_survey_page": "sales or feedback",
        "reply_to_receipt_email": "usually an auto-reply (no_action); sometimes refunds"}},
]
VARIANTS2 = {
    "sw2_gloss_own": (GLOSS2 + [OWN], "relative"),
    "sw2_gloss_both_r1": (GLOSS2 + [OWN, rel("both", 1)], "relative"),
    "sw2_gloss_both_r1_look": (GLOSS2 + [OWN, rel("both", 1, filt="lookalike")], "relative"),
    "sw2_gloss_acct_r2_look": (GLOSS2 + [OWN, rel("same_account", 2, filt="lookalike")], "relative"),
    "sw2_gloss_box_r1_profile": (GLOSS2 + [OWN, rel("box", 1, show="profile", k=3)], "relative"),
    "sw2_gloss_both_r2_look4": (GLOSS2 + [OWN, rel("both", 2, filt="lookalike", max_tickets=4)], "relative"),
}
SETS = {"1": VARIANTS, "2": VARIANTS2}


def main(pid: str, which: str = "1") -> None:
    rows = []
    for gid, (ops, fmt) in SETS[which].items():
        path = OUT / f"{gid}.json"
        path.write_text(json.dumps({"id": gid, "rationale": "PRIVATE sweep", "prediction": "", "ops": ops,
                                    "format": fmt}, indent=2), encoding="utf-8")
        subprocess.run([sys.executable, str(HERE / "run.py"), "run", str(path), pid, "--private"],
                       check=True, stdout=subprocess.DEVNULL)
        s = json.loads((ROOT / "out" / "runs" / pid / gid / "scores.json").read_text(encoding="utf-8"))
        rows.append((gid, s["balanced_accuracy"], s["accuracy"], s["mean_confidence"], s["tokens"]))
        print(f"  {gid:<26} balanced {s['balanced_accuracy']:.1%}  plain {s['accuracy']:.1%}  "
              f"conf {s['mean_confidence']:.2f}  tokens {s['tokens']}", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:3])
