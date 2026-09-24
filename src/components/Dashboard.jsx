import { useState, useMemo } from "react";
import { computeMetrics, pct, inr } from "../lib/calculations.js";
import { exportProductionToExcel } from "../lib/excelExport.js";
import ExcelExportModal from "./ExcelExportModal.jsx";

export default function Dashboard({
  entries,
  master = [],
  machines = [],
  shifts = [],
  reasonCodes = [],
  locations = [],
  plants = [],
  initialPlantId,
}) {
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterPlant, setFilterPlant] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [filterMachine, setFilterMachine] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);

  // Cascaded plants based on selected location
  const availablePlants = useMemo(() => {
    if (filterLocation === "all") return plants;
    return plants.filter((p) => p.location_id === filterLocation);
  }, [plants, filterLocation]);

  function handleLocationFilterChange(locId) {
    setFilterLocation(locId);
    setFilterPlant("all");
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterPlant !== "all" && e.plant_id !== filterPlant) return false;
      if (filterLocation !== "all") {
        const pObj = plants.find((p) => p.plant_id === e.plant_id);
        if (!pObj || pObj.location_id !== filterLocation) return false;
      }
      if (filterShift !== "all" && e.shift_id !== filterShift) return false;
      if (filterMachine !== "all" && e.machine_id !== filterMachine) return false;
      if (filterDate && e.shift_date !== filterDate) return false;
      return true;
    });
  }, [entries, filterPlant, filterLocation, filterShift, filterMachine, filterDate, plants]);

  const withMetrics = useMemo(() => {
    return filteredEntries.map((e) => ({
      ...e,
      m: computeMetrics(
        e,
        master.find((x) => x.sap_code === e.sap_code),
        reasonCodes
      ),
    }));
  }, [filteredEntries, master, reasonCodes]);

  // Daily Overall OEE average formula as per Excel: AVERAGE(OEE)
  const avgOee = withMetrics.length
    ? withMetrics.reduce((s, e) => s + e.m.oee, 0) / withMetrics.length
    : 0;

  const totalOkProd = withMetrics.reduce((s, e) => s + (Number(e.ok_prod) || 0), 0);
  const totalTgt = withMetrics.reduce((s, e) => s + e.m.tgt, 0);
  const totalOkValue = withMetrics.reduce((s, e) => s + e.m.ok_prod_price, 0);
  const totalShortfallLoss = withMetrics.reduce((s, e) => s + e.m.shortfall_loss, 0);
  const totalRejLoss = withMetrics.reduce((s, e) => s + e.m.rej_price, 0);
  const totalConsumptionKg = withMetrics.reduce((s, e) => s + e.m.total_consumption, 0);

  const downtimeTotals = {};
  const rejectTotals = {};

  withMetrics.forEach((e) => {
    (e.reasons || []).forEach((r) => {
      const rc = reasonCodes.find((x) => x.reason_id === r.reason_id);
      if (!rc) return;
      if (rc.category !== "rejection") {
        downtimeTotals[rc.name] = (downtimeTotals[rc.name] || 0) + Number(r.value);
      } else {
        rejectTotals[rc.name] = (rejectTotals[rc.name] || 0) + Number(r.value);
      }
    });
  });

  const dtEntries = Object.entries(downtimeTotals).sort((a, b) => b[1] - a[1]);
  const rejEntries = Object.entries(rejectTotals).sort((a, b) => b[1] - a[1]);
  const maxDt = Math.max(1, ...dtEntries.map((x) => x[1]));
  const maxRej = Math.max(1, ...rejEntries.map((x) => x[1]));

  return (
    <div>
      {/* Multi-tier Filters Bar */}
      <div
        className="card"
        style={{
          marginBottom: "18px",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--brand-primary)" }}>
          🔍 FILTER BY:
        </div>

        {/* Location & Plant scope badge or filter */}
        {locations.length === 1 && availablePlants.length === 1 ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#0f172a",
            }}
            title="Viewing dashboard metrics for your assigned plant unit"
          >
            <span>🔒</span>
            <span>
              {availablePlants[0].name} ({locations[0].name})
            </span>
          </div>
        ) : (
          <>
            {/* Location Filter */}
            {locations.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Location:</label>
                <select
                  value={filterLocation}
                  onChange={(e) => handleLocationFilterChange(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: "13px", height: "38px", width: "auto" }}
                >
                  <option value="all">All Locations ({locations.length})</option>
                  {locations.map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      📍 {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Plant / Unit Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Plant / Unit:</label>
              <select
                value={filterPlant}
                onChange={(e) => setFilterPlant(e.target.value)}
                style={{ padding: "6px 10px", fontSize: "13px", height: "38px", width: "auto" }}
              >
                <option value="all">All Accessible Plants ({availablePlants.length})</option>
                {availablePlants.map((p) => {
                  const loc = locations.find((l) => l.location_id === p.location_id);
                  return (
                    <option key={p.plant_id} value={p.plant_id}>
                      🏭 {p.name} {loc && filterLocation === "all" ? `(${loc.name})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </>
        )}

        {/* Shift Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Shift:</label>
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            style={{ padding: "6px 10px", fontSize: "13px", height: "38px", width: "auto" }}
          >
            <option value="all">All Shifts ({shifts.length})</option>
            {shifts.map((s) => (
              <option key={s.shift_id} value={s.shift_id}>
                Shift {s.shift_id}
              </option>
            ))}
          </select>
        </div>

        {/* Machine Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Machine:</label>
          <select
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
            style={{ padding: "6px 10px", fontSize: "13px", height: "38px", width: "auto" }}
          >
            <option value="all">All Machines ({machines.length})</option>
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_no}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Date:</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: "6px 10px", fontSize: "13px", height: "38px", width: "auto" }}
          >
          </input>
          {filterDate && (
            <button className="btn small secondary" onClick={() => setFilterDate("")}>
              Clear
            </button>
          )}
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Showing {withMetrics.length} of {entries.length} shift records
          </span>
          <button
            type="button"
            className="btn-excel-export"
            onClick={() => setShowExportModal(true)}
            disabled={entries.length === 0}
            title="Download tailored executive report and filtered records to Microsoft Excel (.xlsx)"
          >
            <span style={{ fontSize: "14px" }}>📊</span>
            <span>Export Dashboard (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid4" style={{ marginBottom: "18px" }}>
        <div className="card">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              color: "var(--primary-dark)",
            }}
          >
            {pct(avgOee)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Average OEE (Excel Daily Report)
          </div>
        </div>

        <div className="card">
          <div style={{ fontFamily: "var(--font-display)", fontSize: "28px" }}>
            {totalOkProd.toLocaleString()}{" "}
            <span style={{ fontSize: "14px", color: "var(--ink-faint)" }}>
              / {totalTgt.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            OK Production vs Target (pcs)
          </div>
        </div>

        <div className="card">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              color: "#16a34a",
            }}
          >
            {inr(totalOkValue)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Total OK Prod Amount (BE)
          </div>
        </div>

        <div className="card">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              color: totalShortfallLoss > 0 ? "var(--warn, #d97706)" : "var(--ink)",
            }}
          >
            {inr(totalShortfallLoss)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Prod Shortfall Loss (CW)
          </div>
        </div>
      </div>

      <div className="grid3" style={{ marginBottom: "18px" }}>
        <div className="card">
          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px" }}>
            {totalConsumptionKg.toFixed(1)} kg
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Raw Material Consumed (BL)
          </div>
        </div>
        <div className="card">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              color: "var(--danger, #dc2626)",
            }}
          >
            {inr(totalRejLoss)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Rejection Scrap Cost (BF)
          </div>
        </div>
        <div className="card">
          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px" }}>
            {withMetrics.reduce((s, e) => s + e.m.tool_change_count, 0)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
            Total Mould Tool Changes (BM)
          </div>
        </div>
      </div>

      {/* Downtime Pareto */}
      <div className="chart-card" style={{ marginBottom: "18px" }}>
        <h4>Downtime Pareto (Minutes Loss)</h4>
        {dtEntries.length === 0 && (
          <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>No downtime logged yet.</p>
        )}
        {dtEntries.map(([name, val]) => (
          <div className="bar-row" key={name}>
            <span className="bar-label">{name}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: (val / maxDt) * 100 + "%" }}></div>
            </div>
            <span className="bar-val">
              {val.toFixed(0)} mins ({(val / 60).toFixed(1)} hrs)
            </span>
          </div>
        ))}
      </div>

      {/* Rejection Pareto */}
      <div className="chart-card" style={{ marginBottom: "18px" }}>
        <h4>Rejection Pareto — Defect Breakdown (Quantity)</h4>
        {rejEntries.length === 0 && (
          <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>No rejections logged yet.</p>
        )}
        {rejEntries.map(([name, val]) => (
          <div className="bar-row" key={name}>
            <span className="bar-label">{name}</span>
            <div className="bar-track">
              <div className="bar-fill accent" style={{ width: (val / maxRej) * 100 + "%" }}></div>
            </div>
            <span className="bar-val">{val.toLocaleString()} pcs</span>
          </div>
        ))}
      </div>

      {/* Recent Entries */}
      <div className="chart-card">
        <h4>OEE By Shift Entry</h4>
        {withMetrics.length === 0 && (
          <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>
            No entries match selected filter.
          </p>
        )}
        {[...withMetrics]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10)
          .map((e) => {
            const mcName =
              (machines.find((x) => x.machine_id === e.machine_id) || {}).machine_no ||
              e.machine_id;
            const plantObj = plants.find((p) => p.plant_id === e.plant_id);
            return (
              <div className="bar-row" key={e.entry_id}>
                <span className="bar-label">
                  {plantObj ? `${plantObj.name} · ` : ""}
                  {e.shift_date} · Shift {e.shift_id} · {mcName} · {e.sap_code}
                </span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: Math.min(100, e.m.oee * 100) + "%" }}
                  ></div>
                </div>
                <span className="bar-val">{pct(e.m.oee)}</span>
              </div>
            );
          })}
      </div>

      {showExportModal && (
        <ExcelExportModal
          isOpen={true}
          onClose={() => setShowExportModal(false)}
          entries={entries}
          master={master}
          machines={machines}
          plants={plants}
          locations={locations}
          reasonCodes={reasonCodes}
          viewerRole="admin"
          defaultPlantId={filterPlant !== "all" ? filterPlant : plants.length === 1 ? plants[0].plant_id : "all"}
        />
      )}
    </div>
  );
}
