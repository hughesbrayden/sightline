"""Hurricane world: a 32x32 city grid (stylized NYC, Miami, Houston, New Orleans), 12 damage states,
eight messy report sources. The city outlines match the Sightline demo; storms are simulated.

Six hours after landfall, every land block has one true state. Rules are seeded per storm:
  elevation   rises with distance from water, plus noise
  flood       the lowest 18-30% of land: flooded_homes in dense housing, flooded_street elsewhere
  debris path a storm track: collapsed in the core, roof_damage in the band, road_blocked at the edges
  power       feeder zones from substations; two feeders out -> power_out, downed_lines on their streets
  fire        a few ignitions next to downed lines
  facilities  2x2 campuses: shelters and one hospital on high ground, one hospital down in a hazard zone

Each source speaks a real-world vocabulary (Hurricane Sandy era, NYC) and has a planted habit the curator can
only fix with ops. The model sees one static post-storm snapshot; `hour` is for the demo feed only.
  911-call      CAD-style call types (NYPD/FDNY): vague codes shared by several states ("UTILITY EMERGENCY -
                ELECTRIC", "ASSIST CIVILIAN - NON-MEDICAL"); location often off by one block (FCC Phase II
                accuracy is 50-150 m); severe incidents draw repeat calls
  social-post   viral "verified: yes" accounts (paid badges since 2023) spread false collapse / fire / flood reports
  city-survey   FEMA Preliminary Damage Assessment levels: Destroyed / Major / Minor / Affected / Inaccessible;
                "Major" means water inside homes, "Affected" means cosmetic only
  311           real NYC 311 complaint type / descriptor pairs, plus the everyday background (heat, noise)
  fire-dept     NFIRS incident type codes (111 building fire, 363 swift water rescue, 444 power line down, ...)
  pre-storm-map stale prior: PLUTO land use, hurricane evacuation zone, FEMA flood zone, elevation; every
                school is a designated evacuation center, but only some open
  drone-pass    RescueNet / FloodNet-style image labels, ~30% coverage in flight strips; power_out looks undamaged
  utility-feed  accurate but feeder-wide: "de-energized" says nothing about other damage

Truth goes to puzzle_draft/secret/storms/<town>/ (and Mongo `assessments`), never to the curator.
"""

import json
import math
import random
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
STORM_DIR = ROOT / "puzzle_draft" / "storms"
SECRET_DIR = ROOT / "puzzle_draft" / "secret" / "storms"
W = H = 32
WORLD_VERSION = "v3-real-vocab"  # bump when report vocabularies or rules change; once-only held-out scoring is per version

STATES = ["intact", "flooded_street", "flooded_homes", "roof_damage", "collapsed", "fire", "road_blocked",
          "power_out", "downed_lines", "shelter_open", "hospital_ok", "hospital_down"]
DESCRIPTIONS = {  # what Jev chooses between; neutral wording, no hints about sources
    "intact": "No significant damage to the block",
    "flooded_street": "Floodwater in the streets, homes not flooded inside",
    "flooded_homes": "Floodwater inside homes",
    "roof_damage": "Roofs damaged, buildings standing",
    "collapsed": "One or more buildings collapsed",
    "fire": "Active fire or recent burn",
    "road_blocked": "Road impassable from debris or trees",
    "power_out": "Power out, no other significant damage",
    "downed_lines": "Power lines down on the block",
    "shelter_open": "Emergency shelter operating on the block",
    "hospital_ok": "Hospital operating normally",
    "hospital_down": "Hospital not operating",
}
COLORS = {
    "intact": "#6B7A5A", "flooded_street": "#5FA8D3", "flooded_homes": "#1F5FBF", "roof_damage": "#E0B04A",
    "collapsed": "#B3261E", "fire": "#FF6A00", "road_blocked": "#8C6D4F", "power_out": "#7A5FA8",
    "downed_lines": "#D65DB1", "shelter_open": "#2BB673", "hospital_ok": "#F2F2F2", "hospital_down": "#111111",
}
SEA = "#16222E"
LIFE_SAFETY = ["collapsed", "flooded_homes", "fire", "hospital_down"]
# dev = past storms the curator trains on; val = the gate (pass/fail only); heldout = tonight, scored once;
# cities = next season elsewhere (demo beat 7), also scored once with the frozen policy.
SPLITS = {"dev": ["MIA1", "HOU1", "NOL1"], "val": ["NYC0"], "heldout": ["NYC1"], "cities": ["MIA2", "HOU2", "NOL2"],
          # a second validation storm for the gate (paired bootstrap over NYC0 + HOU0): one storm is too noisy to
          # gate on, since a single hospital-campus block moves balanced accuracy ~2 points. Last, so the order of
          # the other towns is unchanged; every town has its own seed, so adding it changes no other storm.
          "val2": ["HOU0"]}
