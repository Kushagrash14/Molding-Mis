import { Fragment, useMemo, useState } from "react";
import { computeMetrics, findProduct } from "../lib/calculations.js";

const THRESHOLDS = [105, 110, 120, 150];
const MIN_RUN_HOURS = [0, 2, 8, 24];
const SLOW_LIMIT = 70;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function round(n, d = 0) {
  if (n === null || n === undefined || !isFinite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function fmt(n, d = 0) {
  const v = round(n, d);
  return v === null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1] || m} ${y.slice(2)}`;
}

function fmtMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] || m} ${y}`;
}

function dateSpan(dates) {
  const uniq = [...new Set(dates)].sort();
  if (uniq.length === 0) return "—";
  if (uniq.length === 1) return fmtDate(uniq[0]);
  return `${fmtDate(uniq[0])} – ${fmtDate(uniq[uniq.length - 1])}`;
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
  if (pct === null) return { key: "na", label: "Not in master", color: "#64748b", bg: "#f1f5f9" };
  if (pct >= threshold) return { key: "over", label: "CT wrong · faster", color: "#b91c1c", bg: "#fee2e2" };
  if (pct < SLOW_LIMIT) return { key: "slow", label: "Running slow", color: "#b45309", bg: "#fef3c7" };
  return { key: "ok", label: "OK", color: "#15803d", bg: "#dcfce7" };
}

function matchesView(key, view) {
  if (view === "over") return key === "over";
  if (view === "slow") return key === "slow";
  return true;
}

