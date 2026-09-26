(function () {
  var React = window.React;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var html = window.htm.bind(React.createElement);
  var S = window.Sightline, D = window.SightlineDemo;
  var F = D.flow();
  var GENS = F.gens;
  var LAST = GENS.length - 1;  // generations after generation 0
  var countOf = function (st) { return GENS.filter(function (G) { return G.status === st; }).length; };
  var LABEL = {};
  S.STATES.forEach(function (s) { LABEL[s.key] = s.label; });
  var CRIT = { home: 1, major: 1, destroyed: 1, fire: 1 };
  var pct = function (v) { return v == null ? '—' : (v * 100).toFixed(1) + '%'; };
  var pts = function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1); };

  var CELL = 20;
  function at(r, c, cell) { cell = cell || CELL; return { left: 1 + c * (cell + 1) + cell / 2, top: 1 + r * (cell + 1) + cell / 2 }; }

  var PIN = {
    call: { width: 10, height: 10, borderRadius: 5, background: 'var(--critical)', boxShadow: '0 0 0 2px var(--surface-raised)' },
    ticket: { width: 9, height: 9, background: 'var(--warn)', boxShadow: '0 0 0 2px var(--surface-raised)' },
    drone: { width: 9, height: 9, background: 'var(--accent)', boxShadow: '0 0 0 2px var(--surface-raised)', rotate: true },
    social: { width: 10, height: 10, borderRadius: 5, background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 2.5px var(--ink-muted)' },
    utility: { width: 9, height: 9, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--surface-raised)' }
  };
  function pinStyle(kind, extra) {
    var p = PIN[kind], st = Object.assign({}, p, extra || {});
    delete st.rotate;
    st.transform = (extra && extra.position === 'absolute' ? 'translate(-50%, -50%) ' : '') + (p.rotate ? 'rotate(45deg)' : '');
    return st;
  }

  // Which generation fixed each of gen 0's four misreads.
  var FIXED_BY = { 1: 4, 2: 1, 3: 3, 4: 7 };

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

  // ---------- the evolution loop (runs at app level, whatever is on screen) ----------
  var PLAN = [['Propose', 2], ['Compile', 0.8], ['Backtest', 3.5], ['Validate', 1.2], ['Verdict', 1.8]];
  var PLAN_SKIP = [['Propose', 2], ['Memory check', 1.4], ['Verdict', 1.8]];
  function planFor(g) { return GENS[g].status === 'skipped' ? PLAN_SKIP : PLAN; }
  var EVO0 = { started: false, done: false, gen: 0, phase: 0, pt: 0, elapsed: 0, history: [] };

  function useEvolution() {
    var s = useState(EVO0), st = s[0], setSt = s[1];
    useEffect(function () {
      if (!st.started || st.done) return;
      var id = setInterval(function () {
        setSt(function (prev) {
          if (!prev.started || prev.done) return prev;
          var plan = planFor(prev.gen);
          var next = Object.assign({}, prev, { elapsed: prev.elapsed + 0.2, pt: prev.pt + 0.2 });
          if (next.pt >= plan[prev.phase][1]) {
            next.pt = 0; next.phase = prev.phase + 1;
            if (next.phase >= plan.length) {
              next.history = prev.history.concat([prev.gen]);
              next.gen = prev.gen + 1; next.phase = 0;
              if (next.gen >= GENS.length) { next.done = true; next.gen = GENS.length - 1; }
            }
          }
          return next;
        });
      }, 200);
      return function () { clearInterval(id); };
    }, [st.started, st.done]);
    return {
      st: st,
      start: function () { setSt(Object.assign({}, EVO0, { started: true })); },
      reset: function () { setSt(EVO0); }
    };
  }

  function bestOf(history) {
    var best = null;
    history.forEach(function (g) { var s = GENS[g].status; if (s === 'baseline' || s === 'kept') best = g; });
    return best;
  }

  // ---------- shared pieces ----------
  function Header(props) {
    return html`<header className="bar">
      <div className="brand"><span className="wordmark">Sightline</span><span className="muted">${props.place}</span></div>
      <div className="row gap16">
        <span className="muted">${props.clock}</span>
        <span className=${'pill pill-' + props.mode}><span className="pill-dot"></span>${props.modeLabel}</span>
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
    var lv = useState(null), live = lv[0], setLive = lv[1];
    useEffect(function () {  // live mode: fetch exactly what Jev saw for this block
      if (!D.blockUrl || props.gen == null) return;
      setLive(null);
      fetch(D.blockUrl(props.gen, c, r)).then(function (x) { return x.json(); }).then(setLive).catch(function () {});
    }, [i, props.gen]);
    if (D.blockUrl && props.gen != null) {
      var recs = live && live.lines ? live.lines.slice(2) : [];
      var ok = live && live.correct;
      return html`<div className="blockcard">
        <div className="row between"><strong>Block ${r + 1}-${c + 1}</strong><span className="muted small push">${D.where(r, c)}</span>
          <button className="x" aria-label="Close" onClick=${props.onClose}>×</button></div>
        <div className="small">Jev: <strong>${live ? D.nice(live.jev.pick) : '…'}</strong> <span className="mono muted">${live ? live.jev.conf.toFixed(2) : ''}</span>
          ${live && props.truth && live.assessment ? html` · <span style=${{ color: ok ? 'var(--good)' : 'var(--critical)' }}>${ok ? 'Assessment agrees' : 'Assessment: ' + D.nice(live.assessment)}</span>` : null}</div>
        <span className="muted xs">What Jev saw (${recs.length} of 12 lines):</span>
        <ul className="reports">${recs.map(function (ln, k) {
          var m = /^- \[([^\]]+)\] (.*)$/.exec(ln) || [null, '', ln];
          return html`<li key=${k}><span className="mono muted">${m[1]}</span><span>${m[2]}</span></li>`;
        })}</ul>
      </div>`;
    }
    return html`<div className="blockcard">
      <div className="row between"><strong>Block ${r + 1}-${c + 1}</strong><span className="muted small push">${D.where(r, c)}</span>
        <button className="x" aria-label="Close" onClick=${props.onClose}>×</button></div>
      <div className="small">Jev: <strong>${LABEL[guess] || guess}</strong> <span className="mono muted">${props.conf ? props.conf[i].toFixed(2) : ''}</span>
        ${truth ? html` · <span style=${{ color: truth === guess ? 'var(--good)' : 'var(--critical)' }}>${truth === guess ? 'Assessment agrees' : 'Assessment: ' + LABEL[truth]}</span>` : null}</div>
      <ul className="reports">
        ${rumor ? html`<li><span className="mono muted">Social</span><span>WHOLE BLOCK COLLAPSED, confirmed!!</span></li>` : null}
        ${(REP[F.truth[i]] || []).map(function (p, k) { return html`<li key=${k}><span className="mono muted">${p[0]}</span><span>${p[1]}</span></li>`; })}
      </ul>
    </div>`;
  }

  function MapStage(props) {
    var sel = useState(null), selected = sel[0], setSelected = sel[1];
    useEffect(function () { setSelected(null); }, [props.resetKey]);
    var clickable = !!props.clickable;
    return html`<div className="mapstage">
      <${S.DamageMap} cells=${props.cells} confidence=${props.conf} truth=${props.truth} mode=${props.mode || 'guess'}
        cellSize=${CELL} caption=${props.caption} meta=${props.meta} label=${props.caption}
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
      ${clickable && selected == null ? html`<span className="hint">Click any block to see what's behind it</span>` : null}
    </div>`;
  }

  function Cta(props) {
    if (!props.onClick) return null;
    return html`<button className="cta" onClick=${props.onClick}>${props.label} →</button>`;
  }

  function Stat(props) {
    return html`<div className="stat"><span className="muted small">${props.label}</span><span className=${'mono num ' + (props.size || '')} style=${{ color: props.color }}>${props.value}${props.unit ? html`<span className="unit">${props.unit}</span>` : null}</span>${props.note ? html`<span className="muted xs">${props.note}</span>` : null}</div>`;
  }

  var legendStates = ['intact', 'minor', 'street', 'home', 'wind', 'major', 'destroyed', 'power'];
  var NYC = F.place || 'New York · Lower Manhattan and the Brooklyn waterfront';

  // ---------- beat 1: generation 0 ----------
  function Gen0(props) {
    var ph = useState('reports'), phase = ph[0], setPhase = ph[1];
    var tick = useTicker(true, phase, 250);
    var map, panel, cta = null;
    if (phase === 'reports') {
      var n = Math.min(F.pins.length, 3 + tick * 2), frac = n / F.pins.length;
      var grow = function (v) { return Math.round(v * frac).toLocaleString('en-US'); };
      var feed = F.feed.slice(0, Math.min(F.feed.length, 1 + Math.floor(tick / 6)));
      map = { cells: F.calm, caption: 'Incoming reports', meta: n + ' on the map', pins: F.pins.slice(0, n) };
      panel = html`
        <div className="intro"><h2>The storm hits. Reports flood in.</h2><p className="muted lead">${grow(F.counts.total || 10164)} reports so far from ${F.sources || 'five kinds of sources'}. Some of them are wrong.</p></div>
        <div className="counts">${[['911', 'call', F.counts.calls], ['311', 'ticket', F.counts.tickets], ['Drone', 'drone', F.counts.drone], ['Social', 'social', F.counts.social], ['Utility', 'utility', F.counts.utility]].map(function (c) {
          return html`<div className="stat" key=${c[0]}><span className="muted small row gap6"><span style=${pinStyle(c[1])}></span>${c[0]}</span><span className="mono num md">${grow(c[2])}</span></div>`;
        })}</div>
        <div className="feed">${feed.map(function (f, k) {
          return html`<div className="feedrow" key=${k}><span className="mono muted xs">${f.time}</span><span className="xs strong muted">${f.src}</span><span>${f.text}</span>${f.odd ? html`<span className="flag">Looks off</span>` : html`<span></span>`}</div>`;
        })}</div>`;
      cta = html`<${Cta} label="Run generation 0" onClick=${function () { setPhase('assess'); }} />`;
    } else {
      var mapped = Math.min(1024, tick * 48);
      var cells = F.zero.cells.map(function (c, i) { return i < mapped ? c : F.calm[i]; });
      var conf = F.zero.conf.map(function (c, i) { return i < mapped ? c : 1; });
      var flagged = 0;
      for (var i = 0; i < mapped; i++) if (CRIT[F.zero.cells[i]]) flagged++;
      var doneMap = mapped >= 1024;
      map = { gen: F.src ? F.src.zeroGen : null, cells: cells, conf: conf, caption: "Jev's map · generation 0", meta: doneMap ? 'the unevolved harness' : mapped + ' of 1,024 blocks', clickable: doneMap,
        marks: doneMap ? [{ n: 1, r: Math.floor(F.zero.top[0].i / 32), c: F.zero.top[0].i % 32, tone: 'accent' }] : [] };
      panel = html`
        <div className="intro"><h2>Generation 0 triages every block</h2><p className="muted lead">The unevolved harness: the 12 reports nearest each block, taken at face value. Jev is frozen; it never changes in this demo.</p></div>
        <div className="stats"><${Stat} label="Blocks flagged rescue-critical" value=${flagged} size="xxl" /></div>
        <div className="col"><strong className="small pad8">Dispatch list, most confident first</strong>
          ${!doneMap ? html`<span className="muted small">Mapping…</span>` : F.zero.top.map(function (t, k) {
            return html`<div className=${'trow' + (k === 0 ? ' first' : '')} key=${k}><span className="mono muted xs">${k + 1}</span><span className="mono xs">${t.block}</span><span>${t.where}</span><span>${LABEL[t.state]}</span><span className="mono xs right">${t.conf}</span></div>`;
          })}
          ${doneMap ? html`<span className="xs muted" style=${{ paddingTop: 10 }}>The first crew goes to block ${F.zero.top[0].block}. Click it on the map.</span>` : null}
        </div>`;
      cta = doneMap ? html`<${Cta} label="Skip ahead: the assessment arrives" onClick=${props.onNext} />` : null;
    }
    return html`<div className="screen">
      <${Header} place=${NYC} clock=${phase === 'reports' ? 'Tuesday 23:44 · landfall' : 'Wednesday 01:15'} mode="live" modeLabel="Live · generation 0" />
      <div className="body">
        <${MapStage} resetKey=${phase} ...${map} />
        <div className="panel">${panel}<div className="panel-foot">${cta}<${S.DamageLegend} states=${legendStates} /></div></div>
      </div>
    </div>`;
  }

  // ---------- beat 2: the fitness signal ----------
  function Fitness(props) {
    var map = { gen: F.src ? F.src.zeroGen : null, cells: F.zero.cells, truth: F.truth, mode: 'diff', caption: 'Generation 0 vs the official assessment', meta: 'wrong blocks at full strength', clickable: true, showTruth: true,
      marks: F.misreads.map(function (m) { return { n: m.n, r: m.r, c: m.c }; }) };
    return html`<div className="screen">
      <${Header} place=${NYC} clock="Nine days later · assessment in" mode="review" modeLabel="Fitness signal" />
      <div className="body">
        <${MapStage} resetKey="fit" ...${map} />
        <div className="panel">
          <div className="intro"><h2>The fitness signal arrives</h2><p className="muted lead">The official assessment shows exactly where generation 0 failed.</p></div>
          <div className="stats"><${Stat} label="Blocks right" value=${pct(F.zero.acc)} size="xl" color="var(--critical)" /><${Stat} label="Rescue-critical found" value=${F.zero.critFound} unit=${'/' + F.zero.critTotal} size="xl" /><${Stat} label="Crews sent to the wrong block" value=${F.zero.falseAlarms} size="xl" /></div>
          <div className="col gap12"><strong className="small">Evidence taken too literally</strong>
            ${F.misreads.map(function (m) {
              return html`<div className="misread" key=${m.n}><span className="mark static">${m.n}</span><div className="col gap2"><span className="strong">${m.title} <span className="muted normal">· ${m.where}</span></span><span className="small">${m.text}</span><span className="muted xs">Jev: ${m.jev} · Assessment: ${m.truth}</span></div></div>`;
            })}
          </div>
          <div className="panel-foot"><${Cta} label="Evolve the harness" onClick=${props.onNext} /><${S.DamageLegend} states=${legendStates} /></div>
        </div>
      </div>
    </div>`;
  }

  // ---------- beat 3: evolution, live ----------
  function Evolution(props) {
    var evo = props.evo, st = evo.st;
    var cur = GENS[st.gen], plan = planFor(st.gen);
    var bestIdx = bestOf(st.history), best = bestIdx == null ? null : GENS[bestIdx];
    var phaseName = st.started && !st.done ? plan[st.phase][0] : '';
    var base = best ? best.cells : (F.backCalm || F.calm), baseConf = best ? best.conf : null;
    var cells = base, conf = baseConf, caption = best ? 'Backtest · best policy, generation ' + best.gen : 'Backtest · waiting to start', meta = best ? pct(best.dev) + ' on past storms' : '';
    var mapped = 0;
    if (phaseName === 'Backtest' && cur.cells) {
      mapped = Math.floor((st.pt / plan[st.phase][1]) * 1024);
      cells = cur.cells.map(function (c, i) { return i < mapped ? c : base[i]; });
      conf = cur.cells.map(function (c, i) { return i < mapped ? cur.conf[i] : (baseConf ? baseConf[i] : 1); });
      caption = 'Backtest · generation ' + cur.gen; meta = mapped.toLocaleString('en-US') + ' of 1,024 blocks';
    } else if ((phaseName === 'Validate' || phaseName === 'Verdict') && cur.cells) {
      cells = cur.cells; conf = cur.conf; caption = 'Backtest · generation ' + cur.gen; meta = pct(cur.dev) + ' on past storms';
    }

    // generation card content
    var showResult = st.started && (st.done || phaseName === 'Validate' || phaseName === 'Verdict');
    var showVerdict = st.started && (st.done || phaseName === 'Verdict');
    var shown = st.done ? GENS[bestOf(st.history)] : cur;
    var verdict = !showVerdict ? null : shown.status === 'baseline' ? { t: 'Baseline', c: 'var(--ink)', bg: 'var(--surface-sunken)' }
      : shown.status === 'kept' ? { t: 'Kept', c: 'var(--good)', bg: 'var(--good-soft)' }
      : shown.status === 'rejected' ? { t: 'Rejected', c: 'var(--critical)', bg: 'var(--critical-soft)' }
      : { t: shown.memory === false ? 'Not scored' : 'Skipped by memory', c: 'var(--ink-muted)', bg: 'var(--surface-raised)' };
    var why = !showVerdict ? '' : st.done ? 'The evolved policy is saved to the lineage.'
      : shown.status === 'baseline' ? 'Starting point for selection.'
      : shown.status === 'kept' ? 'Validation rose ' + Math.abs(shown.valDelta * 100).toFixed(1) + ' points. It joins the lineage.'
      : shown.status === 'rejected' ? 'The backtest rose, but validation fell ' + Math.abs(shown.valDelta * 100).toFixed(1) + ' points. The gate throws it out.'
      : shown.note;
    var status = !st.started ? '' : st.done ? 'Evolution finished: ' + LAST + ' generations.' : {
      Propose: 'Reading the last generation’s mistakes and writing one change…',
      Compile: 'Compiling the policy into a MongoDB aggregation pipeline…',
      Backtest: 'Backtest on past storms: Jev is mapping ' + mapped.toLocaleString('en-US') + ' of 1,024 blocks…',
      Validate: 'Scoring the validation town (scorer login only)…',
      'Memory check': 'Checking memory for similar failed ideas…',
      Verdict: why
    }[phaseName];

    var lineage = st.history.map(function (g) {
      var G = GENS[g];
      return { gen: g, parent: G.parent, status: G.status,
        label: G.status === 'skipped' ? (G.memory === false ? 'invalid' : 'memory') : G.status === 'rejected' ? pts(G.valDelta) + ' val' : (G.val * 100).toFixed(1) };
    });
    var bestLine = [], tries = [], run = null;
    GENS.forEach(function (G, g) {
      var doneG = st.history.indexOf(g) >= 0;
      if (doneG && (G.status === 'kept' || G.status === 'baseline')) run = G.val;
      bestLine.push(doneG ? run : null);
      tries.push(doneG && G.val != null ? G.val : null);
    });

    var phases = ['Propose', 'Compile', 'Backtest', 'Validate', 'Verdict'].map(function (name) {
      var names = plan.map(function (p) { return p[0]; });
      var idx = names.indexOf(name);
      if (name === 'Compile' && idx < 0) idx = names.indexOf('Memory check');
      var label = idx < 0 ? name + ' (skipped)' : (name === 'Compile' && cur.status === 'skipped' ? 'Memory check' : name);
      var fill = 0, color = 'var(--accent)', on = false;
      if (st.done) { fill = 100; color = 'var(--line-strong)'; }
      else if (st.started && idx >= 0) {
        if (idx < st.phase) { fill = 100; color = 'var(--good)'; on = true; }
        else if (idx === st.phase) { fill = Math.round((st.pt / plan[idx][1]) * 100); on = true; }
      }
      return html`<div className="phase" key=${name}><div className="ptrack"><div style=${{ width: fill + '%', background: color }}></div></div><span className=${'xs' + (on ? '' : ' muted')}>${label}</span></div>`;
    });

    return html`<div className="screen">
      <${Header} place=${F.backtestPlace || 'New York · past storms (backtest) and a validation town, assessments locked to the scorer'} clock=${st.started ? 'Generation ' + cur.gen + ' of ' + LAST : 'Ready'} mode="training" modeLabel=${!st.started ? 'Evolution ready' : st.done ? 'Evolution done' : 'Evolution live'} />
      <div className="body gap48">
        <div className="col gap10">
          <${S.DamageMap} cells=${cells} confidence=${conf} cellSize=${14} caption=${caption} meta=${meta} label="Backtest map" />
          <div className="whygate"><strong className="xs">Why there's a gate</strong><span className="xs">An earlier, ungated loop climbed from 46% to 93% on its own storms while held-out fell from 50% to 45%. It was fooling itself. Now every change must also raise a validation town it never trains on.</span></div>
        </div>
        <div className="col gap20 grow">
          <div className="gencard">
            ${!st.started ? html`
              <div className="col gap12">
                <span className="tag tag-train">Evolution</span>
                <strong className="h2">Jev stays frozen. The harness evolves how it reads the reports.</strong>
                <span className="muted">Each generation proposes one change with a prediction, backtests it on past storms, and keeps it only if the validation town improves.</span>
                <button className="cta" onClick=${evo.start}>Start evolution</button>
              </div>` : html`
              <div className="row between"><strong className="h2">${st.done ? 'Generation ' + shown.gen + ' · the evolved harness' : 'Generation ' + cur.gen}</strong>
                ${verdict ? html`<span className="verdict" style=${{ color: verdict.c, background: verdict.bg }}>${verdict.t}</span>` : html`<span className="verdict muted">${phaseName}…</span>`}</div>
              <span className="hyp">${st.done ? 'Kept changes: ' + countOf('kept') + ' · rejected: ' + countOf('rejected') + ' · not scored: ' + countOf('skipped') : cur.hyp}</span>
              <div className="genstats">
                <${Stat} label="Prediction" value=${!st.done && cur.predicted != null ? '+' + (cur.predicted * 100).toFixed(0) : '—'} size="md" note="points on validation" />
                <${Stat} label="Fitness · backtest" value=${showResult && shown.dev != null ? pct(shown.dev) : '—'} size="md" note="past storms" />
                <${Stat} label="Selection · validation" value=${showResult && shown.val != null ? pct(shown.val) : '—'} size="md" color=${showVerdict && shown.status === 'rejected' ? 'var(--critical)' : 'var(--ink)'} note=${showResult && shown.valDelta != null ? pts(shown.valDelta) + ' vs the lineage' : 'town it never trains on'} />
              </div>
              <div className="phases">${phases}</div>
              <span className="mono xs" style=${{ color: showVerdict && shown.status === 'rejected' ? 'var(--critical)' : showVerdict && shown.status === 'kept' ? 'var(--good)' : 'var(--ink-muted)' }}>${status}</span>`}
          </div>
          <div className="col gap6">
            <div className="row between"><strong className="small">Lineage</strong><span className="xs muted">Kept changes stack on the line. Rejected and remembered ideas hang off it.</span></div>
            <${S.LineageTree} gens=${lineage} total=${GENS.length} current=${st.started && !st.done ? cur.gen : null} width=${800} height=${150} label="Lineage of the harness" />
          </div>
          <div className="row gap24 end">
            <${S.ScoreCurve} train=${bestLine} heldout=${tries} xLabels=${GENS.map(function (G) { return 'Gen ' + G.gen; })} trainLabel="Lineage, validation" heldoutLabel="Each proposal" min=${0.2} max=${1} width=${480} height=${150} label="Validation score by generation" />
            <div className="push"><${Cta} label=${F.replayCta || "Replay tonight with the evolved harness"} onClick=${props.onNext} /></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- beat 4: replay ----------
  function Replay(props) {
    var map = { gen: F.src ? F.src.bestGen : null, cells: F.evolved.cells, conf: F.evolved.conf, caption: "Jev's map · evolved harness" + (F.live ? ', generation ' + F.bestGen : ''), meta: 'same night, replayed', clickable: true, showTruth: true,
      marks: F.misreads.map(function (m) { return { n: m.n, r: m.r, c: m.c, tone: 'good' }; }) };
    return html`<div className="screen">
      <${Header} place=${NYC} clock="Replay of Tuesday night" mode="review" modeLabel="Adaptation proven" />
      <div className="body">
        <${MapStage} resetKey="replay" ...${map} />
        <div className="panel">
          <div className="intro"><h2>The evolved harness, on the same night</h2><p className="muted lead">${F.replayNote || "Same reports. Same frozen Jev. Only the harness changed. Tonight's storm is scored once, never trained on."}</p></div>
          <div className="compare">
            <div className="crow head"><span></span><span>Generation 0</span><span>Evolved</span></div>
            ${[['Blocks right', pct(F.zero.acc), pct(F.evolved.acc)], ['Rescue-critical blocks found (of ' + F.zero.critTotal + ')', F.zero.critFound, F.evolved.critFound], ['Crews sent to the wrong block', F.zero.falseAlarms, F.evolved.falseAlarms]].map(function (c) {
              return html`<div className="crow" key=${c[0]}><span>${c[0]}</span><span className="mono before">${c[1]}</span><span className="mono after">${c[2]}</span></div>`;
            })}
          </div>
          <div className="col gap10"><strong className="small">${F.live ? 'Generation 0\'s ' + F.misreads.length + ' most confident misreads: ' + F.misreads.filter(function (m) { return m.fixedBy != null; }).length + ' now handled' : "Generation 0's four misreads, now handled"}</strong>
            ${F.misreads.map(function (m) {
              return html`<div className="misread" key=${m.n}><span className="mark static good">${m.n}</span><span className="small">${m.title}: ${F.live ? (m.fixedBy != null ? 'fixed by the evolved harness (generation ' + m.fixedBy + ').' : 'still wrong.') : 'fixed by generation ' + FIXED_BY[m.n] + '.'}</span></div>`;
            })}
          </div>
          <div className="panel-foot"><${Cta} label="What did it learn?" onClick=${props.onNext} /><${S.DamageLegend} states=${legendStates} /></div>
        </div>
      </div>
    </div>`;
  }

  // ---------- beat 5: what it learned ----------
  function Learned() {
    var rules = [];
    GENS.forEach(function (G) { if (G.status === 'kept') (G.rules || (G.rule ? [G.rule] : [])).forEach(function (t) { rules.push({ text: t, gen: G.gen }); }); });
    var town = F.heldTown;
    return html`<div className="screen">
      <${Header} place="The evolved harness" clock=${'After ' + LAST + ' generations'} mode="review" modeLabel="What it learned" />
      <div className="body gap64">
        <div className="col gap20 grow">
          <div className="intro"><span className="tag tag-live">The policy is the product</span><h2 className="big">What it learned</h2>
            <p className="muted lead">${rules.length} rules the harness discovered on its own, each traced to the generation that found it. Jev never changed. Only these did.</p></div>
          <${S.PolicyRules} rules=${rules} />
          <p className="pitch">${F.pitch || "We froze the model and let the harness evolve how it reads the world: gated, remembered, and proven on a storm it never saw."}</p>
        </div>
        <div className="col gap12" style=${{ width: 420, flex: 'none' }}>
          <span className="tag tag-train">A town it never saw</span>
          ${town ? html`
          <${S.DamageMap} cells=${town.cells} confidence=${town.conf} cellSize=${12} caption=${town.name + ' · blind'} meta="scored once" label=${town.name + ' damage map'} />
          <div className="row gap24">
            <${Stat} label="Blocks right" value=${pct(town.acc)} size="xl" color="var(--good)" />
            <${Stat} label="Rescue-critical found" value=${town.critFound} unit=${'/' + town.critTotal} size="xl" />
          </div>` : html`<div className="whygate"><strong className="xs">Pending</strong><span className="xs">Miami, Houston and New Orleans next season are scored once with the frozen policy, after the final run.</span></div>`}
          <span className="xs muted">Same harness, its own lineage. Scored once against the official assessment; never used for selection.</span>
        </div>
      </div>
    </div>`;
  }

  // ---------- shell ----------
  var BEATS = ['Generation 0', 'Fitness signal', 'Evolution', 'Replay', 'What it learned'];

  function App() {
    var evo = useEvolution();
    var s1 = useState(Math.min(5, Math.max(1, Number(new URLSearchParams(location.search).get('beat')) || 1))), step = s1[0], setStep = s1[1];  // ?beat=N deep link
    var go = function (n) { setStep(Math.max(1, Math.min(BEATS.length, n))); };
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
    var next = function () { go(step + 1); };
    var screen = step === 1 ? html`<${Gen0} onNext=${next} />`
      : step === 2 ? html`<${Fitness} onNext=${next} />`
      : step === 3 ? html`<${Evolution} evo=${evo} onNext=${next} />`
      : step === 4 ? html`<${Replay} onNext=${next} />`
      : html`<${Learned} />`;
    var est = evo.st;
    var evoLabel = !est.started ? 'Evolution not started' : est.done ? 'Evolution done · ' + LAST + ' generations' : (F.live ? 'Replaying recorded run · generation ' : 'Evolving · generation ') + est.gen + ' of ' + LAST;
    return html`<div className="app">
      ${screen}
      <nav className="presenter" aria-label="Presenter controls">
        <div className="row gap10">
          ${!est.started ? html`<button className="dark" onClick=${evo.start}>Start evolution</button>` : html`<button className="ghost" onClick=${evo.reset}>Reset</button>`}
          <span className="xs row gap6">${est.started && !est.done ? html`<span className="live-dot"></span>` : null}<span className=${est.started ? '' : 'muted'}>${evoLabel}</span></span>
        </div>
        <div className="steps">${BEATS.map(function (name, i) {
          var n = i + 1, on = n === step;
          return html`<button key=${n} className=${'step' + (on ? ' on' : '')} aria-label=${'Beat ' + n + ': ' + name} aria-current=${on ? 'step' : 'false'} onClick=${function () { go(n); }}>${on ? n + ' · ' + name : n}</button>`;
        })}</div>
        <div className="row gap8">
          <span className="muted xs">← → keys</span>
          <button className="ghost" disabled=${step === 1} onClick=${function () { go(step - 1); }}>Back</button>
          <button className="dark" disabled=${step === BEATS.length} onClick=${next}>Next</button>
        </div>
      </nav>
    </div>`;
  }

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
