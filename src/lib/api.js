const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok" && data.database === "connected";
  } catch (e) {
    return false;
  }
}

export async function fetchBootstrapData() {
  const res = await fetch(`${API_BASE}/bootstrap`);
  if (!res.ok) throw new Error(`Failed to fetch bootstrap data: ${res.statusText}`);
  return await res.json();
}

export async function createEntryApi(entry) {
  const res = await fetch(`${API_BASE}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`Failed to create entry: ${res.statusText}`);
  return await res.json();
}

export async function updateEntryApi(entryId, payload) {
  const res = await fetch(`${API_BASE}/entries/${entryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update entry: ${res.statusText}`);
  return await res.json();
}
