// Judges' start page: the pitch, the demo, and the real numbers from the recorded run (lib/headline.json,
// written by demo/snapshot.mjs). Static, so it works even if the database is unreachable.
import headline from "@/lib/headline.json";

const REPO = "https://github.com/hughesbrayden/sightline";
const VIDEO_URL: string | null = null;  // set once the recording is uploaded

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const BEATS = ["Calm night", "Storm hits", "Generation 0", "Fitness signal", "Evolution", "Replay", "What it learned"];

const c = {
  surface: "#f4f5f3", raised: "#ffffff", sunken: "#e9ece9", line: "#d8dcd9", ink: "#15191b", muted: "#59626a",
  accent: "#0a6c86", accentSoft: "#ddeff3", good: "#1d7544", critical: "#b0271f", held: "#a44a14",
};
const display = "'Archivo', system-ui, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

function Stat({ label, from, to, note }: { label: string; from: string; to: string; note?: string }) {
  return (
    <div style={{ background: c.raised, border: `1px solid ${c.line}`, borderRadius: 10, padding: "18px 20px", flex: "1 1 220px" }}>
      <div style={{ color: c.muted, fontSize: 13 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 26, marginTop: 6 }}>
        <span style={{ color: c.muted }}>{from}</span> <span style={{ color: c.muted }}>→</span>{" "}
        <span style={{ color: c.good, fontWeight: 500 }}>{to}</span>
      </div>
      {note ? <div style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>{note}</div> : null}
    </div>
  );
}

