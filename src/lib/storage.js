// Production state and local cache layer

const STORAGE_KEY = "oee_production_state_v4";

const SENSITIVE_KEYS = ["entries", "users", "auditLog", "master", "machines", "accessRequests"];

export function loadState() {
  try {
    localStorage.removeItem("oee_prototype_state_v2");
    localStorage.removeItem("oee_production_state_v3");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    for (const key of SENSITIVE_KEYS) delete parsed[key];
    return parsed;
  } catch (e) {
    return null;
  }
}

export function saveState(state) {
  try {
    const safe = { ...state };
    for (const key of SENSITIVE_KEYS) delete safe[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch (e) {
    // Storage unavailable (private browsing, quota, etc.) — app still
    // works in-memory for the current session.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("oee_user_session");
  } catch (e) {
    // ignore
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
    // Login is the HttpOnly cookie. Do not keep the account in localStorage.
    localStorage.removeItem(SESSION_KEY);
    if (!user) localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}
