import { Fragment, useMemo, useState } from "react";
import { computeMetrics, findProduct } from "../lib/calculations.js";

const THRESHOLDS = [105, 110, 120, 150];
const MIN_RUN_HOURS = [0, 2, 8, 24];
const SLOW_LIMIT = 70;

function round(n, d = 0) {
  if (n === null || n === undefined || !isFinite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function fmt(n, d = 0) {
  const v = round(n, d);
  return v === null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Single-run entries are read at entry level because admin edits only touch entry-level fields.
function runsOf(entry) {
  if (Array.isArray(entry.runs) && entry.runs.length > 1) {
    return entry.runs.map((r) => ({ ...r, plant_id: r.plant_id || entry.plant_id }));
  }
  return [
    {
      ...entry,
      sap_code: entry.primary_sap_code || entry.runs?.[0]?.sap_code || entry.sap_code,
    },
  ];
}

function statusFor(pct, threshold) {
  if (pct === null) return { key: "na", label: "No data", color: "#64748b", bg: "#f1f5f9" };
  if (pct >= threshold) return { key: "over", label: "Wrong cycle time (faster than master)", color: "#b91c1c", bg: "#fee2e2" };
  if (pct < SLOW_LIMIT) return { key: "slow", label: "Running slow vs declared", color: "#b45309", bg: "#fef3c7" };
  return { key: "ok", label: "OK", color: "#15803d", bg: "#dcfce7" };
}

export default function CycleTimeTracker({
  entries = [],
  master = [],
  machines = [],
  reasonCodes = [],
  plants = [],
  selectedPlantId = "1040",
  selectedMonth = "2026-09",
}) {
  const [threshold, setThreshold] = useState(110);
  const [minHours, setMinHours] = useState(2);
  const [view, setView] = useState("over");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const plantName = plants.find((p) => p.plant_id === selectedPlantId)?.name || selectedPlantId;

  const parts = useMemo(() => {
    const bySap = new Map();
    entries.forEach((entry) => {
      if (!entry.shift_date || !entry.shift_date.startsWith(selectedMonth)) return;
      if (selectedPlantId && selectedPlantId !== "all" && (entry.plant_id || "1040") !== selectedPlantId) return;

      runsOf(entry).forEach((run) => {
        const sap = run.sap_code;
        if (!sap || sap === "DOWN_12H" || sap.startsWith("MULTI")) return;
        const m = computeMetrics(run, master, reasonCodes);
        const hrs = Number(m.net_run_time) || 0;
        const produced = (Number(m.ok_prod) || 0) + (Number(m.total_rej) || 0);
        if (hrs <= 0 || produced <= 0) return;

        const plantId = run.plant_id || entry.plant_id || "1040";
        const key = `${plantId}_${sap}`;
        if (!bySap.has(key)) {
          const product = findProduct(master, sap, plantId);
          bySap.set(key, {
            key,
            sap,
            plantId,
            partNo: product?.part_no || run.part_no || "",
            description: product?.material_description || run.material_description || "",
            cavity: Number(product?.cavity) || Number(run.std_cavity) || 1,
            declared: Number(product?.shots_per_hour) || 0,
            hrs: 0,
            produced: 0,
            target: 0,
            machines: new Set(),
            runs: [],
          });
        }
        const rec = bySap.get(key);
        rec.hrs += hrs;
        rec.produced += produced;
        rec.target += Number(m.tgt) || 0;
        rec.machines.add(entry.machine_id);
        rec.runs.push({
          date: entry.shift_date,
          shift: entry.shift_id,
          machine: entry.machine_id,
          hrs,
          produced,
          rate: produced / hrs,
          pct: rec.declared > 0 ? (produced / hrs / rec.declared) * 100 : null,
        });
      });
    });

    return [...bySap.values()].map((rec) => {
      const actual = rec.hrs > 0 ? rec.produced / rec.hrs : 0;
      const pct = rec.declared > 0 ? (actual / rec.declared) * 100 : null;
      return {
        ...rec,
        machines: [...rec.machines],
        actual,
        pct,
        declaredCt: rec.declared > 0 ? 3600 / rec.declared : null,
        actualCt: actual > 0 ? 3600 / actual : null,
        overRuns: rec.runs.filter((r) => r.pct !== null && r.pct >= threshold).length,
        runs: rec.runs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      };
    });
  }, [entries, master, reasonCodes, selectedMonth, selectedPlantId, threshold]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parts
      .filter((p) => p.hrs >= minHours)
      .filter((p) => {
        const s = statusFor(p.pct, threshold).key;
        if (view === "over") return s === "over";
        if (view === "slow") return s === "slow";
        return true;
      })
      .filter(
        (p) =>
          !term ||
          p.sap.toLowerCase().includes(term) ||
          p.partNo.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      )
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  }, [parts, minHours, view, search, threshold]);

  const kpis = useMemo(() => {
    const eligible = parts.filter((p) => p.hrs >= minHours);
    const over = eligible.filter((p) => statusFor(p.pct, threshold).key === "over");
    const slow = eligible.filter((p) => statusFor(p.pct, threshold).key === "slow");
    const worst = over.reduce((w, p) => (p.pct > (w?.pct ?? 0) ? p : w), null);
    return { analysed: eligible.length, over: over.length, slow: slow.length, worst };
  }, [parts, minHours, threshold]);

  const machineName = (id) => machines.find((mc) => mc.machine_id === id)?.machine_no?.split(" (")[0] || id;

  return (
    <div className="ct-page">
      <div className="ct-head">
        <div>
          <h2>Cycle Time Tracker</h2>
          <p>
            {plantName} · {selectedMonth} — parts whose actual output runs above the declared shots/hr, which means the
            declared cycle time in master is wrong.
          </p>
        </div>
        <div className="ct-filters">
          <label>
            Flag above
            <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
              {THRESHOLDS.map((t) => (
                <option key={t} value={t}>
                  {t}% of target
                </option>
              ))}
            </select>
          </label>
          <label>
            Min run hours
            <select value={minHours} onChange={(e) => setMinHours(Number(e.target.value))}>
              {MIN_RUN_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? "Any" : `${h}+ hrs`}
                </option>
              ))}
            </select>
          </label>
          <input
            className="ct-search"
            placeholder="Search SAP / part / description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="ct-kpis">
        <button type="button" className={`ct-kpi ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>
          <span className="ct-kpi-label">Parts analysed</span>
          <span className="ct-kpi-value">{kpis.analysed}</span>
        </button>
        <button type="button" className={`ct-kpi danger ${view === "over" ? "active" : ""}`} onClick={() => setView("over")}>
          <span className="ct-kpi-label">Above {threshold}% (cycle time wrong)</span>
          <span className="ct-kpi-value">{kpis.over}</span>
        </button>
        <button type="button" className={`ct-kpi warn ${view === "slow" ? "active" : ""}`} onClick={() => setView("slow")}>
          <span className="ct-kpi-label">Below {SLOW_LIMIT}% (running slow)</span>
          <span className="ct-kpi-value">{kpis.slow}</span>
        </button>
        <div className="ct-kpi static">
          <span className="ct-kpi-label">Worst part</span>
          <span className="ct-kpi-value small">
            {kpis.worst ? `${kpis.worst.sap} · ${fmt(kpis.worst.pct)}%` : "—"}
          </span>
        </div>
      </div>

      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th>SAP Code</th>
              <th className="left">Part / Description</th>
              <th>Cav</th>
              <th>Machines</th>
              <th>Shifts</th>
              <th>Run Hrs</th>
              <th>Produced</th>
              <th>Declared Shots/Hr</th>
              <th>Actual /Hr</th>
              <th>Actual vs Declared</th>
              <th>Declared CT (s)</th>
              <th>Actual CT (s)</th>
              <th>Suggested Shots/Hr</th>
              <th className="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={14} className="ct-empty">
                  {parts.length === 0
                    ? "No production entries with run hours for this plant and month."
                    : "No parts match this filter."}
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const st = statusFor(p.pct, threshold);
              const isOpen = expanded === p.key;
              return (
                <Fragment key={p.key}>
                  <tr className={`ct-row ${isOpen ? "open" : ""}`} onClick={() => setExpanded(isOpen ? null : p.key)}>
                    <td className="mono">
                      <span className="ct-caret">{isOpen ? "▾" : "▸"}</span>
                      {p.sap}
                    </td>
                    <td className="left">
                      <div className="ct-part">{p.partNo || "—"}</div>
                      <div className="ct-desc" title={p.description}>
                        {p.description}
                      </div>
                    </td>
                    <td>{p.cavity}</td>
                    <td title={p.machines.join(", ")}>{p.machines.map(machineName).join(", ")}</td>
                    <td>{p.runs.length}</td>
                    <td>{fmt(p.hrs, 1)}</td>
                    <td>{fmt(p.produced)}</td>
                    <td>{p.declared ? fmt(p.declared) : "Not in master"}</td>
                    <td className="strong">{fmt(p.actual)}</td>
                    <td>
                      <span className="ct-pct" style={{ color: st.color, background: st.bg }}>
                        {p.pct === null ? "—" : `${fmt(p.pct)}%`}
                      </span>
                    </td>
                    <td>{fmt(p.declaredCt, 1)}</td>
                    <td>{fmt(p.actualCt, 1)}</td>
                    <td className="strong">{st.key === "over" || st.key === "slow" ? fmt(p.actual) : "—"}</td>
                    <td className="left">
                      <span className="ct-status" style={{ color: st.color, background: st.bg }}>
                        {st.label}
                        {p.overRuns > 0 && st.key !== "over" ? ` · ${p.overRuns} shift(s) above` : ""}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="ct-detail">
                      <td colSpan={14}>
                        <table className="ct-subtable">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Shift</th>
                              <th>Machine</th>
                              <th>Run Hrs</th>
                              <th>Produced</th>
                              <th>Actual /Hr</th>
                              <th>vs Declared</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.runs.map((r, i) => {
                              const rs = statusFor(r.pct, threshold);
                              return (
                                <tr key={i}>
                                  <td>{r.date}</td>
                                  <td>Shift {r.shift}</td>
                                  <td>{machineName(r.machine)}</td>
                                  <td>{fmt(r.hrs, 1)}</td>
                                  <td>{fmt(r.produced)}</td>
                                  <td>{fmt(r.rate)}</td>
                                  <td>
                                    <span className="ct-pct" style={{ color: rs.color, background: rs.bg }}>
                                      {r.pct === null ? "—" : `${fmt(r.pct)}%`}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ct-note">
        Actual /Hr = (OK + rejected pieces) ÷ net run hours. Declared CT = 3600 ÷ declared shots/hr. A part far above 100%
        means the machine is consistently faster than the master says — update its shots/hr in Master data to the
        suggested value.
      </p>
    </div>
  );
}