export default function Page() {
  const h = headline;
  const scoredTonight = h.heldout.some((x: { town: string }) => x.town === "NYC1");
  return (
    <main style={{ background: c.surface, color: c.ink, minHeight: "100vh", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 16px 64px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${c.line}`, paddingBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: display, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Sightline</span>
          <span style={{ color: c.muted, fontSize: 13 }}>MongoDB NYC · Harness Engineering &amp; Model Wrangling · Kishore Bhatia &amp; Brayden Hughes</span>
        </header>

        <section style={{ padding: "48px 0 28px" }}>
          <div style={{ color: c.accent, fontSize: 12, letterSpacing: "0.12em", fontWeight: 600 }}>THE POLICY IS THE PRODUCT</div>
          <h1 style={{ fontFamily: display, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "10px 0 16px", maxWidth: 820 }}>
            A frozen model. A harness that evolves how it reads the storm.
          </h1>
          <p style={{ fontSize: 18, color: c.muted, maxWidth: 760, lineHeight: 1.5, margin: 0 }}>
            Fast decision models see only a sliver of the data, and that sliver decides whether they are right. Sightline
            teaches itself what to show Jev, TypeSafe&apos;s fast decision model, after a hurricane: it proves the result on
            storms it never trained on, and it can&apos;t cheat, because MongoDB locks the answers away from it.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <a href="/sightline.html" style={{ background: c.accent, color: "#fff", padding: "14px 22px", borderRadius: 8, fontWeight: 600, textDecoration: "none", fontSize: 16 }}>Open the demo →</a>
            {VIDEO_URL ? <a href={VIDEO_URL} style={{ border: `1px solid ${c.line}`, background: c.raised, color: c.ink, padding: "14px 22px", borderRadius: 8, textDecoration: "none" }}>Watch the 3-minute video</a> : null}
            <a href={`${REPO}/blob/main/DEMO.md`} style={{ border: `1px solid ${c.line}`, background: c.raised, color: c.ink, padding: "14px 22px", borderRadius: 8, textDecoration: "none" }}>Code &amp; architecture</a>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: c.muted, fontSize: 13 }}>Jump to a beat:</span>
            {BEATS.map((b, i) => (
              <a key={b} href={`/sightline.html?beat=${i + 1}`} style={{ fontSize: 13, color: c.accent, background: c.accentSoft, padding: "4px 10px", borderRadius: 999, textDecoration: "none" }}>{i + 1} · {b}</a>
            ))}
          </div>
        </section>

        <section>
          <div style={{ fontSize: 13, color: c.muted, marginBottom: 10 }}>
            Real numbers from the recorded run <span style={{ fontFamily: mono }}>{h.run}</span> · storms are simulated on stylized city maps
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Stat label="Validation storm, balanced accuracy" from={pct(h.val.from)} to={pct(h.val.to)} note={`Builder's hand-written ceiling: ${pct(h.val.ceiling)}`} />
            <Stat label="NYC storm: crews sent to the wrong block" from={String(h.night.gen0.wrongCrews)} to={String(h.night.evolved.wrongCrews)} note="Generation 0 vs the evolved harness" />
            <Stat label="NYC storm: rescue-critical blocks found" from={`${h.night.gen0.crit}/${h.night.gen0.critTotal}`} to={`${h.night.evolved.crit}/${h.night.evolved.critTotal}`} note="Collapsed, homes flooded, fire, hospital down" />
            <Stat label="Generations run automatically" from={`${h.generations}`} to={`${h.kept} kept`} note={`${h.rejected} rejected by the gate · ${h.notScored} not scored · curator cost $${h.curatorCost.toFixed(2)}`} />
          </div>
          <p style={{ fontSize: 13, color: c.muted, marginTop: 10 }}>
            {scoredTonight
              ? "Tonight's NYC storm has been scored once with the final policy; the demo shows it."
              : "The NYC storm shown is the validation storm the gate used. Tonight's held-out NYC storm is scored once, at the end."}
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16, marginTop: 36 }}>
          {[
            ["The problem", "Six hours after landfall the evidence contradicts itself: 911 calls filed one block off, viral \"verified\" rumors, two agencies with two damage scales, a utility feed that is dark for a whole neighborhood. Shown the 12 nearest reports, Jev takes them at face value."],
            ["What we built", "A blind curator LLM proposes a context policy. It compiles to a MongoDB aggregation pipeline ($geoNear, $match, $switch) that picks exactly what Jev sees per block. Jev maps every block; a scorer grades the map; a gate on a separate storm keeps or rejects each change; a held-out storm is scored once."],
            ["Why it can't cheat", "The answer key lives in a MongoDB collection only the scorer's login can read. The curator's login is refused, and a live probe proves it:"],
          ].map(([t, body], i) => (
            <div key={t} style={{ background: c.raised, border: `1px solid ${c.line}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t}</div>
              <p style={{ margin: 0, lineHeight: 1.55, fontSize: 15 }}>{body}</p>
              {i === 2 && h.probe ? <code style={{ display: "block", marginTop: 10, fontFamily: mono, fontSize: 12, background: c.sunken, padding: 10, borderRadius: 6, color: c.critical }}>denied (code 13): {h.probe}</code> : null}
            </div>
          ))}
        </section>

        <section style={{ marginTop: 36, background: c.raised, border: `1px solid ${c.line}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, marginBottom: 10 }}>What the harness learned on its own</div>
          {h.rules.map((r: { gen: number; text: string }, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${c.line}` : "none" }}>
              <span>{r.text}</span><span style={{ fontFamily: mono, fontSize: 12, color: c.accent, background: c.accentSoft, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>Gen {r.gen}</span>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 36, fontSize: 14, lineHeight: 1.6 }}>
          <strong>Stack.</strong> TypeSafe Jev (typesafe/jev-1.13 via OpenRouter) · open-model curator (GLM-5.2 via OpenRouter) ·
          MongoDB Atlas: geo queries, time-series runs, vector-indexed memory, collection-level custom roles · Python harness ·
          Next.js on Vercel · Sightline design system.
          <div style={{ marginTop: 10, color: c.muted }}>
            For the technically curious: the live, read-only API is at <a href="/api/state" style={{ color: c.accent }}>/api/state</a>,{" "}
            <a href="/api/map?town=MIA1&gen=0" style={{ color: c.accent }}>/api/map</a> and /api/block. The source is on{" "}
            <a href={REPO} style={{ color: c.accent }}>GitHub</a>.
          </div>
        </section>
      </div>
    </main>
  );
}
