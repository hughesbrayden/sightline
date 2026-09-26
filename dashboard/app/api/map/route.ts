// GET /api/map?run=&gen=&town= -> the 32x32 map Jev drew for one generation on one storm.
import { db, json, resolveRun } from "@/lib/db";
import meta from "@/lib/storm-meta.json";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const d = await db();
  const run = await resolveRun(d, q.get("run"));
  const town = q.get("town") ?? meta.splits.dev[0];
  if (!run) return json({ error: "no runs yet" }, 404);
  let gen = q.get("gen") !== null ? Number(q.get("gen")) : null;
  if (gen === null) {  // default: newest generation that has a map for this storm
    const last = await d.collection("runs").find({ "meta.run": run, "meta.town": town })
      .sort({ "meta.gen": -1 }).limit(1).next();
    gen = (last?.meta?.gen as number) ?? 0;
  }
  const [blocks, cells] = await Promise.all([
    d.collection("blocks").find({ town }, { projection: { _id: 0, x: 1, y: 1 } }).toArray(),
    d.collection("runs").find({ "meta.run": run, "meta.gen": gen, "meta.town": town },
      { projection: { _id: 0, x: 1, y: 1, pick: 1, conf: 1, correct: 1, truth: 1, ...(q.get("lines") ? { lines: 1 } : {}) } }).toArray(),  // ?lines=1: what Jev saw, per block
  ]);
  const mask = Array.from({ length: meta.h }, () => Array(meta.w).fill(0));
  for (const b of blocks) mask[b.y][b.x] = 1;
  const split = Object.entries(meta.splits).find(([, ts]) => (ts as string[]).includes(town))?.[0] ?? null;
  const n = cells.length;
  const right = cells.filter((c) => c.correct === true).length;
  return json({
    run, gen, town, split, w: meta.w, h: meta.h, mask, states: meta.states, colors: meta.colors, sea: meta.sea,
    cells, accuracy: n && cells.some((c) => c.correct !== undefined) ? right / n : null,
  });
}
