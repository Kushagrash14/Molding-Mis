import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  SEED_MASTER,
  MACHINES,
  SHIFTS,
  LOCATIONS,
  PLANTS,
  REASON_CODES,
  USERS,
} from "../src/data/seedData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "cloud_store.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let store = null;

function getInitialStore() {
  return {
    version: 1,
    last_updated: new Date().toISOString(),
    users: [...USERS],
    master: [...SEED_MASTER],
    machines: [...MACHINES],
    shifts: [...SHIFTS],
    locations: [...LOCATIONS],
    plants: [...PLANTS],
    reasonCodes: [...REASON_CODES],
    entries: [],
    auditLog: [],
  };
}

function sanitizeUnlockedWindowEntries(entriesList) {
  if (!Array.isArray(entriesList)) return false;
  let modified = false;
  for (const e of entriesList) {
    if (e.shift_date >= "2026-09-01" && e.shift_date <= "2026-09-22") {
      if (e.status === "locked") {
        e.status = "submitted";
        e.locked_at = null;
        modified = true;
      }
    }
  }
  return modified;
}

function loadStore() {
  if (store) return store;

  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      store = {
        ...getInitialStore(),
        ...parsed,
      };
      // Ensure seed accounts exist
      for (const su of USERS) {
        if (!store.users.some((u) => u.id === su.id || u.email?.toLowerCase() === su.email?.toLowerCase())) {
          store.users.push(su);
        }
      }
      // Unlock any entries in the 1 Sep - 22 Sep 2026 window
      if (sanitizeUnlockedWindowEntries(store.entries)) {
        saveStore();
      }
      return store;
    } catch (err) {
      console.error("[CLOUD STORE] Error reading store, initializing fresh:", err.message);
    }
  }

  store = getInitialStore();
  saveStore();
  return store;
}

