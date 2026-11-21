import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FAMILY_MOLDS, familyInPlant, applyFamilyMoldsToMaster } from '../../src/data/familyMolds.js';
import { PLANT_MASTER_UPDATES } from '../../src/data/plantMasterUpdates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const parsed = JSON.parse(fs.readFileSync(path.join(rootDir, 'server/scripts/parsed_user_molds.json'), 'utf8'));
const store = JSON.parse(fs.readFileSync(path.join(rootDir, 'server/data/cloud_store.json'), 'utf8'));

console.log('--- RUNNING FULL VERIFICATION ---');

// 1. Test applyFamilyMoldsToMaster
const familyChanges = applyFamilyMoldsToMaster(store.master);
console.log(`applyFamilyMoldsToMaster changed: ${familyChanges} rows.`);

const pgelMaster = store.master.filter(m => String(m.plant_id || '1040') === '1040');
const pgelMap = new Map(pgelMaster.map(m => [String(m.sap_code).trim(), m]));

// Map unique SAPs from parsed
const uniqueParsed = new Map();
parsed.forEach(p => {
  uniqueParsed.set(p.sap_code, p);
});

console.log(`Total unique SAPs to verify: ${uniqueParsed.size}`);

let errors = 0;
uniqueParsed.forEach((expected, sap) => {
  const actual = pgelMap.get(sap);
  if (!actual) {
    console.error(`[ERROR] SAP ${sap} not found in PGEL master!`);
    errors++;
    return;
  }
  // Check shots_per_hour
  if (actual.shots_per_hour !== expected.shots_per_hour) {
    console.error(`[MISMATCH] SAP ${sap} shots_per_hour: expected ${expected.shots_per_hour}, got ${actual.shots_per_hour}`);
    errors++;
  }
  // Check mold_combo
  if (actual.mold_combo !== expected.cavityCombo) {
    console.error(`[MISMATCH] SAP ${sap} mold_combo: expected ${expected.cavityCombo}, got ${actual.mold_combo}`);
    errors++;
  }
  // Check price
  if (actual.price !== expected.price) {
    console.error(`[MISMATCH] SAP ${sap} price: expected ${expected.price}, got ${actual.price}`);
    errors++;
  }
  // Check part_wt
  if (actual.part_wt !== expected.part_wt) {
    console.error(`[MISMATCH] SAP ${sap} part_wt: expected ${expected.part_wt}, got ${actual.part_wt}`);
    errors++;
  }
  // Check manpower
  if (actual.manpower !== expected.manpower) {
    console.error(`[MISMATCH] SAP ${sap} manpower: expected ${expected.manpower}, got ${actual.manpower}`);
    errors++;
  }
  // Check familyInPlant
  const fam = familyInPlant(store.master, sap, '1040');
  if (!fam) {
    console.error(`[MISMATCH] SAP ${sap} familyInPlant returned null!`);
    errors++;
  } else if (fam.combo !== expected.cavityCombo) {
    console.error(`[MISMATCH] SAP ${sap} familyInPlant combo: expected ${expected.cavityCombo}, got ${fam.combo}`);
    errors++;
  }
});

if (errors === 0) {
  console.log(`\nSUCCESS: All ${uniqueParsed.size} unique PGEL parts passed 100% of checks with ZERO errors!`);
  console.log('Sample verified rows:');
  Array.from(uniqueParsed.values()).slice(0, 10).forEach(p => {
    const row = pgelMap.get(p.sap_code);
    const ct = (3600 / row.shots_per_hour).toFixed(1);
    console.log(`- SAP: ${row.sap_code} | Desc: ${row.material_description} | Cavity: ${row.mold_combo} | Shots/hr: ${row.shots_per_hour} (CT: ${ct}s) | Price: ₹${row.price} | Wt: ${row.part_wt}kg | Manpower: ${row.manpower}`);
  });
} else {
  console.error(`\nFAILED: Found ${errors} mismatches!`);
  process.exit(1);
}