TOWNS = [t for ts in SPLITS.values() for t in ts]
CITY = {"MIA": "miami", "HOU": "houston", "NOL": "nola", "NYC": "nyc"}
SEEDS = {"MIA1": 101, "HOU1": 202, "NOL1": 303, "NYC0": 404, "NYC1": 505, "MIA2": 606, "HOU2": 707, "NOL2": 808, "HOU0": 909}
MIN_DEV_COUNT, MIN_TOWN_COUNT = 8, 2  # every state >= 8x across dev towns, >= 2x in each town
SOURCES = ["911-call", "311", "social-post", "city-survey", "fire-dept", "pre-storm-map", "drone-pass", "utility-feed"]

VALUE_OF = {  # source -> true state -> the value that source reports
    "911-call": {  # CAD call types in the FDNY / NYPD style; several states share one vague code
        "collapsed": "STRUCTURAL: BUILDING COLLAPSE", "flooded_homes": "WATER RESCUE: PERSONS TRAPPED",
        "flooded_street": "HAZARD: FLOODED ROADWAY", "fire": "FIRE: RESIDENCE PRIVATE HOUSE",
        "downed_lines": "UTILITY EMERGENCY - ELECTRIC", "power_out": "UTILITY EMERGENCY - ELECTRIC",
        "road_blocked": "HAZARD: TREE DOWN", "roof_damage": "ASSIST CIVILIAN - NON-MEDICAL",
        "shelter_open": "ASSIST CIVILIAN - NON-MEDICAL", "hospital_down": "MEDICAL - ASSIST CIVILIAN",
        "hospital_ok": "MEDICAL - ASSIST CIVILIAN", "intact": "UNDEFINED EMERGENCY"},
    "social-post": {
        "collapsed": "#collapse", "flooded_homes": "#flooding", "flooded_street": "#flooding", "fire": "#fire",
        "downed_lines": "#powerlines", "road_blocked": "#roadclosed", "roof_damage": "#roofdamage",
        "power_out": "#poweroutage", "hospital_down": "#hospital", "hospital_ok": "#hospital",
        "shelter_open": "#shelter", "intact": "#safe"},
    # FEMA PDA levels. Affected = cosmetic only (streets wet, homes dry); Major = water inside homes
    "city-survey": {"intact": "Affected", "flooded_street": "Affected", "roof_damage": "Minor",
                    "flooded_homes": "Major", "collapsed": "Destroyed"},
    # NFIRS incident types: 111 building fire, 461 building collapsed, 444 power line down,
    # 813 wind storm / hurricane assessment, 363 swift water rescue
    "fire-dept": {"fire": "111", "collapsed": "461", "downed_lines": "444", "road_blocked": "813",
                  "flooded_homes": "363"},
    "311": {  # NYC 311 complaint type / descriptor (power outages go to Con Ed, not 311)
        "flooded_street": "Sewer / Street Flooding (SJ)",
        "flooded_homes": "Sewer / Sewer Backup (Use Comments) (SA)",
        "road_blocked": "Damaged Tree / Entire Tree Has Fallen Down",
        "power_out": "Street Light Condition / Street Light Out",
        "roof_damage": "General Construction/Plumbing / Debris - Falling Or In Danger Of Falling",
        "collapsed": "General Construction/Plumbing / Building Shaking/Vibrating/Structural Stability"},
    "drone-pass": {  # RescueNet / FloodNet-style labels: overhead imagery sees roofs and water extent only
        "intact": "Building-No-Damage", "power_out": "Building-No-Damage",
        "flooded_street": "Road-Flooded, Building-Non-Flooded", "flooded_homes": "Building-Flooded",
        "roof_damage": "Building-Minor-Damage", "collapsed": "Building-Total-Destruction",
        "fire": "Building-Major-Damage", "road_blocked": "Road-Blocked", "downed_lines": "Tree, Road-Clear",
        "shelter_open": "Building-No-Damage, Vehicle", "hospital_ok": "Building-No-Damage",
        "hospital_down": "Building-Flooded"},
}
COVERAGE = {  # source -> state -> chance a block in that state gets a report
    "911-call": {"collapsed": .45, "flooded_homes": .35, "fire": .6, "hospital_down": .5, "downed_lines": .4,
                 "flooded_street": .2, "road_blocked": .25, "roof_damage": .2, "power_out": .1,
                 "shelter_open": .1, "hospital_ok": .05, "intact": .03},
    "social-post": {**{s: .25 for s in STATES}, "intact": .1, "power_out": .12},
    "311": {"flooded_street": .35, "flooded_homes": .15, "road_blocked": .5, "power_out": .2, "roof_damage": .15,
            "collapsed": .1},
    "city-survey": {"flooded_street": .35, "roof_damage": .35, "flooded_homes": .35, "collapsed": .35,
                    "intact": .1},
    "fire-dept": {"fire": .85, "collapsed": .5, "downed_lines": .6, "road_blocked": .35, "flooded_homes": .25},
}
CALLS_311 = {  # the resident's comments on the request
    "Sewer / Street Flooding (SJ)": "Water across the street, cars can't pass",
    "Sewer / Sewer Backup (Use Comments) (SA)": "Water coming up through the basement drain",
    "Damaged Tree / Entire Tree Has Fallen Down": "Tree down across the road",
    "Street Light Condition / Street Light Out": "Every light on the street is out",
    "General Construction/Plumbing / Debris - Falling Or In Danger Of Falling": "Pieces of the roof on the sidewalk",
    "General Construction/Plumbing / Building Shaking/Vibrating/Structural Stability": "Building next door is leaning",
    "HEATING / HEAT": "No heat in the apartment", "Noise - Residential / Loud Music/Party": "Party next door",
    "Damaged Tree / Branch Cracked and Will Fall": "Big branch hanging over the sidewalk",
    "Traffic Signal Condition / Controller": "Traffic light is dark at the corner"}
