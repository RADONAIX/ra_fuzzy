import React, { useState, useMemo } from "react";

// __DATA__ is replaced with the pipeline's verdict export at build time
const DATA = __DATA__;

const C = {
  bg: "#0B1220",
  panel: "#111C2E",
  panelEdge: "#1D2C44",
  ink: "#E6EEF8",
  dim: "#8CA3BF",
  faint: "#5A7190",
  cyan: "#39C6D6",
  steel: "#2E4A6B",
  Healthy: "#2FA57B",
  Watch: "#D9A13B",
  Suspect: "#E06A3B",
  Critical: "#D93B4E",
};

const VERDICTS = ["Healthy", "Watch", "Suspect", "Critical"];
const TYPES = [
  { id: "ADJ", label: "Adjustment records" },
  { id: "REF", label: "Refill records" },
];

const fmtHour = (iso) => {
  const d = new Date(iso);
  return (
    d.toISOString().slice(5, 10).replace("-", "/") +
    " " +
    String(d.getUTCHours()).padStart(2, "0") + ":00"
  );
};

const SCEN_LABEL = {
  LEAKAGE: "Injected: leakage (records dropped, never arrive)",
  LATE_FILE: "Injected: late file (records arrive next hour)",
  DUPLICATES: "Injected: duplicate processed records",
  AMT_CORRUPT: "Injected: amount corruption on matched records",
};

