import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const excelPath = "C:/Users/KUSHAGRA SHARMA/Downloads/DMIC UPDATED MOLDS.xlsx";
const updatesFile = path.resolve("src/data/plantMasterUpdates.js");
const cloudStoreFile = path.resolve("server/data/cloud_store.json");

console.log("Reading Excel from:", excelPath);
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets["Physical stock"];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

const weightsMap = {
  "7010001430": 3.38,
  "7010003483": 0.25,
  "7010003277": 0.65,
  "7010005440": 0.227,
  "7010003293": 0.15,
  "7010003273": 0.12,
  "7010003272": 0.11,
  "7010005433": 0.134,
  "7010001209": 0.15,
  "7010001351": 0.12,
  "7010005404": 0.255,
  "7010005431": 0.55,
  "7010005432": 0.25,
  "7010003274": 0.562,
  "7010001356": 0.55,
  "7010002218": 1.85,
  "7010002258": 4.5,
  "7010003275": 0.657,
  "7010001214": 0.65,
  "7010001530": 0.195,
  "7010001526": 0.195,
  "7010002208": 0.65,
  "7010005754": 0.712,
  "7010005752": 0.65,
  "7010005753": 0.55,
  "7010005810": 0.747,
  "7010005817": 1.25,
  "7010005818": 1.25,
  "7010005816": 1.25,
  "7010005819": 2.85,
  "7010005820": 2.85,
  "7010005821": 2.85,
  "7010005116": 3.5,
};

const cloudStore = JSON.parse(fs.readFileSync(cloudStoreFile, "utf8"));
const existingMaster = cloudStore.master || [];
const existing2060Saps = new Set(
  existingMaster.filter((m) => String(m.plant_id) === "2060").map((m) => String(m.sap_code).trim())
);

console.log("Current 2060 molds in cloud store:", existing2060Saps.size);

const newItems = [];
const seenSaps = new Set();

for (let i = 1; i < raw.length; i++) {
  const r = raw[i];
  if (!r) continue;
  let sap = r[1];
  if (!sap || isNaN(Number(sap))) {
    for (const c of r) {
      if (c && /^[79]\d{9}$/.test(String(c).trim())) {
        sap = c;
        break;
      }
    }
  }
  if (!sap) continue;
  const cleanSap = String(sap).trim();
  if (seenSaps.has(cleanSap)) continue;
  seenSaps.add(cleanSap);

  if (!existing2060Saps.has(cleanSap)) {
    const model = String(r[0] || "").trim() || "DMIC";
    const desc = String(r[4] || "").trim();
    const wt = weightsMap[cleanSap] || 0.5;

    newItems.push({
      sap_code: cleanSap,
      plant_id: "2060",
      part_no: model,
      material_description: desc,
      cavity: 1,
      shots_per_hour: 40,
      price: 1,
      part_wt: wt,
      run_wt: 0,
      manpower: 1,
    });
  }
}

console.log("New items detected to add:", newItems.length);
console.log("Sample new item:", newItems[0]);

// 1. Update cloud_store.json
let addedToStore = 0;
for (const item of newItems) {
  const exists = cloudStore.master.some(
    (m) => String(m.sap_code) === item.sap_code && String(m.plant_id) === "2060"
  );
  if (!exists) {
    cloudStore.master.push(item);
    addedToStore++;
  }
}
fs.writeFileSync(cloudStoreFile, JSON.stringify(cloudStore, null, 2), "utf8");
console.log(`Updated cloud_store.json: added ${addedToStore} items. Total master items now: ${cloudStore.master.length}`);

// 2. Update plantMasterUpdates.js
let updatesContent = fs.readFileSync(updatesFile, "utf8");
const closingIndex = updatesContent.lastIndexOf("];");
if (closingIndex !== -1) {
  const newLines = newItems.map((it) => `  ${JSON.stringify(it)},`).join("\n");
  const before = updatesContent.slice(0, closingIndex).trimEnd();
  const sep = before.endsWith(",") ? "\n" : ",\n";
  const updatedContent = before + sep + newLines + "\n];\n";
  fs.writeFileSync(updatesFile, updatedContent, "utf8");
  console.log(`Updated ${updatesFile} with ${newItems.length} new molds.`);
} else {
  console.error("Could not find closing bracket in plantMasterUpdates.js");
}

// 3. Update seedData.js
import { PLANT_MASTER_UPDATES } from "../../src/data/plantMasterUpdates.js";
const dmicItems = PLANT_MASTER_UPDATES.filter((m) => String(m.plant_id) === "2060");
const seedDataFile = path.resolve("src/data/seedData.js");
let seedContent = fs.readFileSync(seedDataFile, "utf8");
const anchor = "\nexport const MACHINES = [";
const anchorIdx = seedContent.indexOf(anchor);
if (anchorIdx !== -1) {
  const beforeAnchor = seedContent.slice(0, anchorIdx);
  const closingSeedIdx = beforeAnchor.lastIndexOf("];");
  if (closingSeedIdx !== -1) {
    const seedBefore = beforeAnchor.slice(0, closingSeedIdx).trimEnd();
    const sep = seedBefore.endsWith(",") ? "\n" : ",\n";
    const seedLines = dmicItems.map((it) => `  ${JSON.stringify(it)},`).join("\n");
    const updatedSeed = seedBefore + sep + seedLines + "\n];" + seedContent.slice(anchorIdx);
    fs.writeFileSync(seedDataFile, updatedSeed, "utf8");
    console.log(`Updated ${seedDataFile} with ${dmicItems.length} new molds.`);
  }
}