NOISE_311 = ["HEATING / HEAT", "Noise - Residential / Loud Music/Party", "Damaged Tree / Branch Cracked and Will Fall",
             "Traffic Signal Condition / Controller"]  # the everyday 311 background (Sandy week: HEAT was #1)
NOISE_311_RATE = 0.12
REPEAT_911 = {"collapsed": .5, "fire": .5, "flooded_homes": .4, "hospital_down": .4}  # chance of repeat calls
PDA_LADDER = ["Destroyed", "Major", "Minor", "Affected"]
PDA_INACCESSIBLE = {"flooded_homes": .15, "flooded_street": .15, "collapsed": .15}  # surveyor couldn't reach it
FIRE_CODES = ["111", "461", "444", "813", "363"]
PLUTO = {"dense housing": "02 Multi-Family Walk-Up Buildings", "sparse housing": "01 One & Two Family Buildings",
         "commercial": "05 Commercial & Office Buildings", "park": "09 Open Space & Outdoor Recreation",
         "hospital": "08 Public Facilities & Institutions (hospital)",
         "school": "08 Public Facilities & Institutions (school, designated evacuation center)"}
DECOY_SCHOOLS = 6  # designated evacuation centers that did not open
TRANSCRIPTS = {
    "collapsed": ["The house next to us came down, there are people inside", "Building collapsed, we can hear someone"],
    "flooded_homes": ["Water's coming in, we're on the second floor with the kids",
                      "Water is up to the outlets in the living room"],
    "flooded_street": ["Street's flooded, my car stalled, we're fine inside", "Can't drive out, water in the road"],
    "fire": ["Sparks from the pole and now there's smoke and flames", "Fire, the house on the corner is burning"],
    "downed_lines": ["Power line down in the road, it's sparking", "Wires on the ground in front of my house"],
    "road_blocked": ["Big tree across the road, nobody can get through", "Road's blocked with debris"],
    "roof_damage": ["Part of our roof blew off, rain coming in upstairs", "Shingles gone, ceiling leaking"],
    "power_out": ["No power since last night, my mother's oxygen machine needs power", "Power's out on the whole street"],
    "hospital_down": ["They're turning ambulances away from the hospital", "Hospital's dark, water in the lobby"],
    "hospital_ok": ["I'm at the hospital, the ER is open"],
    "shelter_open": ["Is the school shelter open? We're here and they're taking people"],
    "intact": ["We're okay, no damage, just checking in about my neighbor", "All fine here, just scared"],
}
POSTS = {
    "#collapse": ["Whole building just came down!!", "Houses flattened, it's gone"],
    "#flooding": ["Street is a river right now", "Water everywhere, houses underwater"],
    "#fire": ["Fire!! Smoke all over the block", "Something's burning, huge flames"],
    "#powerlines": ["Lines down and sparking, stay away"], "#roadclosed": ["Road totally blocked by trees"],
    "#roofdamage": ["Roof tore off the house across the street"], "#poweroutage": ["Still no power here"],
    "#hospital": ["Anyone know if the hospital is open?"], "#shelter": ["Shelter at the school is open"],
    "#safe": ["We made it through, all good here"],
}
SEVERE_TAGS = ["#collapse", "#fire", "#flooding"]
HANDLES = ["stormwatcher", "coastlocal", "newsnow24", "harborlife", "wx_chaser", "citybeat", "neighborly", "breakingcoast"]
SHIFT_911 = 0.5           # share of 911 calls filed at a neighboring block
SOCIAL_VERIFIED = 0.3     # share of ordinary posts from verified accounts
SOCIAL_ACC = {False: 0.75, True: 0.75}
VIRAL = ["BreakingStormNews", "WeatherAlertsNow", "CityScanner"]  # verified, viral, and usually wrong
VIRAL_RATE = 0.12         # chance a quiet block (intact / power_out / roof) gets a false viral post
SURVEY_ACC, FIRE_ACC, DRONE_ACC = 0.9, 0.9, 0.95
UTILITY_COVERAGE = 0.7

