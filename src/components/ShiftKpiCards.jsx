import { useMemo } from "react";
import { computeMetrics, addDaysToDateStr } from "../lib/calculations.js";

export default function ShiftKpiCards({
  entries = [],
  selectedPlantId,
  selectedShiftDate,
  selectedShiftId,
  master = [],
  reasonCodes = [],
}) {
  // 1. Filter entries for active shift and active date
  const currentShiftEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        (!selectedPlantId || e.plant_id === selectedPlantId) &&
        e.shift_date === selectedShiftDate &&
        (!selectedShiftId || String(e.shift_id) === String(selectedShiftId))
    );
  }, [entries, selectedPlantId, selectedShiftDate, selectedShiftId]);

  // All entries for today's entire production date across shifts
  const todayAllShiftEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        (!selectedPlantId || e.plant_id === selectedPlantId) &&
        e.shift_date === selectedShiftDate
    );
  }, [entries, selectedPlantId, selectedShiftDate]);

  // Yesterday's entries for comparison
  const yesterdayDate = useMemo(() => {
    return addDaysToDateStr(selectedShiftDate, -1);
  }, [selectedShiftDate]);

  const yesterdayEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        (!selectedPlantId || e.plant_id === selectedPlantId) &&
        e.shift_date === yesterdayDate
    );
  }, [entries, selectedPlantId, yesterdayDate]);

  // Metrics rollups
  const kpis = useMemo(() => {
    // Today's total production (shift & full day)
    const shiftOkProd = currentShiftEntries.reduce((acc, e) => acc + (Number(e.ok_prod) || 0), 0);
    const todayTotalOkProd = todayAllShiftEntries.reduce((acc, e) => acc + (Number(e.ok_prod) || 0), 0);

    // Yesterday's total production
    const yesterdayOkProd = yesterdayEntries.reduce((acc, e) => acc + (Number(e.ok_prod) || 0), 0);

    // Today's full-day downtimes & rejections rollup across all shifts
    let todayPdtHours = 0;
    let todayUdtHours = 0;
    let todayRejPcs = 0;

    todayAllShiftEntries.forEach((e) => {
      const m = computeMetrics(e, master, reasonCodes);
      todayPdtHours += m.planned_dt || 0;
      todayUdtHours += m.unplanned_dt || 0;
      todayRejPcs += m.total_rej || 0;
    });

    // Active shift downtimes & rejections for subtext comparison
    let shiftPdtHours = 0;
    let shiftUdtHours = 0;
    let shiftRejPcs = 0;

    currentShiftEntries.forEach((e) => {
      const m = computeMetrics(e, master, reasonCodes);
      shiftPdtHours += m.planned_dt || 0;
      shiftUdtHours += m.unplanned_dt || 0;
      shiftRejPcs += m.total_rej || 0;
    });

    const todayPdtMins = Math.round(todayPdtHours * 60);
    const todayUdtMins = Math.round(todayUdtHours * 60);
    const shiftPdtMins = Math.round(shiftPdtHours * 60);
    const shiftUdtMins = Math.round(shiftUdtHours * 60);

    const todayGross = todayTotalOkProd + todayRejPcs;
    const todayRejRate = todayGross > 0 ? ((todayRejPcs / todayGross) * 100).toFixed(1) : "0.0";

    return {
      shiftOkProd,
      todayTotalOkProd,
      yesterdayOkProd,
      todayPdtMins,
      todayPdtHours: todayPdtHours.toFixed(1),
      shiftPdtMins,
      todayUdtMins,
      todayUdtHours: todayUdtHours.toFixed(1),
      shiftUdtMins,
      todayRejPcs,
      shiftRejPcs,
      todayRejRate,
    };
  }, [currentShiftEntries, todayAllShiftEntries, yesterdayEntries, master, reasonCodes]);

  return (
    <div className="kpi-cards-grid">
      {/* 1. Today's Total Production */}
      <div className="kpi-card accent-navy">
        <div className="kpi-accent-bar navy" />
        <div className="kpi-card-header">
          <span className="kpi-label">TODAYS TOTAL PRODUCTION</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-num navy">
            {kpis.todayTotalOkProd.toLocaleString()}
          </span>
          <span className="kpi-unit">PCS</span>
        </div>
        <div className="kpi-subtext">
          Active Shift: <strong>{kpis.shiftOkProd.toLocaleString()} pcs</strong>
        </div>
      </div>

      {/* 2. Yesterday Total Production */}
      <div className="kpi-card accent-green">
        <div className="kpi-accent-bar green" />
        <div className="kpi-card-header">
          <span className="kpi-label">YESTERDAY TOTAL PRODUCTION</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-num green">
            {kpis.yesterdayOkProd.toLocaleString()}
          </span>
          <span className="kpi-unit">PCS</span>
        </div>
        <div className="kpi-subtext">
          {kpis.todayTotalOkProd >= kpis.yesterdayOkProd ? (
            <span style={{ color: "#16a34a" }}>▲ Higher than yesterday</span>
          ) : (
            <span style={{ color: "#64748b" }}>24h historical baseline</span>
          )}
        </div>
      </div>

      {/* 3. Todays Planned Downtime */}
      <div className="kpi-card accent-amber">
        <div className="kpi-accent-bar amber" />
        <div className="kpi-card-header">
          <span className="kpi-label">TODAYS PLANNED DOWNTIME</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-num amber">{kpis.todayPdtMins}</span>
          <span className="kpi-unit">MINS</span>
        </div>
        <div className="kpi-subtext">
          Active Shift: <strong>{kpis.shiftPdtMins} mins</strong> ({kpis.todayPdtHours}h today)
        </div>
      </div>

      {/* 4. Todays Unplanned Downtime */}
      <div className="kpi-card accent-red">
        <div className="kpi-accent-bar red" />
        <div className="kpi-card-header">
          <span className="kpi-label">TODAYS UNPLANNED DOWNTIME</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-num red">{kpis.todayUdtMins}</span>
          <span className="kpi-unit">MINS</span>
        </div>
        <div className="kpi-subtext">
          Active Shift: <strong>{kpis.shiftUdtMins} mins</strong> ({kpis.todayUdtHours}h today)
        </div>
      </div>

      {/* 5. Todays Total Rejections */}
      <div className="kpi-card accent-teal">
        <div className="kpi-accent-bar teal" />
        <div className="kpi-card-header">
          <span className="kpi-label">TODAYS TOTAL REJECTIONS</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-num teal">
            {kpis.todayRejPcs.toLocaleString()}
          </span>
          <span className="kpi-unit">PCS</span>
        </div>
        <div className="kpi-subtext">
          Defect Rate: <strong>{kpis.todayRejRate}%</strong> (Shift: {kpis.shiftRejPcs} pcs)
        </div>
      </div>
    </div>
  );
}
