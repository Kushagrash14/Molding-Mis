// Family molds from MULTI CAVITY ALL PART.xlsx.
// 1+1 means two different parts, one cavity each. 2+2 means two parts, two cavities each.
// A mold is applied only when every part in the family exists in that plant's master.

export const FAMILY_PLANTS = ["1040", "2020", "4010"];

export const FAMILY_MOLDS = [
  { parts: [{ sap: "7020000229", cavity: 1 }, { sap: "7020000230", cavity: 1 }] },
  { parts: [{ sap: "7020000888", cavity: 1 }, { sap: "7020000887", cavity: 1 }] },
  { parts: [{ sap: "7020000215", cavity: 1 }, { sap: "7020000216", cavity: 1 }] },
  { parts: [{ sap: "7020000246", cavity: 1 }, { sap: "7020000247", cavity: 1 }] },
  { parts: [{ sap: "7020000907", cavity: 2 }, { sap: "7020000908", cavity: 2 }] },
  { parts: [{ sap: "7020000657", cavity: 1 }, { sap: "7020000659", cavity: 1 }] },
  { parts: [{ sap: "7020000651", cavity: 1 }, { sap: "7020000652", cavity: 1 }] },
  { parts: [{ sap: "702000650", cavity: 2 }, { sap: "702000471", cavity: 2 }] },
  { parts: [{ sap: "7020001243", cavity: 1 }, { sap: "7020001244", cavity: 1 }] },
  { parts: [{ sap: "7020001105", cavity: 1 }, { sap: "7020001106", cavity: 1 }] },
  { parts: [{ sap: "7020001256", cavity: 1 }, { sap: "7020001257", cavity: 1 }] },
  { parts: [{ sap: "7020001818", cavity: 1 }, { sap: "7020001796", cavity: 1 }] },
  { parts: [{ sap: "7020001804", cavity: 2 }, { sap: "7020001805", cavity: 2 }] },
  { parts: [{ sap: "7020001667", cavity: 1 }, { sap: "7020001668", cavity: 1 }] },
  { parts: [{ sap: "7020001736", cavity: 1 }, { sap: "7020001735", cavity: 1 }] },
  { parts: [{ sap: "7020001745", cavity: 1 }, { sap: "7020001744", cavity: 1 }] },
  { parts: [{ sap: "7020001753", cavity: 1 }, { sap: "7020001752", cavity: 1 }, { sap: "7020001751", cavity: 1 }] },
  { parts: [{ sap: "7020001725", cavity: 1 }, { sap: "7020001727", cavity: 1 }] },
  { parts: [{ sap: "7020003754", cavity: 1 }, { sap: "7020003755", cavity: 1 }] },
  { parts: [{ sap: "7020004389", cavity: 1 }, { sap: "7020004390", cavity: 1 }] },
  { parts: [{ sap: "7020004840", cavity: 1 }, { sap: "7020004841", cavity: 1 }] },
  { parts: [{ sap: "7020004850", cavity: 1 }, { sap: "7020004851", cavity: 1 }] },
  { parts: [{ sap: "9010002479", cavity: 1 }, { sap: "9010002480", cavity: 1 }] },
];

export function familyInPlant(master, sapCode, plantId) {
  const sap = String(sapCode || "").trim();
  const pid = String(plantId || "1040");
  if (!FAMILY_PLANTS.includes(pid) || !sap || !Array.isArray(master)) return null;
  const group = FAMILY_MOLDS.find((g) => g.parts.some((p) => p.sap === sap));
  if (!group) return null;
  const present = [];
  for (const part of group.parts) {
    const row = master.find(
      (m) => String(m.sap_code) === part.sap && String(m.plant_id || "1040") === pid
    );
    if (!row) return null;
    present.push({ sap: part.sap, cavity: part.cavity, product: row });
  }
  return {
    combo: present.map((p) => p.cavity).join("+"),
    parts: present,
    pieceFactor: present.reduce((s, p) => s + p.cavity, 0),
  };
}

export function withFamilyRun(fields, master, plantId) {
  const fam = familyInPlant(master, fields?.sap_code, plantId);
  if (!fam) return fields;
  const selected = String(fields.sap_code);
  const cavity_parts = fam.parts.map((p, idx) => ({
    cavity_no: idx + 1,
    sap_code: p.sap,
    material_description: p.product.material_description || "",
    part_no: p.product.part_no || "",
    cavity: p.cavity,
    ok_prod: p.sap === selected ? (fields.ok_prod ?? "") : "",
    reasons: {},
  }));
  return {
    ...fields,
    std_cavity: fam.pieceFactor,
    running_cavity: fam.pieceFactor,
    is_multi_cavity: true,
    cavity_parts,
  };
}

export function applyFamilyMoldsToMaster(master) {
  if (!Array.isArray(master)) return 0;
  let changed = 0;
  for (const pid of FAMILY_PLANTS) {
    for (const group of FAMILY_MOLDS) {
      const rows = group.parts.map((p) =>
        master.find((m) => String(m.sap_code) === p.sap && String(m.plant_id || "1040") === pid)
      );
      if (rows.some((r) => !r)) continue;
      const combo = group.parts.map((p) => p.cavity).join("+");
      const familySaps = group.parts.map((p) => p.sap);
      group.parts.forEach((p, i) => {
        const row = rows[i];
        const sameSaps = Array.isArray(row.family_saps) && row.family_saps.join() === familySaps.join();
        if (Number(row.cavity) === p.cavity && row.mold_combo === combo && sameSaps) return;
        row.cavity = p.cavity;
        row.mold_combo = combo;
        row.family_saps = familySaps;
        changed++;
      });
    }
  }
  return changed;
}