function Gauge({ lo, hi, score, verdict }) {
  // 0-100 risk scale with the IT2 type-reduced interval drawn as a band
  const zones = [
    { to: 25, c: C.Healthy },
    { to: 50, c: C.Watch },
    { to: 76, c: C.Suspect },
    { to: 100, c: C.Critical },
  ];
  let from = 0;
  return (
    <div>
      <div style={{ position: "relative", height: 34 }}>
        <div style={{ position: "absolute", inset: "12px 0 12px 0", borderRadius: 5, overflow: "hidden", display: "flex" }}>
          {zones.map((z, i) => {
            const w = z.to - from;
            const el = (
              <div key={i} style={{ width: `${w}%`, background: z.c, opacity: 0.28 }} />
            );
            from = z.to;
            return el;
          })}
        </div>
        {/* uncertainty band */}
        <div
          style={{
            position: "absolute",
            left: `${lo}%`,
            width: `${Math.max(hi - lo, 0.8)}%`,
            top: 8,
            bottom: 8,
            background: C[verdict],
            opacity: 0.55,
            borderRadius: 4,
          }}
        />
        {/* crisp score marker */}
        <div
          style={{
            position: "absolute",
            left: `calc(${score}% - 1.5px)`,
            top: 2,
            bottom: 2,
            width: 3,
            background: C.ink,
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.faint, fontFamily: "ui-monospace, monospace" }}>
        <span>0</span>
        <span>
          band {lo.toFixed(1)}–{hi.toFixed(1)} · score {score.toFixed(1)}
        </span>
        <span>100</span>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, tone }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.panelEdge}`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.faint }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, color: tone || C.ink, marginTop: 2 }}>
        {value}
        {unit && <span style={{ fontSize: 11, color: C.dim, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function App() {
  const hours = useMemo(() => [...new Set(DATA.map((d) => d.h))].sort(), []);
  const byKey = useMemo(() => {
    const m = {};
    DATA.forEach((d) => (m[d.t + "|" + d.h] = d));
    return m;
  }, []);
  const [sel, setSel] = useState(() => {
    const crit = DATA.find((d) => d.verdict === "Critical") || DATA[0];
    return crit.t + "|" + crit.h;
  });
  const cur = byKey[sel];

  const counts = useMemo(() => {
    const c = { Healthy: 0, Watch: 0, Suspect: 0, Critical: 0 };
    DATA.forEach((d) => c[d.verdict]++);
    return c;
  }, []);
  const flagged = counts.Watch + counts.Suspect + counts.Critical;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "22px 26px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.22em", color: C.cyan, textTransform: "uppercase" }}>
            RADONaix · Revenue Assurance
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 650, letterSpacing: "-0.01em" }}>
            AIR feed reconciliation — hourly IT2 fuzzy verdicts
          </h1>
        </div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.dim }}>
          network (raw) vs mediation (processed) · 48h window · MVP demo
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, margin: "16px 0" }}>
        <Metric label="Hours monitored" value={DATA.length} />
        <Metric label="Healthy" value={counts.Healthy} tone={C.Healthy} />
        <Metric label="Watch" value={counts.Watch} tone={C.Watch} />
        <Metric label="Suspect" value={counts.Suspect} tone={C.Suspect} />
        <Metric label="Critical" value={counts.Critical} tone={C.Critical} />
        <Metric label="Flagged for review" value={`${((flagged / DATA.length) * 100).toFixed(0)}%`} />
      </div>

      {/* verdict strips — signature element */}
      <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, marginBottom: 10 }}>
          Hourly verdict strip — tap an hour to inspect
        </div>
        {TYPES.map((t) => (
          <div key={t.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{t.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${hours.length}, 1fr)`, gap: 2 }}>
              {hours.map((h) => {
                const d = byKey[t.id + "|" + h];
                if (!d) return <div key={h} />;
                const active = sel === t.id + "|" + h;
                return (
                  <button
                    key={h}
                    onClick={() => setSel(t.id + "|" + h)}
                    title={`${fmtHour(h)} — ${d.verdict}`}
                    style={{
                      height: 30,
                      border: active ? `2px solid ${C.ink}` : `1px solid ${C.bg}`,
                      borderRadius: 3,
                      background: C[d.verdict],
                      opacity: d.verdict === "Healthy" ? 0.45 : 1,
                      cursor: "pointer",
                      position: "relative",
                      padding: 0,
                    }}
                  >
                    {d.scen && (
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: C.ink,
                          opacity: 0.9,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 10, color: C.dim }}>
          {VERDICTS.map((v) => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C[v], opacity: v === "Healthy" ? 0.45 : 1 }} />
              {v}
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ink }} /> injected scenario (ground truth)
          </span>
        </div>
      </div>

      {/* detail */}
      {cur && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1.1fr) minmax(280px, 1fr)", gap: 12, marginTop: 12 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: C.dim }}>
                {cur.t === "ADJ" ? "ADJUSTMENT" : "REFILL"} · {fmtHour(cur.h)} UTC
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C[cur.verdict],
                  border: `1px solid ${C[cur.verdict]}`,
                  borderRadius: 999,
                  padding: "3px 12px",
                }}
              >
                {cur.verdict}
                <span style={{ color: C.dim, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                  similarity {cur.sim.toFixed(2)}
                </span>
              </div>
            </div>
            <div style={{ margin: "14px 0 6px" }}>
              <Gauge lo={cur.lo} hi={cur.hi} score={cur.score} verdict={cur.verdict} />
            </div>
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
              The shaded band is the IT2 type-reduced interval — the engine's honest uncertainty, not a single crisp
              point. The white marker is the Nie–Tan defuzzified score.
            </div>
            {cur.scen && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: C.ink,
                  background: C.bg,
                  border: `1px dashed ${C.steel}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                }}
              >
                {SCEN_LABEL[cur.scen]}
              </div>
            )}
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, marginBottom: 10 }}>
              Discrepancy vector (Layer 1, exact)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 8 }}>
              <Metric label="Raw records" value={cur.raw.toLocaleString()} />
              <Metric label="Processed" value={cur.proc.toLocaleString()} />
              <Metric label="Count gap" value={cur.cg.toFixed(2)} unit="%" tone={cur.cg > 2 ? C.Suspect : C.ink} />
              <Metric label="Value gap" value={cur.vg.toFixed(2)} unit="%" tone={cur.vg > 2 ? C.Suspect : C.ink} />
              <Metric label="Catch-up" value={cur.cu.toFixed(0)} unit="%" tone={cur.cu > 50 ? C.Healthy : C.ink} />
              <Metric label="Duplicates" value={cur.dr.toFixed(2)} unit="%" />
              <Metric label="Amt mismatch" value={cur.mm.toFixed(2)} unit="%" />
              <Metric label="Traffic" value={cur.tp.toFixed(0)} unit="% of peak" />
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, margin: "14px 0 6px" }}>
              Why — strongest fired rules (Layer 2)
            </div>
            {cur.drivers.length === 0 && (
              <div style={{ fontSize: 12, color: C.dim }}>No rule fired above threshold.</div>
            )}
            {cur.drivers.map((d, i) => (
              <div
                key={i}
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: C.ink,
                  background: C.bg,
                  border: `1px solid ${C.panelEdge}`,
                  borderRadius: 6,
                  padding: "6px 9px",
                  marginBottom: 5,
                }}
              >
                IF {Object.entries(d.if).map(([k, v]) => `${k} is ${v}`).join(" AND ")}
                {" → "}
                <span style={{ color: C[d.then] || C.cyan, fontWeight: 700 }}>{d.then}</span>
                <span style={{ color: C.faint }}> · firing [{d.f[0]}, {d.f[1]}]</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 10, color: C.faint }}>
        Layer 1 reconciliation is exact and auditable (key: origin_txn_id + local_seq_no). Layer 2 verdicts are triage
        guidance from an interval type-2 fuzzy system with a computing-with-words decoder — they rank attention, they
        don't replace root-cause investigation. Timeline simulated from real AIR records.
      </div>
    </div>
  );
}
