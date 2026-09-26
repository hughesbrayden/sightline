/* Example scenario data for the Sightline hurricane mockups. Illustrative only: stylized maps, made-up storms and scores. */
(function () {
  var N = 32;

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---- Geography: a stylized 32x32 map per city. true = water. ----
  function nycWater(r, c) {
    if (c <= 1) return true; // Hudson
    var shift = (r >= 10 ? 1 : 0) + (r >= 20 ? 1 : 0);
    var east = 13 + shift, west = 2;
    if (r >= 21) { west = 2 + (r - 21); east = east - (r - 21); }
    var manhattan = c >= west && c <= east;
    var bkWest = 17 + shift;
    var brooklyn = c >= bkWest && r <= 26;
    var redhook = r >= 24 && r <= 29 && c >= bkWest + 1 && c <= bkWest + 8 - (r - 24);
    var gowanus = c === bkWest + 10 && r >= 13 && r <= 25;
    var governors = r >= 29 && r <= 30 && c >= 12 && c <= 15;
    if (gowanus) return true;
    return !(manhattan || brooklyn || redhook || governors);
  }
  function nycPark(r, c) {
    if (r >= 29 && r <= 30 && c >= 12 && c <= 15) return true; // Governors Island
    if (r >= 25 && r <= 26 && c >= 6 && c <= 8) return true;    // Battery Park
    if (c === 18 && r >= 5 && r <= 11) return true;             // Brooklyn Bridge Park
    return false;
  }
  function miamiWater(r, c) {
    if (c >= 29) return true;                     // Atlantic
    if (c >= 18 && c <= 24) return true;          // Biscayne Bay
    if (r === 12 && c <= 17 && c >= 3) return true; // Miami River
    if (c >= 25 && c <= 28 && (r <= 1 || r >= 30)) return true;
    return false;
  }
  function houstonWater(r, c) {
    var b1 = 11 + Math.round(3 * Math.sin(c / 4.5));
    var b2 = 24 + Math.round(2 * Math.sin(c / 3.2 + 1));
    return r === b1 || r === b2 || (c === 20 && r > b1 && r < b2 && r % 1 === 0 && r >= 14 && r <= 20);
  }
  function nolaWater(r, c) {
    if (r <= 4) return true; // Lake Pontchartrain
    var river = 20 + Math.round(7 * Math.sin((r - 8) / 5.5));
    if (r >= 9 && Math.abs(c - river) <= 1) return true;
    if ((c === 8 || c === 14) && r >= 5 && r <= 13) return true; // drainage canals
    return false;
  }

  var CITIES = {
    nyc: { key: 'nyc', name: 'New York', area: 'Lower Manhattan and the Brooklyn waterfront', water: nycWater, park: nycPark,
      hospitals: [[6, 8], [9, 25]], shelters: [[3, 5], [4, 22], [15, 27], [11, 10]] },
    miami: { key: 'miami', name: 'Miami', area: 'Downtown, Brickell and Miami Beach', water: miamiWater, park: function () { return false; },
      hospitals: [[6, 8]], shelters: [[3, 4], [20, 10], [15, 26]] },
    houston: { key: 'houston', name: 'Houston', area: 'Buffalo and Brays Bayou', water: houstonWater, park: function () { return false; },
      hospitals: [[18, 9]], shelters: [[4, 20], [30, 6], [17, 28]] },
    nola: { key: 'nola', name: 'New Orleans', area: 'Mid-City to the Lower Ninth Ward', water: nolaWater, park: function () { return false; },
      hospitals: [[12, 4]], shelters: [[7, 26], [25, 5], [29, 30]] }
  };
  var ORDER = ['nyc', 'miami', 'houston', 'nola'];

  // Storms per city: 3 in sequence. The first is tuned on; later ones are mapped blind first.
  var STORMS = {
    nyc: [
      { name: 'Storm 1', kind: 'Surge', when: 'October', surge: 0.95, rain: 0.2, wind: 0.25, outage: true },
      { name: 'Storm 2', kind: 'Cloudburst', when: 'September', surge: 0.15, rain: 0.95, wind: 0.15 },
      { name: 'Storm 3', kind: 'Tonight', when: 'Now', surge: 0.6, rain: 0.4, wind: 0.85, outage: true }
    ],
    miami: [
      { name: 'Storm 1', kind: 'Surge', when: 'August', surge: 0.9, rain: 0.3, wind: 0.6 },
      { name: 'Storm 2', kind: 'King tide', when: 'October', surge: 0.55, rain: 0.2, wind: 0.1 },
      { name: 'Storm 3', kind: 'Tonight', when: 'Now', surge: 0.7, rain: 0.5, wind: 0.8, outage: true }
    ],
    houston: [
      { name: 'Storm 1', kind: 'Stalled rain', when: 'August', surge: 0.0, rain: 1.0, wind: 0.2 },
      { name: 'Storm 2', kind: 'Derecho', when: 'May', surge: 0.0, rain: 0.3, wind: 0.95, outage: true },
      { name: 'Storm 3', kind: 'Tonight', when: 'Now', surge: 0.0, rain: 0.85, wind: 0.6 }
    ],
    nola: [
      { name: 'Storm 1', kind: 'Levee breach', when: 'August', surge: 0.8, rain: 0.6, wind: 0.5, bowl: true },
      { name: 'Storm 2', kind: 'Cloudburst', when: 'June', surge: 0.1, rain: 0.9, wind: 0.1, bowl: true },
      { name: 'Storm 3', kind: 'Tonight', when: 'Now', surge: 0.6, rain: 0.6, wind: 0.8, outage: true, bowl: true }
    ]
  };

  var cache = {};

  function geo(cityKey) {
    if (cache['g' + cityKey]) return cache['g' + cityKey];
    var city = CITIES[cityKey];
    var water = [], park = [], dist = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var i = r * N + c;
      water[i] = city.water(r, c);
      park[i] = !water[i] && city.park(r, c);
      dist[i] = water[i] ? 0 : 99;
    }
    // BFS distance to water
    var queue = [];
    for (var j = 0; j < N * N; j++) if (water[j]) queue.push(j);
    while (queue.length) {
      var k = queue.shift(), kr = Math.floor(k / N), kc = k % N;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nr = kr + d[0], nc = kc + d[1];
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) return;
        var n = nr * N + nc;
        if (dist[n] > dist[k] + 1) { dist[n] = dist[k] + 1; queue.push(n); }
      });
    }
    return (cache['g' + cityKey] = { water: water, park: park, dist: dist });
  }

  function blobs(R, count) {
    var out = [];
    for (var b = 0; b < count; b++) out.push({ r: R() * N, c: R() * N, s: 2 + R() * 3 });
    return function (r, c) {
      var v = 0;
      out.forEach(function (b) { var d2 = (r - b.r) * (r - b.r) + (c - b.c) * (c - b.c); v = Math.max(v, Math.exp(-d2 / (2 * b.s * b.s))); });
      return v;
    };
  }

  function truth(cityKey, stormIndex) {
    var key = 't' + cityKey + stormIndex;
    if (cache[key]) return cache[key];
    var city = CITIES[cityKey], storm = STORMS[cityKey][stormIndex], g = geo(cityKey);
    var R = rng(hash(key));
    var rain = blobs(R, 6);
    var swath = { r0: R() * 8, c0: R() * N, r1: 24 + R() * 8, c1: R() * N };
    var cells = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var i = r * N + c;
      if (g.water[i]) { cells.push('water'); continue; }
      if (g.park[i]) { cells.push('park'); continue; }
      var d = g.dist[i];
      var surgeHome = storm.surge * (d === 1 ? 0.8 : d === 2 ? 0.5 : d === 3 ? 0.18 : 0);
      var surgeStreet = storm.surge * (d <= 2 ? 0.15 : d <= 4 ? 0.4 : d <= 5 ? 0.15 : 0);
      var low = storm.bowl ? Math.max(0, 1 - Math.abs(r - 18) / 9) * Math.max(0, 1 - Math.abs(c - 12) / 12) : 0;
      var rv = rain(r, c) * storm.rain + low * storm.rain * 0.6;
      var pHome = Math.min(0.95, surgeHome + rv * 0.55 + (storm.bowl ? low * storm.surge * 0.5 : 0));
      var pStreet = Math.min(0.9, surgeStreet + rv * 0.35);
      // wind swath distance
      var ax = swath.c1 - swath.c0, ay = swath.r1 - swath.r0;
      var t = Math.max(0, Math.min(1, ((c - swath.c0) * ax + (r - swath.r0) * ay) / (ax * ax + ay * ay)));
      var wd = Math.hypot(c - (swath.c0 + t * ax), r - (swath.r0 + t * ay));
      var w = storm.wind * Math.max(0, 1 - wd / 4);
      var x = R();
      var s;
      if (x < pHome) s = (d <= 1 && storm.surge > 0.8 && R() < 0.12) ? (R() < 0.5 ? 'destroyed' : 'major') : 'home';
      else if (x < pHome + pStreet) s = 'street';
      else if (R() < w * 0.55) s = R() < 0.18 ? 'major' : (R() < 0.25 ? 'road' : 'wind');
      else if (R() < 0.07 + storm.wind * 0.05) s = R() < 0.5 ? 'minor' : 'road';
      else s = 'intact';
      if (s === 'intact' && storm.outage && (d <= 4 || r >= 18) && R() < 0.35) s = 'power';
      cells.push(s);
    }
    // fires: a couple, near flooding or wind
    for (var f = 0; f < 2; f++) {
      var fi = Math.floor(R() * N * N);
      if (cells[fi] === 'home' || cells[fi] === 'major' || cells[fi] === 'wind') cells[fi] = 'fire';
    }
    city.hospitals.forEach(function (p) { var i = p[0] * N + p[1]; if (cells[i] !== 'water') cells[i] = 'hospital'; });
    city.shelters.forEach(function (p) { var i = p[0] * N + p[1]; if (cells[i] !== 'water') cells[i] = 'shelter'; });
    return (cache[key] = cells);
  }

  var CONFUSE = {
    intact: ['minor', 'power', 'street'], minor: ['intact', 'wind', 'road'], street: ['home', 'intact', 'minor'],
    home: ['street', 'major', 'intact'], wind: ['minor', 'major', 'road'], major: ['wind', 'destroyed', 'home'],
    destroyed: ['major', 'home'], fire: ['major', 'wind'], road: ['minor', 'intact'], power: ['intact', 'minor'],
    shelter: ['intact'], hospital: ['intact', 'shelter']
  };
  var ALL = ['intact', 'minor', 'street', 'home', 'wind', 'major', 'destroyed', 'fire', 'road', 'power', 'shelter', 'hospital'];

  // Jev's map for a given policy quality (0..1). Deterministic per seed.
  function guess(cityKey, stormIndex, quality, seed) {
    var key = 'j' + cityKey + stormIndex + ':' + quality + ':' + seed;
    if (cache[key]) return cache[key];
    var t = truth(cityKey, stormIndex), R = rng(hash(key));
    var cells = [], conf = [];
    t.forEach(function (s) {
      if (s === 'water' || s === 'park') { cells.push(s); conf.push(1); return; }
      if (R() < quality) { cells.push(s); conf.push(Math.min(1, 0.5 + 0.35 * quality + 0.2 * R())); return; }
      var pick = R() < 0.5 + quality * 0.4 ? CONFUSE[s][Math.floor(R() * CONFUSE[s].length)] : ALL[Math.floor(R() * ALL.length)];
      cells.push(pick);
      conf.push(0.12 + 0.4 * R());
    });
    return (cache[key] = { cells: cells, conf: conf });
  }

  var CRIT = { home: 1, major: 1, destroyed: 1, fire: 1 };
  function score(t, gcells) {
    var right = 0, total = 0, critTotal = 0, critFound = 0;
    t.forEach(function (s, i) {
      if (s === 'water' || s === 'park') return;
      total++;
      if (gcells[i] === s) right++;
      if (CRIT[s]) { critTotal++; if (CRIT[gcells[i]]) critFound++; }
    });
    return { acc: right / total, right: right, total: total, critTotal: critTotal, critFound: critFound };
  }

  // Policy quality by stage. Tuning runs on a storm, then the blind first look at the next storm.
  var PLAN = {
    nyc: {
      runs: [0.30, 0.44, 0.40, 0.57, 0.66, 0.74, null, 0.83],
      blind: [null, 0.70, 0.82],   // blind first look at storms 2 and 3
      tuned: [0.83, 0.88, null]
    },
    miami: { runs: [0.48, 0.58, 0.66, 0.73, 0.79, null, 0.82, 0.84], blind: [null, 0.74, 0.8], tuned: [0.84, 0.87, null] },
    houston: { runs: [0.55, 0.62, 0.70, 0.66, 0.77, 0.81, 0.83, null], blind: [null, 0.76, 0.81], tuned: [0.83, 0.86, null] },
    nola: { runs: [0.6, 0.67, 0.74, 0.79, null, 0.82, 0.85, 0.86], blind: [null, 0.78, 0.83], tuned: [0.86, 0.88, null] }
  };

  // Curator log for NYC storm 1 (one entry per scored run).
  var RUNS_NYC = [
    { run: 1, status: 'accepted', hyp: 'Baseline: the 12 reports nearest the block by vector search.', ops: [] },
    { run: 2, status: 'accepted', hyp: 'The utility outage feed looks mirrored. Swap its latitude and longitude.', ops: [{ knob: 'correct', op: 'change', text: 'Utility feed: swap lat and long.' }], predicted: 0.08 },
    { run: 3, status: 'rejected', hyp: 'Trust the city survey over the fire department; its scale is more detailed.', ops: [{ knob: 'weight', op: 'change', text: 'City survey weight 2, fire department 0.5.' }], predicted: 0.06, trap: true },
    { run: 4, status: 'accepted', hyp: 'The two agencies use different codes. Translate both to one: FEMA "Major" and NFIRS "363" both mean water inside homes.', ops: [{ knob: 'gloss', op: 'add', text: 'Map both agencies\' scales to the 12 states.' }], predicted: 0.1 },
    { run: 5, status: 'accepted', hyp: 'Three social accounts post confident collapse reports that never match drone passes. Drop them.', ops: [{ knob: 'exclude', op: 'add', text: 'Drop accounts R2, R5 and R7.' }], predicted: 0.07 },
    { run: 6, status: 'accepted', hyp: 'Flooding spreads across block edges. Add how many blocks within 200 m report water.', ops: [{ knob: 'related', op: 'add', text: 'Neighbor summary: $geoNear, 200 m, water reports only.' }], predicted: 0.08 },
    { run: 7, status: 'skipped', hyp: 'Weight the city survey higher than the fire department.', ops: [], note: 'Too close to run 3, which failed. Not scored.' },
    { run: 8, status: 'accepted', hyp: 'Drone passes are the most reliable. Put them first when a block has one.', ops: [{ knob: 'format', op: 'change', text: 'Order: drone, 911, surveys, social.' }], predicted: 0.05 }
  ];

  // Lessons the harness carries to a new city (memory, vector search).
  var LESSONS = [
    { text: 'New feeds: check coordinate order before trusting them.', from: 'NYC run 2' },
    { text: 'Agencies rate damage on different scales. Translate before comparing.', from: 'NYC run 4' },
    { text: 'Confident accounts that never match drone passes are rumor. Drop them.', from: 'NYC run 5' },
    { text: 'Water spreads across block edges; wind damage doesn\'t. Summarize neighbors for flooding only.', from: 'NYC run 6' },
    { text: 'Bayous flood along their banks, not the coast. Measure distance to any water.', from: 'Houston run 3' }
  ];

  function where(r, c) {
    if (c <= 15) return r >= 18 ? 'Financial District' : r >= 9 ? 'Two Bridges' : 'Lower East Side';
    return r >= 23 ? 'Red Hook' : r >= 13 ? 'Cobble Hill' : 'DUMBO';
  }

  // Everything the demo-flow storyboards need, for NYC, tonight = Storm 3.
  function flow() {
    if (cache.flow) return cache.flow;
    var K = 2, t = truth('nyc', K), g = geo('nyc'), R = rng(hash('flow'));
    var calm = t.map(function (s) { return s === 'water' || s === 'park' ? s : 'intact'; });

    function find(test) {
      for (var i = 0; i < t.length; i++) { var r = Math.floor(i / N), c = i % N; if (test(t[i], r, c, g.dist[i])) return i; }
      return -1;
    }
    var mRumor = find(function (s, r, c, d) { return s === 'intact' && c >= 22 && r >= 13 && r <= 18 && d >= 3; });
    var mSwap = find(function (s, r, c, d) { return s === 'intact' && c >= 8 && c <= 12 && r >= 10 && r <= 14 && d >= 2; });
    var mScale = find(function (s, r, c, d) { return s === 'home' && c >= 19 && r >= 23; });
    var mDrift = find(function (s, r, c, d) { return s === 'home' && c <= 12 && r >= 14 && r <= 20; });

    // Zero-shot: plain retrieval, no harness. The four misreads are its most confident mistakes.
    var z0 = guess('nyc', K, 0.30, 7);
    var zero = { cells: z0.cells.slice(), conf: z0.conf.slice() };
    [[mRumor, 'destroyed'], [mSwap, 'power'], [mScale, 'minor'], [mDrift, 'street']].forEach(function (p) {
      if (p[0] >= 0) { zero.cells[p[0]] = p[1]; zero.conf[p[0]] = 0.93; }
    });
    var ev = guess('nyc', K, PLAN.nyc.blind[K], 102);
    var evolved = { cells: ev.cells.slice(), conf: ev.conf.slice() };
    [mRumor, mSwap, mScale, mDrift].forEach(function (i) { if (i >= 0) { evolved.cells[i] = t[i]; evolved.conf[i] = 0.86; } });

    var CRIT = { home: 1, major: 1, destroyed: 1, fire: 1 };
    function triage(m) {
      var list = [];
      m.cells.forEach(function (s, i) { if (CRIT[s]) list.push({ i: i, s: s, conf: m.conf[i] }); });
      list.sort(function (a, b) { return b.conf - a.conf; });
      var falseAlarms = list.filter(function (x) { return !CRIT[t[x.i]]; }).length;
      return { flagged: list.length, falseAlarms: falseAlarms, top: list.slice(0, 6).map(function (x) {
        var r = Math.floor(x.i / N), c = x.i % N;
        return { i: x.i, block: (r + 1) + '-' + (c + 1), where: where(r, c), state: x.s, conf: x.conf.toFixed(2) };
      }) };
    }

    // Incoming reports as pins. Utility pins use swapped coordinates, so many land in the water.
    var pins = [];
    t.forEach(function (s, i) {
      var r = Math.floor(i / N), c = i % N;
      if (s === 'water' || s === 'park') return;
      var x = R();
      if (CRIT[s] && x < 0.22) pins.push({ r: r, c: c, kind: 'call' });
      else if (s === 'street' && x < 0.12) pins.push({ r: r, c: c, kind: 'ticket' });
      else if (s === 'power' && x < 0.25) pins.push({ r: c, c: r, kind: 'utility', odd: g.water[c * N + r] });
      else if (x < 0.018) pins.push({ r: r, c: c, kind: 'drone' });
      else if (x < 0.03) pins.push({ r: r, c: c, kind: 'social' });
    });
    if (mRumor >= 0) pins.push({ r: Math.floor(mRumor / N), c: mRumor % N, kind: 'social', odd: true });

    var feed = [
      { time: '23:41', src: '911', text: 'Water coming in under the door, ground floor. Near Van Brunt St.' },
      { time: '23:42', src: 'Social', text: 'WHOLE BLOCK COLLAPSED on Court St, confirmed!!', odd: true },
      { time: '23:42', src: 'Utility', text: 'Outage at (-74.004, 40.708): lands in the East River.', odd: true },
      { time: '23:43', src: '311', text: 'Street flooded, cars floating, Water St.' },
      { time: '23:44', src: 'Survey', text: 'FEMA survey: damage level Major, Van Brunt St.' },
      { time: '23:44', src: 'Drone', text: 'Pass 12: standing water to first-floor windows.' }
    ];

    var misreads = [
      { n: 1, i: mRumor, title: 'A rumor taken literally', jev: 'Destroyed', truth: 'Intact',
        text: 'A viral post said the whole block collapsed. No drone pass or 911 call backed it up.' },
      { n: 2, i: mSwap, title: 'Coordinates read as written', jev: 'Power out', truth: 'Intact',
        text: 'The utility feed swaps latitude and longitude. Outages landed in the river and on the wrong blocks.' },
      { n: 3, i: mScale, title: 'A damage scale read at face value', jev: 'Minor damage', truth: 'Homes flooded',
        text: 'On the FEMA survey, "Major" means water inside homes, not structural collapse.' },
      { n: 4, i: mDrift, title: 'A 911 location taken as exact', jev: 'Street flooded', truth: 'Homes flooded',
        text: 'Caller locations drift up to a block. The flooded homes next door went unmatched.' }
    ].map(function (m) { m.r = Math.floor(m.i / N); m.c = m.i % N; m.where = where(m.r, m.c); return m; });

    var runs = RUNS_NYC.map(function (run, j) {
      var q = PLAN.nyc.runs[j];
      var m = q == null ? null : guess('nyc', 0, q, j + 1);
      return { run: run.run, status: run.status, hyp: run.hyp, trap: !!run.trap,
        acc: m ? score(truth('nyc', 0), m.cells).acc : null, cells: m ? m.cells : null, conf: m ? m.conf : null };
    });

    var cities = ORDER.map(function (key) {
      var gm = guess(key, 2, PLAN[key].blind[2], 102);
      var s = score(truth(key, 2), gm.cells);
      var start = score(truth(key, 0), guess(key, 0, PLAN[key].runs[0], 1).cells).acc;
      return { key: key, name: CITIES[key].name, area: CITIES[key].area, cells: gm.cells, conf: gm.conf, acc: s.acc, critFound: s.critFound, critTotal: s.critTotal, start: start };
    });

    // Evolution: generation 0 is the unevolved harness. Fitness = backtest on past storms;
    // selection = the gate on a validation town (a change is kept only if validation rises).
    var GEN_DEF = [
      { hyp: 'Generation 0: the 12 reports nearest each block, taken at face value.', q: 0.30, valOff: -0.013 },
      { hyp: 'Outage reports land in the river. The utility feed must have latitude and longitude swapped.', rule: 'Swap the utility feed back to latitude, longitude.', predicted: 0.08, q: 0.44, valOff: -0.022 },
      { hyp: 'The city survey is more detailed than the fire department’s. Trust it more.', predicted: 0.06, q: 0.55, val: 0.418, trap: true },
      { hyp: 'FEMA "Major" and NFIRS "363" both mean water inside homes. Translate both agencies’ codes before Jev reads them.', rule: 'Translate the fire-department codes and the FEMA damage levels.', predicted: 0.10, q: 0.57, valOff: -0.025 },
      { hyp: 'Three "verified" accounts post collapses no drone pass ever confirms. They’re rumors; drop them.', rule: 'Drop accounts that never match a drone pass.', predicted: 0.07, q: 0.66, valOff: -0.028 },
      { hyp: 'Flooding spreads across block edges. Add neighbors’ flood reports within 200 m.', rule: 'Pull neighbors’ flood reports only, within 200 m.', predicted: 0.08, q: 0.74, valOff: -0.028 },
      { hyp: 'Weight the city survey above the fire department.', skippedLike: 2 },
      { hyp: '911 locations drift up to a block. Match calls to blocks within 150 m, not exact addresses.', rule: 'Match 911 calls within 150 m.', predicted: 0.05, q: 0.83, valOff: -0.037 }
    ];
    var t0 = truth('nyc', 0), bestVal = null, bestGen = null;
    var gens = GEN_DEF.map(function (d, g) {
      var out = { gen: g, hyp: d.hyp, rule: d.rule || null, predicted: d.predicted == null ? null : d.predicted, trap: !!d.trap };
      if (d.skippedLike != null) {
        return Object.assign(out, { status: 'skipped', parent: bestGen, note: 'Too close to generation ' + d.skippedLike + ', which failed. Not scored.' });
      }
      var m = guess('nyc', 0, d.q, 300 + g);
      var dev = score(t0, m.cells).acc, val = d.val != null ? d.val : dev + d.valOff;
      var kept = bestVal == null || val > bestVal;
      Object.assign(out, { cells: m.cells, conf: m.conf, dev: dev, val: val, parent: bestGen,
        valDelta: bestVal == null ? null : val - bestVal, status: g === 0 ? 'baseline' : kept ? 'kept' : 'rejected' });
      if (kept) { bestVal = val; bestGen = g; }
      return out;
    });

    var heldTown = cities[1];

    return (cache.flow = {
      gens: gens, origin: { devFrom: 0.46, devTo: 0.93, heldFrom: 0.50, heldTo: 0.45 },
      heldTown: heldTown,
      calm: calm, truth: t, pins: pins, feed: feed, misreads: misreads, runs: runs, cities: cities,
      pastTruth: truth('nyc', 0),
      zero: Object.assign(zero, score(t, zero.cells), triage(zero)),
      evolved: Object.assign(evolved, score(t, evolved.cells), triage(evolved)),
      counts: { calls: 1184, tickets: 2410, drone: 38, social: 6120, utility: 412 }
    });
  }

  window.SightlineDemo = {
    N: N, CITIES: CITIES, ORDER: ORDER, STORMS: STORMS, PLAN: PLAN, RUNS_NYC: RUNS_NYC, LESSONS: LESSONS,
    truth: truth, guess: guess, score: score, geo: geo, flow: flow, where: where
  };
})();
