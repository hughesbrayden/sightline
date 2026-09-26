/* @ds-bundle: {"format":4,"namespace":"Sightline","components":[{"name":"PuzzleGrid"},{"name":"StatusBadge"},{"name":"LineageNode"},{"name":"ScoreCurve"},{"name":"DiffCard"},{"name":"DamageMap"},{"name":"DamageLegend"},{"name":"LineageTree"},{"name":"PolicyRules"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  var PALETTE = ["void", "paper", "red", "orange", "yellow", "green", "blue", "brown"];

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(" ");
  }

  function pixelColor(c) {
    var key = typeof c === "number" ? PALETTE[c] : c;
    return "var(--px-" + (key || "void") + ")";
  }

  function signed(d, digits) {
    var n = Math.abs(d).toFixed(digits == null ? 1 : digits);
    if (d > 0) return "+" + n;
    if (d < 0) return "−" + n;
    return "±" + n;
  }

  // ---------- PuzzleGrid ----------
  function PuzzleGrid(props) {
    var size = props.size || 16;
    var cells = props.cells || [];
    var conf = props.confidence;
    var truth = props.truth;
    var cellSize = props.cellSize || 12;
    var showErrors = !!props.showErrors;
    var floor = props.confidenceFloor == null ? 0.15 : props.confidenceFloor;
    var items = [];
    for (var i = 0; i < size * size; i++) {
      var c = cells[i];
      var wrong = showErrors && truth && truth[i] !== c;
      var o = conf ? floor + (1 - floor) * Math.max(0, Math.min(1, conf[i])) : 1;
      items.push(h("div", {
        key: i,
        className: cx("sl-cell", wrong && "sl-cell-wrong"),
        style: { background: pixelColor(c), opacity: wrong ? 1 : o }
      }));
    }
    var grid = h("div", {
      className: "sl-grid",
      role: "img",
      "aria-label": props.label || size + " by " + size + " puzzle",
      style: {
        gridTemplateColumns: "repeat(" + size + ", " + cellSize + "px)",
        gridAutoRows: cellSize + "px"
      }
    }, items);
    var cap = (props.caption || props.meta) && h("figcaption", { className: "sl-puzzle-cap" },
      props.caption && h("span", { className: "sl-label" }, props.caption),
      props.meta && h("span", { className: "sl-num sl-muted" }, props.meta));
    return h("figure", { className: cx("sl-puzzle", props.className) }, grid, cap);
  }

  // ---------- StatusBadge ----------
  var BADGE_TEXT = {
    passed: "Gate passed",
    rejected: "Rejected",
    skipped: "Skipped · seen before",
    denied: "Read denied",
    running: "Running"
  };

  function StatusBadge(props) {
    var kind = props.kind || "running";
    return h("span", { className: cx("sl-badge", "sl-badge-" + kind, props.className) },
      props.children || BADGE_TEXT[kind]);
  }

  // ---------- LineageNode ----------
  function LineageNode(props) {
    var status = props.status || "accepted";
    var inner = [
      h("span", { key: "g", className: "sl-label" }, "Gen " + props.gen),
      h("span", { key: "m", className: cx("sl-node-mark", "sl-mark-" + status), "aria-label": status }),
      h("span", { key: "s", className: "sl-num sl-node-score" },
        props.score == null ? "—" : (props.score * 100).toFixed(1)),
      h("span", {
        key: "d",
        className: cx("sl-num", "sl-node-delta",
          props.delta > 0 ? "sl-up" : props.delta < 0 ? "sl-down" : "sl-muted")
      }, props.delta == null ? (status === "pending" ? "running" : "") : signed(props.delta * 100))
    ];
    var cls = cx("sl-node", "sl-node-" + status, props.active && "sl-node-active", props.className);
    if (props.onClick) {
      return h("button", { type: "button", className: cls, onClick: props.onClick, "aria-pressed": !!props.active }, inner);
    }
    return h("div", { className: cls }, inner);
  }

  // ---------- ScoreCurve ----------
  function lastIndex(a) {
    for (var i = a.length - 1; i >= 0; i--) if (a[i] != null) return i;
    return -1;
  }

  function ScoreCurve(props) {
    var train = props.train || [];
    var heldout = props.heldout || [];
    var refs = props.refs || [];
    var width = props.width || 360;
    var height = props.height || 150;
    var min = props.min == null ? 0.4 : props.min;
    var max = props.max == null ? 1 : props.max;
    var pad = { l: 34, r: 48, t: 10, b: 22 };
    var n = Math.max(train.length, heldout.length, (props.xLabels || []).length, 2);
    var iw = width - pad.l - pad.r;
    var ih = height - pad.t - pad.b;
    function x(i) { return pad.l + (i / (n - 1)) * iw; }
    function y(v) { return pad.t + (1 - (v - min) / (max - min)) * ih; }
    function segments(a, cls) {
      var out = [], cur = [];
      a.forEach(function (v, i) {
        if (v == null) { if (cur.length > 1) out.push(cur); cur = []; return; }
        cur.push(x(i).toFixed(1) + "," + y(v).toFixed(1));
      });
      if (cur.length > 1) out.push(cur);
      return out.map(function (p, k) { return h("polyline", { key: cls + k, className: cls, points: p.join(" ") }); });
    }

    var ticks = [];
    for (var t = Math.ceil(min * 10); t <= Math.floor(max * 10); t++) {
      var v = t / 10;
      ticks.push(h("g", { key: "t" + t },
        h("line", { className: "sl-curve-grid", x1: pad.l, x2: width - pad.r, y1: y(v), y2: y(v) }),
        h("text", { x: pad.l - 6, y: y(v) + 3, textAnchor: "end" }, Math.round(v * 100))));
    }
    var last = n - 1;
    var xl = props.xLabels;
    var idx = xl && xl.length <= 12 ? xl.map(function (_, i) { return i; }) : [0, Math.round(last / 2), last];
    var xt = idx.map(function (i) {
      var label = xl ? xl[i] : "Gen " + i;
      return h("text", { key: "x" + i, x: x(i), y: height - 6, textAnchor: i === 0 ? "start" : i === last ? "end" : "middle" }, label);
    });

    var refEls = refs.map(function (r, k) {
      return h("g", { key: "r" + k },
        h("line", { className: "sl-ref", x1: pad.l, x2: width - pad.r, y1: y(r.value), y2: y(r.value) }),
        h("text", { className: "sl-ref-label", x: pad.l + 6, y: y(r.value) - 5 }, r.label + " · " + (r.value * 100).toFixed(0)));
    });

    var ends = [];
    var ti = lastIndex(train), hi = lastIndex(heldout);
    var ty = ti >= 0 ? y(train[ti]) : null;
    var hy = hi >= 0 ? y(heldout[hi]) : null;
    if (ty != null && hy != null && ti === hi && Math.abs(ty - hy) < 12) {
      var mid = (ty + hy) / 2;
      if (ty <= hy) { ty = mid - 6; hy = mid + 6; } else { ty = mid + 6; hy = mid - 6; }
    }
    if (ti >= 0) {
      ends.push(h("circle", { key: "tc", className: "sl-dot-train", cx: x(ti), cy: y(train[ti]), r: 3.5 }));
      ends.push(h("text", { key: "tt", className: "sl-end-train", x: x(ti) + 8, y: ty + 3 }, (train[ti] * 100).toFixed(1)));
    }
    heldout.forEach(function (v, i) {
      if (v == null) return;
      ends.push(h("circle", { key: "hc" + i, className: "sl-dot-heldout", cx: x(i), cy: y(v), r: i === hi ? 3.5 : 2.5 }));
    });
    if (hi >= 0) {
      ends.push(h("text", { key: "ht", className: "sl-end-heldout", x: x(hi) + 8, y: hy + 3 }, (heldout[hi] * 100).toFixed(1)));
    }

    var svg = h("svg", {
      className: "sl-curve-svg",
      viewBox: "0 0 " + width + " " + height,
      width: width,
      height: height,
      role: "img",
      "aria-label": props.label || "Score by generation"
    },
      ticks,
      refEls,
      props.baseline != null && h("line", { className: "sl-base", x1: pad.l, x2: width - pad.r, y1: y(props.baseline), y2: y(props.baseline) }),
      segments(train, "sl-line-train"),
      segments(heldout, "sl-line-heldout"),
      ends,
      xt);

    var legend = h("div", { className: "sl-legend" },
      train.length > 0 && h("span", { className: "sl-key sl-key-train" }, props.trainLabel || "Training"),
      heldout.length > 0 && h("span", { className: "sl-key sl-key-heldout" }, props.heldoutLabel || "Held-out"),
      props.baseline != null && h("span", { className: "sl-key sl-key-base" }, "Baseline"));

    return h("figure", { className: cx("sl-curve", props.className) }, svg, legend);
  }

  // ---------- DiffCard ----------
  var OP = { add: "+", remove: "−", change: "~" };

  function DiffCard(props) {
    var changes = props.changes || [];
    var rows = changes.map(function (c, i) {
      var op = c.op || "change";
      return h("li", { key: i, className: "sl-diff-row" },
        h("span", { className: "sl-label" }, c.knob),
        h("span", { className: cx("sl-num", "sl-op", "sl-op-" + op), "aria-label": op }, OP[op]),
        h("span", { className: "sl-diff-text" }, c.text));
    });
    var hasResult = props.predicted != null || props.actual != null;
    return h("article", { className: cx("sl-diff", props.className) },
      h("header", { className: "sl-diff-head" },
        h("span", { className: "sl-diff-title" },
          h("span", { className: "sl-num" }, "Gen " + props.gen),
          props.parent != null && h("span", { className: "sl-muted sl-small" }, " from Gen " + props.parent)),
        props.status && h(StatusBadge, { kind: props.status })),
      h("ul", { className: "sl-diff-list" }, rows),
      hasResult && h("footer", { className: "sl-diff-foot" },
        props.predicted != null && h("span", null,
          h("span", { className: "sl-label" }, "Predicted "),
          h("span", { className: "sl-num" }, signed(props.predicted * 100) + " pts")),
        props.actual != null && h("span", null,
          h("span", { className: "sl-label" }, "Actual "),
          h("span", { className: cx("sl-num", props.actual > 0 ? "sl-up" : props.actual < 0 ? "sl-down" : "") },
            signed(props.actual * 100) + " pts"))));
  }

  // ---------- DamageMap ----------
  var STATES = [
    { key: "intact", label: "Intact", fill: "dmg-intact" },
    { key: "minor", label: "Minor damage", fill: "dmg-minor" },
    { key: "street", label: "Street flooded", fill: "dmg-street" },
    { key: "home", label: "Homes flooded", fill: "dmg-home", critical: true },
    { key: "wind", label: "Wind or roof damage", fill: "dmg-wind" },
    { key: "major", label: "Major damage", fill: "dmg-major", critical: true },
    { key: "destroyed", label: "Destroyed", fill: "dmg-destroyed", critical: true },
    { key: "fire", label: "Fire", fill: "dmg-major", glyph: "fire", critical: true },
    { key: "road", label: "Road blocked", fill: "dmg-intact", glyph: "road" },
    { key: "power", label: "Power out", fill: "dmg-intact", glyph: "power" },
    { key: "shelter", label: "Shelter open", fill: "dmg-intact", glyph: "shelter" },
    { key: "hospital", label: "Hospital operating", fill: "dmg-intact", glyph: "hospital" }
  ];
  var STATE = {};
  STATES.forEach(function (s) { STATE[s.key] = s; });
  STATE.water = { key: "water", label: "Water", fill: "map-water", scenery: true };
  STATE.park = { key: "park", label: "Park", fill: "map-park", scenery: true };

  function DamageMap(props) {
    var size = props.size || 32;
    var cells = props.cells || [];
    var conf = props.confidence;
    var truth = props.truth;
    var mode = props.mode || "guess";
    var cellSize = props.cellSize || 16;
    var gap = props.gap == null ? (cellSize >= 10 ? 1 : 0) : props.gap;
    var glyphs = props.glyphs == null ? cellSize >= 12 : props.glyphs;
    var floor = props.confidenceFloor == null ? 0.15 : props.confidenceFloor;
    var src = mode === "truth" && truth ? truth : cells;
    var items = [];
    for (var i = 0; i < size * size; i++) {
      var k = src[i] || "intact";
      var s = STATE[k] || STATE.intact;
      var o = 1;
      var wrong = false;
      if (!s.scenery) {
        if (mode === "diff" && truth) {
          wrong = truth[i] !== cells[i];
          o = wrong ? 1 : 0.18;
        } else if (mode === "guess" && conf) {
          o = floor + (1 - floor) * Math.max(0, Math.min(1, conf[i]));
        }
      }
      items.push(h("div", {
        key: i,
        "data-i": i,
        className: cx("sl-mcell", wrong && "sl-mcell-wrong", props.selected === i && "sl-mcell-sel"),
        style: { background: "var(--" + s.fill + ")", opacity: o }
      }, glyphs && s.glyph ? h("span", { className: "sl-glyph sl-glyph-" + s.glyph }) : null));
    }
    var onClick = props.onSelect ? function (e) {
      var t = e.target.closest ? e.target.closest("[data-i]") : null;
      if (t) props.onSelect(Number(t.getAttribute("data-i")));
    } : undefined;
    var grid = h("div", {
      className: cx("sl-map", props.onSelect && "sl-map-pick"),
      role: "img",
      "aria-label": props.label || size + " by " + size + " damage map",
      onClick: onClick,
      style: {
        gridTemplateColumns: "repeat(" + size + ", " + cellSize + "px)",
        gridAutoRows: cellSize + "px",
        gap: gap + "px"
      }
    }, items);
    var cap = (props.caption || props.meta) && h("figcaption", { className: "sl-puzzle-cap" },
      props.caption && h("span", { className: "sl-label" }, props.caption),
      props.meta && h("span", { className: "sl-num sl-muted" }, props.meta));
    return h("figure", { className: cx("sl-puzzle", props.className) }, grid, cap);
  }

  function DamageLegend(props) {
    var keys = props.states || STATES.map(function (s) { return s.key; });
    return h("ul", { className: cx("sl-legend-map", props.columns === 1 && "sl-legend-one", props.className) },
      keys.map(function (k) {
        var s = STATE[k];
        return h("li", { key: k },
          h("span", { className: "sl-swatch", style: { background: "var(--" + s.fill + ")" } },
            s.glyph ? h("span", { className: "sl-glyph sl-glyph-" + s.glyph }) : null),
          h("span", null, s.label),
          s.critical && props.markCritical ? h("span", { className: "sl-crit" }, "critical") : null);
      }));
  }

  // ---------- LineageTree ----------
  // Kept changes stack on the main line; rejected ideas hang off as dead ends; memory skips as hollow stubs.
  function LineageTree(props) {
    var gens = props.gens || [];
    var total = props.total || Math.max(gens.length, 2);
    var width = props.width || 760, height = props.height || 150;
    var padX = 28, yMain = 44, yBranch = 112;
    var step = (width - padX * 2) / Math.max(1, total - 1);
    function x(g) { return padX + g * step; }
    var els = [], main = [];
    gens.forEach(function (g) { if (g.status === 'baseline' || g.status === 'kept') main.push(g); });
    for (var k = 1; k < main.length; k++) {
      els.push(h("line", { key: "e" + k, className: "sl-lt-edge", x1: x(main[k - 1].gen), y1: yMain, x2: x(main[k].gen), y2: yMain }));
    }
    gens.forEach(function (g) {
      var onMain = g.status === 'baseline' || g.status === 'kept';
      var cx = x(g.gen), cy = onMain ? yMain : yBranch;
      if (!onMain && g.parent != null) {
        els.push(h("path", { key: "b" + g.gen, className: "sl-lt-branch sl-lt-branch-" + g.status,
          d: "M" + x(g.parent) + " " + yMain + " C " + x(g.parent) + " " + (yMain + 40) + ", " + cx + " " + (yBranch - 40) + ", " + cx + " " + (yBranch - 13) }));
      }
      els.push(h("g", { key: "n" + g.gen, className: "sl-lt-node sl-lt-" + g.status },
        h("circle", { cx: cx, cy: cy, r: 13 }),
        h("text", { x: cx, y: cy + 4, textAnchor: "middle", className: "sl-lt-num" }, g.gen),
        h("text", { x: cx, y: cy + (onMain ? -22 : 30), textAnchor: "middle", className: "sl-lt-label" }, g.label || "")));
    });
    if (props.current != null) {
      var cx2 = x(props.current);
      els.push(h("g", { key: "cur", className: "sl-lt-current" },
        h("circle", { cx: cx2, cy: yMain, r: 13 }),
        h("text", { x: cx2, y: yMain + 4, textAnchor: "middle", className: "sl-lt-num" }, props.current)));
    }
    return h("svg", { className: cx("sl-lt", props.className), viewBox: "0 0 " + width + " " + height, width: width, height: height,
      role: "img", "aria-label": props.label || "Lineage of the harness" }, els);
  }

  // ---------- PolicyRules ----------
  // The evolved policy as plain rules, each traced to the generation that found it.
  function PolicyRules(props) {
    var rules = props.rules || [];
    return h("ol", { className: cx("sl-rules", props.className) }, rules.map(function (r, i) {
      return h("li", { key: i },
        h("span", { className: "sl-rules-n sl-num" }, i + 1),
        h("span", { className: "sl-rules-text" }, r.text),
        h("span", { className: "sl-rules-gen" }, "Gen " + r.gen));
    }));
  }

  var api = {
    PuzzleGrid: PuzzleGrid,
    StatusBadge: StatusBadge,
    LineageNode: LineageNode,
    ScoreCurve: ScoreCurve,
    DiffCard: DiffCard,
    DamageMap: DamageMap,
    DamageLegend: DamageLegend,
    LineageTree: LineageTree,
    PolicyRules: PolicyRules,
    STATES: STATES,
    PALETTE: PALETTE
  };
  window.Sightline = window.Sightline || {};
  Object.assign(window.Sightline, api);
})();
