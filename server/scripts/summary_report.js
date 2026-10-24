import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function findStore() {
  const candidates = [
    "/var/www/production-oee-tracker/server/data/cloud_store.json",
    "/home/ubuntu/production-oee-tracker/server/data/cloud_store.json",
    "/var/www/molding-mis/server/data/cloud_store.json",
    "/home/ubuntu/Molding-Mis/server/data/cloud_store.json",
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

function isNoPlanEntry(e) {
  if (!e) return false;
  if (e.sap_code === "DOWN_12H" || e.sap_code === "NO_PLAN") return true;
  const r = e.reasons;
  if (!r) return false;
  if (Array.isArray(r)) {
    return r.some((x) => {
      const id = String(x?.reason_id || x?.name || "").toLowerCase();
      const val = Number(x?.value || x?.minutes || 0);
      return val > 0 && (id.includes("no_plan") || id.includes("no plan"));
    });
  }
  if (typeof r === "object") {
    for (const [k, v] of Object.entries(r)) {
      const id = k.toLowerCase();
      const val = typeof v === "object" && v !== null ? Number(v.value || v.minutes || 0) : Number(v || 0);
      if (val > 0 && (id.includes("no_plan") || id.includes("no plan"))) return true;
    }
  }
  return false;
}

const storeFile = findStore();
if (!storeFile) {
  console.error("cloud_store.json not found!");
  process.exit(1);
}
console.log("Using store file:", storeFile);
const store = JSON.parse(fs.readFileSync(storeFile, "utf8"));
const entries = store.entries || [];
console.log("Total entries in database:", entries.length);

const plants = [
  { id: "2020", name: "PGTL- MOLDING", totalMc: 53 },
  { id: "4010", name: "NGM- MOLDING", totalMc: 57 },
  { id: "1040", name: "PGEL- MOLDING", totalMc: 85 },
];

const dates = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
];

for (const p of plants) {
  console.log("\n" + "=".repeat(65));
  console.log(`### ${p.name} (Total M/C: ${p.totalMc}) ###`);
  console.log("=".repeat(65));
  console.log("Date\tTotal Prod\tTotal M/C\tNo Plan M/C\tFilled M/C\tFilled %");

  for (const d of dates) {
    const dayLabel = d.slice(8, 10) + "-Oct";
    const dParts = d.split("-");
    const alt1 = dParts[2] + "-" + dParts[1] + "-" + dParts[0];
    const alt2 = dParts[2] + "/" + dParts[1] + "/" + dParts[0];

    const plantEntries = entries.filter((e) => {
      const matchPlant =
        String(e.plant_id || "") === p.id ||
        (p.id === "1040" && ["PLANT-U01", "PLANT-U02", "PLANT-U03"].includes(String(e.plant_id)));
      const rawDate = String(e.shift_date || "");
      const entryDate = rawDate.slice(0, 10);
      return matchPlant && (entryDate === d || rawDate.startsWith(d) || entryDate === alt1 || entryDate === alt2);
    });

    const mcEntriesMap = new Map();
    for (const e of plantEntries) {
      if (!e.machine_id) continue;
      if (!mcEntriesMap.has(e.machine_id)) {
        mcEntriesMap.set(e.machine_id, []);
      }
      mcEntriesMap.get(e.machine_id).push(e);
    }

    const filledCount = mcEntriesMap.size;
    let totalProd = 0;
    let noPlanCount = 0;

    for (const [mcId, mcList] of mcEntriesMap.entries()) {
      let mcProd = 0;
      let hasNoPlanReason = false;
      for (const e of mcList) {
        mcProd += Number(e.ok_prod) || 0;
        if (isNoPlanEntry(e)) hasNoPlanReason = true;
      }
      totalProd += mcProd;
      if (mcProd === 0 && hasNoPlanReason) {
        noPlanCount++;
      }
    }

    const filledPct = p.totalMc > 0 ? Math.round((filledCount / p.totalMc) * 100) + "%" : "0%";
    const prodStr = totalProd.toLocaleString("en-IN");

    console.log(`${dayLabel}\t${prodStr}\t${p.totalMc}\t${noPlanCount}\t${filledCount}\t${filledPct}`);
  }
}
