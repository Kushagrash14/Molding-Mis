import { useState, useMemo } from "react";
import { computeMetrics, pct, inr, isEntryPastTwelveHours } from "../lib/calculations.js";
import { exportProductionToExcel, exportProductionToCSV } from "../lib/excelExport.js";
import Pill from "./Pill.jsx";

export default function EntriesTable({
  entries,
  master,
  machines = [],
  shifts = [],
  locations = [],
  plants = [],
  reasonCodes = [],
  viewerRole,
  onEdit,
  scopeToUser,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlant, setFilterPlant] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const list = scopeToUser ? entries.filter((e) => e.entered_by === scopeToUser) : entries;

  const filtered = useMemo(() => {
    return list.filter((e) => {
      if (filterPlant !== "all" && e.plant_id !== filterPlant) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const mc =
        (machines.find((x) => x.machine_id === e.machine_id) || {}).machine_no || e.machine_id;
      const pObj = plants.find((p) => p.plant_id === e.plant_id);
      const plantText = pObj ? `${pObj.name} ${pObj.plant_id}` : (e.plant_id || "");

      const matchesRuns = (e.runs || []).some(
        (r) =>
          (r.sap_code || "").toLowerCase().includes(term) ||
          (r.part_no || "").toLowerCase().includes(term) ||
          (r.material_description || "").toLowerCase().includes(term)
      );

      return (
        e.sap_code.toLowerCase().includes(term) ||
        e.shift_date.toLowerCase().includes(term) ||
        e.shift_id.toLowerCase().includes(term) ||
        mc.toLowerCase().includes(term) ||
        plantText.toLowerCase().includes(term) ||
        (e.entered_by_name || "").toLowerCase().includes(term) ||
        matchesRuns
      );
    });
  }, [list, searchTerm, filterPlant, machines, plants]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filtered]);

  function handleExportExcel() {
    if (sorted.length === 0) {
      alert("No data available in current table view to export.");
      return;
    }
    setExporting(true);
    setTimeout(() => {
      try {
        const pObj = plants.find((p) => p.plant_id === filterPlant);
        const scopeLabel =
          filterPlant !== "all"
            ? `${pObj?.name || filterPlant}`
            : searchTerm
            ? `Filtered_Search`
            : "All_Plants";

        exportProductionToExcel({
          entries: sorted,
          master,
          machines,
          plants,
          locations,
          reasonCodes,
          filterInfo: scopeLabel,
          viewerRole,
        });

        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3500);
      } catch (err) {
        console.error("Failed to export Excel:", err);
        alert("Export failed: " + err.message);
      } finally {
        setExporting(false);
      }
    }, 150);
  }

  function handleExportCSV() {
    if (sorted.length === 0) {
      alert("No data available in current table view to export.");
      return;
    }
    exportProductionToCSV({
      entries: sorted,
      master,
      machines,
      plants,
      reasonCodes,
      viewerRole,
    });
  }

  return (
    <div>
      {/* Quick Search & Export Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Plant filter */}
          {plants.length === 1 ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#0f172a",
              }}
              title="Viewing entries for your assigned manufacturing unit"
            >
              <span>🔒</span>
              <span>{plants[0].name}</span>
            </div>
          ) : plants.length > 1 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--ink-faint)", fontWeight: 700 }}>
                PLANT:
              </span>
              <select
                value={filterPlant}
                onChange={(e) => setFilterPlant(e.target.value)}
                style={{ padding: "0 12px", fontSize: "13px", height: "42px", width: "auto", borderRadius: "8px", border: "1.5px solid #cbd5e1" }}
              >
                <option value="all">All Accessible Plants ({plants.length})</option>
                {plants.map((p) => (
                  <option key={p.plant_id} value={p.plant_id}>
                    🏭 {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="search-box-pro">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search SAP Code, Part Number, Machine, Shift or Date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {exportSuccess && (
            <span
              style={{
                fontSize: "12px",
                color: "#15803d",
                fontWeight: 700,
                background: "#dcfce7",
                padding: "6px 10px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ✓ Excel Downloaded!
            </span>
          )}

          <button
            type="button"
            className="btn-excel-export"
            onClick={handleExportExcel}
            disabled={exporting || sorted.length === 0}
            title="Export full multi-sheet Microsoft Excel (.xlsx) workbook"
          >
            <span style={{ fontSize: "14px" }}>📊</span>
            <span>{exporting ? "Generating Excel..." : "Export to Excel (.xlsx)"}</span>
          </button>

          <button
            type="button"
            className="btn-csv-export"
            onClick={handleExportCSV}
            disabled={sorted.length === 0}
            title="Download plain Comma-Separated Values (.csv)"
          >
            📄 CSV
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plant</th>
              <th>Date</th>
              <th>Shift</th>
              <th>Machine</th>
              <th>SAP Code</th>
              {viewerRole !== "operator" && <th>TGT</th>}
              <th>OK Prod</th>
              <th>Total Rej</th>
              <th>Avail</th>
              <th title="Performance (BB)">Perf</th>
              <th>Quality</th>
              <th>OEE</th>
              {viewerRole !== "operator" && <th>Shortfall Loss</th>}
              <th>Status</th>
              {viewerRole === "admin" && <th>Entered By</th>}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr className="empty-row">
                <td
                  colSpan={viewerRole === "admin" ? 16 : viewerRole === "operator" ? 13 : 15}
                  style={{ textAlign: "center", padding: "28px", color: "var(--ink-faint)" }}
                >
                  No matching shift entries found.
                </td>
              </tr>
            )}
            {sorted.map((e) => {
              const metrics = computeMetrics(e, master, reasonCodes);
              const isEntryLocked = e.status === "locked" || isEntryPastTwelveHours(e, shifts);
              const canEdit =
                viewerRole === "admin" ||
                (viewerRole === "operator" &&
                  !isEntryLocked &&
                  (!scopeToUser || e.entered_by === scopeToUser));

              // OEE Color Tag
              const oeePercent = metrics.oee * 100;
              let oeeColor = "#10b981";
              if (oeePercent < 65) oeeColor = "#ef4444";
              else if (oeePercent < 85) oeeColor = "#0284c7";

              const mcName =
                (machines.find((x) => x.machine_id === e.machine_id) || {}).machine_no ||
                e.machine_id;

              const pObj = plants.find((p) => p.plant_id === e.plant_id);
              const plantDisplay = pObj ? pObj.name : (e.plant_id || "Unit-02");

              return (
                <tr key={e.entry_id}>
                  <td>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 700,
                        fontSize: "11px",
                      }}
                    >
                      {plantDisplay}
                    </span>
                  </td>
                  <td>{e.shift_date}</td>
                  <td style={{ fontWeight: 600 }}>Shift {e.shift_id}</td>
                  <td>{mcName}</td>
                  <td>
                    {e.runs && e.runs.length > 1 ? (
                      <div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontWeight: 700,
                            fontSize: "11px",
                            marginBottom: "4px",
                          }}
                        >
                          🔄 {e.runs.length} Molds Run
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {e.runs.map((r, rIdx) => (
                            <div
                              key={rIdx}
                              style={{
                                fontSize: "11.5px",
                                color: "#334155",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ color: "#94a3b8", fontWeight: 700 }}>#{rIdx + 1}</span>
                              <span className="mono" style={{ fontWeight: 700, color: "#0284c7" }}>
                                {r.sap_code}
                              </span>
                              <span style={{ color: "#64748b", fontSize: "10.5px" }}>
                                ({r.start_time}–{r.end_time} · {r.run_hour}h)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {e.primary_sap_code || e.sap_code}
                      </span>
                    )}
                  </td>
                  {viewerRole !== "operator" && <td>{Number(metrics.tgt || 0).toLocaleString()}</td>}
                  <td style={{ fontWeight: 700, color: "#16a34a" }}>
                    {Number(e.ok_prod || 0).toLocaleString()}
                  </td>
                  <td
                    style={{
                      color: metrics.total_rej > 0 ? "var(--danger, #ef4444)" : "var(--ink-faint)",
                      fontWeight: metrics.total_rej > 0 ? 600 : 400,
                    }}
                  >
                    {metrics.total_rej}
                  </td>
                  <td>{pct(metrics.availability)}</td>
                  <td>{pct(metrics.productivity)}</td>
                  <td>{pct(metrics.quality_rate)}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: 800,
                        color: oeeColor,
                        background: `${oeeColor}15`,
                        border: `1px solid ${oeeColor}30`,
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: oeeColor,
                        }}
                      ></span>
                      {pct(metrics.oee)}
                    </span>
                  </td>
                  {viewerRole !== "operator" && (
                    <td
                      style={{
                        color:
                          metrics.shortfall_loss > 0 ? "var(--warn, #d97706)" : "var(--ink-faint)",
                        fontWeight: metrics.shortfall_loss > 0 ? 600 : 400,
                      }}
                    >
                      {metrics.shortfall_loss > 0 ? inr(metrics.shortfall_loss) : "—"}
                    </td>
                  )}
                  <td>
                    <Pill status={isEntryLocked ? "locked" : e.status} />
                  </td>
                  {viewerRole === "admin" && <td>{e.entered_by_name}</td>}
                  <td>
                    {canEdit ? (
                      <button className="btn small secondary" onClick={() => onEdit(e)}>
                        {isEntryLocked ? "Admin Edit" : "Edit"}
                      </button>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>Locked</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
