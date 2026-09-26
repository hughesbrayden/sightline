// GET /api/reports?town=NYC1&until_hour=6 -> the report feed for the storm-hits beat, in arrival order.
import { db, json } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const town = q.get("town") ?? "NYC1";
  const until = Number(q.get("until_hour") ?? 6);
  const sources = q.get("sources")?.split(",").filter(Boolean);
  const d = await db();
  const reports = await d.collection("reports").find(
    { town, hour: { $lte: until }, ...(sources ? { source: { $in: sources } } : { source: { $ne: "pre-storm-map" } }) },
    { projection: { _id: 0, hour: 1, source: 1, x: 1, y: 1, value: 1, text: 1, verified: 1, handle: 1 } },
  ).sort({ hour: 1 }).limit(3000).toArray();
  return json({ town, until_hour: until, count: reports.length, reports });
}