# --- value -> states (for the fake backend's votes and for readable digests) ---
STATES_OF = {src: {} for src in VALUE_OF}
for _src, _table in VALUE_OF.items():
    for _state, _value in _table.items():
        STATES_OF[_src].setdefault(_value, set()).add(_state)
STATES_OF["utility-feed"] = {"energized": {"intact"}, "de-energized": {"power_out"},
                             "de-energized, line fault reported": {"downed_lines"}}
STATES_OF["city-survey"]["Inaccessible"] = set()
for _noise in NOISE_311:
    STATES_OF["311"][_noise] = set()

# every value each source can report (the `value` field, not the rendered line): the harness validates glosses
# and only_values against this, and the curator brief lists it
VALUES = {src: sorted(STATES_OF[src]) for src in STATES_OF}
VALUES["pre-storm-map"] = sorted(PLUTO.values())


def _nyc_water(r, c):
    if c <= 1:
        return True  # Hudson
    shift = (r >= 10) + (r >= 20)
    east, west = 13 + shift, 2
    if r >= 21:
        west, east = 2 + (r - 21), east - (r - 21)
    bk_west = 17 + shift
    land = ((west <= c <= east) or (c >= bk_west and r <= 26)
            or (24 <= r <= 29 and bk_west + 1 <= c <= bk_west + 8 - (r - 24)) or (29 <= r <= 30 and 12 <= c <= 15))
    return (c == bk_west + 10 and 13 <= r <= 25) or not land  # Gowanus canal