export default function CycleTimeTracker({
  entries = [],
  master = [],
  machines = [],
  shifts = [],
  reasonCodes = [],
  plants = [],
  selectedPlantId = "1040",
  selectedMonth = "2026-09",
}) {
  const [threshold, setThreshold] = useState(110);
  const [minHours, setMinHours] = useState(2);
  const [view, setView] = useState("over");
  const [mode, setMode] = useState("shift");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const plantName = plants.find((p) => p.plant_id === selectedPlantId)?.name || selectedPlantId;
  const machineName = (id) => machines.find((mc) => mc.machine_id === id)?.machine_no?.split(" (")[0] || id;
  const shiftName = (id) => {
    const name = shifts.find((s) => s.shift_id === id)?.name;
    const tag = name?.match(/\(([^)]+)\)/)?.[1];
    return tag ? `S${id} ${tag}` : name || `S${id}`;
  };

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
        const ok = Number(m.ok_prod) || 0;
        const rej = Number(m.total_rej) || 0;
        const produced = ok + rej;
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
            machines: new Set(),
            runs: [],
          });
        }
        const rec = bySap.get(key);
        const rate = produced / hrs;
        rec.hrs += hrs;
        rec.produced += produced;
        rec.machines.add(entry.machine_id);
        rec.runs.push({
          id: `${entry.id || entry.entry_id || entry.shift_date}_${entry.machine_id}_${rec.runs.length}`,
          date: entry.shift_date,
          shift: entry.shift_id,
          machine: entry.machine_id,
          operator: entry.operator_name || entry.created_by_name || "",
          hrs,
          ok,
          rej,
          produced,
          target: Number(m.tgt) || 0,
          rate,
          pct: rec.declared > 0 ? (rate / rec.declared) * 100 : null,
        });
      });
    });

    return [...bySap.values()].map((rec) => {
      const actual = rec.hrs > 0 ? rec.produced / rec.hrs : 0;
      return {
        ...rec,
        machines: [...rec.machines],
        actual,
        pct: rec.declared > 0 ? (actual / rec.declared) * 100 : null,
        declaredCt: rec.declared > 0 ? 3600 / rec.declared : null,
        actualCt: actual > 0 ? 3600 / actual : null,
        overRuns: rec.runs.filter((r) => r.pct !== null && r.pct >= threshold).length,
        runs: rec.runs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.shift).localeCompare(String(a.shift)))),
      };
    });
  }, [entries, master, reasonCodes, selectedMonth, selectedPlantId, threshold]);

  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parts
      .filter((p) => p.hrs >= minHours)
      .filter(
        (p) =>
          !term ||
          p.sap.toLowerCase().includes(term) ||
          p.partNo.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.machines.some((mc) => machineName(mc).toLowerCase().includes(term))
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, minHours, search, machines]);

  const visibleParts = useMemo(
    () =>
      searched
        .filter((p) => matchesView(statusFor(p.pct, threshold).key, view))
        .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)),
    [searched, view, threshold]
  );

  const visibleRows = useMemo(
    () =>
      searched
        .flatMap((p) => p.runs.map((r) => ({ ...r, part: p })))
        .filter((r) => matchesView(statusFor(r.pct, threshold).key, view))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.pct ?? -1) - (a.pct ?? -1))),
    [searched, view, threshold]
  );

  const kpis = useMemo(() => {
    const eligible = parts.filter((p) => p.hrs >= minHours);
    const over = eligible.filter((p) => statusFor(p.pct, threshold).key === "over");
    const slow = eligible.filter((p) => statusFor(p.pct, threshold).key === "slow");
    const worst = over.reduce((w, p) => (p.pct > (w?.pct ?? 0) ? p : w), null);
    const overShifts = eligible.reduce((s, p) => s + p.overRuns, 0);
    return { analysed: eligible.length, over: over.length, slow: slow.length, worst, overShifts };
  }, [parts, minHours, threshold]);

  const Pct = ({ pct }) => {
    const st = statusFor(pct, threshold);
    return (
      <span className="ct-pct" style={{ color: st.color, background: st.bg }}>
        {pct === null ? "—" : `${fmt(pct)}%`}
      </span>
    );
  };

  const Status = ({ pct }) => {
    const st = statusFor(pct, threshold);
    return (
      <span className="ct-status" style={{ color: st.color, background: st.bg }}>
        {st.label}
      </span>
    );
  };

  const PartCell = ({ p }) => (
    <td className="left">
      <div className="ct-part">
        <span className="mono">{p.sap}</span>
        {p.partNo ? ` · ${p.partNo}` : ""}
      </div>
      <div className="ct-desc" title={p.description}>
        {p.description}
      </div>
    </td>
  );

  const emptyText =
    parts.length === 0 ? "No production entries with run hours for this plant and month." : "No rows match this filter.";

  return (
    <div className="ct-page">
      <div className="ct-head">
        <div className="ct-title">
          <div className="ct-title-icon">⏱️</div>
          <div>
            <h2>
              Cycle Time Tracker <span className="ct-meta">{plantName} · {fmtMonth(selectedMonth)}</span>
            </h2>
            <p>Parts producing far above master shots/hr — their declared cycle time is wrong.</p>
          </div>
        </div>
        <div className="ct-filters">
          <label>
            View
            <div className="ct-toggle">
              <button type="button" className={mode === "shift" ? "active" : ""} onClick={() => setMode("shift")}>
                Shift-wise
              </button>
              <button type="button" className={mode === "part" ? "active" : ""} onClick={() => setMode("part")}>
                Part-wise
              </button>
            </div>
          </label>
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
          <label>
            Search
            <input
              className="ct-search"
              placeholder="SAP / part / machine…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="ct-kpis">
        <button type="button" className={`ct-kpi ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>
          <span className="ct-kpi-label">Parts analysed</span>
          <span className="ct-kpi-value">{kpis.analysed}</span>
        </button>
        <button type="button" className={`ct-kpi danger ${view === "over" ? "active" : ""}`} onClick={() => setView("over")}>
          <span className="ct-kpi-label">Parts above {threshold}% · CT wrong</span>
          <span className="ct-kpi-value">{kpis.over}</span>
        </button>
        <div className="ct-kpi static danger">
          <span className="ct-kpi-label">Shifts above {threshold}%</span>
          <span className="ct-kpi-value">{kpis.overShifts}</span>
        </div>
        <button type="button" className={`ct-kpi warn ${view === "slow" ? "active" : ""}`} onClick={() => setView("slow")}>
          <span className="ct-kpi-label">Below {SLOW_LIMIT}% · slow</span>
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
        {mode === "shift" ? (
          <table className="ct-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th>Machine</th>
                <th className="left">SAP · Part / Description</th>
                <th>Cav</th>
                <th>Run Hrs</th>
                <th>OK</th>
                <th>Rej</th>
                <th>Produced</th>
                <th>Target</th>
                <th>Declared /Hr</th>
                <th>Actual /Hr</th>
                <th>vs Declared</th>
                <th title="Declared → actual cycle time in seconds">CT (s)</th>
                <th className="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={15} className="ct-empty">
                    {emptyText}
                  </td>
                </tr>
              )}
              {visibleRows.map((r) => (
                <tr key={`${r.part.key}_${r.id}`}>
                  <td className="strong">{fmtDate(r.date)}</td>
                  <td>{shiftName(r.shift)}</td>
                  <td>{machineName(r.machine)}</td>
                  <PartCell p={r.part} />
                  <td>{r.part.cavity}</td>
                  <td>{fmt(r.hrs, 1)}</td>
                  <td>{fmt(r.ok)}</td>
                  <td>{fmt(r.rej)}</td>
                  <td className="strong">{fmt(r.produced)}</td>
                  <td>{fmt(r.target)}</td>
                  <td>{r.part.declared ? fmt(r.part.declared) : "—"}</td>
                  <td className="strong">{fmt(r.rate)}</td>
                  <td>
                    <Pct pct={r.pct} />
                  </td>
                  <td className="mono">
                    {fmt(r.part.declaredCt, 1)} → {fmt(r.rate > 0 ? 3600 / r.rate : null, 1)}
                  </td>
                  <td className="left">
                    <Status pct={r.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="ct-table">
            <thead>
              <tr>
                <th className="left">SAP · Part / Description</th>
                <th>Dates</th>
                <th>Cav</th>
                <th>Machines</th>
                <th>Shifts</th>
                <th>Run Hrs</th>
                <th>Produced</th>
                <th>Declared /Hr</th>
                <th>Actual /Hr</th>
                <th>vs Declared</th>
                <th title="Declared → actual cycle time in seconds">CT (s)</th>
                <th>Suggested /Hr</th>
                <th className="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleParts.length === 0 && (
                <tr>
                  <td colSpan={13} className="ct-empty">
                    {emptyText}
                  </td>
                </tr>
              )}
              {visibleParts.map((p) => {
                const isOpen = expanded === p.key;
                const st = statusFor(p.pct, threshold);
                return (
                  <Fragment key={p.key}>
                    <tr className={`ct-row ${isOpen ? "open" : ""}`} onClick={() => setExpanded(isOpen ? null : p.key)}>
                      <td className="left">
                        <div className="ct-part">
                          <span className="ct-caret">{isOpen ? "▾" : "▸"}</span>
                          <span className="mono">{p.sap}</span>
                          {p.partNo ? ` · ${p.partNo}` : ""}
                        </div>
                        <div className="ct-desc" title={p.description}>
                          {p.description}
                        </div>
                      </td>
                      <td className="strong">{dateSpan(p.runs.map((r) => r.date))}</td>
                      <td>{p.cavity}</td>
                      <td title={p.machines.join(", ")}>{p.machines.map(machineName).join(", ")}</td>
                      <td>
                        {p.runs.length}
                        {p.overRuns > 0 && <span className="ct-sub"> ({p.overRuns} over)</span>}
                      </td>
                      <td>{fmt(p.hrs, 1)}</td>
                      <td>{fmt(p.produced)}</td>
                      <td>{p.declared ? fmt(p.declared) : "—"}</td>
                      <td className="strong">{fmt(p.actual)}</td>
                      <td>
                        <Pct pct={p.pct} />
                      </td>
                      <td className="mono">
                        {fmt(p.declaredCt, 1)} → {fmt(p.actualCt, 1)}
                      </td>
                      <td className="strong">{st.key === "over" || st.key === "slow" ? fmt(p.actual) : "—"}</td>
                      <td className="left">
                        <Status pct={p.pct} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="ct-detail">
                        <td colSpan={13}>
                          <table className="ct-subtable">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Shift</th>
                                <th>Machine</th>
                                <th>Run Hrs</th>
                                <th>OK</th>
                                <th>Rej</th>
                                <th>Produced</th>
                                <th>Target</th>
                                <th>Actual /Hr</th>
                                <th>vs Declared</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.runs.map((r) => (
                                <tr key={r.id}>
                                  <td>{fmtDate(r.date)}</td>
                                  <td>{shiftName(r.shift)}</td>
                                  <td>{machineName(r.machine)}</td>
                                  <td>{fmt(r.hrs, 1)}</td>
                                  <td>{fmt(r.ok)}</td>
                                  <td>{fmt(r.rej)}</td>
                                  <td>{fmt(r.produced)}</td>
                                  <td>{fmt(r.target)}</td>
                                  <td>{fmt(r.rate)}</td>
                                  <td>
                                    <Pct pct={r.pct} />
                                  </td>
                                </tr>
                              ))}
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
        )}
      </div>
      <p className="ct-note">
        Actual /Hr = (OK + Rej) ÷ net run hrs · CT = 3600 ÷ shots/hr · A part far above 100% means master shots/hr is
        too low — update it in Master data to the suggested value.
      </p>
    </div>
  );
}
