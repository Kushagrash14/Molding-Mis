// Family molds from MULTI CAVITY ALL PART.xlsx.
// 1+1 means two different parts, one cavity each. 2+2 means two parts, two cavities each.
// A mold is applied only when every part in the family exists in that plant's master.

export const FAMILY_PLANTS = ["1040", "2020", "4010"];

const PGEL = ["1040"];
const one = (a, b) => ({
  plants: PGEL,
  manual: true,
  combo: "1+1",
  parts: [{ sap: a, cavity: 1 }, { sap: b, cavity: 1 }],
});
const lone = (sap) => ({ plants: PGEL, manual: true, combo: "1+1", parts: [{ sap, cavity: 1 }] });

const PGEL_PUNE_11 = [
  one("9010003780", "9010003781"),
  one("9010002960", "9010002961"),
  one("9010003059", "9010003060"),
  one("9010001159", "9010001167"),
  one("9010002483", "9010002484"),
  one("9010001158", "9010001166"),
  one("9010003852", "9010003853"),
  one("9010001101", "9010001111"),
  one("9010002475", "9010002476"),
  one("9010001177", "9010001106"),
  one("9010002481", "9010002482"),
  one("9010001104", "9010001105"),
  one("9010003789", "9010003790"),
  one("9010001120", "9010001121"),
  one("7010003523", "7010003524"),
  one("9010001267", "9010001271"),
  one("9010002962", "9010002963"),
  one("9010002964", "9010002965"),
  one("9010003961", "9010003962"),
  one("9010002477", "9010002478"),
  one("9010001069", "9010001089"),
  one("9010001075", "9010001077"),
  one("9010002958", "9010002959"),
  one("9010002956", "9010002957"),
  one("9010001024", "9010001025"),
  one("9010001034", "9010001035"),
  one("9010001036", "9010001037"),
  one("9010002518", "9010002519"),
  one("9010003063", "9010003062"),
  one("9010002645", "9010002644"),
  one("9010000215", "9010000216"),
  one("9010000957", "9010000958"),
  one("9010002984", "9010002985"),
  one("9010003784", "9010003785"),
  one("9010003739", "9010003740"),
  one("9010000964", "9010000971"),
  one("9010000965", "9010000972"),
  one("9010000966", "9010000973"),
  one("9010001225", "9010001226"),
  one("9010002526", "9010002527"),
  one("9010002528", "9010002529"),
  one("9010001239", "9010001240"),
  one("9010003782", "9010003783"),
  one("9010003786", "9010003787"),
  one("9010000920", "9010000925"),
  one("9010000936", "9010000937"),
  one("9010000873", "9010000874"),
  one("9010003097", "9010003098"),
  one("9010000404", "9010000406"),
  one("9010000397", "9010000398"),
  one("9010000399", "9010000405"),
  one("9010000400", "9010000401"),
  one("9010000402", "9010000403"),
  one("9010000408", "9010000555"),
  one("9010002938", "9010002939"),
  lone("9010002942"),
  lone("7010003077"),
  lone("9010000601"),
  lone("9010003804"),
  lone("9010003805"),
  lone("9010002648"),
  lone("9010002646"),
  lone("9010000571"),
  lone("9010002647"),
  lone("9010002651"),
  lone("9010000572"),
  lone("9010002650"),
];

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
  ...PGEL_PUNE_11,
];

export function familyInPlant(master, sapCode, plantId) {
  const sap = String(sapCode || "").trim();
  const pid = String(plantId || "1040");
  if (!FAMILY_PLANTS.includes(pid) || !sap || !Array.isArray(master)) return null;
  const group = FAMILY_MOLDS.find(
    (g) => (!g.plants || g.plants.includes(pid)) && g.parts.some((p) => p.sap === sap)
  );
  if (!group) return null;
  const present = [];
  for (const part of group.parts) {
    const row = master.find(
      (m) => String(m.sap_code) === part.sap && String(m.plant_id || "1040") === pid
    );
    if (!row) {
      if (group.manual) continue;
      return null;
    }
    present.push({ sap: part.sap, cavity: part.cavity, product: row });
  }
  if (!present.some((p) => p.sap === sap)) return null;
  const combo = group.combo || present.map((p) => p.cavity).join("+");
  const pieceFactor = group.combo
    ? group.combo.split("+").reduce((s, n) => s + (Number(n) || 0), 0)
    : present.reduce((s, p) => s + p.cavity, 0);
  return {
    combo,
    parts: group.manual ? present.filter((p) => p.sap === sap) : present,
    pieceFactor,
    manual: Boolean(group.manual),
  };
}

export function withFamilyRun(fields, master, plantId) {
  const fam = familyInPlant(master, fields?.sap_code, plantId);
  if (!fam) return fields;
  const selected = String(fields.sap_code);
  if (fam.manual) {
    const known = fam.parts.find((p) => p.sap === selected) || fam.parts[0];
    const prod = known?.product;
    return {
      ...fields,
      std_cavity: fam.pieceFactor,
      running_cavity: fam.pieceFactor,
      is_multi_cavity: true,
      cavity_parts: [
        {
          cavity_no: 1,
          sap_code: selected,
          material_description: prod?.material_description || fields.material_description || "",
          part_no: prod?.part_no || fields.part_no || "",
          cavity: 1,
          ok_prod: fields.ok_prod ?? "",
          reasons: {},
        },
        {
          cavity_no: 2,
          sap_code: "",
          material_description: "",
          part_no: "",
          cavity: 1,
          ok_prod: "",
          reasons: {},
        },
      ],
    };
  }
  if (fam.parts.length < 2) return fields;
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
      if (group.plants && !group.plants.includes(pid)) continue;
      if (group.manual) {
        const combo = group.combo || "1+1";
        group.parts.forEach((p) => {
          const row = master.find(
            (m) => String(m.sap_code) === p.sap && String(m.plant_id || "1040") === pid
          );
          if (!row) return;
          const same = Number(row.cavity) === p.cavity && row.mold_combo === combo && row.manual_family;
          if (same) return;
          row.cavity = p.cavity;
          row.mold_combo = combo;
          row.family_saps = [p.sap];
          row.manual_family = true;
          changed++;
        });
        continue;
      }
      const rows = group.parts.map((p) =>
        master.find((m) => String(m.sap_code) === p.sap && String(m.plant_id || "1040") === pid)
      );
      if (rows.some((r) => !r)) continue;
      const combo = group.combo || group.parts.map((p) => p.cavity).join("+");
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
