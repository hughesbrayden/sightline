// Live data for the Sightline demo: builds the same `flow()` shape as scenario.js from the dashboard API
// (the recorded harness run in MongoDB). Every number, map, report and rule shown comes from the real loop.
//
// Honesty rules baked in:
// - "Tonight" is the held-out NYC storm (NYC1) once it has been scored; until then the demo uses the past NYC
//   storm (NYC0, the validation storm) and says so on screen.
// - The assessment is only drawn where the scorer has published it.
(function () {
  var N = 32;
  // Engine states -> design-system states (severity palette + service glyphs).
  var TO_DS = {
    intact: 'intact', flooded_street: 'street', flooded_homes: 'home', roof_damage: 'wind', collapsed: 'destroyed',
    fire: 'fire', road_blocked: 'road', power_out: 'power', downed_lines: 'power', shelter_open: 'shelter',
    hospital_ok: 'hospital', hospital_down: 'major'
  };
  var LIFE = { collapsed: 1, flooded_homes: 1, fire: 1, hospital_down: 1 };
  var NICE = {
    intact: 'Intact', flooded_street: 'Street flooded', flooded_homes: 'Homes flooded', roof_damage: 'Roof damage',
    collapsed: 'Collapsed', fire: 'Fire', road_blocked: 'Road blocked', power_out: 'Power out',
    downed_lines: 'Lines down', shelter_open: 'Shelter open', hospital_ok: 'Hospital operating',
    hospital_down: 'Hospital down'
  };
  var CITY = { MIA: 'Miami', HOU: 'Houston', NOL: 'New Orleans', NYC: 'New York' };
  var PIN_OF = { '911-call': 'call', '311': 'ticket', 'drone-pass': 'drone', 'social-post': 'social', 'utility-feed': 'utility' };
  var SRC_LABEL = { '911-call': '911', '311': '311', 'drone-pass': 'Drone', 'social-post': 'Social', 'utility-feed': 'Utility',
    'city-survey': 'Survey', 'fire-dept': 'Fire dept.' };
  var SEVERE_TAGS = { '#collapse': 1, '#fire': 1, '#flooding': 1 };

  // Every request goes through here. If the live API is unreachable (cluster paused, credentials rotated),
  // fall back to the snapshot of the recorded run that ships next to the page, so the demo always works.
  var snapshot = null, usedSnapshot = false;
  function fromSnapshot(path) {
    snapshot = snapshot || fetch('/snapshot.json').then(function (r) { if (!r.ok) throw new Error('no snapshot'); return r.json(); });
    return snapshot.then(function (snap) {
      var key = path;
      if (!(key in snap) && key.indexOf('/api/state') === 0) {  // no run named: the snapshot's recorded run
        key = Object.keys(snap).filter(function (k) { return k.indexOf('/api/state') === 0; })[0];
      }
      if (!(key in snap)) throw new Error(path + ' is not in the snapshot');
      usedSnapshot = true;
      return snap[key];
    });
  }
  function api(base, path) {
    var live = window.SIGHTLINE_FORCE_SNAPSHOT ? Promise.reject(new Error('forced'))
      : fetch(base + path).then(function (r) {
        if (!r.ok && r.status !== 404) throw new Error(path + ': HTTP ' + r.status);
        return r.json();
      });
    return live.catch(function (e) { return fromSnapshot(path).catch(function () { throw e; }); });
  }

  // A map response -> row-major arrays the DamageMap understands.
  function grid(m) {
    var cells = [], conf = [], truth = [], eng = [], engTruth = [], lines = [];
    for (var i = 0; i < N * N; i++) {
      var r = Math.floor(i / N), c = i % N, land = m.mask[r][c] === 1;
      cells.push(land ? 'intact' : 'water'); conf.push(1); truth.push(land ? null : 'water');
      eng.push(null); engTruth.push(null);
    }
    (m.cells || []).forEach(function (b) {
      var i = b.y * N + b.x;
      cells[i] = TO_DS[b.pick] || 'intact'; conf[i] = b.conf; eng[i] = b.pick;
      if (b.truth) { truth[i] = TO_DS[b.truth]; engTruth[i] = b.truth; }
      if (b.lines) lines[i] = b.lines;
    });
    return { cells: cells, conf: conf, truth: truth, eng: eng, engTruth: engTruth, lines: lines, n: (m.cells || []).length,
             hasTruth: (m.cells || []).some(function (b) { return !!b.truth; }) };
  }

  // Scores on the engine's own states (plain accuracy, life-safety found, crews to the wrong block).
  function score(g) {
    var right = 0, total = 0, critTotal = 0, critFound = 0, flagged = [], falseAlarms = 0;
    for (var i = 0; i < N * N; i++) {
      var p = g.eng[i], t = g.engTruth[i];
      if (!p) continue;
      if (LIFE[p]) flagged.push(i);
      if (!t) continue;
      total++; if (p === t) right++;
      if (LIFE[t]) { critTotal++; if (p === t) critFound++; }
      if (LIFE[p] && t === 'intact') falseAlarms++;  // the scorer's false_dispatches: life-safety call on an intact block
    }
    return { acc: total ? right / total : null, critTotal: critTotal, critFound: critFound, falseAlarms: falseAlarms,
             flagged: flagged.length, flaggedIdx: flagged };
  }

  function triage(g, where) {
    var list = g.eng.map(function (p, i) { return p && LIFE[p] ? { i: i, s: p, conf: g.conf[i] } : null; })
      .filter(Boolean).sort(function (a, b) { return b.conf - a.conf; });
    return list.slice(0, 6).map(function (x) {
      var r = Math.floor(x.i / N), c = x.i % N;
      return { i: x.i, block: (r + 1) + '-' + (c + 1), where: where(r, c), state: TO_DS[x.s], conf: x.conf.toFixed(2) };
    });
  }

  function clock(hour) {  // landfall Tuesday 23:44
    var mins = 23 * 60 + 44 + Math.round(hour * 60), day = mins >= 24 * 60 ? 'Wed ' : '';
    mins %= 24 * 60;
    return day + String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }

  // Plain-language rule for what a kept generation added on top of its parent's genome.
  function describe(op) {
    var src = (op.sources || (op.source ? [op.source] : [])).join(' and ');
    if (op.op === 'exclude_source') return 'Ignore ' + src + ' reports.';
    if (op.op === 'gloss_value') {
      var keys = Object.keys(op.map || {});
      return 'Translate ' + src + ' codes before Jev reads them (' + keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '') + ').';
    }
    if (op.op === 'include_own') return "Show up to " + (op.k || 3) + " of the block's own reports" + (src ? ' from ' + src : '') + '.';
    if (op.op === 'include_related') {
      var what = op.only_values ? 'only ' + op.only_values.slice(0, 3).join(', ') + (op.only_values.length > 3 ? '…' : '') + ' reports'
        : (src ? src + ' reports' : 'reports');
      return (op.show === 'profile' ? 'Summarize ' : 'List ') + what + ' from blocks within ' + (op.radius || 1) + (op.radius > 1 ? ' blocks' : ' block') + '.';
    }
    return op.op;
  }
  function rulesFor(ops, parentOps) {
    var had = {}; (parentOps || []).forEach(function (o) { had[JSON.stringify(o)] = 1; });
    return ops.filter(function (o) { return !had[JSON.stringify(o)]; }).map(describe);
  }

  function predicted(text) {
    var m = /([+-]?\d+(?:\.\d+)?)\s*(?:-\s*\d+(?:\.\d+)?\s*)?(?:pp|points?|pts|%)/i.exec(text || '');
    return m ? Math.abs(parseFloat(m[1])) / 100 : null;
  }

  // Why generation 0 got a block wrong, read from the exact lines it saw: quote the line that points at Jev's
  // (wrong) answer, and name the habit behind it.
  var POINTS_TO = {
    // report vocabularies follow their real-world counterparts: CAD call types, NYC 311, FEMA PDA levels,
    // NFIRS incident types, PLUTO land use, RescueNet / FloodNet image labels; each also keeps the
    // pre-cutover codes (WATER-RESCUE, Category A-E, Minor/Major/Destroyed) so older recorded runs still read right
    flooded_homes: /WATER RESCUE|Building-Flooded|#flooding|damage level Major|Sewer Backup|incident type 363|second floor|living room|WATER-RESCUE|water above door|Category B/i,
    flooded_street: /FLOODED ROADWAY|Road-Flooded|Street Flooding|#flooding|damage level Affected|FLOODED-ROADWAY|water in street|Category D/i,
    collapsed: /BUILDING COLLAPSE|Total-Destruction|#collapse|damage level Destroyed|incident type 461|Structural Stability|came down|flattened|STRUCTURE-COLLAPSE|structure down|Category A|severity Destroyed/i,
    fire: /FIRE:|smoke|flames|#fire|burn|incident type 111|Major-Damage|dispatch code FIRE|severity Major/i,
    roof_damage: /ASSIST CIVILIAN - NON-MEDICAL|roof|damage level Minor|Minor-Damage|Debris - Falling|shingles|STRUCTURE-DAMAGE|Category C|Building Damage/i,
    power_out: /UTILITY EMERGENCY - ELECTRIC|de-energized|Street Light Out|#poweroutage|no power|UTILITY-OUTAGE|Power Outage/i,
    downed_lines: /UTILITY EMERGENCY - ELECTRIC|line fault|incident type 444|Tree, Road-Clear|#powerlines|WIRES-DOWN|Downed Wire|leaning poles/i,
    road_blocked: /TREE DOWN|Tree Has Fallen|Road-Blocked|#roadclosed|incident type 813|ROAD-OBSTRUCTION|Blocked Road|debris across|severity Minor/i,
    hospital_down: /MEDICAL - ASSIST CIVILIAN|hospital|turning ambulances|MEDICAL-FACILITY|hospital lot flooded/i,
    intact: /UNDEFINED EMERGENCY|Building-No-Damage|#safe|damage level Affected|energized|HEATING|Loud Music|WELFARE-CHECK|no visible damage|Category E/i
  };
  function misreadTitle(lines, x, y, pick) {
    var recs = (lines || []).slice(2).map(function (l) { return l.replace(/^- /, ''); });
    var own = 'Block (' + x + ', ' + y + ')', re = POINTS_TO[pick] || /./;
    var hits = recs.filter(function (l) { return re.test(l); });
    var find = function (test) { return hits.filter(test)[0]; };
    var h;
    if ((h = find(function (l) { return /^\[social-post\].*verified: yes/.test(l); }))) return ['A "verified" rumor taken literally', h];
    if ((h = find(function (l) { return /^\[city-survey\].*damage level (Destroyed|Major|Minor|Affected|Inaccessible)$/.test(l) && l.indexOf(own) >= 0; }))) return ["FEMA's damage scale read at face value", h];
    if ((h = find(function (l) { return /^\[fire-dept\].*incident type \d+$/.test(l) && l.indexOf(own) >= 0; }))) return ["A fire-department incident code read at face value", h];
    if ((h = find(function (l) { return /^\[city-survey\].*Category [A-E]$/.test(l) && l.indexOf(own) >= 0; }))) return ['A damage scale read at face value', h];
    if ((h = find(function (l) { return /^\[fire-dept\].*severity (Minor|Major|Destroyed)$/.test(l) && l.indexOf(own) >= 0; }))) return ["A second agency's scale read at face value", h];
    if ((h = find(function (l) { return /^\[311\].*(HEATING|Noise - Residential)/.test(l); }))) return ['A routine 311 request read as storm damage', h];
    if ((h = find(function (l) { return /^\[911-call\]/.test(l) && l.indexOf(own) < 0; }))) return ["A neighbor's 911 call taken as this block's", h];
    if ((h = find(function (l) { return /^\[utility-feed\].*de-energized/.test(l); }))) return ['A feeder-wide outage read as the whole story', h];
    if ((h = find(function (l) { return /^\[[^\]]+\] Block/.test(l) && l.indexOf(own) < 0; }))) return ["A neighbor's report taken as this block's", h];
    if ((h = find(function (l) { return /^\[profile/.test(l); }))) return ['A neighborhood summary outweighed the block', h];
    if (hits.length) return ['A report taken at face value', hits[0]];
    return ['Too little evidence on the block', recs[0] || ''];
  }

  window.SightlineLive = {
    load: function (base, run) {
      base = base || '';
      return api(base, '/api/state' + (run ? '?run=' + encodeURIComponent(run) : '')).then(function (st) {
        run = st.run.id;
        var best = st.run.best_gen;
        var scored = st.gens.filter(function (g) { return g.dev != null; });
        var heldNYC = (st.heldout || []).some(function (h) { return h.town === 'NYC1'; });
        var night = heldNYC ? 'NYC1' : 'NYC0';
        var backtest = 'MIA1';
        var genNight = heldNYC ? null : 0;  // tonight's gen-0 map exists only if the baseline was also scored once
        var q = function (gen, town) { return '/api/map?run=' + run + '&gen=' + gen + '&town=' + town; };
        var jobs = [api(base, q(0, night) + '&lines=1'), api(base, q(best, night)), api(base, '/api/reports?town=' + night + '&until_hour=6')];
        scored.forEach(function (g) { jobs.push(api(base, q(g.gen, backtest))); });
        var cityTowns = ['MIA2', 'HOU2', 'NOL2'].filter(function (t) { return (st.heldout || []).some(function (h) { return h.town === t; }); });
        cityTowns.forEach(function (t) { jobs.push(api(base, q(best, t))); });
        return Promise.all(jobs).then(function (res) {
          var D = window.SightlineDemo, where = D.where;
          var zero = grid(res[0]), evolved = grid(res[1]), reports = res[2].reports || [];
          var back = {}; scored.forEach(function (g, k) { back[g.gen] = grid(res[3 + k]); });
          var cityMaps = res.slice(3 + scored.length).map(grid);
          var truth = zero.hasTruth ? zero.truth : evolved.truth;
          var calm = zero.cells.map(function (c) { return c === 'water' ? 'water' : 'intact'; });

          // ---- generations (the recorded lineage) ----
          var bestVal = null, bestGen = null, prevOps = {};
          var gens = st.gens.filter(function (g) { return g.status !== 'running'; }).map(function (g) {
            var out = { gen: g.gen, hyp: g.hypothesis || '', predicted: predicted(g.prediction), parent: bestGen, rule: null, trace: g.trace_url || null };
            if (g.dev == null) {
              return Object.assign(out, { status: 'skipped', memory: g.status === 'skipped',
                note: g.status === 'skipped' ? (g.note || 'Too close to an idea that already failed. Not scored.')
                  : 'The curator returned no valid policy this generation. Not scored.' });
            }
            var kept = g.gen === 0 || g.status === 'accepted';
            var m = back[g.gen];
            Object.assign(out, { cells: m.cells, conf: m.conf, dev: g.dev, val: g.val,
              valDelta: bestVal == null ? null : g.val - bestVal,
              status: g.gen === 0 ? 'baseline' : kept ? 'kept' : 'rejected' });
            if (kept && g.gen > 0) out.rules = rulesFor(g.ops, prevOps[bestGen]);
            prevOps[g.gen] = g.ops;
            if (kept) { bestVal = g.val; bestGen = g.gen; }
            return out;
          });
          gens.forEach(function (G) { if (G.rules && G.rules.length) G.rule = G.rules.join(' '); });

          // ---- reports: pins, feed, counts ----
          var counts = { calls: 0, tickets: 0, drone: 0, social: 0, utility: 0, total: reports.length };
          var pins = [], feed = [];
          reports.forEach(function (rep) {
            var kind = PIN_OF[rep.source];
            if (kind === 'call') counts.calls++; else if (kind === 'ticket') counts.tickets++;
            else if (kind === 'drone') counts.drone++; else if (kind === 'social') counts.social++;
            else if (kind === 'utility') counts.utility++;
            var viral = rep.source === 'social-post' && rep.verified && SEVERE_TAGS[rep.value];
            if (kind && (kind !== 'utility' || rep.value !== 'energized')) pins.push({ r: rep.y, c: rep.x, kind: kind, odd: !!viral });
            if (rep.source !== 'utility-feed' && (feed.length < 40)) {
              var text = rep.text.replace(/^\[[^\]]+\] Block \((\d+), (\d+)\)[:,]?\s*/, function (_, x, y) { return where(+y, +x) + ': '; });
              feed.push({ time: clock(rep.hour), src: SRC_LABEL[rep.source] || rep.source, text: text, odd: !!viral });
            }
          });

          // ---- generation 0's four most confident, most distinct mistakes on this night ----
          var wrong = [];
          zero.eng.forEach(function (p, i) {
            var t = zero.engTruth[i];
            if (p && t && p !== t && (LIFE[p] || LIFE[t])) wrong.push({ i: i, p: p, t: t, conf: zero.conf[i] });
          });
          wrong.sort(function (a, b) { return b.conf - a.conf; });
          var cands = [], seen = {};
          wrong.forEach(function (w) { var k = w.p + '>' + w.t; if (cands.length < 16 && !seen[k]) { seen[k] = 1; cands.push(w); } });
          wrong.forEach(function (w) { if (cands.length < 16 && cands.indexOf(w) < 0) cands.push(w); });
          var blockJobs = cands.map(function (w) {
            return api(base, '/api/block?run=' + run + '&gen=0&town=' + night + '&x=' + (w.i % N) + '&y=' + Math.floor(w.i / N));
          });
          return Promise.all(blockJobs).then(function (all) {
            var picked = [], blocks = [], titles = {};
            cands.forEach(function (w, k) {  // most confident first, one per cause, then fill
              var t = misreadTitle(all[k].lines, w.i % N, Math.floor(w.i / N), w.p)[0];
              if (picked.length < 4 && !titles[t]) { titles[t] = 1; picked.push(w); blocks.push(all[k]); }
            });
            cands.forEach(function (w, k) { if (picked.length < 4 && picked.indexOf(w) < 0) { picked.push(w); blocks.push(all[k]); } });
            var misreads = picked.map(function (w, k) {
              var r = Math.floor(w.i / N), c = w.i % N, why = misreadTitle(blocks[k].lines, c, r, w.p);
              var fixedBy = null;
              gens.forEach(function (G) {  // first kept generation whose map of this night gets it right
                if (fixedBy == null && G.status === 'kept' && evolved.eng[w.i] === w.t) fixedBy = best;
              });
              return { n: k + 1, i: w.i, r: r, c: c, where: where(r, c), title: why[0],
                text: 'Jev read: ' + why[1].replace(/^\[([^\]]+)\] Block \((\d+), (\d+)\)[:,]?\s*/, function (_, src, x, y) {
                  return src + (+x === c && +y === r ? ' on this block' : ' at ' + where(+y, +x) + ' block ' + (+y + 1) + '-' + (+x + 1)) + ': ';
                }),
                jev: NICE[w.p], truth: NICE[w.t], fixedBy: evolved.eng[w.i] === w.t ? best : null,
                lines: blocks[k].lines };
            });
            var zs = score(zero), es = score(evolved);
            var heldTown = null;
            if (cityMaps.length) {
              var cm = cityMaps[0], cs = score(cm), h = st.heldout.filter(function (x) { return x.town === cityTowns[0]; })[0];
              heldTown = { name: CITY[cityTowns[0].slice(0, 3)], cells: cm.cells, conf: cm.conf, acc: cs.acc,
                critFound: h ? h.life_safety_found : cs.critFound, critTotal: h ? h.life_safety_total : cs.critTotal };
            }
            var F = {
              live: true, run: run, night: night, bestGen: best,
              place: 'New York · ' + (heldNYC ? "tonight's storm (held-out, simulated)" : 'a past storm (the validation storm, simulated)'),
              backtestPlace: 'Past storms: Miami, Houston, New Orleans (backtest) · validation storms (the gate) · assessments locked to the scorer',
              replayNote: heldNYC ? "Same reports. Same frozen Jev. Only the harness changed. Tonight's storm is scored once, never trained on."
                : 'Same reports. Same frozen Jev. Only the harness changed. This is the validation storm the gate used; tonight\'s storm is scored once at the end.',
              sources: 'eight kinds of sources',
              backCalm: back[0] ? back[0].cells.map(function (c) { return c === 'water' ? 'water' : 'intact'; }) : null,
              replayCta: heldNYC ? 'Replay tonight with the evolved harness' : 'Replay the NYC storm with the evolved harness',
              pitch: heldNYC ? null : 'We froze the model and let the harness evolve how it reads the world: gated, remembered, and next scored once on a storm it never saw.',
              landBlocks: calm.filter(function (x) { return x !== 'water'; }).length,
              sourceList: [['911 calls', 'call', 'some filed a block off'], ['311 tickets', 'ticket', ''], ['Drone passes', 'drone', '~30% coverage'],
                ['Social posts', 'social', 'includes viral rumors'], ['Utility outage feed', 'utility', 'whole feeders at once'],
                ['Fire dept. and city damage surveys', null, 'two different scales'], ['Pre-storm land-use map', null, 'stale']],
              nightTag: heldNYC ? 'Tonight · live' : 'NYC storm · generation 0',
              speedFact: 'One generation: 3,111 blocks across four storms in about a minute.',
              gens: gens, heldTown: heldTown, calm: calm, truth: truth, pins: pins, feed: feed, misreads: misreads,
              zero: Object.assign({ cells: zero.cells, conf: zero.conf, top: triage(zero, where) }, zs),
              evolved: Object.assign({ cells: evolved.cells, conf: evolved.conf, top: triage(evolved, where) }, es),
              counts: counts, src: { night: night, zeroGen: 0, bestGen: best }, api: base
            };
            // For the click-through story (story.js): the recorded lineage as training runs, the once-only cities,
            // the learned rules as lessons, and generation 0's real lines for the "now reading" panel.
            F.runs = gens.map(function (G) {
              return { run: G.gen + 1, status: G.status === 'kept' || G.status === 'baseline' ? 'accepted' : G.status,
                       hyp: G.hyp || G.note || '', predicted: G.predicted, cells: G.cells || null, conf: G.conf || null,
                       acc: G.val != null ? G.val : null, dev: G.dev, note: G.note, trace: G.trace || null };
            });
            var heldBy = {}; (st.heldout || []).forEach(function (x) { if (x.genome_id !== 'baseline') heldBy[x.town] = x; });
            var tonightHeld = heldBy.NYC1;
            F.cities = [{ key: 'nyc', name: 'New York', area: 'tonight, held out', cells: evolved.cells, conf: evolved.conf,
                          acc: tonightHeld ? tonightHeld.score : es.acc, critFound: es.critFound, critTotal: es.critTotal }]
              .concat(cityTowns.map(function (t, k) {
                var h2 = heldBy[t], cm2 = cityMaps[k];
                return { key: t, name: CITY[t.slice(0, 3)], area: 'next season', cells: cm2.cells, conf: cm2.conf,
                         acc: h2 ? h2.score : score(cm2).acc, critFound: h2 ? h2.life_safety_found : null,
                         critTotal: h2 ? h2.life_safety_total : null };
              }));
            F.lines0 = zero.lines;
            F.rules = []; gens.forEach(function (G) { (G.rules || []).forEach(function (t) { F.rules.push({ text: t, gen: G.gen }); }); });
            D.LESSONS = F.rules;
            var confSum = 0, confN = 0; evolved.eng.forEach(function (p, i) { if (p) { confSum += evolved.conf[i]; confN++; } });
            F.confFact = "Confidence isn't a check: Jev averaged " + (confSum / confN).toFixed(2) + ' confidence tonight while ' +
              Math.round((1 - es.acc) * 100) + '% of its blocks were wrong.';
            D.flow = function () { return F; };
            D.nice = function (st) { return NICE[st] || st; };
            D.blockUrl = function (gen, x, y) { return base + '/api/block?run=' + run + '&gen=' + gen + '&town=' + night + '&x=' + x + '&y=' + y; };
            D.getBlock = function (gen, x, y) { return api(base, '/api/block?run=' + run + '&gen=' + gen + '&town=' + night + '&x=' + x + '&y=' + y); };
            D.usedSnapshot = function () { return usedSnapshot; };
            return F;
          });
        });
      });
    }
  };
})();
