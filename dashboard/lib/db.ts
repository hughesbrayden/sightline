// Read-only MongoDB access for the dashboard. Server-side only: this module must never reach the browser.
// The `dashboard` login can read everything except `assessments` and can write nothing (enforced by Atlas roles).
import "server-only";
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI_DASHBOARD;

const globalForMongo = globalThis as unknown as { _mongo?: Promise<MongoClient> };

export async function db(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI_DASHBOARD is not set");
  globalForMongo._mongo ??= new MongoClient(uri, { appName: "sightline-dashboard", maxPoolSize: 5 }).connect();
  return (await globalForMongo._mongo).db("jevly");
}

// Latest run id that has lineage, unless one is asked for.
export async function resolveRun(d: Db, run: string | null): Promise<string | null> {
  if (run) return run;
  const doc = await d
    .collection("policies")
    .find({ kind: { $ne: "probe" }, gen: { $exists: true } })
    .sort({ created: -1 })
    .limit(1)
    .next();
  return (doc?.run as string) ?? null;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
