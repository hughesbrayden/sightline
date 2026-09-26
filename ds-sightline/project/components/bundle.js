/* @ds-bundle: {"format":4,"namespace":"Sightline","components":[{"name":"PuzzleGrid"},{"name":"StatusBadge"},{"name":"LineageNode"},{"name":"ScoreCurve"},{"name":"DiffCard"}]} */
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
  function ScoreCurve(props) {
    var train = props.train || [];
    var heldout = props.heldout || [];
    var width = props.width || 360;
    var height = props.height || 150;
    var min = props.min == null ? 0.4 : props.min;
    var max = props.max == null ? 1 : props.max;
    var pad = { l: 34, r: 48, t: 10, b: 22 };
    var n = Math.max(train.length, heldout.length, 2);
    var iw = width - pad.l - pad.r;
    var ih = height - pad.t - pad.b;
    function x(i) { return pad.l + (i / (n - 1)) * iw; }
    function y(v) { return pad.t + (1 - (v - min) / (max - min)) * ih; }
    function pts(a) { return a.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" "); }

    var ticks = [];
    for (var t = Math.ceil(min * 10); t <= Math.floor(max * 10); t++) {
      var v = t / 10;
      ticks.push(h("g", { key: "t" + t },
        h("line", { className: "sl-curve-grid", x1: pad.l, x2: width - pad.r, y1: y(v), y2: y(v) }),
        h("text", { x: pad.l - 6, y: y(v) + 3, textAnchor: "end" }, Math.round(v * 100))));
    }
    var last = n - 1;
    var xt = [0, Math.round(last / 2), last].map(function (i) {
      return h("text", { key: "x" + i, x: x(i), y: height - 6, textAnchor: i === 0 ? "start" : i === last ? "end" : "middle" }, "Gen " + i);
    });

    var ends = [];
    var ty = train.length ? y(train[train.length - 1]) : null;
    var hy = heldout.length ? y(heldout[heldout.length - 1]) : null;
    if (ty != null && hy != null && Math.abs(ty - hy) < 12) {
      var mid = (ty + hy) / 2;
      if (ty <= hy) { ty = mid - 6; hy = mid + 6; } else { ty = mid + 6; hy = mid - 6; }
    }
    if (train.length) {
      var tv = train[train.length - 1];
      ends.push(h("circle", { key: "tc", className: "sl-dot-train", cx: x(train.length - 1), cy: y(tv), r: 3.5 }));
      ends.push(h("text", { key: "tt", className: "sl-end-train", x: x(train.length - 1) + 8, y: ty + 3 }, (tv * 100).toFixed(1)));
    }
    if (heldout.length) {
      var hv = heldout[heldout.length - 1];
      ends.push(h("circle", { key: "hc", className: "sl-dot-heldout", cx: x(heldout.length - 1), cy: y(hv), r: 3.5 }));
      ends.push(h("text", { key: "ht", className: "sl-end-heldout", x: x(heldout.length - 1) + 8, y: hy + 3 }, (hv * 100).toFixed(1)));
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
      props.baseline != null && h("line", { className: "sl-base", x1: pad.l, x2: width - pad.r, y1: y(props.baseline), y2: y(props.baseline) }),
      train.length > 1 && h("polyline", { className: "sl-line-train", points: pts(train) }),
      heldout.length > 1 && h("polyline", { className: "sl-line-heldout", points: pts(heldout) }),
      ends,
      xt);

    var legend = h("div", { className: "sl-legend" },
      h("span", { className: "sl-key sl-key-train" }, "Training"),
      h("span", { className: "sl-key sl-key-heldout" }, "Held-out"),
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

  var api = {
    PuzzleGrid: PuzzleGrid,
    StatusBadge: StatusBadge,
    LineageNode: LineageNode,
    ScoreCurve: ScoreCurve,
    DiffCard: DiffCard,
    PALETTE: PALETTE
  };
  window.Sightline = window.Sightline || {};
  Object.assign(window.Sightline, api);
})();
