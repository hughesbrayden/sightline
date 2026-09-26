// GET /api/state?run=live-1 -> run summary, refs, lineage, once-only scores, tripwire probe.
import { db, json, resolveRun } from "@/lib/db";

export const dynamic = "force-dynamic";

type Policy = {
  gen: number; parent: number | null; status: string; genome_id?: string; ops?: unknown[]; format?: string;
  compiled_pipeline?: unknown[]; rationale?: { hypothesis?: string; refuted_if?: string } | string;
  prediction?: string; gate?: string | null; note?: string; error?: string;
  dev_score?: { balanced_accuracy: number; life_safety_found: number; life_safety_total: number;
                false_dispatches: number; brier: number; mean_confidence: number };
  curator?: { model?: string; cost?: number; seconds?: number; prompt_tokens?: number; completion_tokens?: number };
  created?: Date;
};

export async function GET(req: Request) {
  const d = await db();
  const run = await resolveRun(d, new URL(req.url).searchParams.get("run"));
  if (!run) return json({ error: "no runs yet" }, 404);

  const [policies, gates, refs, probe] = await Promise.all([
    d.collection<Policy>("policies").find({ run, kind: { $ne: "probe" } }, { projection: { _id: 0 } })
      .sort({ gen: 1 }).toArray(),
    d.collection("gate_scores").find({ run }, { projection: { _id: 0 } }).sort({ created: 1 }).toArray(),
    d.collection("gate_scores").find({ kind: "refs" }, { projection: { _id: 0 } }).sort({ created: -1 }).limit(1).next(),
    d.collection("policies").find({ kind: "probe" }, { projection: { _id: 0 } }).sort({ created: -1 }).limit(1).next(),
  ]);
  const valByGen = new Map(gates.map((g) => [g.gen as number, g]));
  // This run's genomes, plus the shared baseline (generation 0 is the baseline genome, scored once on tonight's storm).
  const genomeIds = [...(policies.map((p) => p.genome_id).filter(Boolean) as string[]), "baseline"];
  const heldout = await d.collection("heldout_scores")
    .find({ genome_id: { $in: genomeIds } }, { projection: { _id: 0 } }).sort({ created: 1 }).toArray();

  const gens = policies.map((p) => {
    const g = valByGen.get(p.gen);
    const r = typeof p.rationale === "object" && p.rationale ? p.rationale : { hypothesis: p.rationale };
    return {
      gen: p.gen, parent: p.parent, status: p.status, genome_id: p.genome_id, gate: p.gate ?? null,
      dev: p.dev_score?.balanced_accuracy ?? null, val: g?.val_score ?? null,
      life_safety_found: p.dev_score?.life_safety_found ?? null,
      life_safety_total: p.dev_score?.life_safety_total ?? null,
      false_dispatches: p.dev_score?.false_dispatches ?? null,
      hypothesis: r.hypothesis ?? null, refuted_if: r.refuted_if ?? null, prediction: p.prediction ?? null,
      ops: p.ops ?? [], format: p.format ?? "raw", pipeline: p.compiled_pipeline ?? [],
      note: p.note ?? p.error ?? null, curator: p.curator ?? null, created: p.created ?? null,
    };
  });
  const scored = gens.filter((g) => g.dev !== null);
  return json({
    run: {
      id: run, used: gens.filter((g) => g.gen > 0).length,
      status: gens.some((g) => g.status === "running") ? "running" : "idle",
      cost_usd: gens.reduce((s, g) => s + (g.curator?.cost ?? 0), 0),
      best_gen: [...gens].reverse().find((g) => g.status === "accepted")?.gen ?? 0,
      scored_gens: scored.length,
    },
    refs: refs ? { baseline: refs.baseline, ceiling: refs.ceiling } : null,
    gens,
    heldout,
    probe: probe ? { denied: probe.status === "denied", error: probe.error, at: probe.created, label: probe.label } : null,
  });
}
