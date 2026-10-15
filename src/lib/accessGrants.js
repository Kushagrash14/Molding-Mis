export function datesBetween(start, end) {
  if (!start || !end) return [];
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return [];
  const out = [];
  for (let d = new Date(a); d <= b && out.length < 31; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export function grantCovers(grants, userId, plantId, shiftDate) {
  const day = String(shiftDate || "").slice(0, 10);
  if (!day || !userId) return null;
  const now = Date.now();
  return (
    (grants || []).find(
      (g) =>
        g.status === "approved" &&
        g.requested_by === userId &&
        String(g.plant_id || "1040") === String(plantId || "1040") &&
        g.unlock_until &&
        new Date(g.unlock_until).getTime() > now &&
        (g.dates || []).includes(day)
    ) || null
  );
}

export function pendingForDate(grants, userId, plantId, shiftDate) {
  const day = String(shiftDate || "").slice(0, 10);
  return (grants || []).find(
    (g) =>
      g.status === "pending" &&
      g.requested_by === userId &&
      String(g.plant_id || "1040") === String(plantId || "1040") &&
      (g.dates || []).includes(day)
  );
}
