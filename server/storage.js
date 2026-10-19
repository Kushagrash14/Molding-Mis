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
import { applyFamilyMoldsToMaster } from "../src/data/familyMolds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "cloud_store.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let store = null;
let storeMtime = 0;

const LEGACY_PLANT_IDS = {
  "PLANT-U01": "1040",
  "PLANT-U02": "1040",
  "PLANT-U03": "1040",
};

function normalizeEntryIdentity(entry) {
  if (!entry || typeof entry !== "object") return false;
  let changed = false;
  const rawPlant = String(entry.plant_id || "1040");
  const plantId = LEGACY_PLANT_IDS[rawPlant] || rawPlant;
  const shiftDate = String(entry.shift_date || "").slice(0, 10);
  const shiftId = String(entry.shift_id || "");
  if (entry.plant_id !== plantId) {
    entry.plant_id = plantId;
    changed = true;
  }
  if (shiftDate && entry.shift_date !== shiftDate) {
    entry.shift_date = shiftDate;
    changed = true;
  }
  if (shiftId && entry.shift_id !== shiftId) {
    entry.shift_id = shiftId;
    changed = true;
  }
  return changed;
}

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
    accessRequests: [],
  };
}

function sanitizeUnlockedWindowEntries(entriesList) {
  if (!Array.isArray(entriesList)) return false;
  let modified = false;
  for (const e of entriesList) {
    const shiftDay = String(e.shift_date || "").slice(0, 10);
    if (shiftDay >= "2026-10-01" && shiftDay <= "2026-10-16") {
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
  if (store && fs.existsSync(STORE_FILE)) {
    const stat = fs.statSync(STORE_FILE);
    if (stat.mtimeMs === storeMtime) return store;
    store = null;
  }

  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      storeMtime = fs.statSync(STORE_FILE).mtimeMs;
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

      let storeModified = false;

      // Ensure seed locations exist (e.g. LOC-NOI) and prune legacy locations (e.g. LOC-GN)
      if (!Array.isArray(store.locations)) {
        store.locations = [...LOCATIONS];
        storeModified = true;
      } else {
        for (const sl of LOCATIONS) {
          if (!store.locations.some((l) => l.location_id === sl.location_id)) {
            store.locations.push(sl);
            storeModified = true;
            console.log(`[CLOUD STORE] Added new seed location: ${sl.name} (${sl.location_id})`);
          }
        }
        const validLocIds = new Set(LOCATIONS.map((l) => l.location_id));
        const prevLocLen = store.locations.length;
        store.locations = store.locations.filter((l) => validLocIds.has(l.location_id));
        if (store.locations.length !== prevLocLen) {
          storeModified = true;
          console.log(`[CLOUD STORE] Pruned ${prevLocLen - store.locations.length} legacy locations.`);
        }
      }

      // Ensure seed plants exist (e.g. NGM 4010, NGM 4020, DMIC Noida 2060)
      for (const sp of PLANTS) {
        if (!store.plants.some((p) => p.plant_id === sp.plant_id)) {
          store.plants.push(sp);
          storeModified = true;
          console.log(`[CLOUD STORE] Added new seed plant: ${sp.name} (${sp.plant_id})`);
        }
      }

      // Prune legacy/removed plants (e.g. PLANT-U01, PLANT-U02)
      const validPlantIds = new Set(PLANTS.map((p) => p.plant_id));
      const prevPlantLen = store.plants.length;
      store.plants = store.plants.filter((p) => validPlantIds.has(p.plant_id));
      if (store.plants.length !== prevPlantLen) {
        storeModified = true;
        console.log(`[CLOUD STORE] Pruned ${prevPlantLen - store.plants.length} legacy plants.`);
      }

      // Ensure seed machines exist
      for (const sm of MACHINES) {
        if (!store.machines.some((m) => m.machine_id === sm.machine_id)) {
          store.machines.push(sm);
          storeModified = true;
        }
      }

      // Ensure seed reason codes exist (e.g. pdt_no_plan)
      for (const sr of REASON_CODES) {
        if (!store.reasonCodes.some((r) => r.reason_id === sr.reason_id)) {
          store.reasonCodes.push(sr);
          storeModified = true;
        }
      }

      // Ensure seed master products exist and sync updated part_wt
      const existingMasterMap = new Map(
        store.master.map((m) => [`${m.plant_id || "1040"}_${m.sap_code}`, m])
      );
      let newMasterAdded = 0;
      let masterUpdated = 0;
      for (const sm of SEED_MASTER) {
        const key = `${sm.plant_id || "1040"}_${sm.sap_code}`;
        const existing = existingMasterMap.get(key);
        if (!existing) {
          store.master.push(sm);
          existingMasterMap.set(key, sm);
          newMasterAdded++;
        } else if (existing.part_wt === 1 && sm.part_wt && sm.part_wt !== 1) {
          existing.part_wt = sm.part_wt;
          if (sm.material_description && !existing.material_description) {
            existing.material_description = sm.material_description;
          }
          masterUpdated++;
        }
      }
      if (newMasterAdded > 0 || masterUpdated > 0) {
        console.log(`[CLOUD STORE] Synced ${newMasterAdded} new and ${masterUpdated} updated master products from seed data into cloud store.`);
        storeModified = true;
      }

      if (storeModified) {
        saveStore();
      }

      const familyUpdated = applyFamilyMoldsToMaster(store.master);
      if (familyUpdated > 0) {
        console.log(`[CLOUD STORE] Updated ${familyUpdated} master rows for 1+1 / 2+2 family molds.`);
        saveStore();
      }

      if (!Array.isArray(store.accessRequests)) {
        store.accessRequests = [];
        saveStore();
      }

      if (Array.isArray(store.entries)) {
        for (const entry of store.entries) {
          if (normalizeEntryIdentity(entry)) storeModified = true;
        }
      }

      // Unlock every entry from 1 Oct through 16 Oct 2026
      if (sanitizeUnlockedWindowEntries(store.entries)) {
        storeModified = true;
      }
      if (storeModified) saveStore();
      return store;
    } catch (err) {
      console.error("[CLOUD STORE] Existing store could not be read. It was NOT replaced:", err.message);
      if (store) return store;
      throw err;
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
    if (fs.existsSync(STORE_FILE)) {
      fs.copyFileSync(STORE_FILE, `${STORE_FILE}.bak`);
    }
    const tempFile = `${STORE_FILE}.tmp_${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempFile, STORE_FILE);
    storeMtime = fs.statSync(STORE_FILE).mtimeMs;
  } catch (err) {
    console.error("[CLOUD STORE] Failed to write store file:", err.message);
    throw err;
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
      accessRequests: s.accessRequests || [],
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

    normalizeEntryIdentity(entry);
    // 1 Oct through 16 Oct 2026 entries are never locked
    const shiftDay = String(entry.shift_date || "").slice(0, 10);
    if (shiftDay >= "2026-10-01" && shiftDay <= "2026-10-16") {
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
      normalizeEntryIdentity(entry);
      const shiftDay = String(entry.shift_date || "").slice(0, 10);
      if (shiftDay >= "2026-10-01" && shiftDay <= "2026-10-16") {
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

    const plantId = String(product.plant_id || "1040");
    const idx = s.master.findIndex((p) => p.sap_code === cleanSap && String(p.plant_id || "1040") === plantId);
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

  deleteProduct(sap_code, plantId) {
    const s = loadStore();
    const initialLen = s.master.length;
    s.master = s.master.filter((p) => !(p.sap_code === sap_code && String(p.plant_id || "1040") === String(plantId || "")));
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

  listAccessRequests() {
    return loadStore().accessRequests || [];
  },

  createAccessRequest(body) {
    const s = loadStore();
    if (!Array.isArray(s.accessRequests)) s.accessRequests = [];
    const dates = Array.isArray(body.dates) ? [...new Set(body.dates.map((d) => String(d).slice(0, 10)))].filter(Boolean).sort() : [];
    if (!body.requested_by || dates.length === 0) {
      throw new Error("Operator and at least one date are required.");
    }
    if (dates.length > 31) throw new Error("Request at most 31 days at a time.");
    const pending = s.accessRequests.find(
      (r) => r.status === "pending" && r.requested_by === body.requested_by && r.plant_id === (body.plant_id || "1040")
    );
    if (pending) throw new Error("You already have a pending request. Wait for the Plant Head.");
    const request = {
      id: `req_${Date.now()}`,
      plant_id: body.plant_id || "1040",
      requested_by: body.requested_by,
      requested_by_name: body.requested_by_name || "Operator",
      dates,
      note: String(body.note || "").slice(0, 300),
      status: "pending",
      created_at: new Date().toISOString(),
      decided_by: null,
      decided_by_name: null,
      decided_at: null,
      unlock_until: null,
    };
    s.accessRequests.unshift(request);
    saveStore();
    return request;
  },

  decideAccessRequest(id, { approve, decided_by, decided_by_name }) {
    const s = loadStore();
    const request = (s.accessRequests || []).find((r) => r.id === id);
    if (!request) throw new Error("Request not found.");
    if (request.status !== "pending") throw new Error("This request is already decided.");
    request.status = approve ? "approved" : "rejected";
    request.decided_by = decided_by || null;
    request.decided_by_name = decided_by_name || null;
    request.decided_at = new Date().toISOString();
    request.unlock_until = approve ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    saveStore();
    return request;
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
