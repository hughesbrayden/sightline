(function () {
  var React = window.React;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var html = window.htm.bind(React.createElement);
  var S = window.Sightline, D = window.SightlineDemo;
  var F = D.flow();
  var LABEL = {};
  S.STATES.forEach(function (s) { LABEL[s.key] = s.label; });
  var CRIT = { home: 1, major: 1, destroyed: 1, fire: 1 };
  var pct = function (v) { return v == null ? '—' : (v * 100).toFixed(1) + '%'; };
  var LAST = F.live ? F.runs.length - 1 : 7;  // generations after generation 0
  var LAND = F.landBlocks || 1024;
  var sgn = function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1); };

  var CELL = 20;
  function at(r, c, cell) { cell = cell || CELL; return { left: 1 + c * (cell + 1) + cell / 2, top: 1 + r * (cell + 1) + cell / 2 }; }

  var PIN = {
    call: { width: 10, height: 10, borderRadius: 5, background: 'var(--critical)', boxShadow: '0 0 0 2px var(--surface-raised)' },
    ticket: { width: 9, height: 9, background: 'var(--warn)', boxShadow: '0 0 0 2px var(--surface-raised)' },
    drone: { width: 9, height: 9, background: 'var(--accent)', boxShadow: '0 0 0 2px var(--surface-raised)', rotate: true },
    social: { width: 10, height: 10, borderRadius: 5, background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 2.5px var(--ink-muted)' },
    utility: { width: 9, height: 9, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--surface-raised)' },
    survey: { width: 10, height: 10, background: 'var(--line-strong)' }
  };
  function pinStyle(kind, extra) {
    var p = PIN[kind], st = Object.assign({}, p, extra || {});
    delete st.rotate;
    st.transform = (extra && extra.position === 'absolute' ? 'translate(-50%, -50%) ' : '') + (p.rotate ? 'rotate(45deg)' : '');
    return st;
  }

  // ---------- ticking clock per step ----------
  function useTicker(active, resetKey, ms) {
    var st = useState(0), tick = st[0], setTick = st[1];
    useEffect(function () { setTick(0); }, [resetKey]);
    useEffect(function () {
      if (!active) return;
      var id = setInterval(function () { setTick(function (t) { return t + 1; }); }, ms || 250);
      return function () { clearInterval(id); };
    }, [active, resetKey]);
    return tick;
  }

  // ---------- shared pieces ----------
  function Header(props) {
    return html`<header className="bar">
      <div className="brand"><span className="wordmark">Sightline</span><span className="muted">${props.place}</span></div>
      <div className="row gap16">
        <span className="muted">${props.clock}</span>
        <span className=${'pill pill-' + props.mode}><span className="pill-dot"></span>${props.modeLabel}</span>
        ${props.right}
      </div>
    </header>`;
  }

  var REP = {
    home: [['911 call', 'Water coming in on the ground floor.'], ['Drone pass', 'Water up to first-floor windows.'], ['Fire dept.', 'Level 3, which on that scale means homes flooded.']],
    street: [['311 report', 'Street flooded, cars stuck.'], ['Drone pass', 'Water over the curb, doors dry.']],
    wind: [['311 report', 'Part of the roof is gone.'], ['Social post', 'Photo of siding torn off.']],
    major: [['911 call', 'A wall came down.'], ['City survey', 'Category D: major damage.']],
    destroyed: [['Drone pass', 'Structure gone; debris only.'], ['City survey', 'Category E: destroyed.']],
    fire: [['911 call', 'Smoke and flames from a basement.'], ['Drone pass', 'Active fire, flooded street.']],
    road: [['311 report', 'Tree down across the road.'], ['Drone pass', 'Debris blocking both lanes.']],
    power: [['Utility feed', 'Outage reported on this block.'], ['311 report', 'No power since 23:00.']],
    shelter: [['City list', 'Shelter open, 120 beds.'], ['Social post', 'People arriving with pets.']],
    hospital: [['Hospital status', 'Operating on generator.'], ['Drone pass', 'Ambulance bay clear.']],
    minor: [['311 report', 'Some windows broken.'], ['Drone pass', 'Minor debris only.']],
    intact: [['Drone pass', 'No visible damage.'], ['Social post', 'All fine on our block.']]
  };

  function BlockCard(props) {
    var i = props.index, r = Math.floor(i / 32), c = i % 32;
    var guess = props.cells[i], truth = props.truth ? props.truth[i] : null;
    var rumor = !F.live && F.misreads[0].i === i;
    var reports = (REP[F.truth[i]] || []).slice();
    var lv = useState(null), live = lv[0], setLive = lv[1];
    useEffect(function () {
      if (!D.getBlock || props.gen == null) return;
      setLive(null);
      D.getBlock(props.gen, c, r).then(setLive).catch(function () {});
    }, [i, props.gen]);
    if (D.getBlock && props.gen != null) {
      var recs = live && live.lines ? live.lines.slice(2) : [];
      return html`<div className="blockcard">
        <div className="row between"><strong>Block ${r + 1}-${c + 1}</strong><span className="muted small">${D.where(r, c)}</span>
          <button className="x" aria-label="Close" onClick=${props.onClose}>×</button></div>
        <div className="small">Jev: <strong>${live ? D.nice(live.jev.pick) : '…'}</strong> <span className="mono muted">${live ? live.jev.conf.toFixed(2) : ''}</span>
          ${live && props.truth && live.assessment ? html` · <span style=${{ color: live.correct ? 'var(--good)' : 'var(--critical)' }}>${live.correct ? 'Assessment agrees' : 'Assessment: ' + D.nice(live.assessment)}</span>` : null}</div>
        <span className="muted xs">What Jev saw (${recs.length} of 12 lines):</span>
        <ul className="reports">${recs.map(function (ln, k) {
          var m = /^- \[([^\]]+)\] (.*)$/.exec(ln) || [null, '', ln];
          return html`<li key=${k}><span className="mono muted">${m[1]}</span><span>${m[2]}</span></li>`;
        })}</ul>
      </div>`;
    }
    return html`<div className="blockcard">
      <div className="row between"><strong>Block ${r + 1}-${c + 1}</strong><span className="muted small">${D.where(r, c)}</span>
        <button className="x" aria-label="Close" onClick=${props.onClose}>×</button></div>
      <div className="small">Jev: <strong>${LABEL[guess] || guess}</strong> <span className="mono muted">${props.conf ? props.conf[i].toFixed(2) : ''}</span>
        ${truth ? html` · <span style=${{ color: truth === guess ? 'var(--good)' : 'var(--critical)' }}>${truth === guess ? 'Assessment agrees' : 'Assessment: ' + LABEL[truth]}</span>` : null}</div>
      <ul className="reports">
        ${rumor ? html`<li><span className="mono muted">Social</span><span>WHOLE BLOCK COLLAPSED, confirmed!!</span></li>` : null}
        ${reports.map(function (p, k) { return html`<li key=${k}><span className="mono muted">${p[0]}</span><span>${p[1]}</span></li>`; })}
      </ul>
    </div>`;
  }

  function MapStage(props) {
    var sel = useState(null), selected = sel[0], setSelected = sel[1];
    useEffect(function () { setSelected(null); }, [props.resetKey]);
    var clickable = !!props.clickable;
    return html`<div className="mapstage">
      <${S.DamageMap} cells=${props.cells} confidence=${props.conf} truth=${props.truth} mode=${props.mode || 'guess'}
        cellSize=${CELL} caption=${props.caption} meta=${props.meta} label=${props.label}
        selected=${selected == null ? -1 : selected}
        onSelect=${clickable ? function (i) { if (F.truth[i] !== 'water' && F.truth[i] !== 'park') setSelected(i); } : undefined} />
      ${(props.pins || []).map(function (p, k) {
        var pos = at(p.r, p.c);
        var extra = { position: 'absolute', left: pos.left, top: pos.top };
        if (p.odd) { extra.outline = '2px dashed var(--critical)'; extra.outlineOffset = 3; }
        return html`<span key=${k} className="pin" style=${pinStyle(p.kind, extra)}></span>`;
      })}
      ${(props.marks || []).map(function (m) {
        var pos = at(m.r, m.c);
        return html`<span key=${'m' + m.n} className=${'mark' + (m.tone ? ' mark-' + m.tone : '')} style=${{ left: pos.left, top: pos.top }}>${m.n}</span>`;
      })}
      ${selected != null ? html`<${BlockCard} index=${selected} gen=${props.gen} cells=${props.cells} conf=${props.conf} truth=${props.showTruth ? F.truth : null} onClose=${function () { setSelected(null); }} />` : null}
      ${(props.inflight || []).map(function (i) {
        var pos = at(Math.floor(i / 32), i % 32);
        return html`<span key=${'f' + i} className="inflight" style=${{ left: pos.left, top: pos.top }}></span>`;
      })}
      ${clickable && selected == null ? html`<span className="hint">Click any block to see what's behind it</span>` : null}
    </div>`;
  }

  function Cta(props) {
    if (!props.onClick) return null;
    return html`<button className="cta" onClick=${props.onClick}>${props.label} →</button>`;
  }

  function Stat(props) {
    return html`<div className="stat"><span className="muted small">${props.label}</span><span className=${'mono num ' + (props.size || '')} style=${{ color: props.color }}>${props.value}${props.unit ? html`<span className="unit">${props.unit}</span>` : null}</span></div>`;
  }

  // ---------- one set of numbers, used on every tab ----------
  // Tonight's held-out NYC storm, generation 0 vs the evolved harness, from the once-only scoring. Falls back to
  // the replayed night's own scores when the held-out storm hasn't been scored yet (or with example data).
  var M = (function () {
    var h = F.heldoutAll || [];
    var after = h.filter(function (x) { return x.genome_id !== 'baseline' && x.town === F.night; })[0];
    var before = after && h.filter(function (x) { return x.genome_id === 'baseline' && x.town === F.night && (x.world || null) === (after.world || null); })[0];
    if (before) return { held: true, acc: [F.zero.acc, F.evolved.acc], fd: [before.false_dispatches, after.false_dispatches],
      crit: [before.life_safety_found, after.life_safety_found], critTotal: after.life_safety_total,
      label: "Tonight's New York storm, which Sightline never trained on" };
    return { held: false, acc: [F.zero.acc, F.evolved.acc], fd: [F.zero.falseAlarms, F.evolved.falseAlarms],
      crit: [F.zero.critFound, F.evolved.critFound], critTotal: F.zero.critTotal,
      label: F.live ? "The NYC validation storm (tonight's storm is scored once, at the end)" : 'Example data' };
  })();
  var ACC = 'Accuracy';  // share of blocks where Jev's call matches the assessment
  var cityAcc = function (c) { return c.plainAcc != null ? c.plainAcc : c.acc; };
  var PROBE = F.probe && F.probe.error ? F.probe.error : 'not authorized to read the assessments';
  // Validation (the gate): generation 0 and the best kept generation.
  var VAL = (function () {
    var kept = F.runs.filter(function (r) { return r.status === 'accepted' && r.acc != null; });
    return { from: F.runs[0].acc, to: kept.reduce(function (a, r) { return a == null || r.acc > a ? r.acc : a; }, null),
      gens: F.runs.length - 1, kept: kept.length - 1 };
  })();

  // The learned rules in plain words (the engine writes source ids like "fire-dept" and raw land-use codes).
  var SRC_WORD = { '911-call': '911 call', 'city-survey': 'city survey', 'fire-dept': 'fire dept.', 'drone-pass': 'drone pass',
    'utility-feed': 'utility feed', 'social-post': 'social post', 'pre-storm-map': 'pre-storm land-use map' };
  function plain(t) {
    t = t.replace(/\d+ Public Facilities & Institutions \(([^)]+)\)/g, '$1');
    var m = /^List (.+) reports from blocks within (\d+) blocks\.$/.exec(t);
    if (m) {
      var srcs = m[1].split(' and ');
      t = 'Read only nearby evidence (within ' + m[2] + ' blocks) from ' + (srcs.length > 1 ? srcs.slice(0, -1).join(', ') + ' and ' : '') + srcs[srcs.length - 1] + ' reports.';
    }
    return t.replace(/(911-call|city-survey|fire-dept|drone-pass|utility-feed|social-post|pre-storm-map)/g, function (s) { return SRC_WORD[s]; });
  }
  var RULES = ((F.live ? F.rules : D.LESSONS) || []).map(function (r) { return { gen: r.gen, text: plain(r.text) }; });

  var SHORT_SRC = { 'fire dept.': 'fire', 'city survey': 'survey', 'pre-storm land-use map': 'land-use', '911 call': '911',
    'social post': 'social', 'drone pass': 'drone', 'utility feed': 'utility' };
  function shortRule(text) {
    var r = plain(text), m;
    if ((m = /^Summarize (.+?) reports/.exec(r))) return 'Summarize ' + m[1] + ' reports';
    if ((m = /^Ignore (.+?) reports\.?$/.exec(r))) return 'Ignore ' + m[1] + 's';
    if ((m = /^Translate (.+?) codes before/.exec(r))) return 'Decode ' + m[1] + ' codes';
    if ((m = /within (\d+) blocks/.exec(r))) return 'Use only reports within ' + m[1] + ' blocks';
    return r.split(' (')[0].replace(/\.$/, '');
  }
  var SHORT = (function () {
    var out = [], decode = [];
    RULES.forEach(function (r) {
      var m;
      if ((m = /^Ignore (.+?) reports\.?$/.exec(r.text))) out.push('Ignore ' + m[1] + 's');
      else if ((m = /^Translate (.+?) codes before/.exec(r.text))) decode.push(SHORT_SRC[m[1]] || m[1]);
      else if ((m = /within (\d+) blocks/.exec(r.text))) out.push('Use only reports within ' + m[1] + ' blocks');
      else out.push(r.text.split(' (')[0].replace(/\.$/, ''));
    });
    if (decode.length) out.splice(Math.min(1, out.length), 0, 'Decode ' + (decode.length > 1 ? decode.slice(0, -1).join(', ') + ' and ' : '') + decode[decode.length - 1] + ' codes');
    return out.slice(0, 3);
  })();

  function evidence(m) {
    var t = String(m.text || ''), g = /^Jev read: ([^:]+?)(?: on this block| at [^:]+)?: (.*)$/.exec(t);
    if (!g) return { src: '', quote: t };
    var src = plain(g[1]).replace(/^./, function (c) { return c.toUpperCase(); }), rest = g[2];
    var q = /"[^"]+"/.exec(rest);
    return { src: src, quote: q ? q[0] : rest.replace(/:\s*/g, ' ') };
  }

  function Kpi(props) {
    return html`<div className="kpi"><span className="muted small">${props.label}</span>
      <span className="mono kpi-num"><span className="from">${props.from}</span><span className="arrow">→</span><span className="to">${props.to}</span>${props.unit ? html`<span className="unit">${props.unit}</span>` : null}</span>
      ${props.note ? html`<span className="muted xs">${props.note}</span>` : null}</div>`;
  }
  function RuleList(props) {
    return html`<div className="rules">${RULES.slice(0, props.max || 6).map(function (r, k) {
      return html`<div className="rule" key=${k}><span>${props.short ? shortRule(r.text) : r.text}</span>${r.gen != null && props.tags !== false ? html`<span className="gentag">Round ${r.gen}</span>` : html`<span></span>`}</div>`;
    })}</div>`;
  }
  function Trust(props) {
    return html`<div className="trust"><strong style=${{ color: 'var(--critical)', whiteSpace: 'nowrap' }}>Can't cheat</strong>
      <span>${props.long ? "The answer key is locked by MongoDB roles: only the scorer's login can read it. When the harness's own login tries, the database refuses: " : "Answers are locked by MongoDB roles; the harness's login is refused: "}<code>denied (code 13)${props.long ? ': ' + PROBE : ''}</code></span></div>`;
  }

  // ---------- story: six beats ----------
  var NAMES = ['Calm night', 'Storm hits', 'First pass', 'How it did', 'Evolution', 'Same night, replayed', 'What it learned'];
  var CLOCK = { 2: 'Wednesday 01:15', 3: 'After the storm · results', 4: 'Offline · past storms', 5: 'Tuesday night, run again', 6: 'Next hurricane season' };
  var MODE = { 1: 'live', 2: 'live', 3: 'review', 4: 'training', 5: 'review', 6: 'live' };
  var MODE_LABEL = { 1: 'Live', 2: 'Live', 3: 'Results', 4: 'Evolution', 5: 'After learning', 6: 'Generalizes' };
  var CTA = { 2: "Let's look at the results", 3: 'Let the harness learn from past storms', 4: "Rerun tonight's storm with what it learned", 5: 'Does it hold up in other cities?' };

  function Story(props) {
    var beat = props.beat, step = beat <= 2 ? 1 : beat - 1, sub = beat === 2 ? 1 : 0, on = props.visible;
    var tick = useTicker(on && ((step === 1 && sub === 1) || step === 2 || step === 4), beat + '-' + on, 250);
    var ctaLabel = step === 1 ? (sub === 0 ? 'Storm makes landfall' : 'First pass: Jev maps the city') : CTA[step];
    var next = ctaLabel ? html`<${Cta} label=${ctaLabel} onClick=${props.onNext} />` : null;
    var legend = html`<${S.DamageLegend} states=${['intact', 'minor', 'street', 'home', 'wind', 'major', 'destroyed', 'power']} />`;
    var place = step === 4 ? (F.live ? 'New York · a past storm (simulated)' : 'Storm 1, October') : step === 6 ? (F.live ? 'New York and three other cities · scored once (simulated)' : 'Miami · Downtown, Brickell and Miami Beach') : (F.place || 'New York · Lower Manhattan and the Brooklyn waterfront');
    var clock = step === 1 ? (sub === 0 ? 'Tuesday 21:00' : 'Tuesday 23:44 · landfall') : CLOCK[step];
    var header = html`<${Header} place=${place} clock=${clock} mode=${MODE[step]} modeLabel=${MODE_LABEL[step]} />`;
    if (step === 4) return html`<div className="screen">${header}<${Training} tick=${tick} next=${next} /></div>`;
    if (step === 6 && F.live) {
      return html`<div className="screen">${header}
        <div className="closing">
          <div className="intro"><h2>What it learned, and how far it carries</h2><p className="muted lead">We applied Sightline's learned harness to other cities: storms in Miami, Houston, and New Orleans.</p></div>
          <div className="citymaps">${F.cities.map(function (c) {
            return html`<div className="citymap" key=${c.key}>
              <${S.DamageMap} cells=${c.cells} confidence=${c.conf} cellSize=${9} label=${c.name + ' map, scored once'} />
              <div className="row between end"><div className="col gap2"><strong>${c.name}</strong><span className="muted xs">${c.area}</span></div><span className="mono cityacc">${pct(cityAcc(c))}</span></div>
            </div>`;
          })}</div>
          <div className="closing-foot">
            <div className="col gap8"><strong className="small">What the harness learned on its own</strong><${RuleList} short=${true} /></div>
            <div className="facts col"><span>The curator never sees the storms it's tested on, or tonight's.</span><span>The gate turned down ${F.runs.filter(function (r) { return r.status === 'rejected'; }).length} of the ${VAL.gens} changes the curator proposed. Only the ones that clearly helped were kept.</span><span>${String(F.speedFact || '').replace(/^One generation:/, 'One round:')}</span></div>
          </div>
        </div>
      </div>`;
    }
    if (step === 5) {
      var mis = F.misreads.map(function (m, k) {
        var ok = !F.live || m.fixedBy != null;
        return html`<span className=${'mtag' + (ok ? ' ok' : ' no')} key=${k}><span className="mono">${ok ? '✓' : '✗'}</span>${m.title}</span>`;
      });
      var Big = function (props) {
        return html`<div className="bignum"><span className="muted small">${props.label}</span>
          <span className="mono bn"><span className="from">${props.from}</span><span className="arrow">→</span><span className="to">${props.to}</span>${props.unit ? html`<span className="unit">${props.unit}</span>` : null}</span>
          ${props.note ? html`<span className="muted xs">${props.note}</span>` : null}</div>`;
      };
      return html`<div className="screen">${header}
        <div className="reveal">
          <div className="row between end">
            <div className="intro"><h2>Tonight's storm, run again with what it learned</h2><p className="muted lead">Same reports, same Jev. Only what it's shown changed, and tonight's storm was never used for learning.</p></div>
            <div className="mapkey"><span>Solid: Jev got it right</span></div>
          </div>
          <div className="reveal-main">
            <div className="reveal-maps">
              <${DispatchMap} cells=${F.zero.cells} conf=${F.zero.conf} highlight="right" ok=${F.zero.ok} cellSize=${15} caption="First pass" meta=${rightIdx({ cells: F.zero.cells, ok: F.zero.ok }).length + ' blocks right'} label="Tonight, first pass" />
              <span className="reveal-arrow">→</span>
              <${DispatchMap} cells=${F.evolved.cells} conf=${F.evolved.conf} highlight="right" ok=${F.evolved.ok} cellSize=${15} caption="After learning" meta=${rightIdx({ cells: F.evolved.cells, ok: F.evolved.ok }).length + ' blocks right'} label="Tonight, after learning" />
            </div>
            <div className="reveal-nums">
              <${Big} label=${ACC} from=${pct(M.acc[0])} to=${pct(M.acc[1])} />
              <${Big} label="Rescue-critical found" from=${M.crit[0]} to=${M.crit[1]} unit=${'/' + M.critTotal} />
              <${Big} label="False dispatches" from=${M.fd[0]} to=${M.fd[1]} />
              <div className="reveal-cta">${next}</div>
            </div>
          </div>
        </div>
      </div>`;
    }

    var map, panel;
    if (step === 1 && sub === 0) {
      map = { cells: F.calm, caption: 'Tuesday 21:00', meta: 'no reports' };
      panel = html`
        <div className="intro"><h2>All quiet</h2><p className="muted lead">${LAND.toLocaleString('en-US')} blocks across Lower Manhattan and the Brooklyn waterfront. The storm is forecast to make landfall around 23:30. Generation 0 of the harness is deployed; Jev stays frozen the whole night.</p></div>
        <div className="stats"><${Stat} label="Reports tonight" value="0" size="xl" /><${Stat} label="Blocks flagged" value="0" size="xl" /></div>
        <div className="col gap10"><strong className="small">Sources connected</strong>
          ${(F.sourceList ? F.sourceList.map(function (x) { return [x[0], x[1] || 'survey', x[2]]; }) : [['911 calls', 'call', 'locations drift'], ['311 tickets', 'ticket', ''], ['Drone passes', 'drone', ''], ['Social posts', 'social', 'includes rumors'], ['Utility outage feed', 'utility', 'lat/long swapped'], ['Fire dept. and city damage surveys', 'survey', 'two different scales']]).map(function (s) {
            return html`<div className="row gap10 small" key=${s[0]}><span style=${pinStyle(s[1])}></span><span>${s[0]}</span><span className="muted push">${s[2]}</span></div>`;
          })}
        </div>`;
    }
    if (step === 1 && sub === 1) {
      var n = Math.min(F.pins.length, 3 + tick * 2), frac = n / F.pins.length;
      var grow = function (v) { return Math.round(v * frac).toLocaleString('en-US'); };
      var feedN = Math.min(F.feed.length, 1 + Math.floor(tick / 6)), feedStart = Math.max(0, feedN - 6);
      var feed = F.feed.slice(feedStart, feedN);  // a rolling window: the newest six, oldest drop off the top
      map = { cells: F.calm, caption: 'Incoming reports', meta: n + ' on the map', pins: F.pins.slice(0, n) };
      panel = html`
        <div className="intro"><h2>Reports are flooding in</h2><p className="muted lead">${grow(F.counts.total || 10164)} reports so far. Some of them are wrong.</p></div>
        <div className="counts">${[['911', 'call', F.counts.calls], ['311', 'ticket', F.counts.tickets], ['Drone', 'drone', F.counts.drone], ['Social', 'social', F.counts.social], ['Utility', 'utility', F.counts.utility]].map(function (c) {
          return html`<div className="stat" key=${c[0]}><span className="muted small row gap6"><span style=${pinStyle(c[1])}></span>${c[0]}</span><span className="mono num md">${grow(c[2])}</span></div>`;
        })}</div>
        <div className="feed">${feed.map(function (f, k) {
          return html`<div className="feedrow" key=${feedStart + k}><span className="mono muted xs">${f.time}</span><span className="xs strong muted">${f.src}</span><span>${f.text}</span>${f.odd ? html`<span className="flag">Looks off</span>` : html`<span></span>`}</div>`;
        })}</div>
        <div className="qbox">
          <strong>The question: which blocks need a crew?</strong>
          <span className="muted">Reports pour in from eight different sources. They overlap, contradict each other and use different codes. How can we get clarity on where the damage actually is?</span>
        </div>`;
      legend = null;  // the map shows reports, not damage, on this beat
    }
    if (step === 2) {
      var mapped = Math.min(1024, tick * 32);
      var running = mapped < 1024;
      var isLand = function (i) { return F.truth[i] !== 'water' && F.truth[i] !== 'park'; };
      // Unassessed blocks stay faint; assessed blocks take Jev's answer.
      var cells = F.zero.cells.map(function (c, i) { return i < mapped ? c : F.calm[i]; });
      var conf = F.zero.conf.map(function (c, i) { return i < mapped || !isLand(i) ? (i < mapped ? c : 1) : 0.05; });
      var flagged = 0;
      for (var i = 0; i < mapped; i++) if (CRIT[F.zero.cells[i]]) flagged++;
      // The 16 blocks Jev is deciding right now (16 calls in parallel).
      var inflight = [];
      for (var j = mapped; j < Math.min(1024, mapped + 16); j++) if (isLand(j)) inflight.push(j);
      map = { gen: F.src ? F.src.zeroGen : null, cells: cells, conf: conf, caption: "Jev's map · first pass", meta: running ? 'Jev is deciding block by block' : 'generation 0', clickable: !running, inflight: running ? inflight : [] };
      if (running) legend = null;

      if (running) {
        var cur = inflight.length ? inflight[0] : 0;
        if (!inflight.length) for (var lb = mapped - 1; lb >= 0; lb--) if (isLand(lb)) { cur = lb; break; }
        var cr = Math.floor(cur / 32), cc = cur % 32;
        // The nearest reports, taken at face value: what generation 0 hands Jev for this block.
        var near = [];
        for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
          var rr = cr + dr, c2 = cc + dc, k2 = rr * 32 + c2;
          if (rr < 0 || c2 < 0 || rr > 31 || c2 > 31 || !isLand(k2)) continue;
          if (F.lines0) continue;  // live: use the lines Jev actually saw (below)
          var rep = (REP[F.truth[k2]] || [])[(Math.abs(dr) + Math.abs(dc)) % 2] || (REP[F.truth[k2]] || [])[0];
          if (rep) near.push({ d: Math.abs(dr) + Math.abs(dc), src: rep[0], text: rep[1], m: Math.round(Math.hypot(dr, dc) * 110) });
        }
        if (F.lines0 && F.lines0[cur]) F.lines0[cur].slice(2).forEach(function (ln, k) {
          var mm = /^- \[([^\]]+)\] ([^:]+): (.*)$/.exec(ln) || [null, '', '', ln];
          near.push({ d: k, src: mm[1], text: mm[3], m: mm[2] });
        });
        if (!F.live && F.misreads[0].i === cur || Math.abs(Math.floor(F.misreads[0].i / 32) - cr) + Math.abs(F.misreads[0].i % 32 - cc) <= 2) near.unshift({ d: 0, src: 'Social', text: 'WHOLE BLOCK COLLAPSED, confirmed!!', m: 60 });
        near.sort(function (a, b) { return a.d - b.d; });
        var lines = near.slice(0, 12);
        var answer = F.zero.cells[cur], answerConf = F.zero.conf[cur];
        var recent = [];
        for (var q = mapped - 1; q >= 0 && recent.length < 4; q--) if (isLand(q)) recent.push(q);
        var pctDone = Math.round((mapped / 1024) * 100);
        panel = html`
          <div className="intro"><h2>First pass: Jev maps the city</h2><p className="muted lead">The simplest approach: for each block, Jev reads the 12 nearest reports, as-is, and calls the damage in ${F.live ? 'about a third of a second' : 'a fraction of a second'}.</p></div>
          <div className="runbox">
            <div className="row between end"><div className="col gap2"><span className="muted small">Blocks mapped</span><span className="mono num xl">${(F.live ? Math.round(mapped / 1024 * LAND) : mapped).toLocaleString('en-US')}<span className="unit"> / ${LAND.toLocaleString('en-US')}</span></span></div>
              <div className="col gap2 right"><span className="muted small">Crews sent so far</span><span className="mono num md">${flagged}</span></div></div>
            <div className="runbar"><div style=${{ width: pctDone + '%' }}></div></div>
          </div>
          <div className="readcard">
            <div className="row between"><strong className="small">What Jev is reading: block ${cr + 1}-${cc + 1}</strong><span className="muted xs">${D.where(cr, cc)} · ${Math.min(5, lines.length)} of ${lines.length} lines shown</span></div>
            <ol className="readlines">${lines.slice(0, 5).map(function (l, k) {
              return html`<li key=${k}><span className="mono muted">${String(k + 1).padStart(2, '0')}</span><span className="mono muted clip">${l.src} · ${typeof l.m === 'number' ? l.m + ' m' : l.m}</span><span className="clip">${l.text}</span></li>`;
            })}</ol>
            <div className="answer"><span className="muted xs">Jev</span><span className="swatch-inline" style=${{ background: 'var(--' + (S.STATES.filter(function (s) { return s.key === answer; })[0] || { fill: 'dmg-intact' }).fill + ')' }}></span><strong>${LABEL[answer] || answer}</strong><span className="mono muted">${answerConf.toFixed(2)}</span></div>
          </div>
          <div className="col"><strong className="small pad8">Latest calls</strong>
            ${recent.map(function (b) {
              var br = Math.floor(b / 32), bc = b % 32;
              return html`<div className="decrow" key=${b}><span className="mono xs">${br + 1}-${bc + 1}</span><span className="xs muted clip">${D.where(br, bc)}</span><span className="xs clip">${LABEL[F.zero.cells[b]]}</span><span className="mono xs right">${F.zero.conf[b].toFixed(2)}</span></div>`;
            })}
          </div>`;
      } else {
        next = html`<div className="col gap12"><strong className="endq">But were they the right ones?</strong>${next}</div>`;
        panel = html`
          <div className="intro"><h2>First pass: Jev maps the city</h2><p className="muted lead">All ${LAND.toLocaleString('en-US')} blocks in about 15 seconds. Crews are on their way to ${flagged} blocks.</p></div>
          <div className="stats"><${Stat} label="Crews sent" value=${flagged} size="xxl" /></div>
          <div className="col"><strong className="small pad8">Where crews go first</strong>
            ${F.zero.top.map(function (t, k) {
              return html`<div className="trow" key=${k}><span className="mono muted xs">${k + 1}</span><span className="mono xs">${t.block}</span><span>${t.where}</span><span>${LABEL[t.state]}</span><span className="mono xs right">${t.conf}</span></div>`;
            })}
          </div>`;
      }
    }
    if (step === 3) {
      map = { gen: F.src ? F.src.zeroGen : null, cells: F.zero.cells, truth: F.truth, mode: 'diff', caption: 'First pass vs the survey', meta: 'wrong blocks at full strength', clickable: true, showTruth: true,
        marks: F.misreads.map(function (m) { return { n: m.n, r: m.r, c: m.c }; }) };
      panel = html`
        <div className="intro"><h2>How did the first pass do?</h2><p className="muted lead">The official damage survey shows what actually happened on every block. Here's where the first pass went wrong.</p></div>
        <div className="col gap8"><span className="muted xs">${M.label}</span>
          <div className="stats"><${Stat} label="False dispatches" value=${M.fd[0]} size="xl" color="var(--critical)" /><${Stat} label="Rescue-critical found" value=${M.crit[0]} unit=${'/' + M.critTotal} size="xl" /><${Stat} label=${ACC} value=${pct(M.acc[0])} size="xl" /></div></div>
        <div className="col gap14"><strong className="small">Evidence taken too literally</strong>
          ${F.misreads.map(function (m) {
            var e = evidence(m);
            return html`<div className="evid" key=${m.n}><span className="mark static">${m.n}</span>
              <div className="col gap4">
                <span className="strong">${m.title} <span className="muted normal">· ${m.where}</span></span>
                <span className="small clip">${e.src ? html`<span className="muted">${e.src}: </span>` : null}${e.quote}</span>
                <span className="xs muted callpair"><span className="said">Jev: ${m.jev}</span><span className="muted">→</span><span className="was">Actually: ${m.truth}</span></span>
              </div></div>`;
          })}
        </div>`;
      legend = null;  // the diff map speaks for itself
      next = html`<div className="col gap12"><strong className="endq">How can we improve the results?</strong>${next}</div>`;
    }
    if (step === 5) {
      map = { gen: F.src ? F.src.bestGen : null, cells: F.evolved.cells, conf: F.evolved.conf, caption: "Jev's map · evolved harness" + (F.live ? ', generation ' + F.bestGen : ''), meta: 'same night, replayed', clickable: true, showTruth: true,
        marks: F.misreads.map(function (m) { return { n: m.n, r: m.r, c: m.c, tone: m.fixedBy != null || !F.live ? 'good' : null }; }) };
      panel = html`
        <div className="intro"><h2>Tonight's storm, run again with what it learned</h2><p className="muted lead">${F.replayNote || "Same reports, same frozen Jev. Only the harness changed: how it picks and reads Jev's 12 lines."}</p></div>
        <div className="compare">
          <div className="crow head"><span style=${{ textAlign: 'left' }}>${M.label}</span><span>Generation 0</span><span>${F.bestGen != null ? 'Evolved · gen ' + F.bestGen : 'Evolved'}</span></div>
          ${[['False dispatches', M.fd[0], M.fd[1]], ['Rescue-critical found (of ' + M.critTotal + ')', M.crit[0], M.crit[1]], [ACC, pct(M.acc[0]), pct(M.acc[1])]].map(function (c) {
            return html`<div className="crow" key=${c[0]}><span>${c[0]}</span><span className="mono before">${c[1]}</span><span className="mono after">${c[2]}</span></div>`;
          })}
        </div>
        ${F.fixes ? html`<span className="small">Block by block against generation 0: <strong style=${{ color: 'var(--good)' }}>${F.fixes.fixed} fixed</strong>, <strong style=${{ color: 'var(--critical)' }}>${F.fixes.broke} newly wrong</strong>.</span>` : null}
        <div className="col gap10"><strong className="small">${F.live ? F.misreads.length + " of generation 0's misreads: " + F.misreads.filter(function (m) { return m.fixedBy != null; }).length + ' now handled' : "Generation 0's four misreads, now handled"}</strong>
          ${(F.live ? F.misreads.map(function (m) { return m.title + ': ' + (m.fixedBy != null ? 'fixed by the evolved harness.' : 'still wrong.'); })
            : ['Accounts that never match drone passes are treated as rumor.', 'The utility feed is swapped back to latitude, longitude.', 'Both agencies’ damage scales are translated before Jev reads them.', '911 calls match blocks within 150 m, not exact addresses.']).map(function (t, k) {
            var ok = !F.live || F.misreads[k].fixedBy != null;
            return html`<div className="misread" key=${k}><span className=${'mark static' + (ok ? ' good' : '')}>${k + 1}</span><span className="small">${t}</span></div>`;
          })}
        </div>`;
    }
    if (step === 6) {
      var miami = F.cities[1];
      map = { cells: miami.cells, conf: miami.conf, caption: F.live ? 'Miami · next season, frozen policy' : 'Miami · first storm, blind', meta: F.live ? pct(cityAcc(miami)) + ' accuracy, scored once' : pct(miami.acc) + ' after the assessment' };
      if (F.live) {
        panel = html`
        <div className="intro"><h2>What it learned, and where it carries</h2><p className="muted lead">The frozen policy from generation ${F.bestGen}, scored once on tonight's storm and on next season's storms in three other cities. None of them was used for training or selection.</p></div>
        <div className="col gap10 ruled"><strong className="small">Accuracy, scored once with the frozen policy</strong>
          ${F.cities.map(function (c) {
            return html`<div className="barrow" key=${c.key}><span>${c.name}<span className="muted xs"> · ${c.area}</span></span><div className="track"><div style=${{ width: (cityAcc(c) * 100).toFixed(0) + '%' }}></div></div><span className="mono right">${(cityAcc(c) * 100).toFixed(1)}</span></div>`;
          })}
        </div>
        <div className="col gap8"><strong className="small">What the harness learned on its own</strong><${RuleList} /></div>
        <div className="facts"><span>The curator is a blind Claude: it never sees the validation storms or tonight's.</span><span>${F.confFact}</span><span>${F.speedFact}</span></div>`;
        legend = null;  // room for the cities and the rules
      } else {
      panel = html`
        <div className="intro"><h2>Same harness, a new city</h2><p className="muted lead">Miami grows its own lineage, because its feeds and water are different. It starts from everything the harness learned in New York.</p></div>
        <div className="col gap10 ruled"><strong className="small">Generation 0 in each new city, before any evolution</strong>
          ${F.cities.map(function (c) {
            return html`<div className="barrow" key=${c.key}><span>${c.name}</span><div className="track"><div style=${{ width: (c.start * 100).toFixed(0) + '%' }}></div></div><span className="mono right">${(c.start * 100).toFixed(0)}</span></div>`;
          })}
        </div>
        <div className="col gap8"><strong className="small">What it learned and brought along</strong><${RuleList} max=${3} /></div>
        <div className="facts"><span>The answers are locked to the scorer. The harness's login was refused.</span><span>Confidence isn't a check. A few field-verified blocks are.</span><span>One 1,024-block map in about 15 seconds.</span></div>`;
      }
    }

    return html`<div className="screen">${header}
      <div className="body">
        <${MapStage} resetKey=${beat} ...${map} label=${map.caption} />
        <div className="panel">${panel}<div className="panel-foot">${next}${legend}</div></div>
      </div>
    </div>`;
  }

  // Hill-climb chart for the Evolution step: the lineage (best kept so far) as a step line, every proposal as a
  // faint dot, and % labels at the crucial points: the start, each kept jump (with its gain) and the current best.
  function HillCurve(props) {
    var runs = props.runs, cur = props.cur, W = props.width || 513, H = props.height || 190;
    var padL = 34, padR = 16, padT = 26, padB = 26, iw = W - padL - padR, ih = H - padT - padB;
    var vals = runs.map(function (r) { return r.acc; }).filter(function (v) { return v != null; });
    var lo = Math.floor((Math.min.apply(null, vals) - 0.03) * 20) / 20, hi = Math.ceil((Math.max.apply(null, vals) + 0.03) * 20) / 20;
    var n = runs.length;
    var x = function (i) { return padL + (n > 1 ? (i / (n - 1)) * iw : iw / 2); };
    var y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * ih; };
    var best = null, line = [], labels = [], dots = [];
    runs.forEach(function (r, i) {
      if (i > cur) return;
      if (r.acc != null) dots.push({ i: i, v: r.acc, kept: r.status === 'accepted' });
      var before = best;
      if (r.acc != null && r.status === 'accepted' && (best == null || r.acc > best)) best = r.acc;
      if (best != null) line.push([x(i), y(best)]);
      if (best != null && best !== before) labels.push({ i: i, v: best, gain: before == null ? null : best - before });
    });
    var path = line.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var steps = [];
    var step = hi - lo > 0.3 ? 0.1 : 0.05;  // wider ranges get 10-point gridlines so labels don't crowd
    for (var t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) steps.push(t);
    return html`<div className="col gap6">
      <svg width=${W} height=${H} viewBox=${'0 0 ' + W + ' ' + H} role="img" aria-label=${props.label || 'Score by generation'}>
        ${steps.map(function (t, k) { return html`<g key=${'g' + k}><line x1=${padL} x2=${W - padR} y1=${y(t)} y2=${y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x=${padL - 6} y=${y(t) + 3} textAnchor="end" fontSize="10" fill="var(--ink-muted)" fontFamily="var(--font-mono)">${Math.round(t * 100)}</text></g>`; })}
        ${runs.map(function (r, i) { return html`<text key=${'x' + i} x=${x(i)} y=${H - 8} textAnchor="middle" fontSize="10" fill=${i === cur ? 'var(--ink)' : 'var(--ink-muted)'} fontFamily="var(--font-mono)">${props.xPrefix || 'G'}${r.run - 1}</text>`; })}
        ${dots.filter(function (d) { return !d.kept; }).map(function (d) { return html`<circle key=${'d' + d.i} cx=${x(d.i)} cy=${y(d.v)} r="3.5" fill="var(--series-heldout)" opacity="0.45" />`; })}
        <path d=${path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        ${labels.map(function (l, k) {
          var lx = x(l.i), ly = y(l.v), anchor = l.i === 0 ? 'start' : l.i === n - 1 ? 'end' : 'middle';
          return html`<g key=${'l' + k}>
            <circle cx=${lx} cy=${ly} r="4.5" fill="var(--accent)" stroke="var(--surface-raised)" strokeWidth="1.5" />
            <text x=${l.i === 0 ? lx + 6 : lx} y=${l.i === 0 ? ly + 18 : ly - 9} textAnchor=${anchor} fontSize="12" fontWeight="600" fill="var(--accent)" fontFamily="var(--font-mono)">${(l.v * 100).toFixed(1)}%</text>
            ${l.gain != null ? html`<text x=${lx} y=${ly + 17} textAnchor=${anchor} fontSize="10" fill="var(--good)" fontFamily="var(--font-mono)">+${(l.gain * 100).toFixed(1)}</text>` : null}
          </g>`;
        })}
      </svg>
      <div className="row gap16 xs muted"><span className="row gap6"><span style=${{ display: 'inline-block', width: 14, height: 2.5, background: 'var(--accent)' }}></span>${props.trainLabel || 'Lineage (kept changes)'}</span><span className="row gap6"><span style=${{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: 'var(--series-heldout)', opacity: 0.45 }}></span>Rejected change</span></div>
    </div>`;
  }

  // Evolution beat: the recorded generations as a montage, each proposal with what the gate decided.
  function Training(props) {
    // Evolution beat: the map of a past storm improving generation by generation, with one plain line per change.
    var runs = F.runs, n = runs.length;
    var cur = Math.min(n - 1, Math.floor(props.tick / 10));
    var shown = cur;  // the map follows the best kept version: a rejected change never reaches it
    while (shown > 0 && (runs[shown].cells == null || runs[shown].status !== 'accepted')) shown--;
    // Plain lines: merge "Decode X codes" rules into one; a rejected tweak of an earlier rule says so.
    var joinRules = function (list) {
      var out = [], dec = [];
      list.map(shortRule).forEach(function (x) { var m = /^Decode (.+) codes$/.exec(x); if (m) dec.push(m[1]); else if (out.indexOf(x) < 0) out.push(x); });
      if (dec.length) out.unshift('Decode ' + (dec.length > 1 ? dec.slice(0, -1).join(', ') + ' and ' : '') + dec[dec.length - 1] + ' codes');
      return out;
    };
    var keptSoFar = [];
    runs.forEach(function (r) { r._kept = keptSoFar.slice(); if (r.status === 'accepted' && r.rules) keptSoFar = keptSoFar.concat(joinRules(r.rules)); });
    var line = function (r) {
      if (r.run === 1) return 'Start: the 12 nearest reports, as-is';
      var list = r.status === 'accepted' ? r.rules : r.tried;
      if (!F.live || !list || !list.length) return r.hyp;
      var lines = joinRules(list);
      if (r.status === 'accepted') return lines.join('; ');
      var fresh = lines.filter(function (x) { return r._kept.indexOf(x) < 0; });
      return fresh.length ? 'Tried: ' + fresh[0] : 'Tried: a tweak to "' + lines[0] + '"';
    };
    return html`<div className="body">
      <div className="mapstage">
        <${S.DamageMap} cells=${runs[shown].cells} confidence=${runs[shown].conf} cellSize=${CELL}
          caption=${(F.live ? 'A past NYC storm' : 'Storm 1, October') + ' · best so far, round ' + (runs[shown].run - 1)} meta=${'score ' + pct(runs[shown].acc)} label="Past storm map at the current generation" />
      </div>
      <div className="panel">
        <div className="intro"><h2>Learning from past storms</h2><p className="muted lead">Each round, a curator suggests one change to how reports are picked and read. It's tested on past storms and kept only if it clearly helps. We focus on curating Jev's context, not the model itself.</p></div>
        <div className="col"><div className="row between pad8"><strong className="small">What it's trying</strong><span className="mono xs muted">Round ${runs[cur].run - 1} of ${LAST}</span></div>
          ${runs.map(function (r, i) {
            if (i > cur + 1) return null;  // the list grows as the generations run (all nine fit), with the next one dimmed
            var done = i <= cur;
            var result = !done ? 'next' : r.status === 'accepted' ? (r.run === 1 ? 'starting point' : 'kept') : r.status === 'rejected' ? 'rejected' : (F.live ? 'not scored' : 'skipped by memory');
            var color = !done ? 'var(--ink-muted)' : r.status === 'accepted' ? 'var(--good)' : r.status === 'rejected' ? 'var(--critical)' : 'var(--ink-muted)';
            return html`<div className=${'logrow' + (i === cur ? ' current' : '')} style=${{ opacity: done ? 1 : 0.45 }} key=${i}><span className="mono muted xs">Round ${r.run - 1}</span><span className="small">${line(r)}</span><span className="xs strong" style=${{ color: color }}>${result}</span></div>`;
          })}
        </div>
        <div className="col gap16" style=${{ marginTop: 'auto' }}>${props.next}<${HillCurve} runs=${runs} cur=${cur} width=${560} height=${176} trainLabel="Best so far" xPrefix="R" label="Score by round" /></div>
      </div>
    </div>`;
  }

  // ---------- live arena: the robust loop, one generation at a time ----------
  var PLAN_NORMAL = [['Propose', 2], ['Screen', 0.8], ['Backtest', 4], ['Gate', 1.2], ['Remember', 1.4]];
  var PLAN_SKIP = [['Propose', 2], ['Memory check', 1.4], ['Remember', 1.4]];
  var PHASES = ['Propose', 'Screen', 'Backtest', 'Gate', 'Remember'];
  var CALLS = F.live ? 3111 : 1024;  // Jev calls per generation

  function Arena(props) {
    var init = { started: false, done: false, iter: 0, phase: 0, pt: 0, elapsed: 0, history: [], best: null };
    var s = useState(new URLSearchParams(location.search).get('autostart') ? Object.assign({}, init, { started: true }) : init), st = s[0], setSt = s[1];
    var runs = F.runs;
    useEffect(function () {
      if (!st.started || st.done) return;
      var id = setInterval(function () {
        setSt(function (prev) {
          if (!prev.started || prev.done) return prev;
          var run = runs[prev.iter], plan = run.status === 'skipped' ? PLAN_SKIP : PLAN_NORMAL;
          var next = Object.assign({}, prev, { elapsed: prev.elapsed + 0.2, pt: prev.pt + 0.2 });
          if (next.pt >= plan[prev.phase][1]) {
            next.pt = 0; next.phase = prev.phase + 1;
            if (next.phase >= plan.length) {
              var bestAcc = prev.best == null ? null : runs[prev.best].acc;
              var kept = run.status === 'accepted' && (F.live || bestAcc == null || run.acc > bestAcc);  // live: the recorded gate decided
              next.history = prev.history.concat([{ run: run.run, status: run.status, acc: run.acc, bestBefore: bestAcc, kept: kept }]);
              next.best = kept ? prev.iter : prev.best;
              next.iter = prev.iter + 1; next.phase = 0;
              if (next.iter >= runs.length) { next.done = true; next.iter = runs.length - 1; }
            }
          }
          return next;
        });
      }, 200);
      return function () { clearInterval(id); };
    }, [st.started, st.done]);
    useEffect(function () { if (props.onStatus) props.onStatus(st.started ? (st.done ? 'done' : 'running') : 'idle'); }, [st.started, st.done]);

    var run = runs[st.iter], plan = run.status === 'skipped' ? PLAN_SKIP : PLAN_NORMAL;
    var bestRun = st.best == null ? null : runs[st.best];
    var unit = F.live ? ' validation' : ' right';
    var base = bestRun ? bestRun.cells : F.calm, baseConf = bestRun ? bestRun.conf : null;
    var cells = base, conf = baseConf, caption = bestRun ? 'Lineage so far · generation ' + (bestRun.run - 1) : 'Waiting to start', meta = bestRun ? pct(bestRun.acc) + unit : '';
    var phaseName = st.started && !st.done ? plan[st.phase][0] : '';
    var frac = 0;
    if (phaseName === 'Backtest' && run.cells) {
      frac = st.pt / plan[st.phase][1];
      var mapped = Math.floor(frac * 1024);
      cells = run.cells.map(function (c, i) { return i < mapped ? c : base[i]; });
      conf = run.cells.map(function (c, i) { return i < mapped ? run.conf[i] : (baseConf ? baseConf[i] : 1); });
      caption = 'Generation ' + (run.run - 1) + (F.live ? ' · past NYC storm' : ' · backtest'); meta = Math.floor(frac * CALLS).toLocaleString('en-US') + ' of ' + CALLS.toLocaleString('en-US') + (F.live ? ' blocks, four storms' : ' blocks');
    } else if ((phaseName === 'Gate' || phaseName === 'Remember') && run.cells) {
      cells = run.cells; conf = run.conf; caption = 'Generation ' + (run.run - 1) + ' · candidate'; meta = phaseName === 'Gate' ? 'at the gate' : pct(run.acc) + unit;
    }
    var bestAcc = bestRun ? bestRun.acc : null, startAcc = st.history.length ? st.history[0].acc : null;
    var src = F.live ? runs[st.iter] : D.RUNS_NYC[st.iter];
    var improves = F.live ? run.status === 'accepted' : run.run === 1 || (bestAcc != null && run.acc > bestAcc);
    var verdict = run.status === 'skipped' ? (F.live ? (run.note || 'Not scored.') : 'Skipped by memory: too close to generation 2, which failed. Not scored.')
      : run.run === 1 ? 'Generation 0 set: ' + pct(run.acc) + unit + '.'
      : improves ? 'Kept: ' + sgn(run.acc - bestAcc) + ' points. It joins the lineage.'
      : 'Rejected by the gate: ' + sgn(run.acc - (bestAcc || 0)) + ' points' + (F.live && run.acc > bestAcc ? ', not confidently better (P(better) < 0.9)' : '') + '. The lineage stays as it was.';
    var status = !st.started ? '' : st.done ? 'Finished. ' + pct(bestAcc) + unit + ', up from ' + pct(startAcc) + ' at generation 0.' : {
      Propose: F.live ? 'A blind Claude reads which blocks the last change fixed and broke, plus related lessons from the lab notebook, and writes one change…' : 'Reading the last generation’s mistakes and writing one change…',
      Screen: F.live ? 'Screen: a quick test that drops clearly worse ideas (proven in our lab runs)…' : 'Screen: a quick run on about 600 dev blocks drops clearly worse ideas…',
      Backtest: 'Backtest: Jev is mapping ' + Math.floor(frac * CALLS).toLocaleString('en-US') + ' of ' + CALLS.toLocaleString('en-US') + ' blocks…',
      Gate: F.live ? 'Gate: paired bootstrap on the two validation storms. Keep only if P(better) ≥ 0.9 and harm doesn’t rise…' : 'Scoring against the official assessment (scorer login only)…',
      'Memory check': 'Lab notebook: checking for similar failed ideas…',
      Remember: verdict + (F.live ? ' Lesson written to the lab notebook.' : '')
    }[phaseName];
    var statusColor = st.done ? 'var(--good)' : phaseName !== 'Remember' || run.status === 'skipped' ? 'var(--ink-muted)' : improves ? 'var(--good)' : 'var(--critical)';
    var secs = Math.floor(st.elapsed * 3.2);
    var clock = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');

    return html`<div className="screen">
      <${Header} place=${F.live ? 'Replay of recorded run ' + F.run + ' · backtest Miami, Houston, New Orleans · gate on the validation storms' : 'New York · Storm 1, October · official assessment on file, locked to the scorer'} clock=${'Generation ' + (st.started ? run.run - 1 : 0) + ' of ' + LAST + ' · elapsed ' + clock} mode="training"
        modeLabel=${!st.started ? 'Evolution ready' : st.done ? 'Evolution done' : 'Evolution live'}
        right=${html`<button className="ghost" style=${{ visibility: st.started ? 'visible' : 'hidden' }} onClick=${function () { setSt(init); }}>Reset</button>`} />
      <div className="body">
        <div className="mapstage">
          <${S.DamageMap} cells=${cells} confidence=${conf} cellSize=${CELL} caption=${caption} meta=${meta} label="Past storm map at the current generation" />
          ${!st.started ? html`<div className="veil"><div className="startcard">
            <span className="tag tag-train">Live evolution</span>
            <strong className="h3">Give the harness past storms to evolve on</strong>
            <span className="muted small">${F.live ? 'The recorded run ' + F.run + ': ' + LAST + ' generations on real Jev with a blind Claude curator, ' + CALLS.toLocaleString('en-US') + ' blocks each, replayed about 10× faster than it ran.' : "1,024 blocks, 9,812 reports, and the official assessment it's scored against. 7 generations after generation 0, about 30 seconds each."}</span>
            <button className="cta wide" onClick=${function () { setSt(Object.assign({}, init, { started: true })); }}>Start evolution</button>
          </div></div>` : null}
        </div>
        <div className="panel">
          <div className="row gap40 end"><${Stat} label=${F.live ? 'Gate score on the validation storms, lineage' : 'Blocks right, lineage so far'} value=${pct(bestAcc)} size="xxl" color="var(--series-heldout)" /><${Stat} label="Since generation 0" value=${bestAcc != null && startAcc != null ? sgn(bestAcc - startAcc) + ' pts' : '—'} size="md" color="var(--good)" /></div>
          <div className="itercard">
            <div className="row between"><strong>${!st.started ? 'Ready' : st.done ? 'All ' + LAST + ' generations done' : 'Generation ' + (run.run - 1)}</strong><span className="muted xs">${st.started && !st.done && src.predicted != null ? 'Predicts +' + (src.predicted * 100).toFixed(0) + ' points' : ''}</span></div>
            ${F.live && runs.some(function (r) { return r.trace; }) ? (st.started && run.trace ? html`<a href=${run.trace} target="_blank" rel="noopener" className="xs traceline" style=${{ color: 'var(--accent)' }}>Open this generation's LangSmith trace ↗</a>` : html`<span className="xs traceline" aria-hidden="true"></span>`) : null}
            <span className="hypbox">${!st.started ? 'Press Start evolution. Each generation, the curator proposes one change. It is screened, backtested by Jev, and kept only if the gate finds it clearly helps (P ≥ 0.9) without raising harm. Every outcome is saved as a lesson.' : st.done ? 'The evolved harness is saved to the lineage and is what runs on the next live storm.' : src.hyp}</span>
            <div className="phases">${PHASES.map(function (name) {
              var names = plan.map(function (p) { return p[0]; });
              var idx = names.indexOf(name);
              if (name === 'Screen' && idx < 0) idx = names.indexOf('Memory check');
              var label = idx < 0 ? name + ' (skipped)' : (name === 'Screen' && run.status === 'skipped' ? 'Memory check' : name);
              var fill = 0, color = 'var(--accent)', on = false;
              if (st.done) { fill = 100; color = 'var(--line-strong)'; }
              else if (st.started && idx >= 0) {
                if (idx < st.phase) { fill = 100; color = 'var(--good)'; on = true; }
                else if (idx === st.phase) { fill = Math.round((st.pt / plan[idx][1]) * 100); on = true; }
              }
              return html`<div className="phase" key=${name}><div className="ptrack"><div style=${{ width: fill + '%', background: color }}></div></div><span className=${'xs' + (on ? '' : ' muted')}>${label}</span></div>`;
            })}</div>
            <span className="mono xs statusline" style=${{ color: statusColor }}>${status}</span>
          </div>
          <${HillCurve} runs=${runs} cur=${st.history.length - 1} width=${613} height=${170} trainLabel=${F.live ? 'Lineage, validation (kept)' : 'Lineage so far'} label="Score by generation" />
          <div className="col">${st.history.slice().reverse().slice(0, 3).map(function (h) {
            var result = h.status === 'skipped' ? (F.live ? 'not scored' : 'skipped by memory') : h.run === 1 ? 'generation 0 · ' + pct(h.acc) : h.kept ? 'kept ' + sgn(h.acc - h.bestBefore) : 'rejected ' + sgn(h.acc - h.bestBefore);
            return html`<div className="logrow" key=${h.run}><span className="mono muted xs">Gen ${h.run - 1}</span><span className="xs clip">${(F.live ? runs[h.run - 1] : D.RUNS_NYC[h.run - 1]).hyp}</span><span className="xs strong" style=${{ color: h.status === 'skipped' ? 'var(--ink-muted)' : h.kept ? 'var(--good)' : 'var(--critical)' }}>${result}</span></div>`;
          })}${[0, 1, 2].slice(Math.min(3, st.history.length)).map(function (k) {  // keep three rows' worth of space
            return html`<div className="logrow placeholder" key=${'p' + k} aria-hidden="true"><span className="mono xs">Gen</span><span className="xs"> </span><span className="xs"> </span></div>`;
          })}</div>
          <span className="muted tiny push-bottom">${F.live ? 'Replay of the recorded run ' + F.run + ' (real Jev, real curator, real gate). A live run is started from the backend: ./sightline.sh loop.' : 'Plays about 3× faster than the real loop. Example data: stylized map and made-up scores.'}</span>
        </div>
      </div>
    </div>`;
  }

  // ---------- summary: the elevator pitch on one screen ----------
  // Summary: how a block gets its call during the storm, and how the curation step learns offline, round by round.
  var PIPE = [['Reports come in', '911, 311, drones, social posts, surveys'], ['Sightline curates', 'Picks 12 key reports and decodes them'],
    ['Jev classifies', 'Intact, flooded, collapsed, fire…'], ['Crews go out', 'Rescue-critical blocks first']];
  // The learning loop as a cycle: five steps around a ring, clockwise, with the run's round count in the middle.
  var CYCLE = [['Propose', 'one change'], ['Screen', 'quick test'], ['Backtest', 'past storms'], ['Gate', 'keep if better'], ['Remember', 'save the lesson']];
  function LoopViz() {
    var W = 330, H = 196, cx = 165, cy = 100, r = 58;
    var pt = function (deg, rad) { var a = deg * Math.PI / 180; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    return html`<svg className="loopviz" width=${W} height=${H} viewBox=${'0 0 ' + W + ' ' + H} role="img" aria-label="The learning loop: propose, screen, backtest, gate, remember, then again">
      <circle cx=${cx} cy=${cy} r=${r} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      ${CYCLE.map(function (s, k) {
        var mid = pt(-54 + k * 72, r);  // a chevron between this step and the next, pointing clockwise
        return html`<path key=${'a' + k} d="M -3.5 -4 L 1.5 0 L -3.5 4" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5"
          transform=${'translate(' + mid[0].toFixed(1) + ' ' + mid[1].toFixed(1) + ') rotate(' + (-54 + k * 72 + 90) + ')'} />`;
      })}
      ${CYCLE.map(function (s, k) {
        var deg = -90 + k * 72, p = pt(deg, r), c = Math.cos(deg * Math.PI / 180);
        var top = k === 0, anchor = top ? 'middle' : c > 0 ? 'start' : 'end';
        var lx = top ? p[0] : p[0] + (c > 0 ? 16 : -16), ly = top ? p[1] - 26 : p[1] + (k === 2 || k === 3 ? 4 : -4);
        return html`<g key=${s[0]}>
          <circle cx=${p[0]} cy=${p[1]} r="10" fill="var(--accent)" />
          <text x=${p[0]} y=${p[1] + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--on-accent)" fontFamily="var(--font-mono)">${k + 1}</text>
          <text x=${lx} y=${ly} textAnchor=${anchor} fontSize="13" fontWeight="600" fill="var(--ink)">${s[0]}</text>
          <text x=${lx} y=${ly + 14} textAnchor=${anchor} fontSize="11" fill="var(--ink-muted)">${s[1]}</text>
        </g>`;
      })}
    </svg>`;
  }

  // False dispatches: a life-safety call on a block the assessment found intact (the scorer's definition).
  function falseIdx(cells) {
    var out = [];
    cells.forEach(function (c, i) { if (CRIT[c] && F.truth[i] === 'intact') out.push(i); });
    return out;
  }
  // Blocks this map got right (live: the run's own scoring; example data: compare with the assessment).
  function rightIdx(props) {
    var out = [];
    props.cells.forEach(function (c, i) { var ok = props.ok ? props.ok[i] : (F.truth[i] && F.truth[i] !== 'water' && F.truth[i] !== 'park' ? c === F.truth[i] : null); if (ok) out.push(i); });
    return out;
  }
  // Blocks the first pass got wrong and the learned harness got right (the run's own scoring).
  function fixedIdx() {
    var out = [];
    if (F.zero.ok && F.evolved.ok) F.zero.ok.forEach(function (ok, i) { if (ok === false && F.evolved.ok[i] === true) out.push(i); });
    else F.truth.forEach(function (t, i) { if (t && t !== 'water' && t !== 'park' && F.zero.cells[i] !== t && F.evolved.cells[i] === t) out.push(i); });
    return out;
  }
  function DispatchMap(props) {
    // Outline each false dispatch. Measured from the first cell, so the outlines sit on the grid whatever the
    // map's own padding; the stage is scaled, hence the offsetWidth / rect ratio.
    var ref = useRef(null), o = useState(null), off = o[0], setOff = o[1];
    useEffect(function () {
      var d = ref.current, c = d && d.querySelector('[data-i="0"]'), c1 = d && d.querySelector('[data-i="33"]');
      if (!c || !c1) return;
      var b = d.getBoundingClientRect(), r = c.getBoundingClientRect(), r1 = c1.getBoundingClientRect(), k = b.width ? d.offsetWidth / b.width : 1;
      // pitch = cell + gap (maps of 10px cells and up have a 1px gap between cells)
      setOff({ x: (r.left - b.left) * k, y: (r.top - b.top) * k, cell: r.width * k, pitch: (r1.left - r.left) * k });
    }, []);
    return html`<div className=${'dmap' + (props.highlight === 'right' ? ' rightmode' : '')} ref=${ref}>
      <${S.DamageMap} cells=${props.cells} confidence=${props.conf} cellSize=${props.cellSize || 10} caption=${props.caption} meta=${props.meta} label=${props.label} />
      ${off ? (props.highlight === 'right' ? rightIdx(props) : props.highlight === 'fixed' || props.highlight === 'tofix' ? fixedIdx() : falseIdx(props.cells)).map(function (i) {
        var st = props.highlight === 'right' ? S.STATES.filter(function (s) { return s.key === props.cells[i]; })[0] : null;
        return html`<span key=${i} className=${'fring' + (props.highlight === 'right' ? ' right' : props.highlight === 'fixed' ? ' fixed' : '')} style=${{ left: off.x + (i % 32) * off.pitch, top: off.y + Math.floor(i / 32) * off.pitch, width: off.cell, height: off.cell, background: st ? 'var(--' + st.fill + ')' : undefined }}></span>`;
      }) : null}
    </div>`;
  }

  function Summary(props) {
    return html`<div className="screen">
      <${Header} place=${F.live ? 'Hurricane damage mapping · New York' : 'Hurricane damage mapping · example data'} clock="" mode="live" modeLabel="Summary" />
      <div className="summary">
        <div className="sum-left">
          <div className="col gap10">
            <h1 className="hero">Send rescue crews where the damage actually is.</h1>
            <p className="lead wide">After a hurricane, the reports conflict: 911 calls pinned to the wrong block, viral "verified" rumors, two agencies grading damage on different scales. Sightline learns which reports to trust and how to read them, before the AI decides where crews go.</p>
          </div>
          <div className="col gap12">
            <div className="col gap4"><strong className="small">Tonight's storm, block by block</strong>
              <span className="muted maplead">Each square is a city block, colored by the damage Jev classified. Our evolution loop improves the signals Jev receives, so fewer crews go to blocks that were fine (outlined in red).</span></div>
            <div className="maps2">
              <${DispatchMap} cells=${F.zero.cells} conf=${F.zero.conf} caption="Before learning" meta=${M.fd[0] + ' false dispatches'} label="Tonight's map, generation 0" />
              <${DispatchMap} cells=${F.evolved.cells} conf=${F.evolved.conf} caption="After learning" meta=${M.fd[1] + ' false dispatches'} label="Tonight's map, evolved harness" />
            </div>
          </div>
        </div>
        <div className="sum-right">
          <div className="col gap20"><span className="eyebrow">How it works</span>
          <div className="col gap10"><strong className="small">During the storm, for every block</strong>
            <div className="pipe">${PIPE.map(function (l, k) {
              return html`<div className=${'loopstep' + (k === 1 ? ' hi' : '')} key=${l[0]}><strong>${l[0]}</strong><span>${l[1]}</span></div>`;
            })}</div>
          </div></div>
          <div className="col gap10"><strong className="small">Round by round, a curator AI improves the curation step</strong>
            <div className="loopnotes">
              <${LoopViz} />
              <div className="col gap10"><span className="muted xs">What it learned on its own</span>
                <div className="learned">${SHORT.map(function (t) { return html`<span key=${t}>${t}</span>`; })}</div></div>
            </div>
          </div>
          <div className="col gap8">
            <div className="row between"><strong className="small">${M.label}</strong><span className="muted xs">Before → after learning</span></div>
            <div className="kpis">
              <${Kpi} label="False dispatches" from=${M.fd[0]} to=${M.fd[1]} />
              <${Kpi} label="Rescue-critical found" from=${M.crit[0]} to=${M.crit[1]} unit=${'/' + M.critTotal} />
              <${Kpi} label=${ACC} from=${pct(M.acc[0])} to=${pct(M.acc[1])} />
            </div>
          </div>
          <div className="notes">
            <span><strong>Simulated storms</strong>in real NYC report formats</span>
            <span><strong>A fair test</strong>answers locked away from Sightline</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- how we built this ----------
  var REPO = 'https://github.com/hughesbrayden/sightline';
  var ROBUST = [
    ['The gate is noise: one block flip can move the score about 2 points.', "The gate compares old and new block by block on two test storms, and keeps a change only if it's better with 90% confidence."],
    ['One number decides everything.', 'Guardrails: the training storms may not drop more than 1 point, and expected harm (5 × missed life-safety blocks + false dispatches) may not rise more than 5%.'],
    ['The curator only hears "fail".', 'A diff digest: which blocks the change fixed and broke, with before/after traces. Predictions are numeric and scored.'],
    ['No memory between stateless curator calls.', 'A vector lab notebook: every generation writes a lesson to Atlas; the prompt retrieves the most relevant ones with $vectorSearch, and repeats of rejected ideas are skipped.'],
    ['Every idea costs a full evaluation.', 'A screen on a stratified dev sample rejects clearly bad ideas at a fraction of the calls (lab runs).'],
    ['Accepted rules pile up.', 'A prune pass removes each rule in turn and keeps only those that measurably help: the survivors are "what it learned" (lab runs).']
  ];
  function hideBroken(e) { e.target.closest('.hcard').style.display = 'none'; }

  function How() {
    var b = F.refs && F.refs.baseline;
    return html`<div className="screen">
      <${Header} place="How we built this" clock=${F.live ? 'Recorded run ' + F.run : 'Example data'} mode="review" modeLabel="Architecture" />
      <div className="howscroll">
        <div className="howgrid">
          <div className="hcard"><h3>The problem</h3><p>Fast decision models answer in about a quarter of a second, but they see only a sliver of the data, and that sliver decides whether they're right. Six hours after a hurricane the evidence contradicts itself: 911 calls filed at the wrong block, viral "verified" rumors, two agencies with two damage scales, a utility feed that says "de-energized" for a whole neighborhood.${b ? ' Shown the 12 nearest reports, Jev makes ' + b.dev_false_dispatches + ' false dispatches across three past storms.' : ''}</p></div>
          <div className="hcard"><h3>What we built</h3><ol>
            <li>A curator AI proposes one change to how reports are curated.</li>
            <li>It compiles to a MongoDB pipeline ($geoNear, $match, $switch) that picks what Jev sees per block.</li>
            <li>Jev maps every block: ${CALLS.toLocaleString('en-US')} calls per round.</li>
            <li>A scorer grades the map against an answer key the curator can't read.</li>
            <li>A gate on two separate storms keeps a change only if it very likely helps (P ≥ 0.9) without raising harm.</li>
            <li>The final version is scored once on tonight's storm.</li></ol></div>
          <div className="hcard"><h3>Why it's different</h3><ul>
            <li>It optimizes <em>context</em>: not prompts, not weights.</li>
            <li>It's a fair test: the curator never sees the test storms, and tonight's storm is scored once.</li>
            <li>The answer lock is enforced by MongoDB roles, not by trusting the agent. A live probe shows the refusal:</li></ul>
            <code className="probe">denied (code 13): ${PROBE}</code></div>
        </div>
        <div className="howsec"><h2>How it works</h2>
          <p className="muted small" style=${{ margin: 0, maxWidth: 900 }}>Four parts, three locked database logins. The answer key is readable only by the scorer; the curator's login is refused. The loop is the standard self-evolving pattern (execute → trace → propose → gate → keep, with lineage), hardened against the failure modes that pattern is known for.</p>
          <div className="howgrid2">
            <a className="hcard" href="/arch-system.png" target="_blank" rel="noopener"><img src="/arch-system.png" alt="System: the storm world loads MongoDB Atlas; the harness loop reads reports with the curator login and the answer key with the scorer login only; the curator's attempt to read answers is denied" onError=${hideBroken} /></a>
            <a className="hcard" href="/arch-loop.png" target="_blank" rel="noopener"><img src="/arch-loop.png" alt="Harness loop: propose one change with a prediction, screen on about 600 dev blocks, Jev maps dev and two validation storms, gate on P(better) ≥ 0.9 with guardrails, and every outcome becomes a lesson in the Atlas notebook" onError=${hideBroken} /></a>
          </div>
        </div>
        <div className="howsec"><h2>The robust loop</h2>
          <div className="hcard" style=${{ padding: 0 }}><table className="htable"><thead><tr><th>Weakness of a simple loop</th><th>What the robust loop does</th></tr></thead>
            <tbody>${ROBUST.map(function (r, k) { return html`<tr key=${k}><td style=${{ width: '40%' }}>${r[0]}</td><td>${r[1]}</td></tr>`; })}</tbody></table></div>
          <p className="muted xs" style=${{ margin: 0 }}>The recorded run live-2 ran on the gate, guardrails and notebook above; the screen and prune pass were proven in the lab. The earlier run live-1 used the simple loop (one validation storm, a 1-point margin) and stalled after generation 3. The comparison with a naive loop and random mutation is in <a href=${REPO + '/blob/main/DEMO.md#robust-loop-vs-naive-loop-vs-random'} target="_blank" rel="noopener">DEMO.md</a>.</p>
        </div>
        <div className="howsec small">
          <span><strong>Stack.</strong> TypeSafe Jev (jev-latest) · blind Claude curator · MongoDB Atlas: geo queries, time-series runs, vector-indexed memory, collection-level custom roles · LangSmith traces per generation · Python harness · Next.js on Vercel · Sightline design system.</span>
          <span className="muted">Team: Kishore Bhatia & Brayden Hughes · MongoDB NYC Harness Engineering & Model Wrangling. Live, read-only API: <a href="/api/state" target="_blank" rel="noopener">/api/state</a>, /api/map, /api/block, /api/reports. Source and runbook on <a href=${REPO} target="_blank" rel="noopener">GitHub</a>.</span>
        </div>
      </div>
    </div>`;
  }

  // ---------- shell: four tabs ----------
  var TABS = [['summary', 'Summary'], ['story', 'Story'], ['arena', 'Live arena'], ['how', 'How we built this']];

  function App() {
    var qs = new URLSearchParams(location.search);
    var beat = Number(qs.get('beat')) || 0;
    var v0 = qs.get('view');
    if (!TABS.some(function (t) { return t[0] === v0; })) v0 = beat ? 'story' : 'summary';
    var s1 = useState(Math.min(7, Math.max(1, beat || 1))), step = s1[0], setStep = s1[1];
    var s2 = useState(v0), view = s2[0], setView = s2[1];
    var s3 = useState('idle'), arena = s3[0], setArena = s3[1];
    var pos = useRef(); pos.current = { view: view, step: step };
    function beatTo(n) { setView('story'); setStep(n); }
    // One linear path for the clicker, in tab order: Summary → the six beats → Live arena → How we built this.
    function nav(dir) {
      var p = pos.current;
      if (p.view === 'summary') { if (dir > 0) beatTo(1); return; }
      if (p.view === 'how') { if (dir < 0) setView('arena'); return; }
      if (p.view === 'arena') { if (dir > 0) setView('how'); else beatTo(7); return; }
      if (p.step === 1 && dir < 0) { setView('summary'); return; }
      if (p.step === 7 && dir > 0) { setView('arena'); return; }
      beatTo(p.step + dir);
    }
    useEffect(function () {
      function onKey(e) {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if (e.key === 'ArrowRight') nav(1);
        if (e.key === 'ArrowLeft') nav(-1);
      }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, []);
    var story = view === 'story';
    var show = function (on) { return { display: on ? 'block' : 'none' }; };
    return html`<div className="app">
      <div style=${show(view === 'summary')}><${Summary} go=${function (v) { if (v === 'story') beatTo(1); else setView(v); }} /></div>
      <div style=${show(story)}><${Story} beat=${step} visible=${story} onNext=${function () { nav(1); }} /></div>
      <div style=${show(view === 'arena')}><${Arena} onStatus=${setArena} /></div>
      <div style=${show(view === 'how')}><${How} /></div>
      <nav className="presenter" aria-label="Presenter controls">
        <div className="row gap10">
          <div className="seg" role="tablist" aria-label="View">${TABS.map(function (t) {
            var on = view === t[0];
            return html`<button key=${t[0]} role="tab" className=${on ? 'on' : ''} aria-selected=${on} onClick=${function () { if (t[0] === 'story') beatTo(step); else setView(t[0]); }}>${t[1]}${t[0] === 'arena' ? (arena === 'running' ? html` <span className="live-dot"></span>` : arena === 'done' ? ' ✓' : '') : ''}</button>`;
          })}</div>
        </div>
        <div className="steps" style=${{ visibility: story ? 'visible' : 'hidden' }}>${NAMES.map(function (name, i) {
          var n = i + 1, on = story && n === step;
          return html`<button key=${n} className=${'step' + (on ? ' on' : '')} aria-label=${'Beat ' + n + ': ' + name} aria-current=${on ? 'step' : 'false'} onClick=${function () { beatTo(n); }}>${on ? n + ' · ' + name : n}</button>`;
        })}</div>
        <div className="row gap8">
          <span className="muted xs">← → keys</span>
          <button className="ghost" disabled=${view === 'summary'} onClick=${function () { nav(-1); }}>Back</button>
          <button className="dark" disabled=${view === 'how'} onClick=${function () { nav(1); }}>Next</button>
        </div>
      </nav>
    </div>`;
  }

  // ---------- fit the 1440×964 stage to the window ----------
  function fit() {
    var stage = document.getElementById('stage'), wrap = document.getElementById('wrap');
    var k = Math.min(window.innerWidth / 1440, window.innerHeight / 964);
    stage.style.transform = 'scale(' + k + ')';
    wrap.style.width = Math.floor(1440 * k) + 'px';
    wrap.style.height = Math.floor(964 * k) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  ReactDOM.createRoot(document.getElementById('stage')).render(html`<${App} />`);
})();
