// Judges' start page: the pitch, the demo, the architecture, and the real numbers from the recorded run
// (lib/headline.json, written by demo/snapshot.mjs). Static, so it works even if the database is unreachable.
import headline from "@/lib/headline.json";

const REPO = "https://github.com/hughesbrayden/sightline";
const VIDEO_URL: string | null = null;  // set once the recording is uploaded

type Held = { genome_id: string; town: string; split: string; score: number; life_safety_found: number;
              life_safety_total: number; false_dispatches: number };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const BEATS = ["Calm night", "Storm hits", "Generation 0", "Fitness signal", "Evolution", "Replay", "Any city"];
const CITY: Record<string, string> = { MIA2: "Miami", HOU2: "Houston", NOL2: "New Orleans" };

const c = {
  surface: "#f4f5f3", raised: "#ffffff", sunken: "#e9ece9", line: "#d8dcd9", ink: "#15191b", muted: "#59626a",
  accent: "#0a6c86", accentSoft: "#ddeff3", good: "#1d7544", critical: "#b0271f", held: "#a44a14",
};
const display = "'Archivo', system-ui, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";
const card = { background: c.raised, border: `1px solid ${c.line}`, borderRadius: 10 } as const;
const h2 = { fontFamily: display, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 6px" } as const;

function Stat({ label, from, to, note, tone }: { label: string; from?: string; to: string; note?: string; tone?: string }) {
  return (
    <div style={{ ...card, padding: "18px 20px", flex: "1 1 220px" }}>
      <div style={{ color: c.muted, fontSize: 13 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 26, marginTop: 6 }}>
        {from ? <><span style={{ color: c.muted }}>{from}</span> <span style={{ color: c.muted }}>→</span> </> : null}
        <span style={{ color: tone || c.good, fontWeight: 500 }}>{to}</span>
      </div>
      {note ? <div style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>{note}</div> : null}
    </div>
  );
}

export default function Page() {
  const h = headline;
  const held = (h.heldout || []) as Held[];
  const best = held.filter((x) => x.genome_id !== "baseline");
  const tonightBefore = held.find((x) => x.genome_id === "baseline" && x.town === "NYC1");
  const tonightAfter = best.find((x) => x.town === "NYC1");
  const cities = best.filter((x) => x.split === "cities");
  return (
    <main style={{ background: c.surface, color: c.ink, minHeight: "100vh", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 16px 64px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${c.line}`, paddingBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: display, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Sightline</span>
          <nav style={{ display: "flex", gap: 16, fontSize: 13, flexWrap: "wrap" }}>
            {[["Results", "#results"], ["How it works", "#architecture"], ["Demo", "/story.html"], ["Seven-beat version", "/sightline.html"], ["Code", REPO]].map(([t, u]) => (
              <a key={t} href={u} style={{ color: c.muted, textDecoration: "none" }}>{t}</a>
            ))}
          </nav>
        </header>

        <section style={{ padding: "44px 0 24px" }}>
          <div style={{ color: c.accent, fontSize: 12, letterSpacing: "0.12em", fontWeight: 600 }}>THE POLICY IS THE PRODUCT</div>
          <h1 style={{ fontFamily: display, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "10px 0 16px", maxWidth: 860 }}>
            A frozen model. A harness that evolves how it reads the storm.
          </h1>
          <p style={{ fontSize: 18, color: c.muted, maxWidth: 780, lineHeight: 1.5, margin: 0 }}>
            A harness that teaches itself what context to show Jev, TypeSafe&apos;s fast decision model, proves the result
            on a storm it never saw, and can&apos;t cheat because MongoDB locks the answers away.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
            <a href="/story.html" style={{ background: c.accent, color: "#fff", padding: "14px 22px", borderRadius: 8, fontWeight: 600, textDecoration: "none", fontSize: 16 }}>Open the demo →</a>
            {VIDEO_URL ? <a href={VIDEO_URL} style={{ ...card, color: c.ink, padding: "14px 22px", borderRadius: 8, textDecoration: "none" }}>Watch the 3-minute video</a> : null}
            <a href="/story.html?view=arena" style={{ ...card, color: c.ink, padding: "14px 22px", borderRadius: 8, textDecoration: "none" }}>Live arena (recorded run)</a>
            <a href="#architecture" style={{ ...card, color: c.ink, padding: "14px 22px", borderRadius: 8, textDecoration: "none" }}>How it works</a>
            <a href={`${REPO}/blob/main/DEMO.md`} style={{ ...card, color: c.ink, padding: "14px 22px", borderRadius: 8, textDecoration: "none" }}>Code &amp; runbook</a>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: c.muted, fontSize: 13 }}>Jump to a beat:</span>
            {BEATS.map((b, i) => (
              <a key={b} href={`/story.html?beat=${i + 1}`} style={{ fontSize: 13, color: c.accent, background: c.accentSoft, padding: "4px 10px", borderRadius: 999, textDecoration: "none" }}>{i + 1} · {b}</a>
            ))}
          </div>
        </section>

        <section id="results" style={{ paddingTop: 12 }}>
          <h2 style={h2}>Results</h2>
          <div style={{ fontSize: 13, color: c.muted, marginBottom: 12 }}>
            Real numbers from the recorded run <span style={{ fontFamily: mono }}>{h.run}</span>: {h.generations} generations run automatically, {h.kept} kept by the
            gate, {h.rejected} rejected, {h.notScored} not scored. Storms are simulated on stylized city maps.
          </div>
          {tonightBefore && tonightAfter ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tonight&apos;s NYC storm: held out, never trained on, scored once</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Stat label="Balanced accuracy" from={pct(tonightBefore.score)} to={pct(tonightAfter.score)} note="Generation 0 vs the evolved harness (generation 3)" />
                <Stat label="False dispatches" from={String(tonightBefore.false_dispatches)} to={String(tonightAfter.false_dispatches)} note="Life-safety call on a block that was actually intact" />
                <Stat label="Rescue-critical blocks found" from={`${tonightBefore.life_safety_found}/${tonightBefore.life_safety_total}`} to={`${tonightAfter.life_safety_found}/${tonightAfter.life_safety_total}`} note="Collapsed, homes flooded, fire, hospital down" />
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: c.muted }}>Tonight&apos;s held-out NYC storm is scored once, at the end.</p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <Stat label="Validation storm (the gate), balanced accuracy" from={pct(h.val.from)} to={pct(h.val.to)} note={`Builder's hand-written ceiling: ${pct(h.val.ceiling)}`} />
            {cities.length ? (
              <Stat label="Next season, cities it never saw" to={cities.map((x) => pct(x.score)).join(" · ")} tone={c.ink}
                note={`${cities.map((x) => CITY[x.town] || x.town).join(" · ")}: frozen policy, scored once`} />
            ) : null}
            <Stat label="Curator cost for the whole run" to={`$${h.curatorCost.toFixed(2)}`} tone={c.ink} note="Open model (GLM-5.2) via OpenRouter; Jev about $0.12 per generation" />
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 36 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>The problem</div>
            <p style={{ margin: 0, lineHeight: 1.55, fontSize: 15 }}>
              Fast decision models answer in about a quarter of a second, but they see only a sliver of the data, and that
              sliver decides whether they&apos;re right. Six hours after a hurricane the evidence contradicts itself: 911 calls
              filed at the wrong block, viral &quot;verified&quot; rumors, two agencies with two damage scales, a utility feed that
              says &quot;de-energized&quot; for a whole neighborhood. Shown the 12 nearest reports, Jev maps three past storms at
              56.7% balanced accuracy and makes 265 false dispatches.
            </p>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>What we built</div>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55, fontSize: 15 }}>
              <li>A blind curator LLM proposes a context policy.</li>
              <li>It compiles to a MongoDB pipeline ($geoNear, $match, $switch) that picks what Jev sees per block.</li>
              <li>Jev maps every block: 3,111 calls per generation.</li>
              <li>A scorer grades the map against an answer key the curator can&apos;t read.</li>
              <li>A gate on a separate storm keeps or rejects each change.</li>
              <li>The final policy is scored once on tonight&apos;s storm.</li>
            </ol>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Why it&apos;s different</div>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55, fontSize: 15 }}>
              <li>It optimizes <em>context</em>: not prompts, not weights.</li>
              <li>It proves transfer: no validation traces for the curator, and the held-out storm is scored once.</li>
              <li>The answer lock is enforced by MongoDB roles, not by trusting the agent. A live probe shows the refusal:</li>
            </ul>
            {h.probe ? <code style={{ display: "block", marginTop: 10, fontFamily: mono, fontSize: 12, background: c.sunken, padding: 10, borderRadius: 6, color: c.critical }}>denied (code 13): {h.probe}</code> : null}
          </div>
        </section>

        <section style={{ ...card, marginTop: 36, padding: 20 }}>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, marginBottom: 10 }}>What the harness learned on its own</div>
          {h.rules.map((r: { gen: number; text: string }, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${c.line}` : "none" }}>
              <span>{r.text}</span><span style={{ fontFamily: mono, fontSize: 12, color: c.accent, background: c.accentSoft, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>Gen {r.gen}</span>
            </div>
          ))}
        </section>

        <section id="architecture" style={{ marginTop: 44 }}>
          <h2 style={h2}>How it works</h2>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.5, margin: "0 0 14px", maxWidth: 820 }}>
            Four parts, three locked database logins. The answer key is readable only by the scorer; the curator&apos;s
            login is refused (the tripwire probe shows it live).
          </p>
          <a href="/arch-system.png" style={{ display: "block", ...card, padding: 12, overflowX: "auto" }}>
            <img src="/arch-system.png" alt="System: the storm world loads MongoDB Atlas; the harness loop reads reports with the curator login and the answer key with the scorer login only; the dashboard reads with a read-only login; the curator's attempt to read answers is denied" style={{ width: "100%", minWidth: 640, display: "block" }} />
          </a>

          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, margin: "28px 0 6px" }}>The harness loop</div>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.5, margin: "0 0 14px", maxWidth: 820 }}>
            The standard self-evolving pattern (execute → trace → propose → gate → keep, with lineage), hardened against
            the failure modes that pattern is known for: overfitting to the storms it tunes on, noisy feedback, bloat, and a
            curator with no memory.
          </p>
          <a href="/arch-loop.png" style={{ display: "block", ...card, padding: 12, overflowX: "auto" }}>
            <img src="/arch-loop.png" alt="Harness loop: curator proposes one change with a numeric prediction; a screen on about 600 dev blocks rejects clearly worse ideas; Jev maps dev and two validation storms; a gate keeps the change only if P(better) is at least 0.9 with guardrails; every outcome becomes a lesson in the Atlas notebook, retrieved by vector search for the next proposal" style={{ width: "100%", minWidth: 640, display: "block" }} />
          </a>
          <div style={{ ...card, marginTop: 14, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, lineHeight: 1.5, minWidth: 640 }}>
              <thead>
                <tr>{["Weakness of a simple loop", "What the robust loop does"].map((t) => (
                  <th key={t} style={{ textAlign: "left", padding: "12px 16px", borderBottom: `1px solid ${c.line}`, fontSize: 13, color: c.muted, fontWeight: 600 }}>{t}</th>
                ))}</tr>
              </thead>
              <tbody>
                {[
                  ["The gate is noise: a 1-point margin on one validation storm, when one block flip can move balanced accuracy about 2 points.",
                   "A paired, stratified bootstrap on two validation storms (NYC0 + HOU0): keep only if P(better) ≥ 0.9."],
                  ["One number decides everything.",
                   "Guardrails: dev may not drop more than 1 point, and expected harm (5 × missed life-safety blocks + false dispatches) may not rise more than 5%."],
                  ["The curator only hears \"fail\".",
                   "A diff digest: which blocks the change fixed and broke, with before/after traces. Predictions are numeric and scored."],
                  ["No memory between stateless curator calls.",
                   "A vector lab notebook: every generation writes a lesson to Atlas memory; the prompt retrieves the most relevant ones with $vectorSearch, and repeats of rejected ideas are skipped."],
                  ["Every idea costs a full evaluation.",
                   "A screen on a stratified dev sample rejects clearly bad ideas at a fraction of the calls."],
                  ["Accepted rules pile up.",
                   "A prune pass removes each rule in turn and keeps only those that measurably help: the survivors are \"what it learned\"."],
                ].map(([w, fix], i) => (
                  <tr key={i} style={{ borderTop: i ? `1px solid ${c.line}` : "none" }}>
                    <td style={{ padding: "12px 16px", verticalAlign: "top", width: "40%" }}>{w}</td>
                    <td style={{ padding: "12px 16px", verticalAlign: "top" }}>{fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: c.muted, marginTop: 10, lineHeight: 1.5 }}>
            The recorded run <span style={{ fontFamily: mono }}>live-1</span> ran on the simple loop (one validation storm, a
            1-point margin). The robust loop runs in the harness lab and was proven in the comparison in{" "}
            <a href={`${REPO}/blob/main/DEMO.md#robust-loop-vs-naive-loop-vs-random`} style={{ color: c.accent }}>DEMO.md</a>;
            porting it into the live driver is the next step. Every live generation is also traced in LangSmith. Click a
            diagram for full size.
          </p>
        </section>

        <section style={{ marginTop: 32, fontSize: 14, lineHeight: 1.6 }}>
          <strong>Stack.</strong> TypeSafe Jev (typesafe/jev-1.13 via OpenRouter) · open-model curator (GLM-5.2 via OpenRouter) ·
          MongoDB Atlas: geo queries, time-series runs, vector-indexed memory, collection-level custom roles · Python harness ·
          Next.js on Vercel · Sightline design system.
          <div style={{ marginTop: 10, color: c.muted }}>
            Team: Kishore Bhatia &amp; Brayden Hughes · MongoDB NYC Harness Engineering &amp; Model Wrangling. The live, read-only API is at{" "}
            <a href="/api/state" style={{ color: c.accent }}>/api/state</a>, /api/map, /api/block and /api/reports. Source and runbook on{" "}
            <a href={REPO} style={{ color: c.accent }}>GitHub</a>.
          </div>
        </section>
      </div>
    </main>
  );
}
