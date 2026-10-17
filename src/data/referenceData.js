export const SHIFTS = [
  {
    "shift_id": "1",
    "name": "Shift 1 (Day)",
    "start_time": "07:00",
    "end_time": "19:00",
    "break_mins": 0,
    "planned_hours": 12,
    "is_overnight": false,
    "code": "Shift 1 (07:00–19:00 · 12.0h)"
  },
  {
    "shift_id": "2",
    "name": "Shift 2 (Night)",
    "start_time": "19:00",
    "end_time": "07:00",
    "break_mins": 0,
    "planned_hours": 12,
    "is_overnight": true,
    "code": "Shift 2 (19:00–07:00 · 12.0h 🌙)"
  }
];

export const LOCATIONS = [
  {
    "location_id": "LOC-PUN",
    "name": "Pune"
  },
  {
    "location_id": "LOC-BHI",
    "name": "Bhiwadi"
  },
  {
    "location_id": "LOC-NOI",
    "name": "Noida"
  }
];

export const PLANTS = [
  {
    "plant_id": "1040",
    "name": "1040 - PGEL Pune",
    "location_id": "LOC-PUN",
    "code": "1040"
  },
  {
    "plant_id": "2020",
    "name": "2020 - PGTL Pune",
    "location_id": "LOC-PUN",
    "code": "2020"
  },
  {
    "plant_id": "PLANT-U04",
    "name": "Unit-04 - Bhiwadi",
    "location_id": "LOC-BHI",
    "code": "U04"
  },
  {
    "plant_id": "4010",
    "name": "4010 - NGM Pune",
    "location_id": "LOC-PUN",
    "code": "4010"
  },
  {
    "plant_id": "4020",
    "name": "4020 - NGM Bhiwadi",
    "location_id": "LOC-BHI",
    "code": "4020"
  },
  {
    "plant_id": "2060",
    "name": "2060 - DMIC Noida",
    "location_id": "LOC-NOI",
    "code": "2060"
  }
];

export const REASON_CODES = [
  {
    "reason_id": "rej_startup",
    "name": "STARTUP",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_power_cut",
    "name": "POWER CUT",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_short_mould",
    "name": "SHORT MOULD",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_pin_mark",
    "name": "PIN MARK",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_flow_mark",
    "name": "FLOW MARK",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_shrinkage",
    "name": "SHRINKAGE",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_silver",
    "name": "SILVER",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_black_spot",
    "name": "BLACK SPOT",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_crack",
    "name": "CRACK",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_barrel_clean",
    "name": "BARREL CLEAN (REJ)",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_weld_line",
    "name": "WELD LINE",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_printing",
    "name": "PRINTING",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "rej_other",
    "name": "OTHER",
    "category": "rejection",
    "unit": "qty"
  },
  {
    "reason_id": "pdt_no_plan",
    "name": "NO PLAN",
    "category": "planned_dt",
    "unit": "min"
  },
  {
    "reason_id": "pdt_no_load",
    "name": "NO LOAD",
    "category": "planned_dt",
    "unit": "min"
  },
  {
    "reason_id": "pdt_mould_change",
    "name": "MOULD CHANGE",
    "category": "planned_dt",
    "unit": "min"
  },
  {
    "reason_id": "pdt_barrel_clean",
    "name": "BARREL CLEAN (PDT)",
    "category": "planned_dt",
    "unit": "min"
  },
  {
    "reason_id": "pdt_preventive",
    "name": "PREVENTIVE",
    "category": "planned_dt",
    "unit": "min"
  },
  {
    "reason_id": "pdt_lunch",
    "name": "LUNCH",
    "category": "planned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_trail",
    "name": "TRAIL",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_cycle_delay",
    "name": "CYCLE DELAY",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_packaging_mat",
    "name": "PACKAGING MATERIAL",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_nozzel_chock",
    "name": "NOZZEL CHOCK",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_5s",
    "name": "5S",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_barrel_heating",
    "name": "BARREL HEATING",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_rm_heating",
    "name": "R/M HEATING",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_under_tool_room",
    "name": "UNDER TOOL ROOM",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_componet_stick",
    "name": "COMPONET STICK",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_mc_issue",
    "name": "M/C ISSUE",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_hrtc_issue",
    "name": "HRTC ISSUE.",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_power_cut",
    "name": "POWER CUT (UDT)",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_rm_short",
    "name": "R/M SHORT",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_no_manpower",
    "name": "NO MANPOWER",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_under_maint",
    "name": "UNDER MAINT",
    "category": "unplanned_dt",
    "unit": "min"
  },
  {
    "reason_id": "udt_others",
    "name": "OTHERS",
    "category": "unplanned_dt",
    "unit": "min"
  }
];
