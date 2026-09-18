// Prototype persistence — browser localStorage only.
//
// This stands in for the Postgres-backed API described in the implementation
// plan (production_entries, audit_log, sap_master tables). Swap loadState /
// saveState for real API calls when wiring this UI up to a backend; every
// component in this project only depends on this module's shape, not on
// localStorage directly, so that swap stays contained to this one file.

const STORAGE_KEY = "oee_production_state_v4";

export function loadState() {
  try {
    // Clear old prototype storage if present
    localStorage.removeItem("oee_prototype_state_v2");
    localStorage.removeItem("oee_production_state_v3");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.master && parsed.master.length < 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage unavailable (private browsing, quota, etc.) — app still
    // works in-memory for the current session.
  }
}

const SESSION_KEY = "oee_user_session";

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveSession(user) {
  try {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    // ignore
  }
}