def _nyc_park(r, c):
    return (29 <= r <= 30 and 12 <= c <= 15) or (25 <= r <= 26 and 6 <= c <= 8) or (c == 18 and 5 <= r <= 11)


def _miami_water(r, c):
    return c >= 29 or 18 <= c <= 24 or (r == 12 and 3 <= c <= 17) or (25 <= c <= 28 and (r <= 1 or r >= 30))


def _houston_water(r, c):
    b1 = 11 + round(3 * math.sin(c / 4.5))
    b2 = 24 + round(2 * math.sin(c / 3.2 + 1))
    return r == b1 or r == b2 or (c == 20 and b1 < r < b2 and 14 <= r <= 20)


def _nola_water(r, c):
    if r <= 4:
        return True  # Lake Pontchartrain
    river = 20 + round(7 * math.sin((r - 8) / 5.5))
    return (r >= 9 and abs(c - river) <= 1) or (c in (8, 14) and 5 <= r <= 13)


WATER = {"nyc": _nyc_water, "miami": _miami_water, "houston": _houston_water, "nola": _nola_water}
PARK = {"nyc": _nyc_park}


def _distance_to_water(water):
    dist = np.where(water, 0, 99)
    frontier = list(zip(*np.nonzero(water)))
    while frontier:
        nxt = []
        for r, c in frontier:
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = r + dr, c + dc
                if 0 <= nr < H and 0 <= nc < W and dist[nr, nc] > dist[r, c] + 1:
                    dist[nr, nc] = dist[r, c] + 1
                    nxt.append((nr, nc))
        frontier = nxt
    return dist


def _waves(rng: random.Random, n: int, freq: float):
    params = [(rng.uniform(-freq, freq), rng.uniform(-freq, freq), rng.uniform(0, 2 * math.pi)) for _ in range(n)]
    ys, xs = np.mgrid[0:H, 0:W]
    return sum(np.sin(a * xs + b * ys + p) for a, b, p in params) / math.sqrt(n)


