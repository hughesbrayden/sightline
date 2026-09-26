// Placeholder status page that proves the API works. The v0-built UI replaces this page, not the API.
"use client";
import { useEffect, useState } from "react";

type Gen = { gen: number; status: string; dev: number | null; val: number | null; hypothesis: string | null };
type State = { run: { id: string; used: number; cost_usd: number }; refs: any; gens: Gen[]; probe: any };

const pct = (v: number | null) => (v === null ? "-" : `${(v * 100).toFixed(1)}%`);

export default function Page() {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/state").then((r) => r.json()).then(setS).catch(() => {});
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);
  if (!s?.gens) return <main style={{ padding: 16 }}>Loading…</main>;
  return (
    <main style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>Sightline · run {s.run.id}</h1>
      <p style={{ opacity: 0.7 }}>
        {s.run.used} generations · curator ${s.run.cost_usd.toFixed(2)} · baseline val {pct(s.refs?.baseline?.val ?? null)} ·
        ceiling val {pct(s.refs?.ceiling?.val ?? null)} · probe: {s.probe?.denied ? "denied ✓" : "not run"}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr>{["gen", "status", "dev", "val", "hypothesis"].map((h) => <th key={h} style={{ textAlign: "left", padding: 6 }}>{h}</th>)}</tr></thead>
        <tbody>
          {s.gens.map((g) => (
            <tr key={g.gen} style={{ borderTop: "1px solid #2A2F36" }}>
              <td style={{ padding: 6 }}>{g.gen}</td><td style={{ padding: 6 }}>{g.status}</td>
              <td style={{ padding: 6 }}>{pct(g.dev)}</td><td style={{ padding: 6 }}>{pct(g.val)}</td>
              <td style={{ padding: 6, opacity: 0.8 }}>{g.hypothesis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
