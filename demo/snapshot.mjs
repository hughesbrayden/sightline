// Record the recorded run as the demo's offline fallback, plus the headline numbers for the start page.
//   node demo/snapshot.mjs [https://sightline-dashboard.vercel.app] [live-2]
// Writes dashboard/public/snapshot.json (API path -> response) and dashboard/lib/headline.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || "https://sightline-dashboard.vercel.app").replace(/\/$/, "");
const RUN = process.argv[3] || "live-2";
const snap = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {  // record every API response the demo makes, keyed by path
  const res = await realFetch(url);
  const body = await res.clone().json().catch(() => null);
  if (String(url).startsWith(BASE + "/api/") && body) snap[String(url).slice(BASE.length)] = body;
  return res;
};
globalThis.window = globalThis;
new Function(fs.readFileSync(path.join(here, "src/scenario.js"), "utf8"))();
new Function(fs.readFileSync(path.join(here, "src/live.js"), "utf8"))();
const F = await window.SightlineLive.load(BASE, RUN);

// Block cards: every land block of the demo night, for generation 0 and the evolved generation.
const cells = [];
F.calm.forEach((c, i) => { if (c !== "water") cells.push(i); });
const jobs = [];
for (const gen of [0, F.bestGen]) for (const i of cells) jobs.push([gen, i % 32, Math.floor(i / 32)]);
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const [gen, x, y] = jobs[next++];
    const r = await window.SightlineDemo.getBlock(gen, x, y).catch(() => null);
    if (r && r.lines) {  // keep the card payload small
      const key = `/api/block?run=${F.run}&gen=${gen}&town=${F.night}&x=${x}&y=${y}`;
      snap[key] = { lines: r.lines, jev: r.jev, assessment: r.assessment, correct: r.correct };
    }
  }
}
await Promise.all(Array.from({ length: 16 }, worker));

const out = path.join(here, "../dashboard/public/snapshot.json");
fs.writeFileSync(out, JSON.stringify(snap));
const st = snap[`/api/state?run=${RUN}`];
const gens = st.gens, kept = gens.filter((g) => g.status === "accepted");
const headline = {
  run: F.run, night: F.night, recorded: new Date().toISOString(),
  generations: gens.length - 1, kept: kept.length - 1,
  rejected: gens.filter((g) => g.status === "rejected").length,
  notScored: gens.filter((g) => g.dev == null).length,
  val: { from: st.refs.baseline.val, to: kept[kept.length - 1].val, ceiling: st.refs.ceiling.val },
  dev: { from: st.refs.baseline.dev, to: kept[kept.length - 1].dev, ceiling: st.refs.ceiling.dev },
  night: { gen0: { acc: F.zero.acc, crit: F.zero.critFound, critTotal: F.zero.critTotal, wrongCrews: F.zero.falseAlarms },
           evolved: { acc: F.evolved.acc, crit: F.evolved.critFound, critTotal: F.evolved.critTotal, wrongCrews: F.evolved.falseAlarms } },
  nightName: F.night,
  rules: F.gens.filter((g) => g.rules).flatMap((g) => g.rules.map((t) => ({ gen: g.gen, text: t }))),
  probe: st.probe ? st.probe.error : null,
  heldout: st.heldout || [],
  curatorCost: st.run.cost_usd,
};
fs.writeFileSync(path.join(here, "../dashboard/lib/headline.json"), JSON.stringify(headline, null, 2));
console.log(`snapshot: ${Object.keys(snap).length} responses, ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB; night ${F.night}; headline written`);