def generate(town: str, seed: int) -> dict:
    rng = random.Random(seed)
    nrng = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:H, 0:W]
    city = CITY[town[:3]]
    water = np.array([[WATER[city](r, c) for c in range(W)] for r in range(H)])
    land = ~water
    dist = _distance_to_water(water)
    elev = np.clip(0.6 * dist + 0.9 * _waves(rng, 4, 0.5), 0, None).round(1)
    street = (xs % 5 == 0) | (ys % 5 == 0)
    dn = _waves(rng, 4, 0.35)
    land_use = np.where(dn > 0.25, "dense housing", np.where(dn < -0.6, "park", "sparse housing")).astype(object)
    land_use[street & (ys % 10 == 0)] = "commercial"
    if city in PARK:
        land_use[np.array([[PARK[city](r, c) for c in range(W)] for r in range(H)])] = "park"
    cells = [(int(x), int(y)) for y, x in zip(*np.nonzero(land))]
    state = np.full((H, W), None, dtype=object)
    state[land] = "intact"
    u = nrng.random((6, H, W))  # independent uniforms per rule

    subs = rng.sample(cells, 6)
    feeder = np.argmin([(xs - sx) ** 2 + (ys - sy) ** 2 for sx, sy in subs], axis=0)
    out = rng.sample(range(6), 2)
    dark = land & np.isin(feeder, out)
    state[dark] = "power_out"
    state[dark & street & (u[0] < 0.15)] = "downed_lines"

    theta = rng.uniform(0, math.pi)
    cx, cy = rng.choice([c for c in cells if 8 <= c[0] <= 24 and 8 <= c[1] <= 24])
    d = np.abs((xs - cx) * math.sin(theta) - (ys - cy) * math.cos(theta))
    state[land & (d < 3.2) & (u[1] < 0.7)] = "roof_damage"
    state[land & street & (d >= 2) & (d < 4.5) & (u[2] < 0.7)] = "road_blocked"

    surge = float(np.quantile(elev[land], rng.uniform(0.18, 0.30)))  # flood the lowest 18-30% of land
    low = land & (elev < surge)
    state[low & (land_use == "dense housing")] = "flooded_homes"
    state[low & (land_use != "dense housing")] = "flooded_street"
    state[land & (d < 1.2) & (u[3] < 0.45)] = "collapsed"

    sparks = [c for c in cells if state[c[1], c[0]] == "downed_lines"] or [c for c in cells if dark[c[1], c[0]]]
    for x, y in rng.sample(sparks, min(4, len(sparks))):
        spread = [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                  if 0 <= x + dx < W and 0 <= y + dy < H and land[y + dy, x + dx]]
        for fx, fy in rng.sample(spread, min(len(spread), rng.choice([1, 2]))):
            state[fy, fx] = "fire"

    taken = set()

    def campus(candidates, kind):
        rng.shuffle(candidates)
        for x, y in candidates:
            block = [(x + i, y + j) for i in (0, 1) for j in (0, 1)]
            if all(0 <= bx < W and 0 <= by < H and land[by, bx] and (bx, by) not in taken for bx, by in block):
                for bx, by in block:
                    state[by, bx] = kind
                    taken.update((bx + i, by + j) for i in (-1, 0, 1) for j in (-1, 0, 1))
                return (x, y)
        raise RuntimeError(f"{town}: no room for {kind}")

    high = [c for c in cells if elev[c[1], c[0]] >= np.percentile(elev[land], 70)]
    hazard = [c for c in cells if elev[c[1], c[0]] < surge + 0.3 or d[c[1], c[0]] < 2.5]
    facilities = {"shelter_open": [campus(list(high), "shelter_open"), campus(list(high), "shelter_open")],
                  "hospital_ok": [campus(list(high), "hospital_ok")],
                  "hospital_down": [campus(list(hazard), "hospital_down")]}
    return {"town": town, "seed": seed, "land": land, "elev": elev, "land_use": land_use, "street": street,
            "feeder": feeder, "state": state, "cells": cells, "city": city,
            "params": {"surge": round(surge, 2), "track": [cx, cy, round(theta, 3)], "feeders_out": out,
                       "facilities": facilities}}


def _neighbors(x: int, y: int, land) -> list:
    return [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
            if (dx or dy) and 0 <= x + dx < W and 0 <= y + dy < H and land[y + dy, x + dx]]


