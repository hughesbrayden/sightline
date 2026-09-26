// GET /api/block?run=&gen=&town=&x=&y= -> exactly what Jev saw for one block, and what it answered.
import { db, json, resolveRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const d = await db();
  const run = await resolveRun(d, q.get("run"));
  const town = q.get("town");
  const raw = ["gen", "x", "y"].map((k) => q.get(k));
  const [gen, x, y] = raw.map((v) => (v === null || v.trim() === "" ? NaN : Number(v)));  // Number(null) is 0
  if (!run || !town || [gen, x, y].some((v) => !Number.isInteger(v))) {
    return json({ error: "need run, gen, town, x, y (integers)" }, 400);
  }
  const doc = await d.collection("runs").findOne(
    { "meta.run": run, "meta.gen": gen, "meta.town": town, x, y }, { projection: { _id: 0 } });
  if (!doc) return json({ error: "no such block in this run" }, 404);
  const probs = Object.entries((doc.probs ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]);
  return json({
    run, gen, town, x, y,
    lines: doc.lines ?? null,  // null for rows written before the driver stored context lines
    jev: { pick: doc.pick, conf: doc.conf, probs },
    assessment: doc.truth ?? null,  // present only once the scorer has published the graded map
    correct: doc.correct ?? null,
  });
}
