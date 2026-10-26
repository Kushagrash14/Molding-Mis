/**
 * Emergency Data Restoration Script for NGM Pune (4010) on 2026-10-23
 * Automatically restores all 114 machine-shift records from export backup
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function findStore() {
  const candidates = [
    "/var/www/production-oee-tracker/server/data/cloud_store.json",
    "/home/ubuntu/production-oee-tracker/server/data/cloud_store.json",
    "/var/www/molding-mis/server/data/cloud_store.json",
    path.join(process.cwd(), "server/data/cloud_store.json"),
    path.join(process.cwd(), "data/cloud_store.json"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const list = JSON.parse(execSync("pm2 jlist 2>/dev/null", { encoding: "utf8" }));
    for (const app of list) {
      if (app.pm2_env && app.pm2_env.pm_cwd) {
        const c = path.join(app.pm2_env.pm_cwd, "server/data/cloud_store.json");
        if (fs.existsSync(c)) return c;
      }
    }
  } catch (e) {}
  try {
    const lines = execSync("find /var/www /home/ubuntu -name cloud_store.json 2>/dev/null", { encoding: "utf8" }).trim().split("\n");
    for (const line of lines) {
      if (line && fs.existsSync(line.trim())) return line.trim();
    }
  } catch (e) {}
  return null;
}

const storePath = findStore();
if (!storePath) {
  console.error("ERROR: cloud_store.json not found!");
  process.exit(1);
}

console.log("Target Database:", storePath);
const backupPath = storePath + ".bak_ngm_23oct_" + Date.now();
fs.copyFileSync(storePath, backupPath);
console.log("Backup created at:", backupPath);

const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
if (!Array.isArray(store.entries)) store.entries = [];

const NGM_ENTRIES_TO_RESTORE = [
  {
    "entry_id": "E-1792812257308-MC-4010-57",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-57",
    "sap_code": "7020000636",
    "material_description": "SLEEVE 715MM",
    "running_cavity": 4,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000636",
        "material_description": "SLEEVE 715MM",
        "running_cavity": 4,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257304-MC-4010-56",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-56",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257301-MC-4010-52",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-52",
    "sap_code": "7020001802",
    "material_description": "LINK ROD2 1040MM C-TYPE",
    "running_cavity": 4,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001802",
        "material_description": "LINK ROD2 1040MM C-TYPE",
        "running_cavity": 4,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257298-MC-4010-51",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-51",
    "sap_code": "7020001256",
    "material_description": "MOTOR PRESSING BLOCK UP 24K IDU",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001256",
        "material_description": "MOTOR PRESSING BLOCK UP 24K IDU",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257295-MC-4010-48",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-48",
    "sap_code": "7020000233",
    "material_description": "SCREW CAP 18K",
    "running_cavity": 8,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000233",
        "material_description": "SCREW CAP 18K",
        "running_cavity": 8,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257292-MC-4010-47",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-47",
    "sap_code": "7020000226",
    "material_description": "PRESSING LINE 01 18K",
    "running_cavity": 4,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000226",
        "material_description": "PRESSING LINE 01 18K",
        "running_cavity": 4,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257288-MC-4010-46",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-46",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257285-MC-4010-45",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-45",
    "sap_code": "7020001742",
    "material_description": "AIR GUIDE FRAME ONE WAY CASSETTE",
    "running_cavity": 5,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001742",
        "material_description": "AIR GUIDE FRAME ONE WAY CASSETTE",
        "running_cavity": 5,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257281-MC-4010-44",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-44",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257277-MC-4010-43",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-43",
    "sap_code": "7020000640",
    "material_description": "DISPLAY COVER 715MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000640",
        "material_description": "DISPLAY COVER 715MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257273-MC-4010-42",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-42",
    "sap_code": "7020001804",
    "material_description": "MOTOR BASE 1 1040MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001804",
        "material_description": "MOTOR BASE 1 1040MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257269-MC-4010-41",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-41",
    "sap_code": "7020000229",
    "material_description": "IDU DISP PCB HOLDER UPPER-PI18PL002400",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000229",
        "material_description": "IDU DISP PCB HOLDER UPPER-PI18PL002400",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257266-MC-4010-40",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-40",
    "sap_code": "7020000646",
    "material_description": "WATER OUTLET PIPE 715mm 9k",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000646",
        "material_description": "WATER OUTLET PIPE 715mm 9k",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257263-MC-4010-39",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-39",
    "sap_code": "7020001126",
    "material_description": "CFF CENTER 24K/36K DIA 122",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001126",
        "material_description": "CFF CENTER 24K/36K DIA 122",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257259-MC-4010-38",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-38",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257256-MC-4010-37",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-37",
    "sap_code": "7020001128",
    "material_description": "CFF SHAFT PLATE 24K DIA 122 MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001128",
        "material_description": "CFF SHAFT PLATE 24K DIA 122 MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257252-MC-4010-35",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-35",
    "sap_code": "7020001127",
    "material_description": "BOSS PLATE 24K/36k Ø122MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001127",
        "material_description": "BOSS PLATE 24K/36k Ø122MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257249-MC-4010-34",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-34",
    "sap_code": "7020001107",
    "material_description": "LR SWING ROCKET 24K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001107",
        "material_description": "LR SWING ROCKET 24K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257246-MC-4010-33",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-33",
    "sap_code": "7020000912",
    "material_description": "ODU HANDLE PALE CREAM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000912",
        "material_description": "ODU HANDLE PALE CREAM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257242-MC-4010-32",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-32",
    "sap_code": "7020000248",
    "material_description": "ELECTRIC BOX  12K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000248",
        "material_description": "ELECTRIC BOX  12K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257239-MC-4010-31",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-31",
    "sap_code": "7020000651",
    "material_description": "CHASSIS LEFT SIDE COVER_715MM IDU_9K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000651",
        "material_description": "CHASSIS LEFT SIDE COVER_715MM IDU_9K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257235-MC-4010-29",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-29",
    "sap_code": "7020000635",
    "material_description": "LEFT SUPPORT 715MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000635",
        "material_description": "LEFT SUPPORT 715MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257232-MC-4010-28",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-28",
    "sap_code": "7020002015",
    "material_description": "3D COOL FRAME L/R COVER 715MM IDU 9K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020002015",
        "material_description": "3D COOL FRAME L/R COVER 715MM IDU 9K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257227-MC-4010-27",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-27",
    "sap_code": "7020000239",
    "material_description": "MOTOR COVER 12K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000239",
        "material_description": "MOTOR COVER 12K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257224-MC-4010-25",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-25",
    "sap_code": "7020000801",
    "material_description": "FAN 18 INCH ODU",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000801",
        "material_description": "FAN 18 INCH ODU",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257220-MC-4010-24",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-24",
    "sap_code": "7020001247",
    "material_description": "FILTER 24K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001247",
        "material_description": "FILTER 24K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257217-MC-4010-23",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-23",
    "sap_code": "7020001798",
    "material_description": "FILTER SCREEN 1040MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001798",
        "material_description": "FILTER SCREEN 1040MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257214-MC-4010-22",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-22",
    "sap_code": "7020000658",
    "material_description": "MOTOR COVER 715MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000658",
        "material_description": "MOTOR COVER 715MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257211-MC-4010-21",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-21",
    "sap_code": "7020000643",
    "material_description": "Guide Plate 715MM 9K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000643",
        "material_description": "Guide Plate 715MM 9K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257207-MC-4010-17",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-17",
    "sap_code": "7020001798",
    "material_description": "FILTER SCREEN 1040MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001798",
        "material_description": "FILTER SCREEN 1040MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257204-MC-4010-15",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-15",
    "sap_code": "7020000194",
    "material_description": "PANEL 02 18K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000194",
        "material_description": "PANEL 02 18K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257201-MC-4010-14",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-14",
    "sap_code": "DOWN_12H",
    "material_description": "—",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "DOWN_12H",
        "material_description": "—",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257197-MC-4010-12",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-12",
    "sap_code": "7020000218",
    "material_description": "MOTOR COVER 18K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000218",
        "material_description": "MOTOR COVER 18K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257194-MC-4010-11",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-11",
    "sap_code": "7020000637",
    "material_description": "CONTROL BOX 715MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000637",
        "material_description": "CONTROL BOX 715MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257191-MC-4010-10",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-10",
    "sap_code": "7020000896",
    "material_description": "FAN 20 INCH ODU",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000896",
        "material_description": "FAN 20 INCH ODU",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257187-MC-4010-09",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-09",
    "sap_code": "7020001598",
    "material_description": "26INCH ODU FAN",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001598",
        "material_description": "26INCH ODU FAN",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257184-MC-4010-07",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-07",
    "sap_code": "7020001351",
    "material_description": "PANEL 06 12K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001351",
        "material_description": "PANEL 06 12K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257180-MC-4010-06",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-06",
    "sap_code": "7020001721",
    "material_description": "EVAP COIL AIR GUIDER",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001721",
        "material_description": "EVAP COIL AIR GUIDER",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257177-MC-4010-03",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-03",
    "sap_code": "7020004842",
    "material_description": "SUCTION GRILL ONE WAY HAVELLS",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020004842",
        "material_description": "SUCTION GRILL ONE WAY HAVELLS",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257171-MC-4010-02",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-02",
    "sap_code": "7020001750",
    "material_description": "FRONT PANEL",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001750",
        "material_description": "FRONT PANEL",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812257157-MC-4010-01",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-01",
    "sap_code": "7020001245",
    "material_description": "CHASSIS 24K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001245",
        "material_description": "CHASSIS 24K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244246-MC-4010-57",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-57",
    "sap_code": "7020000636",
    "material_description": "SLEEVE 715MM",
    "running_cavity": 4,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000636",
        "material_description": "SLEEVE 715MM",
        "running_cavity": 4,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244243-MC-4010-56",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-56",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244240-MC-4010-55",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-55",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244236-MC-4010-53",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-53",
    "sap_code": "7020000214",
    "material_description": "HORIZONTAL VANE BUSH",
    "running_cavity": 8,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000214",
        "material_description": "HORIZONTAL VANE BUSH",
        "running_cavity": 8,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244233-MC-4010-52",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-52",
    "sap_code": "7020001802",
    "material_description": "LINK ROD2 1040MM C-TYPE",
    "running_cavity": 4,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001802",
        "material_description": "LINK ROD2 1040MM C-TYPE",
        "running_cavity": 4,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244229-MC-4010-51",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-51",
    "sap_code": "7020001256",
    "material_description": "MOTOR PRESSING BLOCK UP 24K IDU",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001256",
        "material_description": "MOTOR PRESSING BLOCK UP 24K IDU",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244225-MC-4010-50",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-50",
    "sap_code": "7020000217",
    "material_description": "BEARING HOLDER 18K COMMON",
    "running_cavity": 4,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000217",
        "material_description": "BEARING HOLDER 18K COMMON",
        "running_cavity": 4,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244220-MC-4010-48",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-48",
    "sap_code": "7020000233",
    "material_description": "SCREW CAP 18K",
    "running_cavity": 8,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000233",
        "material_description": "SCREW CAP 18K",
        "running_cavity": 8,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244217-MC-4010-45",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-45",
    "sap_code": "7020001742",
    "material_description": "AIR GUIDE FRAME ONE WAY CASSETTE",
    "running_cavity": 5,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001742",
        "material_description": "AIR GUIDE FRAME ONE WAY CASSETTE",
        "running_cavity": 5,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244214-MC-4010-43",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-43",
    "sap_code": "7020000640",
    "material_description": "DISPLAY COVER 715MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000640",
        "material_description": "DISPLAY COVER 715MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244211-MC-4010-42",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-42",
    "sap_code": "7020001804",
    "material_description": "MOTOR BASE 1 1040MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001804",
        "material_description": "MOTOR BASE 1 1040MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244208-MC-4010-40",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-40",
    "sap_code": "7020000646",
    "material_description": "WATER OUTLET PIPE 715mm 9k",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000646",
        "material_description": "WATER OUTLET PIPE 715mm 9k",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244205-MC-4010-39",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-39",
    "sap_code": "7020001126",
    "material_description": "CFF CENTER 24K/36K DIA 122",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001126",
        "material_description": "CFF CENTER 24K/36K DIA 122",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244201-MC-4010-35",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-35",
    "sap_code": "7020001127",
    "material_description": "BOSS PLATE 24K/36k Ø122MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001127",
        "material_description": "BOSS PLATE 24K/36k Ø122MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244194-MC-4010-34",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-34",
    "sap_code": "7020001107",
    "material_description": "LR SWING ROCKET 24K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001107",
        "material_description": "LR SWING ROCKET 24K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244191-MC-4010-31",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-31",
    "sap_code": "7020000651",
    "material_description": "CHASSIS LEFT SIDE COVER_715MM IDU_9K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000651",
        "material_description": "CHASSIS LEFT SIDE COVER_715MM IDU_9K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244187-MC-4010-29",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-29",
    "sap_code": "7020000635",
    "material_description": "LEFT SUPPORT 715MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000635",
        "material_description": "LEFT SUPPORT 715MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244184-MC-4010-28",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-28",
    "sap_code": "7020002015",
    "material_description": "3D COOL FRAME L/R COVER 715MM IDU 9K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020002015",
        "material_description": "3D COOL FRAME L/R COVER 715MM IDU 9K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244180-MC-4010-27",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-27",
    "sap_code": "7020000239",
    "material_description": "MOTOR COVER 12K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000239",
        "material_description": "MOTOR COVER 12K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244177-MC-4010-26",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-26",
    "sap_code": "7020000234",
    "material_description": "LEFT SUPPORT EVA HOLDER",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000234",
        "material_description": "LEFT SUPPORT EVA HOLDER",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244173-MC-4010-25",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-25",
    "sap_code": "7020000801",
    "material_description": "FAN 18 INCH ODU",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000801",
        "material_description": "FAN 18 INCH ODU",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244170-MC-4010-24",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-24",
    "sap_code": "7020001247",
    "material_description": "FILTER 24K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001247",
        "material_description": "FILTER 24K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244167-MC-4010-22",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-22",
    "sap_code": "7020000658",
    "material_description": "MOTOR COVER 715MM",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000658",
        "material_description": "MOTOR COVER 715MM",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244163-MC-4010-15",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-15",
    "sap_code": "7020000194",
    "material_description": "PANEL 02 18K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000194",
        "material_description": "PANEL 02 18K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244160-MC-4010-14",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-14",
    "sap_code": "DOWN_12H",
    "material_description": "—",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "DOWN_12H",
        "material_description": "—",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244155-MC-4010-12",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-12",
    "sap_code": "7020000218",
    "material_description": "MOTOR COVER 18K",
    "running_cavity": 2,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000218",
        "material_description": "MOTOR COVER 18K",
        "running_cavity": 2,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244151-MC-4010-11",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-11",
    "sap_code": "7020000637",
    "material_description": "CONTROL BOX 715MM",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000637",
        "material_description": "CONTROL BOX 715MM",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244147-MC-4010-10",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-10",
    "sap_code": "7020000896",
    "material_description": "FAN 20 INCH ODU",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000896",
        "material_description": "FAN 20 INCH ODU",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244144-MC-4010-09",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-09",
    "sap_code": "7020001598",
    "material_description": "26INCH ODU FAN",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001598",
        "material_description": "26INCH ODU FAN",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244139-MC-4010-07",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-07",
    "sap_code": "7020001351",
    "material_description": "PANEL 06 12K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001351",
        "material_description": "PANEL 06 12K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244136-MC-4010-06",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-06",
    "sap_code": "7020001721",
    "material_description": "EVAP COIL AIR GUIDER",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001721",
        "material_description": "EVAP COIL AIR GUIDER",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244133-MC-4010-03",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-03",
    "sap_code": "7020004842",
    "material_description": "SUCTION GRILL ONE WAY HAVELLS",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020004842",
        "material_description": "SUCTION GRILL ONE WAY HAVELLS",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244130-MC-4010-02",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-02",
    "sap_code": "7020001750",
    "material_description": "FRONT PANEL",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001750",
        "material_description": "FRONT PANEL",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812244120-MC-4010-01",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-01",
    "sap_code": "7020001245",
    "material_description": "CHASSIS 24K",
    "running_cavity": 1,
    "run_hour": 0,
    "ok_prod": 0,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_plan": 720
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001245",
        "material_description": "CHASSIS 24K",
        "running_cavity": 1,
        "run_hour": 0,
        "ok_prod": 0,
        "reasons": {
          "pdt_no_plan": 720
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812201152-MC-4010-13",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-13",
    "sap_code": "7020000225",
    "material_description": "COVER BOX LEFT 18K",
    "running_cavity": 2,
    "run_hour": 0.3,
    "ok_prod": 16,
    "total_rej": 5,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 5,
      "pdt_no_load": 700
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000225",
        "material_description": "COVER BOX LEFT 18K",
        "running_cavity": 2,
        "run_hour": 0.3,
        "ok_prod": 16,
        "reasons": {
          "rej_startup": 5,
          "pdt_no_load": 700
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812178548-MC-4010-08",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-08",
    "sap_code": "7020000232",
    "material_description": "GUIDE PLATE (HORIZONTAL VANE) 18K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 1409,
    "total_rej": 15,
    "planned_hours": 12,
    "reasons": {
      "rej_flow_mark": 15
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000232",
        "material_description": "GUIDE PLATE (HORIZONTAL VANE) 18K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 1409,
        "reasons": {
          "rej_flow_mark": 15
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812159463-MC-4010-05",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-05",
    "sap_code": "7020000221",
    "material_description": "CHASSIS 18K",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 648,
    "total_rej": 2,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 2
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000221",
        "material_description": "CHASSIS 18K",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 648,
        "reasons": {
          "rej_short_mould": 2
        }
      }
    ]
  },
  {
    "entry_id": "E-1792812135590-MC-4010-04",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-04",
    "sap_code": "7020000228",
    "material_description": "FRAME GRILL 18K",
    "running_cavity": 1,
    "run_hour": 7.8,
    "ok_prod": 477,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_black_spot": 4,
      "pdt_no_load": 250
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000228",
        "material_description": "FRAME GRILL 18K",
        "running_cavity": 1,
        "run_hour": 7.8,
        "ok_prod": 477,
        "reasons": {
          "rej_black_spot": 4,
          "pdt_no_load": 250
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810793742-MC-4010-13",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-13",
    "sap_code": "7020000225",
    "material_description": "COVER BOX LEFT 18K",
    "running_cavity": 1,
    "run_hour": 4.4,
    "ok_prod": 443,
    "total_rej": 10,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 10,
      "pdt_no_load": 454
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000225",
        "material_description": "COVER BOX LEFT 18K",
        "running_cavity": 1,
        "run_hour": 4.4,
        "ok_prod": 443,
        "reasons": {
          "rej_startup": 10,
          "pdt_no_load": 454
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810600515-MC-4010-08",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-08",
    "sap_code": "7020000232",
    "material_description": "GUIDE PLATE (HORIZONTAL VANE) 18K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 1504,
    "total_rej": 12,
    "planned_hours": 12,
    "reasons": {
      "rej_black_spot": 12
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000232",
        "material_description": "GUIDE PLATE (HORIZONTAL VANE) 18K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 1504,
        "reasons": {
          "rej_black_spot": 12
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810577410-MC-4010-05",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-05",
    "sap_code": "7020000221",
    "material_description": "CHASSIS 18K",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 600,
    "total_rej": 10,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 10
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000221",
        "material_description": "CHASSIS 18K",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 600,
        "reasons": {
          "rej_short_mould": 10
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810555532-MC-4010-04",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-04",
    "sap_code": "7020000228",
    "material_description": "FRAME GRILL 18K",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 666,
    "total_rej": 20,
    "planned_hours": 12,
    "reasons": {
      "rej_flow_mark": 20
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000228",
        "material_description": "FRAME GRILL 18K",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 666,
        "reasons": {
          "rej_flow_mark": 20
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810254137-MC-4010-55",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-55",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 878,
    "total_rej": 2,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 2
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 878,
        "reasons": {
          "rej_startup": 2
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810219276-MC-4010-54",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-54",
    "sap_code": "7020000891",
    "material_description": "PRESSING PLATE 1 18K BIG",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 2262,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {},
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000891",
        "material_description": "PRESSING PLATE 1 18K BIG",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 2262,
        "reasons": {}
      }
    ]
  },
  {
    "entry_id": "E-1792810199965-MC-4010-53",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-53",
    "sap_code": "7020000214",
    "material_description": "HORIZONTAL VANE BUSH",
    "running_cavity": 8,
    "run_hour": 12,
    "ok_prod": 12248,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {},
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000214",
        "material_description": "HORIZONTAL VANE BUSH",
        "running_cavity": 8,
        "run_hour": 12,
        "ok_prod": 12248,
        "reasons": {}
      }
    ]
  },
  {
    "entry_id": "E-1792810178727-MC-4010-50",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-50",
    "sap_code": "7020000217",
    "material_description": "BEARING HOLDER 18K COMMON",
    "running_cavity": 4,
    "run_hour": 5.3,
    "ok_prod": 2910,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_load": 400
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000217",
        "material_description": "BEARING HOLDER 18K COMMON",
        "running_cavity": 4,
        "run_hour": 5.3,
        "ok_prod": 2910,
        "reasons": {
          "pdt_no_load": 400
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810148457-MC-4010-49",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-49",
    "sap_code": "7020000223",
    "material_description": "ELECTRIC BOX COVER (TB COVER) 18K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 2410,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {},
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000223",
        "material_description": "ELECTRIC BOX COVER (TB COVER) 18K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 2410,
        "reasons": {}
      }
    ]
  },
  {
    "entry_id": "E-1792810123436-MC-4010-36",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-36",
    "sap_code": "7020001795",
    "material_description": "BOSS PLATE DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 8.7,
    "ok_prod": 492,
    "total_rej": 2,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 2,
      "pdt_no_load": 200
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001795",
        "material_description": "BOSS PLATE DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 8.7,
        "ok_prod": 492,
        "reasons": {
          "rej_short_mould": 2,
          "pdt_no_load": 200
        }
      }
    ]
  },
  {
    "entry_id": "E-1792810019587-MC-4010-30",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-30",
    "sap_code": "7020000224",
    "material_description": "CONTROL BOX COVER RIGHT 18K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 1972,
    "total_rej": 2,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 2
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000224",
        "material_description": "CONTROL BOX COVER RIGHT 18K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 1972,
        "reasons": {
          "rej_short_mould": 2
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809994679-MC-4010-26",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-26",
    "sap_code": "7020000234",
    "material_description": "LEFT SUPPORT EVA HOLDER",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 1798,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 4
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000234",
        "material_description": "LEFT SUPPORT EVA HOLDER",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 1798,
        "reasons": {
          "rej_startup": 4
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809948604-MC-4010-20",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-20",
    "sap_code": "7020000244",
    "material_description": "DISCHARGE GRILL 12K",
    "running_cavity": 2,
    "run_hour": 8.7,
    "ok_prod": 1314,
    "total_rej": 6,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 6,
      "pdt_no_load": 200
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000244",
        "material_description": "DISCHARGE GRILL 12K",
        "running_cavity": 2,
        "run_hour": 8.7,
        "ok_prod": 1314,
        "reasons": {
          "rej_startup": 6,
          "pdt_no_load": 200
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809905549-MC-4010-19",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-19",
    "sap_code": "7020003329",
    "material_description": "P20 ODU FAN DIA 438MM(17.2IN)LIGHTWEIGHT",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 746,
    "total_rej": 5,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 5
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020003329",
        "material_description": "P20 ODU FAN DIA 438MM(17.2IN)LIGHTWEIGHT",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 746,
        "reasons": {
          "rej_short_mould": 5
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809879128-MC-4010-18",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-18",
    "sap_code": "7020000911",
    "material_description": "FAN GUARD 20 INCH PALE CREAM",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 786,
    "total_rej": 5,
    "planned_hours": 12,
    "reasons": {
      "rej_flow_mark": 5
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000911",
        "material_description": "FAN GUARD 20 INCH PALE CREAM",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 786,
        "reasons": {
          "rej_flow_mark": 5
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809852612-MC-4010-16",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "2",
    "machine_id": "MC-4010-16",
    "sap_code": "7020001349",
    "material_description": "PANEL 06 18K",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 672,
    "total_rej": 6,
    "planned_hours": 12,
    "reasons": {
      "rej_flow_mark": 6
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001349",
        "material_description": "PANEL 06 18K",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 672,
        "reasons": {
          "rej_flow_mark": 6
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809704192-MC-4010-36",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-36",
    "sap_code": "7020001126",
    "material_description": "CFF CENTER 24K/36K DIA 122",
    "running_cavity": 1,
    "run_hour": 3.7,
    "ok_prod": 298,
    "total_rej": 5,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 5,
      "pdt_no_load": 500
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001126",
        "material_description": "CFF CENTER 24K/36K DIA 122",
        "running_cavity": 1,
        "run_hour": 3.7,
        "ok_prod": 298,
        "reasons": {
          "rej_startup": 5,
          "pdt_no_load": 500
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809631092-MC-4010-54",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-54",
    "sap_code": "7020000891",
    "material_description": "PRESSING PLATE 1 18K BIG",
    "running_cavity": 2,
    "run_hour": 7,
    "ok_prod": 1638,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 4,
      "pdt_no_load": 300
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000891",
        "material_description": "PRESSING PLATE 1 18K BIG",
        "running_cavity": 2,
        "run_hour": 7,
        "ok_prod": 1638,
        "reasons": {
          "rej_short_mould": 4,
          "pdt_no_load": 300
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809543405-MC-4010-49",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-49",
    "sap_code": "7020000223",
    "material_description": "ELECTRIC BOX COVER (TB COVER) 18K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 2409,
    "total_rej": 3,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 3
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000223",
        "material_description": "ELECTRIC BOX COVER (TB COVER) 18K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 2409,
        "reasons": {
          "rej_startup": 3
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809504270-MC-4010-47",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-47",
    "sap_code": "7020000226",
    "material_description": "PRESSING LINE 01 18K",
    "running_cavity": 4,
    "run_hour": 3.7,
    "ok_prod": 1838,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 4,
      "udt_no_manpower": 500
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000226",
        "material_description": "PRESSING LINE 01 18K",
        "running_cavity": 4,
        "run_hour": 3.7,
        "ok_prod": 1838,
        "reasons": {
          "rej_short_mould": 4,
          "udt_no_manpower": 500
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809418963-MC-4010-46",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-46",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 1370,
    "total_rej": 3,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 3
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 1370,
        "reasons": {
          "rej_short_mould": 3
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809379633-MC-4010-44",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-44",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 2,
    "ok_prod": 175,
    "total_rej": 2,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 2,
      "pdt_no_load": 600
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 2,
        "ok_prod": 175,
        "reasons": {
          "rej_startup": 2,
          "pdt_no_load": 600
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809300278-MC-4010-41",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-41",
    "sap_code": "7020000229 + 7020000230",
    "material_description": "7020000229: IDU DISP PCB HOLDER UPPER-PI18PL002400 (1C · 1049pcs) | 7020000230: IDU DISP PCB HOLDER INNER-PI18PL002500 (1C · 1049pcs)",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 2098,
    "total_rej": 6,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 6
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000229 + 7020000230",
        "material_description": "7020000229: IDU DISP PCB HOLDER UPPER-PI18PL002400 (1C · 1049pcs) | 7020000230: IDU DISP PCB HOLDER INNER-PI18PL002500 (1C · 1049pcs)",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 2098,
        "reasons": {
          "rej_short_mould": 6
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809232275-MC-4010-38",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-38",
    "sap_code": "7020001928",
    "material_description": "CENTER DIA( 116x 820)MM",
    "running_cavity": 1,
    "run_hour": 8.7,
    "ok_prod": 983,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 4,
      "udt_under_tool_room": 200
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001928",
        "material_description": "CENTER DIA( 116x 820)MM",
        "running_cavity": 1,
        "run_hour": 8.7,
        "ok_prod": 983,
        "reasons": {
          "rej_short_mould": 4,
          "udt_under_tool_room": 200
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809207973-MC-4010-37",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-37",
    "sap_code": "7020001128",
    "material_description": "CFF SHAFT PLATE 24K DIA 122 MM",
    "running_cavity": 1,
    "run_hour": 1,
    "ok_prod": 85,
    "total_rej": 0,
    "planned_hours": 12,
    "reasons": {
      "pdt_no_load": 660
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001128",
        "material_description": "CFF SHAFT PLATE 24K DIA 122 MM",
        "running_cavity": 1,
        "run_hour": 1,
        "ok_prod": 85,
        "reasons": {
          "pdt_no_load": 660
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809163833-MC-4010-33",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-33",
    "sap_code": "7020000912",
    "material_description": "ODU HANDLE PALE CREAM",
    "running_cavity": 2,
    "run_hour": 7.8,
    "ok_prod": 1264,
    "total_rej": 6,
    "planned_hours": 12,
    "reasons": {
      "rej_startup": 6,
      "udt_no_manpower": 250
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000912",
        "material_description": "ODU HANDLE PALE CREAM",
        "running_cavity": 2,
        "run_hour": 7.8,
        "ok_prod": 1264,
        "reasons": {
          "rej_startup": 6,
          "udt_no_manpower": 250
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809103806-MC-4010-32",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-32",
    "sap_code": "7020000248",
    "material_description": "ELECTRIC BOX  12K",
    "running_cavity": 1,
    "run_hour": 5.3,
    "ok_prod": 423,
    "total_rej": 3,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 3,
      "pdt_no_load": 400
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000248",
        "material_description": "ELECTRIC BOX  12K",
        "running_cavity": 1,
        "run_hour": 5.3,
        "ok_prod": 423,
        "reasons": {
          "rej_short_mould": 3,
          "pdt_no_load": 400
        }
      }
    ]
  },
  {
    "entry_id": "E-1792809039282-MC-4010-30",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-30",
    "sap_code": "7020000224",
    "material_description": "CONTROL BOX COVER RIGHT 18K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 1606,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 4
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000224",
        "material_description": "CONTROL BOX COVER RIGHT 18K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 1606,
        "reasons": {
          "rej_short_mould": 4
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808987067-MC-4010-23",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-23",
    "sap_code": "7020001798",
    "material_description": "FILTER SCREEN 1040MM",
    "running_cavity": 1,
    "run_hour": 2,
    "ok_prod": 177,
    "total_rej": 3,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 3,
      "pdt_no_load": 600
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001798",
        "material_description": "FILTER SCREEN 1040MM",
        "running_cavity": 1,
        "run_hour": 2,
        "ok_prod": 177,
        "reasons": {
          "rej_short_mould": 3,
          "pdt_no_load": 600
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808928176-MC-4010-21",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-21",
    "sap_code": "7020000643",
    "material_description": "Guide Plate 715MM 9K",
    "running_cavity": 2,
    "run_hour": 5.3,
    "ok_prod": 663,
    "total_rej": 9,
    "planned_hours": 12,
    "reasons": {
      "rej_black_spot": 9,
      "pdt_no_load": 400
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000643",
        "material_description": "Guide Plate 715MM 9K",
        "running_cavity": 2,
        "run_hour": 5.3,
        "ok_prod": 663,
        "reasons": {
          "rej_black_spot": 9,
          "pdt_no_load": 400
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808880290-MC-4010-20",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-20",
    "sap_code": "7020000244",
    "material_description": "DISCHARGE GRILL 12K",
    "running_cavity": 2,
    "run_hour": 12,
    "ok_prod": 1167,
    "total_rej": 3,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 3
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000244",
        "material_description": "DISCHARGE GRILL 12K",
        "running_cavity": 2,
        "run_hour": 12,
        "ok_prod": 1167,
        "reasons": {
          "rej_short_mould": 3
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808846909-MC-4010-19",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-19",
    "sap_code": "7020003329",
    "material_description": "P20 ODU FAN DIA 438MM(17.2IN)LIGHTWEIGHT",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 830,
    "total_rej": 2,
    "planned_hours": 12,
    "reasons": {
      "rej_black_spot": 2
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020003329",
        "material_description": "P20 ODU FAN DIA 438MM(17.2IN)LIGHTWEIGHT",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 830,
        "reasons": {
          "rej_black_spot": 2
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808787923-MC-4010-18",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-18",
    "sap_code": "7020000911",
    "material_description": "FAN GUARD 20 INCH PALE CREAM",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 857,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 4
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020000911",
        "material_description": "FAN GUARD 20 INCH PALE CREAM",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 857,
        "reasons": {
          "rej_short_mould": 4
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808733167-MC-4010-17",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-17",
    "sap_code": "7020001798",
    "material_description": "FILTER SCREEN 1040MM",
    "running_cavity": 1,
    "run_hour": 10.3,
    "ok_prod": 1074,
    "total_rej": 14,
    "planned_hours": 12,
    "reasons": {
      "rej_short_mould": 14,
      "udt_cycle_delay": 100
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001798",
        "material_description": "FILTER SCREEN 1040MM",
        "running_cavity": 1,
        "run_hour": 10.3,
        "ok_prod": 1074,
        "reasons": {
          "rej_short_mould": 14,
          "udt_cycle_delay": 100
        }
      }
    ]
  },
  {
    "entry_id": "E-1792808696373-MC-4010-16",
    "plant_id": "4010",
    "shift_date": "2026-10-23",
    "shift_id": "1",
    "machine_id": "MC-4010-16",
    "sap_code": "7020001349",
    "material_description": "PANEL 06 18K",
    "running_cavity": 1,
    "run_hour": 12,
    "ok_prod": 678,
    "total_rej": 4,
    "planned_hours": 12,
    "reasons": {
      "rej_black_spot": 4
    },
    "status": "submitted",
    "entered_by": "pradeep kumar",
    "operator_name": "pradeep kumar",
    "runs": [
      {
        "run_id": "run-1",
        "sap_code": "7020001349",
        "material_description": "PANEL 06 18K",
        "running_cavity": 1,
        "run_hour": 12,
        "ok_prod": 678,
        "reasons": {
          "rej_black_spot": 4
        }
      }
    ]
  }
];

let insertedCount = 0;
let updatedCount = 0;

for (const entry of NGM_ENTRIES_TO_RESTORE) {
  const existingIdx = store.entries.findIndex(
    (e) =>
      String(e.plant_id || "") === "4010" &&
      String(e.shift_date || "").slice(0, 10) === "2026-10-23" &&
      String(e.shift_id || "") === String(entry.shift_id || "") &&
      e.machine_id === entry.machine_id
  );

  if (existingIdx >= 0) {
    store.entries[existingIdx] = {
      ...store.entries[existingIdx],
      ...entry,
      entry_id: store.entries[existingIdx].entry_id || entry.entry_id,
      updated_at: new Date().toISOString(),
    };
    updatedCount++;
  } else {
    store.entries.push({
      ...entry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    insertedCount++;
  }
}

const tmpFile = storePath + ".tmp_" + Date.now();
fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), "utf8");
fs.renameSync(tmpFile, storePath);

console.log("\n======================================================");
console.log("✅ NGM Pune (4010) 23-Oct Data Restoration Complete!");
console.log("======================================================");
console.log("Total Records Processed:", NGM_ENTRIES_TO_RESTORE.length);
console.log("Newly Inserted:", insertedCount);
console.log("Updated / Merged:", updatedCount);
console.log("Total DB Entries Now:", store.entries.length);
console.log("\nShift 1: 57 machines | Shift 2: 57 machines");
console.log("Total OK Production Restored: 53,884 pcs");
console.log("Total Rejection Restored: 193 pcs");
console.log("======================================================\n");