def reports(world: dict) -> list[dict]:
    rng = random.Random(world["seed"] * 7 + 1)
    land, state, elev, land_use, feeder = (world[k] for k in ("land", "state", "elev", "land_use", "feeder"))
    strips = rng.sample(range(0, 17), 2)  # drone flight strips over land, 3 columns wide (~30% of blocks)
    drone_cols = {c for s in strips for c in range(s, s + 3)}
    docs = []

    def add(src, x, y, value, **extra):  # hour: when the report came in, 0-6 h after landfall (demo feed)
        docs.append({"source": src, "x": x, "y": y, "value": value, "hour": round(rng.uniform(0, 6), 2), **extra})

    to_water = _distance_to_water(~land)
    facility = {"shelter_open", "hospital_ok", "hospital_down"}
    ordinary = [c for c in world["cells"] if state[c[1], c[0]] not in facility]
    decoys = set(rng.sample(ordinary, min(DECOY_SCHOOLS, len(ordinary))))

    for x, y in world["cells"]:
        s = state[y, x]
        use = ("school" if s == "shelter_open" or (x, y) in decoys else
               "hospital" if s in ("hospital_ok", "hospital_down") else land_use[y, x])
        noisy = elev[y, x] + rng.gauss(0, 1.0)  # pre-storm maps are miscalibrated priors, not oracles
        zone = int(min(6, max(1, 1 + noisy // 1.5)))
        fema = ("VE" if to_water[y, x] <= 1 and noisy < 2 else "AE" if noisy < 3 else
                "X (shaded)" if noisy < 4.5 else "X")
        add("pre-storm-map", x, y, PLUTO[use], land_use=use, elev=float(elev[y, x]), evac_zone=zone, flood_zone=fema)
        if rng.random() < COVERAGE["911-call"].get(s, 0):
            transcripts = TRANSCRIPTS[s][:]
            rng.shuffle(transcripts)
            calls = 1 + (rng.random() < REPEAT_911.get(s, 0)) + (rng.random() < REPEAT_911.get(s, 0) / 2)
            for i in range(calls):  # severe incidents draw repeat calls, each located independently
                rx, ry = (rng.choice(_neighbors(x, y, land)) if rng.random() < SHIFT_911 else (x, y))
                add("911-call", rx, ry, VALUE_OF["911-call"][s], transcript=transcripts[i % len(transcripts)])
        if rng.random() < COVERAGE["social-post"].get(s, 0):
            verified = rng.random() < SOCIAL_VERIFIED
            tag = VALUE_OF["social-post"][s] if rng.random() < SOCIAL_ACC[verified] else rng.choice(
                [t for t in SEVERE_TAGS if t != VALUE_OF["social-post"][s]])
            add("social-post", x, y, tag, verified=verified, handle=rng.choice(HANDLES), post=rng.choice(POSTS[tag]))
        if s in ("intact", "power_out", "roof_damage") and rng.random() < VIRAL_RATE:
            tag = rng.choice(SEVERE_TAGS)
            add("social-post", x, y, tag, verified=True, handle=rng.choice(VIRAL), post=rng.choice(POSTS[tag]))
        if rng.random() < COVERAGE["311"].get(s, 0):
            add("311", x, y, VALUE_OF["311"][s], complaint=CALLS_311[VALUE_OF["311"][s]])
        if rng.random() < NOISE_311_RATE:
            noise = rng.choice(NOISE_311)
            add("311", x, y, noise, complaint=CALLS_311[noise])
        if rng.random() < COVERAGE["city-survey"].get(s, 0):
            if rng.random() < PDA_INACCESSIBLE.get(s, 0):
                add("city-survey", x, y, "Inaccessible")
            else:
                k = PDA_LADDER.index(VALUE_OF["city-survey"][s])
                if rng.random() > SURVEY_ACC:
                    k = min(len(PDA_LADDER) - 1, max(0, k + rng.choice([-1, 1])))
                add("city-survey", x, y, PDA_LADDER[k])
        if rng.random() < COVERAGE["fire-dept"].get(s, 0):
            value = VALUE_OF["fire-dept"][s]
            if rng.random() > FIRE_ACC:
                value = rng.choice([v for v in FIRE_CODES if v != value])
            add("fire-dept", x, y, value)
        if x in drone_cols:
            value = VALUE_OF["drone-pass"][s]
            if rng.random() > DRONE_ACC:
                value = rng.choice(sorted(set(VALUE_OF["drone-pass"].values()) - {value}))
            add("drone-pass", x, y, value)
        if rng.random() < UTILITY_COVERAGE:
            out = feeder[y, x] in world["params"]["feeders_out"]
            value = ("de-energized, line fault reported" if s == "downed_lines" else "de-energized") if out else "energized"
            add("utility-feed", x, y, value, feeder=f"F{int(feeder[y, x]) + 1}")
    rng.shuffle(docs)
    return [{"doc_id": f"{world['town']}-{i:04d}", **d} for i, d in enumerate(docs)]


def where(x: int, y: int, target=None) -> str:
    """Location phrase: absolute, or relative to the block Jev is judging."""
    if target is None:
        return f"Block ({x}, {y})"
    dx, dy = x - target[0], y - target[1]
    if not dx and not dy:
        return "This block"
    parts = []
    if dy:
        parts.append(f"{abs(dy)} block{'s' if abs(dy) > 1 else ''} {'south' if dy > 0 else 'north'}")
    if dx:
        parts.append(f"{abs(dx)} block{'s' if abs(dx) > 1 else ''} {'east' if dx > 0 else 'west'}")
    return "Neighbor " + " and ".join(parts)


def doc_text(doc: dict, target=None, glosses: dict | None = None) -> str:
    src, value = doc["source"], doc["value"]
    gloss = (glosses or {}).get(src, {}).get(value)
    shown = f"{value} ({gloss})" if gloss else value
    loc = where(doc["x"], doc["y"], target)
    if src == "911-call":
        return f'[911-call] {loc}: call type {shown}. Caller: "{doc["transcript"]}"'
    if src == "social-post":
        return (f'[social-post] {loc}: @{doc["handle"]} (verified: {"yes" if doc["verified"] else "no"}): '
                f'"{doc["post"]}" {shown}')
    if src == "311":
        return f'[311] {loc}: {shown}: "{doc["complaint"]}"'
    if src == "city-survey":
        return f"[city-survey] {loc}: FEMA PDA damage level {shown}"
    if src == "fire-dept":
        return f"[fire-dept] {loc}: NFIRS incident type {shown}"
    if src == "pre-storm-map":
        return (f"[pre-storm-map] {loc}: PLUTO land use {shown}; hurricane evacuation zone {doc['evac_zone']}; "
                f"FEMA flood zone {doc['flood_zone']}; elevation {doc['elev']:.1f} m (mapped before the storm)")
    if src == "drone-pass":
        return f"[drone-pass] {loc}: image labels {shown}"
    if src == "utility-feed":
        return f"[utility-feed] {loc}, feeder {doc['feeder']}: {shown}"
    raise ValueError(src)


def counts(world: dict) -> Counter:
    return Counter(s for s in world["state"].flatten() if s is not None)


def build_all() -> dict:
    worlds = {t: generate(t, SEEDS[t]) for t in TOWNS}
    dev = sum((counts(worlds[t]) for t in SPLITS["dev"]), Counter())
    problems = [f"dev has {dev[s]}x {s} (< {MIN_DEV_COUNT})" for s in STATES if dev[s] < MIN_DEV_COUNT]
    problems += [f"{t} has {counts(w)[s]}x {s} (< {MIN_TOWN_COUNT})" for t, w in worlds.items()
                 for s in STATES if counts(w)[s] < MIN_TOWN_COUNT]
    if problems:
        raise AssertionError("coverage assertion failed:\n  " + "\n  ".join(problems))
    for t, w in worlds.items():
        pdir, sdir = STORM_DIR / t, SECRET_DIR / t
        pdir.mkdir(parents=True, exist_ok=True)
        sdir.mkdir(parents=True, exist_ok=True)
        docs = reports(w)
        w["reports"] = docs
        public = {"town": t, "city": w["city"], "w": W, "h": H, "land_blocks": len(w["cells"]),
                  "mask": w["land"].astype(int).tolist(), "land_use": w["land_use"].tolist(),
                  "elev": w["elev"].tolist(), "reports": len(docs),
                  "reports_by_source": dict(Counter(d["source"] for d in docs))}
        (pdir / "town.json").write_text(json.dumps(public), encoding="utf-8")
        with open(pdir / "reports.jsonl", "w", encoding="utf-8") as f:
            for d in docs:
                f.write(json.dumps(d) + "\n")
        (sdir / "truth.json").write_text(json.dumps(
            {"town": t, "seed": w["seed"], "grid": w["state"].tolist(), "params": w["params"]}), encoding="utf-8")
    return worlds