function saveStore() {
  if (!store) return;
  store.last_updated = new Date().toISOString();
  try {
    const tempFile = `${STORE_FILE}.tmp_${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.error("[CLOUD STORE] Failed to write store file:", err.message);
  }
}

export const cloudStorage = {
  getBootstrap() {
    const s = loadStore();
    return {
      users: s.users,
      master: s.master,
      machines: s.machines,
      shifts: s.shifts,
      locations: s.locations,
      plants: s.plants,
      reasonCodes: s.reasonCodes,
      entries: s.entries,
      auditLog: s.auditLog,
    };
  },

  getUsers() {
    return loadStore().users;
  },

  saveUser(userData) {
    const s = loadStore();
    const cleanEmail = (userData.email || "").trim().toLowerCase();
    const cleanUsername = (userData.username || cleanEmail.split("@")[0] || `user_${Date.now()}`).trim();
    const cleanEmpCode = (userData.employee_code || "").trim();

    const existingIndex = s.users.findIndex(
      (u) =>
        u.id === userData.id ||
        (cleanEmail && u.email?.toLowerCase() === cleanEmail) ||
        (cleanEmpCode && u.employee_code?.toLowerCase() === cleanEmpCode.toLowerCase())
    );

    const userObj = {
      id: userData.id || `u_${Date.now()}`,
      username: cleanUsername,
      email: cleanEmail,
      employee_code: cleanEmpCode,
      name: userData.name || cleanUsername,
      role: userData.role || "operator",
      department: userData.department || "",
      assigned_location_id: userData.assigned_location_id || "all",
      assigned_location_ids: userData.assigned_location_ids || ["all"],
      assigned_plant_ids: userData.assigned_plant_ids || ["1040"],
      created_at: userData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      s.users[existingIndex] = { ...s.users[existingIndex], ...userObj };
    } else {
      s.users.push(userObj);
    }

    saveStore();
    console.log(`[CLOUD STORE] Saved user on AWS: ${userObj.name} (${userObj.email})`);
    return userObj;
  },

  deleteUser(userId) {
    const s = loadStore();
    if (userId === "u_admin") {
      throw new Error("Cannot delete primary system administrator");
    }
    const initialLen = s.users.length;
    s.users = s.users.filter((u) => u.id !== userId && u.username !== userId);
    if (s.users.length !== initialLen) {
      saveStore();
      console.log(`[CLOUD STORE] Deleted user on AWS: ${userId}`);
      return true;
    }
    return false;
  },

  getEntries() {
    return loadStore().entries;
  },

  saveEntry(entry) {
    const s = loadStore();
    if (!entry.entry_id) {
      entry.entry_id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    // Special window rule: 1 Sep to 22 Sep 2026 entries are never locked
    if (entry.shift_date >= "2026-09-01" && entry.shift_date <= "2026-09-22") {
      entry.status = "submitted";
      entry.locked_at = null;
    }

    const idx = s.entries.findIndex((e) => e.entry_id === entry.entry_id);
    const updatedEntry = {
      ...entry,
      updated_at: new Date().toISOString(),
    };

    if (idx >= 0) {
      s.entries[idx] = updatedEntry;
    } else {
      s.entries.unshift(updatedEntry);
    }

    saveStore();
    return updatedEntry;
  },

  saveEntriesBatch(entriesList) {
    const s = loadStore();
    if (!Array.isArray(entriesList)) return [];

    const processed = [];
    for (const entry of entriesList) {
      if (!entry.entry_id) {
        entry.entry_id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      }
      if (entry.shift_date >= "2026-09-01" && entry.shift_date <= "2026-09-22") {
        entry.status = "submitted";
        entry.locked_at = null;
      }
      const idx = s.entries.findIndex((e) => e.entry_id === entry.entry_id);
      const updatedEntry = {
        ...entry,
        updated_at: new Date().toISOString(),
      };
      if (idx >= 0) {
        s.entries[idx] = updatedEntry;
      } else {
        s.entries.unshift(updatedEntry);
      }
      processed.push(updatedEntry);
    }

    saveStore();
    console.log(`[CLOUD STORE] Batch saved ${processed.length} entries on AWS Cloud`);
    return processed;
  },

  deleteEntry(entryId) {
    const s = loadStore();
    const initialLen = s.entries.length;
    s.entries = s.entries.filter((e) => e.entry_id !== entryId);
    if (s.entries.length !== initialLen) {
      saveStore();
      console.log(`[CLOUD STORE] Deleted entry on AWS: ${entryId}`);
      return true;
    }
    return false;
  },

  saveProduct(product) {
    const s = loadStore();
    const cleanSap = (product.sap_code || "").trim();
    if (!cleanSap) throw new Error("SAP code is required");

    const idx = s.master.findIndex((p) => p.sap_code === cleanSap);
    const prodObj = {
      ...product,
      sap_code: cleanSap,
      plant_id: product.plant_id || "1040",
      updated_at: new Date().toISOString(),
    };

    if (idx >= 0) {
      s.master[idx] = prodObj;
    } else {
      s.master.push(prodObj);
    }

    saveStore();
    return prodObj;
  },

  deleteProduct(sap_code) {
    const s = loadStore();
    const initialLen = s.master.length;
    s.master = s.master.filter((p) => p.sap_code !== sap_code);
    if (s.master.length !== initialLen) {
      saveStore();
      return true;
    }
    return false;
  },

  saveMachine(machine) {
    const s = loadStore();
    const cleanId = (machine.machine_id || "").trim().toUpperCase();
    if (!cleanId) throw new Error("Machine ID is required");

    const idx = s.machines.findIndex((m) => m.machine_id === cleanId);
    const machineObj = {
      ...machine,
      machine_id: cleanId,
      plant_id: machine.plant_id || "1040",
      updated_at: new Date().toISOString(),
    };

    if (idx >= 0) {
      s.machines[idx] = machineObj;
    } else {
      s.machines.push(machineObj);
    }

    saveStore();
    return machineObj;
  },

  deleteMachine(machineId) {
    const s = loadStore();
    const initialLen = s.machines.length;
    s.machines = s.machines.filter((m) => m.machine_id !== machineId);
    if (s.machines.length !== initialLen) {
      saveStore();
      return true;
    }
    return false;
  },

  addAuditLog(auditEntry) {
    const s = loadStore();
    s.auditLog.unshift({
      id: auditEntry.id || `aud_${Date.now()}`,
      action: auditEntry.action || "UPDATE",
      summary: auditEntry.summary || "System action",
      changed_by: auditEntry.changed_by || "u_admin",
      changed_by_name: auditEntry.changed_by_name || "Admin",
      changed_at: new Date().toISOString(),
    });
    if (s.auditLog.length > 500) {
      s.auditLog = s.auditLog.slice(0, 500);
    }
    saveStore();
  },
};
