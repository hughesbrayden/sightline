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

  // ---------- story steps ----------
  var CLOCK = { 1: 'Tuesday 21:00', 2: 'Tuesday 23:44 · landfall', 3: 'Wednesday 01:15', 4: 'Nine days later · assessment in', 5: 'Between storms', 6: 'Replay of Tuesday night', 7: 'Miami · next hurricane season' };
  var MODE = { 1: 'live', 2: 'live', 3: 'live', 4: 'review', 5: 'training', 6: 'review', 7: 'live' };
  var MODE_LABEL = { live: 'Live', review: 'Fitness signal', training: 'Evolution' };
  var CTA = { 1: 'Storm makes landfall', 2: 'Run generation 0', 3: 'Skip ahead: the assessment arrives', 4: 'Evolve the harness on past storms', 5: 'Replay the night with the evolved harness', 6: 'Try another city' };

  function Story(props) {
    var step = props.step;
    var tick = useTicker(step === 2 || step === 3 || step === 5, step, 250);
    var next = CTA[step] ? html`<${Cta} label=${CTA[step]} onClick=${props.onNext} />` : null;
    var legend = html`<${S.DamageLegend} states=${['intact', 'minor', 'street', 'home', 'wind', 'major', 'destroyed', 'power']} />`;
    var place = step === 7 ? (F.live ? 'Three cities it never saw · next hurricane season (simulated)' : 'Miami · Downtown, Brickell and Miami Beach') : (F.place || 'New York · Lower Manhattan and the Brooklyn waterfront');
    var modeLabel = step === 6 ? 'Adaptation proven' : MODE_LABEL[MODE[step]];
    var header = html`<${Header} place=${place} clock=${CLOCK[step]} mode=${MODE[step]} modeLabel=${modeLabel} />`;

    if (step === 5) return html`<div className="screen">${header}<${Training} tick=${tick} next=${next} /></div>`;

    var map, panel;
    if (step === 1) {
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
    if (step === 2) {
      var n = Math.min(F.pins.length, 3 + tick * 2), frac = n / F.pins.length;
      var grow = function (v) { return Math.round(v * frac).toLocaleString('en-US'); };
      var feed = F.feed.slice(0, Math.min(F.feed.length, 1 + Math.floor(tick / 6)));
      map = { cells: F.calm, caption: 'Incoming reports', meta: n + ' on the map', pins: F.pins.slice(0, n) };
      panel = html`
        <div className="intro"><h2>Reports are flooding in</h2><p className="muted lead">${grow(F.counts.total || 10164)} reports so far. Some of them are wrong.</p></div>
        <div className="counts">${[['911', 'call', F.counts.calls], ['311', 'ticket', F.counts.tickets], ['Drone', 'drone', F.counts.drone], ['Social', 'social', F.counts.social], ['Utility', 'utility', F.counts.utility]].map(function (c) {
          return html`<div className="stat" key=${c[0]}><span className="muted small row gap6"><span style=${pinStyle(c[1])}></span>${c[0]}</span><span className="mono num md">${grow(c[2])}</span></div>`;
        })}</div>
        <div className="feed">${feed.map(function (f, k) {
          return html`<div className="feedrow" key=${k}><span className="mono muted xs">${f.time}</span><span className="xs strong muted">${f.src}</span><span>${f.text}</span>${f.odd ? html`<span className="flag">Looks off</span>` : html`<span></span>`}</div>`;
        })}</div>`;
    }
    if (step === 3) {
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
      map = { gen: F.src ? F.src.zeroGen : null, cells: cells, conf: conf, caption: "Jev's map · generation 0", meta: running ? 'Jev is deciding block by block' : 'the unevolved harness', clickable: !running, inflight: running ? inflight : [] };
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
          <div className="intro"><h2>Generation 0 triages every block</h2><p className="muted lead">The unevolved harness hands Jev the 12 reports nearest each block, taken at face value. Jev decides each block in ${F.live ? 'about 0.3 s' : 'about 165 ms'}, 16 at a time.</p></div>
          <div className="runbox">
            <div className="row between end"><div className="col gap2"><span className="muted small">Jev calls</span><span className="mono num xl">${(F.live ? Math.round(mapped / 1024 * LAND) : mapped).toLocaleString('en-US')}<span className="unit"> / ${LAND.toLocaleString('en-US')}</span></span></div>
              <div className="col gap2 right"><span className="muted small">Flagged rescue-critical so far</span><span className="mono num md">${flagged}</span></div></div>
            <div className="runbar"><div style=${{ width: pctDone + '%' }}></div></div>
            <span className="muted xs">16 calls in parallel · generation 0 · Jev frozen</span>
          </div>
          <div className="readcard">
            <div className="row between"><strong className="small">Now reading block ${cr + 1}-${cc + 1}</strong><span className="muted xs">${D.where(cr, cc)} · ${Math.min(5, lines.length)} of ${lines.length} lines shown</span></div>
            <ol className="readlines">${lines.slice(0, 5).map(function (l, k) {
              return html`<li key=${k}><span className="mono muted">${String(k + 1).padStart(2, '0')}</span><span className="mono muted clip">${l.src} · ${typeof l.m === 'number' ? l.m + ' m' : l.m}</span><span className="clip">${l.text}</span></li>`;
            })}</ol>
            <div className="answer"><span className="muted xs">Jev</span><span className="swatch-inline" style=${{ background: 'var(--' + (S.STATES.filter(function (s) { return s.key === answer; })[0] || { fill: 'dmg-intact' }).fill + ')' }}></span><strong>${LABEL[answer] || answer}</strong><span className="mono muted">${answerConf.toFixed(2)}</span></div>
          </div>
          <div className="col"><strong className="small pad8">Latest decisions</strong>
            ${recent.map(function (b) {
              var br = Math.floor(b / 32), bc = b % 32;
              return html`<div className="decrow" key=${b}><span className="mono xs">${br + 1}-${bc + 1}</span><span className="xs muted clip">${D.where(br, bc)}</span><span className="xs clip">${LABEL[F.zero.cells[b]]}</span><span className="mono xs right">${F.zero.conf[b].toFixed(2)}</span></div>`;
            })}
          </div>`;
      } else {
        panel = html`
          <div className="intro"><h2>Generation 0 triages every block</h2><p className="muted lead">The unevolved harness: the 12 reports nearest each block, taken at face value. ${F.live ? 'All ' + LAND.toLocaleString('en-US') + ' blocks in about 15 seconds of Jev calls.' : 'All 1,024 blocks in about 15 seconds.'}</p></div>
          <div className="stats"><${Stat} label="Blocks flagged rescue-critical" value=${flagged} size="xxl" /></div>
          <div className="col"><strong className="small pad8">Dispatch list, most confident first</strong>
            ${F.zero.top.map(function (t, k) {
              return html`<div className="trow" key=${k}><span className="mono muted xs">${k + 1}</span><span className="mono xs">${t.block}</span><span>${t.where}</span><span>${LABEL[t.state]}</span><span className="mono xs right">${t.conf}</span></div>`;
            })}
          </div>`;
      }
    }
    if (step === 4) {
      map = { gen: F.src ? F.src.zeroGen : null, cells: F.zero.cells, truth: F.truth, mode: 'diff', caption: 'Generation 0 vs the assessment', meta: 'wrong blocks at full strength', clickable: true, showTruth: true,
        marks: F.misreads.map(function (m) { return { n: m.n, r: m.r, c: m.c }; }) };
      panel = html`
        <div className="intro"><h2>The fitness signal arrives</h2><p className="muted lead">Generation 0's map, scored against the official assessment. It shows exactly where the unevolved harness failed.</p></div>
        <div className="stats"><${Stat} label="Blocks right" value=${pct(F.zero.acc)} size="xl" color="var(--critical)" /><${Stat} label="Rescue-critical found" value=${F.zero.critFound} unit=${'/' + F.zero.critTotal} size="xl" /><${Stat} label="Crews sent to the wrong block" value=${F.zero.falseAlarms} size="xl" /></div>
        <div className="col gap12"><strong className="small">Evidence taken too literally</strong>
          ${F.misreads.map(function (m) {
            return html`<div className="misread" key=${m.n}><span className="mark static">${m.n}</span><div className="col gap2"><span className="strong">${m.title} <span className="muted normal">· ${m.where}</span></span><span className="small">${m.text}</span><span className="muted xs">Jev: ${m.jev} · Assessment: ${m.truth}</span></div></div>`;
          })}
        </div>`;
    }
    if (step === 6) {
      map = { gen: F.src ? F.src.bestGen : null, cells: F.evolved.cells, conf: F.evolved.conf, caption: "Jev's map · evolved harness" + (F.live ? ', generation ' + F.bestGen : ''), meta: 'same night, replayed', clickable: true, showTruth: true,
        marks: F.misreads.map(function (m) { return { n: m.n, r: m.r, c: m.c, tone: 'good' }; }) };
      panel = html`
        <div className="intro"><h2>The evolved harness, on the same night</h2><p className="muted lead">${F.replayNote || "Same reports, same frozen Jev. Only the harness changed: how it picks and reads Jev's 12 lines."}</p></div>
        <div className="compare">
          <div className="crow head"><span></span><span>Generation 0</span><span>Evolved</span></div>
          ${[['Blocks right', pct(F.zero.acc), pct(F.evolved.acc)], ['Rescue-critical blocks found (of ' + F.zero.critTotal + ')', F.zero.critFound, F.evolved.critFound], ['Crews sent to the wrong block', F.zero.falseAlarms, F.evolved.falseAlarms]].map(function (c) {
            return html`<div className="crow" key=${c[0]}><span>${c[0]}</span><span className="mono before">${c[1]}</span><span className="mono after">${c[2]}</span></div>`;
          })}
        </div>
        <div className="col gap10"><strong className="small">${F.live ? "Generation 0's " + F.misreads.length + ' most confident misreads: ' + F.misreads.filter(function (m) { return m.fixedBy != null; }).length + ' now handled' : "Generation 0's four misreads, now handled"}</strong>
          ${(F.live ? F.misreads.map(function (m) { return m.title + ': ' + (m.fixedBy != null ? 'fixed by the evolved harness (generation ' + m.fixedBy + ').' : 'still wrong.'); })
            : ['Accounts that never match drone passes are treated as rumor.', 'The utility feed is swapped back to latitude, longitude.', 'Both agencies’ damage scales are translated before Jev reads them.', '911 calls match blocks within 150 m, not exact addresses.']).map(function (t, k) {
            return html`<div className="misread" key=${k}><span className="mark static good">${k + 1}</span><span className="small">${t}</span></div>`;
          })}
        </div>`;
    }
    if (step === 7) {
      var miami = F.cities[1];
      map = { cells: miami.cells, conf: miami.conf, caption: F.live ? 'Miami · next season, frozen policy' : 'Miami · first storm, blind', meta: F.live ? pct(miami.acc) + ' balanced, scored once' : pct(miami.acc) + ' after the assessment' };
      if (F.live) {
        panel = html`
        <div className="intro"><h2>Same harness, cities it never saw</h2><p className="muted lead">The frozen policy from generation ${F.bestGen}, scored once on tonight's storm and on next season's storms in three other cities. None of them was used for training or selection.</p></div>
        <div className="col gap10 ruled"><strong className="small">Balanced accuracy, scored once with the frozen policy</strong>
          ${F.cities.map(function (c) {
            return html`<div className="barrow" key=${c.key}><span>${c.name}<span className="muted xs"> · ${c.area}</span></span><div className="track"><div style=${{ width: (c.acc * 100).toFixed(0) + '%' }}></div></div><span className="mono right">${(c.acc * 100).toFixed(1)}</span></div>`;
          })}
        </div>
        <div className="col gap8"><strong className="small">What it learned and brought along</strong>${F.rules.map(function (l, k) { return html`<span className="small" key=${k}>${l.text} <span className="mono muted xs">Gen ${l.gen}</span></span>`; })}</div>
        <div className="facts"><span>The answers are locked to the scorer. The harness's login was refused.</span><span>${F.confFact}</span><span>${F.speedFact}</span></div>`;
      } else {
      panel = html`
        <div className="intro"><h2>Same harness, a new city</h2><p className="muted lead">Miami grows its own lineage, because its feeds and water are different. It starts from everything the harness learned in New York.</p></div>
        <div className="col gap10 ruled"><strong className="small">Generation 0 in each new city, before any evolution</strong>
          ${F.cities.map(function (c) {
            return html`<div className="barrow" key=${c.key}><span>${c.name}</span><div className="track"><div style=${{ width: (c.start * 100).toFixed(0) + '%' }}></div></div><span className="mono right">${(c.start * 100).toFixed(0)}</span></div>`;
          })}
        </div>
        <div className="col gap8"><strong className="small">What it learned and brought along</strong>${D.LESSONS.slice(0, 3).map(function (l, k) { return html`<span className="small" key=${k}>${l.text}</span>`; })}</div>
        <div className="facts"><span>The answers are locked to the scorer. The harness's login was refused.</span><span>Confidence isn't a check. A few field-verified blocks are.</span><span>One 1,024-block map in about 15 seconds.</span></div>`;
      }
    }

    return html`<div className="screen">${header}
      <div className="body">
        <${MapStage} resetKey=${step} ...${map} label=${map.caption} />
        <div className="panel">${panel}<div className="panel-foot">${next}${legend}</div></div>
      </div>
    </div>`;
  }

  function Training(props) {
    var runs = F.runs, n = runs.length;
    var cur = Math.min(n - 1, Math.floor(props.tick / 10));
    var shown = cur;
    while (shown > 0 && runs[shown].cells == null) shown--;
    var best = null;
    var curve = runs.map(function (r, i) {
      if (i > cur || r.acc == null) return i > cur ? null : best;
      if (r.status === 'accepted' && (best == null || r.acc > best)) best = r.acc;
      return best;
    });
    return html`<div className="body">
      <div className="tonight">
        <span className="tag tag-live"><span className="pill-dot"></span>Tonight · live</span>
        <${S.DamageMap} cells=${F.zero.cells} confidence=${F.zero.conf} cellSize=${9} label="Tonight's generation 0 map" />
        <span className="small">Generation 0 scored <span className="mono">${pct(F.zero.acc)}</span>. It waits here for the evolved harness.</span>
      </div>
      <div className="col gap10">
        <div className="row between"><span className="tag tag-train"><span className="pill-dot"></span>${F.live ? 'Evolution · backtest on past storms (Miami shown)' : 'Evolution · Storm 1, October · assessed'}</span><span className="mono small">Generation ${runs[cur].run - 1} of ${LAST}</span></div>
        <${S.DamageMap} cells=${runs[shown].cells} confidence=${runs[shown].conf} cellSize=${15} label="Past storm map at the current generation" />
        <div className="row between"><span className="muted small">${F.live ? 'Selection: validation storm balanced accuracy (the gate)' : "Fitness: scored against Storm 1's official assessment"}</span><span className="mono num md" style=${{ color: 'var(--series-heldout)' }}>${pct(runs[shown].acc)}</span></div>
      </div>
      <div className="col gap12 grow">
        <strong className="small">Generations: what the harness is trying</strong>
        <div className="col">${runs.map(function (r, i) {
          if (F.live && (i < cur - 3 || i > cur + 1)) return null;  // live: a window around the current generation
          var done = i <= cur;
          var result = !done ? 'queued' : r.status === 'accepted' ? (r.run === 1 ? 'generation 0' : 'kept') : r.status === 'rejected' ? 'rejected by the gate' : (F.live ? 'not scored' : 'skipped by memory');
          var color = !done ? 'var(--ink-muted)' : r.status === 'accepted' ? 'var(--good)' : r.status === 'rejected' ? 'var(--critical)' : 'var(--ink-muted)';
          return html`<div className=${'logrow' + (i === cur ? ' current' : '')} style=${{ opacity: done ? 1 : 0.45 }} key=${i}><span className="mono muted xs">Gen ${r.run - 1}</span><span className="xs">${F.live && r.hyp.length > 120 ? r.hyp.slice(0, 117) + '…' : r.hyp}</span><span className="xs strong" style=${{ color: color }}>${result}</span></div>`;
        })}</div>
        ${props.next}
        <${S.ScoreCurve} train=${curve} xLabels=${runs.map(function (r) { return 'Gen ' + (r.run - 1); })} trainLabel=${F.live ? 'Lineage, validation' : 'Lineage so far on Storm 1'} min=${0.2} max=${1} width=${420} height=${150} label="Score by generation" />
      </div>
    </div>`;
  }

  // ---------- live arena ----------
  var PLAN_NORMAL = [['Propose', 2], ['Compile', 0.8], ['Backtest', 4], ['Score', 0.8], ['Verdict', 1.4]];
  var PLAN_SKIP = [['Propose', 2], ['Memory check', 1.4], ['Verdict', 1.4]];

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
    var base = bestRun ? bestRun.cells : F.calm, baseConf = bestRun ? bestRun.conf : null;
    var cells = base, conf = baseConf, caption = bestRun ? 'Lineage so far · generation ' + (bestRun.run - 1) : 'Waiting to start', meta = bestRun ? pct(bestRun.acc) + ' right' : '';
    var phaseName = st.started && !st.done ? plan[st.phase][0] : '';
    var mapped = 0;
    if (phaseName === 'Backtest' && run.cells) {
      mapped = Math.floor((st.pt / plan[st.phase][1]) * 1024);
      cells = run.cells.map(function (c, i) { return i < mapped ? c : base[i]; });
      conf = run.cells.map(function (c, i) { return i < mapped ? run.conf[i] : (baseConf ? baseConf[i] : 1); });
      caption = 'Generation ' + (run.run - 1) + ' · backtest'; meta = mapped.toLocaleString('en-US') + ' of 1,024 blocks';
    } else if ((phaseName === 'Score' || phaseName === 'Verdict') && run.cells) {
      cells = run.cells; conf = run.conf; caption = 'Generation ' + (run.run - 1) + ' · candidate'; meta = phaseName === 'Score' ? 'scoring' : pct(run.acc) + ' right';
    }
    var bestAcc = bestRun ? bestRun.acc : null, startAcc = st.history.length ? st.history[0].acc : null;
    var src = F.live ? runs[st.iter] : D.RUNS_NYC[st.iter];
    var improves = F.live ? run.status === 'accepted' : run.run === 1 || (bestAcc != null && run.acc > bestAcc);
    var status = !st.started ? '' : st.done ? 'Finished. ' + pct(bestAcc) + ' right, up from ' + pct(startAcc) + ' at generation 0.' : {
      Propose: 'Reading the last generation’s mistakes and writing one change…',
      Compile: 'Compiling the policy into a MongoDB aggregation pipeline…',
      Backtest: 'Backtest: Jev is mapping ' + mapped.toLocaleString('en-US') + ' of 1,024 blocks…',
      Score: 'Scoring against the official assessment (scorer login only)…',
      'Memory check': 'Checking memory for similar failed ideas…',
      Verdict: run.status === 'skipped' ? (F.live ? (run.note || 'Not scored.') : 'Skipped by memory: too close to generation 2, which failed. Not scored.') : run.run === 1 ? 'Generation 0 set: ' + pct(run.acc) + ' right.' : improves ? 'Kept: ' + sgn(run.acc - bestAcc) + ' points. It joins the lineage.' : 'Rejected by the gate: ' + sgn(run.acc - (bestAcc || 0)) + ' points' + (F.live && run.acc > bestAcc ? ', under the 1-point margin' : '') + '. The lineage stays as it was.'
    }[phaseName];
    var statusColor = st.done ? 'var(--good)' : phaseName !== 'Verdict' || run.status === 'skipped' ? 'var(--ink-muted)' : improves ? 'var(--good)' : 'var(--critical)';

    var curveBest = [], tries = [], running = null;
    runs.forEach(function (r, i) {
      var h = st.history[i];
      if (!h) { curveBest.push(null); tries.push(null); return; }
      if (h.kept) running = h.acc;
      curveBest.push(running); tries.push(h.status === 'skipped' ? null : h.acc);
    });
    var secs = Math.floor(st.elapsed * 3.2);
    var clock = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');

    return html`<div className="screen">
      <${Header} place=${F.live ? 'Replay of recorded run ' + F.run + ' · backtest Miami, Houston, New Orleans · gate on the NYC validation storm' : 'New York · Storm 1, October · official assessment on file, locked to the scorer'} clock=${'Generation ' + (st.started ? run.run - 1 : 0) + ' of ' + LAST + ' · elapsed ' + clock} mode="training"
        modeLabel=${!st.started ? 'Evolution ready' : st.done ? 'Evolution done' : 'Evolution live'}
        right=${st.started ? html`<button className="ghost" onClick=${function () { setSt(init); }}>Reset</button>` : null} />
      <div className="body">
        <div className="mapstage">
          <${S.DamageMap} cells=${cells} confidence=${conf} cellSize=${CELL} caption=${caption} meta=${meta} label="Storm 1 map at the current generation" />
          ${!st.started ? html`<div className="veil"><div className="startcard">
            <span className="tag tag-train">Live evolution</span>
            <strong className="h3">Give the harness a past storm to evolve on</strong>
            <span className="muted small">${F.live ? 'The recorded run ' + F.run + ': ' + LAST + ' generations on real Jev with the real curator, 3,111 blocks each, replayed about 10× faster than it ran.' : "1,024 blocks, 9,812 reports, and the official assessment it's scored against. 7 generations after generation 0, about 30 seconds each."}</span>
            <button className="cta wide" onClick=${function () { setSt(Object.assign({}, init, { started: true })); }}>Start evolution</button>
          </div></div>` : null}
        </div>
        <div className="panel">
          <div className="row gap40 end"><${Stat} label=${F.live ? 'Validation balanced accuracy, lineage' : 'Blocks right, lineage so far'} value=${pct(bestAcc)} size="xxl" color="var(--series-heldout)" /><${Stat} label="Since generation 0" value=${bestAcc != null && startAcc != null ? sgn(bestAcc - startAcc) + ' pts' : '—'} size="md" color="var(--good)" /></div>
          <div className="itercard">
            <div className="row between"><strong>${!st.started ? 'Ready' : st.done ? 'All ' + LAST + ' generations done' : 'Generation ' + (run.run - 1)}</strong><span className="muted xs">${st.started && !st.done && src.predicted != null ? 'Predicts +' + (src.predicted * 100).toFixed(0) + ' points' : ''}</span></div>
            ${F.live && st.started && run.trace ? html`<a href=${run.trace} target="_blank" rel="noopener" className="xs" style=${{ color: 'var(--accent)' }}>Open this generation's LangSmith trace ↗</a>` : null}
            <span>${!st.started ? 'Press Start evolution. Each generation proposes one change, compiles it to a MongoDB pipeline, has Jev backtest every block, scores the map against the locked assessment, and joins the lineage only if the score rises.' : st.done ? 'The evolved harness is saved to the lineage and is what runs on the next live storm.' : src.hyp}</span>
            <div className="phases">${['Propose', 'Compile', 'Backtest', 'Score', 'Verdict'].map(function (name) {
              var names = plan.map(function (p) { return p[0]; });
              var idx = names.indexOf(name);
              if (name === 'Compile' && idx < 0) idx = names.indexOf('Memory check');
              var label = idx < 0 ? name + ' (skipped)' : (name === 'Compile' && run.status === 'skipped' ? 'Memory check' : name);
              var fill = 0, color = 'var(--accent)', on = false;
              if (st.done) { fill = 100; color = 'var(--line-strong)'; }
              else if (st.started && idx >= 0) {
                if (idx < st.phase) { fill = 100; color = 'var(--good)'; on = true; }
                else if (idx === st.phase) { fill = Math.round((st.pt / plan[idx][1]) * 100); on = true; }
              }
              return html`<div className="phase" key=${name}><div className="ptrack"><div style=${{ width: fill + '%', background: color }}></div></div><span className=${'xs' + (on ? '' : ' muted')}>${label}</span></div>`;
            })}</div>
            <span className="mono xs" style=${{ color: statusColor }}>${status}</span>
          </div>
          <${S.ScoreCurve} train=${curveBest} heldout=${tries} xLabels=${runs.map(function (r) { return 'Gen ' + (r.run - 1); })} trainLabel="Lineage so far" heldoutLabel="Each generation" min=${0.2} max=${1} width=${613} height=${170} label="Score by generation" />
          <div className="col">${st.history.slice().reverse().slice(0, 3).map(function (h) {
            var result = h.status === 'skipped' ? (F.live ? 'not scored' : 'skipped by memory') : h.run === 1 ? 'generation 0 · ' + pct(h.acc) : h.kept ? 'kept ' + sgn(h.acc - h.bestBefore) : 'rejected ' + sgn(h.acc - h.bestBefore);
            return html`<div className="logrow" key=${h.run}><span className="mono muted xs">Gen ${h.run - 1}</span><span className="xs">${(F.live ? runs[h.run - 1] : D.RUNS_NYC[h.run - 1]).hyp}</span><span className="xs strong" style=${{ color: h.status === 'skipped' ? 'var(--ink-muted)' : h.kept ? 'var(--good)' : 'var(--critical)' }}>${result}</span></div>`;
          })}</div>
          <span className="muted tiny push-bottom">${F.live ? 'Replay of the recorded run ' + F.run + ' (real Jev, real curator, real gate). A live run is started from the backend: ./sightline.sh loop.' : 'Plays about 3× faster than the real loop. Example data: stylized map and made-up scores.'}</span>
        </div>
      </div>
    </div>`;
  }

  // ---------- shell ----------
  var NAMES = ['Calm night', 'Storm hits', 'Generation 0', 'Fitness signal', 'Evolution', 'Replay', 'Any city'];

  function App() {
    var qs = new URLSearchParams(location.search);
    var s1 = useState(Math.min(7, Math.max(1, Number(qs.get('beat')) || 1))), step = s1[0], setStep = s1[1];
    var s2 = useState(qs.get('view') === 'arena' ? 'arena' : 'story'), view = s2[0], setView = s2[1];
    var s3 = useState('idle'), arena = s3[0], setArena = s3[1];
    var go = function (n) { setView('story'); setStep(Math.max(1, Math.min(7, n))); };
    var stepRef = useRef(step); stepRef.current = step;
    useEffect(function () {
      function onKey(e) {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if (e.key === 'ArrowRight') go(stepRef.current + 1);
        if (e.key === 'ArrowLeft') go(stepRef.current - 1);
      }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, []);
    var story = view === 'story';
    return html`<div className="app">
      <div style=${{ display: story ? 'block' : 'none' }}><${Story} step=${step} onNext=${function () { go(step + 1); }} /></div>
      <div style=${{ display: story ? 'none' : 'block' }}><${Arena} onStatus=${setArena} /></div>
      <nav className="presenter" aria-label="Presenter controls">
        <div className="row gap10">
        <a href="/" aria-label="Back to the Sightline home page" style=${{ fontSize: 13, color: 'var(--ink)', textDecoration: 'none', padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-raised)', whiteSpace: 'nowrap' }}>← Home</a>
        <div className="seg" role="group" aria-label="View">
          <button className=${story ? 'on' : ''} aria-pressed=${story} onClick=${function () { setView('story'); }}>Story</button>
          <button className=${!story ? 'on' : ''} aria-pressed=${!story} onClick=${function () { setView('arena'); }}>Live arena${arena === 'running' ? html` <span className="live-dot"></span>` : arena === 'done' ? ' ✓' : ''}</button>
        </div>
        </div>
        <div className="steps" style=${{ opacity: story ? 1 : 0.5 }}>${NAMES.map(function (name, i) {
          var n = i + 1, on = story && n === step;
          return html`<button key=${n} className=${'step' + (on ? ' on' : '')} aria-label=${'Step ' + n + ': ' + name} aria-current=${on ? 'step' : 'false'} onClick=${function () { go(n); }}>${on ? n + ' · ' + name : n}</button>`;
        })}</div>
        <div className="row gap8">
          <span className="muted xs">← → keys</span>
          <button className="ghost" disabled=${story && step === 1} onClick=${function () { go(step - 1); }}>Back</button>
          <button className="dark" disabled=${story && step === 7} onClick=${function () { go(step + 1); }}>Next</button>
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
