import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  SHIFTS,
  REASON_CODES,
  LOCATIONS,
  PLANTS,
} from "./data/referenceData.js";
import {
  todayStr,
  getProductionShiftDate,
  isShiftEntryLocked,
  getActiveShift,
  isDateInUnlockedWindow,
  presentEntry,
} from "./lib/calculations.js";
import { loadState, saveState, saveSession, clearState } from "./lib/storage.js";
import {
  getUserAccessiblePlants,
  getUserAccessibleLocations,
} from "./lib/permissions.js";

import TopBar from "./components/TopBar.jsx";
import EntryForm from "./components/EntryForm.jsx";
import EntriesTable from "./components/EntriesTable.jsx";
import EditModal from "./components/EditModal.jsx";
import Dashboard from "./components/Dashboard.jsx";
import MasterAdmin from "./components/MasterAdmin.jsx";
import AuditLogView from "./components/AuditLogView.jsx";
import CycleTimeTracker from "./components/CycleTimeTracker.jsx";
import AccessRequests from "./components/AccessRequests.jsx";
import DailyUpdateView from "./components/DailyUpdateView.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import { grantCovers } from "./lib/accessGrants.js";

const TABS_BY_ROLE = {
  operator: [
    ["entry", "New entry"],
    ["mine", "My entries"],
    ["dashboard", "Dashboard"],
  ],
  supervisor: [
    ["browse", "Plant entries"],
    ["dashboard", "Dashboard"],
  ],
  plant_head: [
    ["dashboard", "Dashboard"],
    ["daily_update", "Daily Update"],
    ["cycle", "Cycle Time Tracker"],
    ["browse", "Plant entries"],
    ["requests", "Requests"],
  ],
  admin: [
    ["all", "All entries"],
    ["daily_update", "Daily Update"],
    ["master", "Master data"],
    ["dashboard", "Dashboard"],
    ["cycle", "Cycle Time Tracker"],
    ["audit", "Audit log"],
  ],
};

function defaultTabFor(role) {
  if (role === "operator") return "entry";
  if (role === "supervisor") return "browse";
  if (role === "plant_head") return "dashboard";
  if (role === "admin") return "all";
  return "entry";
}

export default function App() {
  const saved = loadState();

  const [master, setMaster] = useState(() => (Array.isArray(saved?.master) ? saved.master : []));
  const [machines, setMachines] = useState(() => (Array.isArray(saved?.machines) ? saved.machines : []));

  const [shifts, setShifts] = useState(() => {
    const loaded = saved?.shifts;
    // Migrate if missing or legacy defaults (old 8h Shift A with 06:00, or shift_id === "A" / "C")
    if (
      !loaded ||
      !Array.isArray(loaded) ||
      loaded.length === 0 ||
      loaded.some((s) => s.shift_id === "A" || s.shift_id === "C" || (s.start_time === "06:00" && s.end_time === "14:00"))
    ) {
      return SHIFTS;
    }
    return loaded.map((s) => {
      if (!s.start_time || !s.end_time || !s.planned_hours) {
        const seedS = SHIFTS.find((ss) => ss.shift_id === s.shift_id);
        if (seedS) return { ...s, ...seedS };
        return {
          ...s,
          name: s.name || `Shift ${s.shift_id}`,
          start_time: s.start_time || "07:00",
          end_time: s.end_time || "19:00",
          break_mins: s.break_mins || 0,
          planned_hours: s.planned_hours || 12.0,
          code: s.code || `Shift ${s.shift_id} (07:00–19:00 · 12.0h)`,
        };
      }
      return s;
    });
  });

  const [reasonCodes, setReasonCodes] = useState(() => {
    const loaded = saved?.reasonCodes ?? REASON_CODES;
    if (!loaded.some((r) => r.reason_id === "udt_others")) {
      return [
        ...loaded,
        { reason_id: "udt_others", name: "OTHERS", category: "unplanned_dt", unit: "min" },
      ];
    }
    return loaded;
  });

  const [locations, setLocations] = useState(() => {
    const loaded = saved?.locations;
    if (!loaded || loaded.some((l) => l.location_id === "LOC-AHM" || l.name === "Ahmednagar" || l.state)) {
      return LOCATIONS;
    }
    return loaded;
  });

  const [plants, setPlants] = useState(() => {
    const loaded = saved?.plants;
    if (!loaded || !loaded.some((p) => p.plant_id === "1040") || !loaded.some((p) => p.plant_id === "2020") || loaded.some((p) => p.location_id === "LOC-AHM" || p.description)) {
      return PLANTS;
    }
    const currentList = [...loaded];
    PLANTS.forEach((sp) => {
      if (!currentList.some((p) => p.plant_id === sp.plant_id)) {
        currentList.push(sp);
      }
    });
    return currentList;
  });

  const [users, setUsers] = useState(() => (Array.isArray(saved?.users) ? saved.users : []));

  const [selectedPlantId, setSelectedPlantId] = useState(() => {
    if (saved?.selectedPlantId && saved.selectedPlantId !== "PLANT-U01" && saved.selectedPlantId !== "PLANT-U02" && saved.selectedPlantId !== "PLANT-U03") {
      return saved.selectedPlantId;
    }
    return "1040";
  });

  const [selectedShiftDate, setSelectedShiftDate] = useState(() => getProductionShiftDate(shifts));
  const [selectedMonth, setSelectedMonth] = useState(() => (getProductionShiftDate(shifts) || "2026-09-25").slice(0, 7));

  const handleShiftDateChange = (date) => {
    setSelectedShiftDate(date);
    if (date && date.length >= 7) {
      setSelectedMonth(date.slice(0, 7));
    }
  };
  const activeShift = useMemo(() => getActiveShift(shifts), [shifts]);
  const [selectedShiftId, setSelectedShiftId] = useState(
    () => activeShift?.shift_id || shifts[0]?.shift_id || "1"
  );

  const [entries, setEntries] = useState(() => {
    const loaded = saved?.entries ?? [];
    return loaded.map((e) => {
      if (e.plant_id === "PLANT-U01" || e.plant_id === "PLANT-U02" || e.plant_id === "PLANT-U03") {
        return { ...e, plant_id: "1040" };
      }
      return e;
    });
  });
  const [auditLog, setAuditLog] = useState(saved?.auditLog ?? []);
  const [accessRequests, setAccessRequests] = useState([]);

  // Ref to track which machine_ids operator is actively typing in (never overwrite these during sync)
  const dirtyMachinesRef = useRef(new Set());
  const pendingEntryIdsRef = useRef(new Set());
  const confirmedEntryIdsRef = useRef(new Set());

  // Callback passed to EntryForm so it can report dirty machines in real-time
  const handleDirtyChange = useCallback((dirtySet) => {
    dirtyMachinesRef.current = dirtySet;
  }, []);

  
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Calculate accessible plants & locations for the logged-in user
  const accessiblePlants = useMemo(() => {
    return getUserAccessiblePlants(currentUser, plants, locations);
  }, [currentUser, plants, locations]);

  const accessibleLocations = useMemo(() => {
    return getUserAccessibleLocations(currentUser, plants, locations);
  }, [currentUser, plants, locations]);

  // Ensure active plant is within user's accessible scope
  useEffect(() => {
    if (currentUser && accessiblePlants.length > 0) {
      if (!accessiblePlants.some((p) => p.plant_id === selectedPlantId)) {
        setSelectedPlantId(accessiblePlants[0].plant_id);
      }
    }
  }, [currentUser, accessiblePlants, selectedPlantId]);

  // Strictly filter entries visible to currentUser based on assigned plant scope
  const authorizedEntries = useMemo(() => {
    if (!currentUser) return [];
    if (
      currentUser.assigned_plant_ids?.includes("all") ||
      currentUser.assigned_location_id === "all" ||
      (Array.isArray(currentUser.assigned_location_ids) &&
        currentUser.assigned_location_ids.includes("all"))
    ) {
      return entries;
    }
    return entries.filter((e) => accessiblePlants.some((p) => p.plant_id === e.plant_id));
  }, [entries, currentUser, accessiblePlants]);

  const [tab, setTab] = useState("entry");
  const [editing, setEditing] = useState(null);

  // Persist master data, config, and entries to localStorage
  useEffect(() => {
    saveState({
      master,
      machines,
      shifts,
      reasonCodes,
      locations,
      plants,
      selectedPlantId,
      entries,
      auditLog,
      users,
    });
  }, [
    master,
    machines,
    shifts,
    reasonCodes,
    locations,
    plants,
    selectedPlantId,
    entries,
    auditLog,
    users,
  ]);

  // Lock system: any submitted entry outside the eligible shift window (older than 24h standard / 48h weekend grace window) gets locked automatically.
  // Exception: every entry from 1 Oct through 16 Oct 2026 is kept unlocked.
  useEffect(() => {
    setEntries((prev) =>
      prev.map((e) => {
        if (isDateInUnlockedWindow(e.shift_date)) {
          if (e.status === "locked") {
            return { ...e, status: "submitted", locked_at: null };
          }
          return e;
        }
        return e.status === "submitted" && isShiftEntryLocked(e, shifts)
          ? { ...e, status: "locked", locked_at: new Date().toISOString() }
          : e;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts]);

  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        if (data?.user) {
          setCurrentUser(data.user);
          saveSession(data.user);
          setTab(defaultTabFor(data.user.role));
        } else {
          setCurrentUser(null);
          saveSession(null);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        if (!live) return;
        setCurrentUser(null);
        saveSession(null);
        setAuthChecked(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Central AWS Cloud Sync: smart merge — never overwrite rows operator is actively editing
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;

    // Smart merge: cloud data wins ONLY for machines not currently dirty (being typed in)
    function smartMergeEntries(incomingEntries) {
      setEntries((prev) => {
        const dirty = dirtyMachinesRef.current; // Set<machine_id> currently being edited
        const pending = pendingEntryIdsRef.current;
        const confirmed = confirmedEntryIdsRef.current;
        const entryKey = (e) =>
          `${String(e.shift_date || "").slice(0, 10)}__${String(e.shift_id || "")}__${e.machine_id}__${String(e.plant_id || "1040")}`;
        const keepLocal = (localEntry, seen) =>
          !seen.has(entryKey(localEntry)) &&
          (pending.has(localEntry.entry_id) || confirmed.has(localEntry.entry_id));

        const areEntriesIdentical = (a, b) => {
          if (a === b) return true;
          if (!a || !b) return false;
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            const ai = a[i];
            const bi = b[i];
            if (ai.entry_id !== bi.entry_id) return false;
            if (ai.updated_at !== bi.updated_at) return false;
            if (ai.status !== bi.status) return false;
            if (ai.ok_prod !== bi.ok_prod) return false;
            if (ai.run_hour !== bi.run_hour) return false;
            if (ai.total_rej !== bi.total_rej) return false;
          }
          return true;
        };

        if (!dirty || dirty.size === 0) {
          const cloud = incomingEntries.map(presentEntry);
          const seen = new Set(cloud.map(entryKey));
          for (const localEntry of prev) {
            if (keepLocal(localEntry, seen)) cloud.push(localEntry);
          }
          if (areEntriesIdentical(prev, cloud)) return prev;
          return cloud;
        }
        // Build a map of current local entries for fast lookup
        const localMap = new Map(prev.map((e) => [e.entry_id, e]));
        const result = [];
        const handled = new Set();

        // Process cloud entries
        for (const cloudEntry of incomingEntries) {
          const key = entryKey(cloudEntry);
          if (dirty.has(cloudEntry.machine_id)) {
            // Operator is actively editing this machine → keep local version
            const localVer = localMap.get(cloudEntry.entry_id) ||
              prev.find(
                (e) =>
                  e.machine_id === cloudEntry.machine_id &&
                  e.shift_date === cloudEntry.shift_date &&
                  e.shift_id === cloudEntry.shift_id &&
                  (e.plant_id || "1040") === (cloudEntry.plant_id || "1040")
              );
            result.push(presentEntry(localVer || cloudEntry));
          } else {
            // Not dirty → cloud is authoritative (another PC may have submitted this)
            result.push(presentEntry(cloudEntry));
          }
          handled.add(key);
        }

        // Preserve any purely local entries (dirty rows not yet on cloud for today)
        for (const localEntry of prev) {
          const key = entryKey(localEntry);
          if (!handled.has(key) && (dirty.has(localEntry.machine_id) || pending.has(localEntry.entry_id) || confirmed.has(localEntry.entry_id))) {
            result.push(localEntry);
          }
        }

        if (areEntriesIdentical(prev, result)) return prev;
        return result;
      });
    }

    let lastSyncTime = 0;
    async function syncFromCloud(force = false) {
      if (!force && Date.now() - lastSyncTime < 10000) return;
      lastSyncTime = Date.now();
      try {
        const res = await fetch("/api/bootstrap");
        if (res.status === 401) {
          setCurrentUser(null);
          saveSession(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
          saveSession(data.currentUser);
        }

        // Fast O(1) sample-compare helper: avoid heavy JSON.stringify on thousands of master rows
        const stableSet = (setter, newData) => {
          setter((prev) => {
            if (prev === newData) return prev;
            if (!prev || !newData) return newData;
            if (Array.isArray(prev) && Array.isArray(newData)) {
              if (prev.length !== newData.length) return newData;
              if (prev.length === 0) return prev;
              const mid = Math.floor(prev.length / 2);
              for (const idx of [0, mid, prev.length - 1]) {
                const p = prev[idx];
                const n = newData[idx];
                if (!p || !n) return newData;
                const pk = p.id || p.sap_code || p.machine_id || p.plant_id || p.shift_id;
                const nk = n.id || n.sap_code || n.machine_id || n.plant_id || n.shift_id;
                if (pk !== nk) return newData;
                if (p.updated_at !== n.updated_at) return newData;
              }
              return prev;
            }
            return newData;
          });
        };

        if (Array.isArray(data.users) && data.users.length > 0) {
          stableSet(setUsers, data.users);
        }
        if (Array.isArray(data.entries)) {
          smartMergeEntries(data.entries);
        }
        if (Array.isArray(data.master) && data.master.length > 0) {
          stableSet(setMaster, data.master);
        }
        if (Array.isArray(data.machines) && data.machines.length > 0) {
          stableSet(setMachines, data.machines);
        }
        if (Array.isArray(data.shifts) && data.shifts.length > 0) {
          stableSet(setShifts, data.shifts);
        }
        if (Array.isArray(data.plants) && data.plants.length > 0) {
          stableSet(setPlants, data.plants);
        }
        if (Array.isArray(data.locations) && data.locations.length > 0) {
          stableSet(setLocations, data.locations);
        }
        if (Array.isArray(data.reasonCodes) && data.reasonCodes.length > 0) {
          stableSet(setReasonCodes, data.reasonCodes);
        }
        if (Array.isArray(data.auditLog)) {
          stableSet(setAuditLog, data.auditLog);
        }
        if (Array.isArray(data.accessRequests)) {
          stableSet(setAccessRequests, data.accessRequests);
        }
      } catch (err) {
        console.log("Cloud sync silent fallback to cache:", err.message);
      }
    }

    syncFromCloud(true);
    const interval = setInterval(() => syncFromCloud(false), 30000);
    const handleFocus = () => syncFromCloud(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  function handleLogin(user) {
    setCurrentUser(user);
    saveSession(user);
    setTab(defaultTabFor(user.role));
  }

  function handleLogout() {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearState();
    setCurrentUser(null);
    saveSession(null);
    setTab("entry");
  }

  function addEntry(entry) {
    const entryToSave = {
      ...entry,
      entry_id: entry.entry_id || `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      plant_id: String(entry.plant_id || selectedPlantId || "1040"),
      shift_id: String(entry.shift_id || ""),
      shift_date: String(entry.shift_date || "").slice(0, 10),
      updated_at: new Date().toISOString(),
    };
    pendingEntryIdsRef.current.add(entryToSave.entry_id);

    setEntries((prev) => {
      const idx = prev.findIndex(
        (e) =>
          e.entry_id === entryToSave.entry_id ||
          (e.shift_date === entryToSave.shift_date &&
            e.shift_id === entryToSave.shift_id &&
            e.machine_id === entryToSave.machine_id &&
            (!entryToSave.plant_id || e.plant_id === entryToSave.plant_id))
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...entryToSave, entry_id: prev[idx].entry_id };
        return next;
      }
      return [entryToSave, ...prev];
    });

    return fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entryToSave),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.entry) {
          throw new Error(data.error || "Server did not save this entry.");
        }
        pendingEntryIdsRef.current.delete(entryToSave.entry_id);
        confirmedEntryIdsRef.current.add(data.entry.entry_id || entryToSave.entry_id);
        setEntries((prev) =>
          prev.map((e) => (e.entry_id === entryToSave.entry_id ? data.entry : e))
        );
        return data.entry;
      })
      .catch((err) => {
        console.error("Cloud save entry error:", err);
        throw err;
      });
  }

  function runLockJob() {
    let count = 0;
    setEntries((prev) =>
      prev.map((e) => {
        if (isDateInUnlockedWindow(e.shift_date)) {
          if (e.status === "locked") {
            return { ...e, status: "submitted", locked_at: null };
          }
          return e;
        }
        if (e.status === "submitted" && isShiftEntryLocked(e, shifts)) {
          count++;
          return { ...e, status: "locked", locked_at: new Date().toISOString() };
        }
        return e;
      })
    );
    alert(
      count > 0
        ? `${count} historical entry(ies) past shift cutoff grace window (24h standard / 48h Saturday) locked.`
        : "All submitted entries are within active shift, grace window (24h standard / 48h Saturday), or the 1–16 Oct unlocked window."
    );
  }

  function saveEdit(original, updated) {
    setEntries((prev) => prev.map((e) => (e.entry_id === original.entry_id ? updated : e)));
    let auditObj = null;
    if (original.status === "locked") {
      auditObj = {
        id: "A-" + Date.now(),
        entry_id: original.entry_id,
        action: "update",
        summary: `Admin edited locked entry ${original.entry_id} (${original.sap_code}, ${original.shift_date}) — OK prod ${original.ok_prod} → ${updated.ok_prod}, run hour ${original.run_hour} → ${updated.run_hour}`,
        changed_by: currentUser.id,
        changed_by_name: currentUser.name,
        changed_at: new Date().toISOString(),
      };
      setAuditLog((prev) => [auditObj, ...prev]);
    }
    setEditing(null);

    // Save directly to AWS Cloud
    fetch(`/api/entries/${original.entry_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updated, auditEntry: auditObj }),
    }).catch((err) => console.error("Cloud update entry error:", err));
  }

  async function submitAccessRequest(payload) {
    const res = await fetch("/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.request) throw new Error(data.error || "Could not send the request.");
    setAccessRequests((prev) => [data.request, ...prev.filter((r) => r.id !== data.request.id)]);
  }

  async function decideAccessRequest(id, approve) {
    const res = await fetch(`/api/access-requests/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approve,
        decided_by: currentUser?.id,
        decided_by_name: currentUser?.name,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.request) {
      alert(data.error || "Could not update the request.");
      return;
    }
    setAccessRequests((prev) => prev.map((r) => (r.id === data.request.id ? data.request : r)));
  }

  function tryEdit(entry) {
    const granted = grantCovers(accessRequests, entry.entered_by, entry.plant_id, entry.shift_date);
    const isLocked = isShiftEntryLocked(entry, shifts) && !granted;
    if (currentUser?.role !== "admin" && isLocked) {
      alert("This entry is past the shift cutoff (24h standard / 48h weekend) and is locked. Operators cannot edit locked records.");
      return;
    }
    setEditing(entry);
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Segoe UI, sans-serif", color: "#334155" }}>
        Checking session…
      </div>
    );
  }

  // If user is not authenticated, present the enterprise Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        onLogin={handleLogin}
        plants={plants}
        locations={locations}
      />
    );
  }

  const role = currentUser.role;
  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.operator;

  return (
    <div className="app">
      <TopBar
        currentUser={currentUser}
        onLogout={handleLogout}
        role={role}
        onRunLockJob={runLockJob}
        shifts={shifts}
        locations={accessibleLocations}
        plants={accessiblePlants}
        selectedPlantId={selectedPlantId}
        onPlantChange={setSelectedPlantId}
        selectedShiftDate={selectedShiftDate}
        onShiftDateChange={handleShiftDateChange}
        selectedShiftId={selectedShiftId}
        onShiftChange={setSelectedShiftId}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      <div className="shell">
        <main className="content">
          {tab === "entry" && (
            <EntryForm
              entries={authorizedEntries}
              master={master}
              machines={machines}
              shifts={shifts}
              reasonCodes={reasonCodes}
              locations={accessibleLocations}
              plants={accessiblePlants}
              selectedPlantId={selectedPlantId}
              selectedShiftDate={selectedShiftDate}
              onShiftDateChange={setSelectedShiftDate}
              selectedShiftId={selectedShiftId}
              onShiftChange={setSelectedShiftId}
              onSubmit={addEntry}
              onDirtyChange={handleDirtyChange}
              currentUser={currentUser}
              accessGrants={accessRequests}
              onRequestAccess={submitAccessRequest}
            />
          )}

          {tab === "mine" && (
            <EntriesTable
              entries={authorizedEntries}
              master={master}
              machines={machines}
              shifts={shifts}
              locations={accessibleLocations}
              plants={accessiblePlants}
              reasonCodes={reasonCodes}
              viewerRole={currentUser.role || "operator"}
              scopeToUser={currentUser.id}
              onEdit={tryEdit}
              accessGrants={accessRequests}
              viewerId={currentUser.id}
            />
          )}

          {tab === "browse" && (
            <div className="entries-workspace-wrapper">
              <div className="page-head" style={{ marginBottom: "10px" }}>
                <div>
                  <h2>Plant Entries Register</h2>
                  <p>
                    {role === "plant_head" ? "Plant Head view" : "Supervisor floor view"} — real-time monitoring
                    across all machines and shifts.
                  </p>
                </div>
              </div>
              <EntriesTable
                entries={authorizedEntries}
                master={master}
                machines={machines}
                shifts={shifts}
                locations={accessibleLocations}
                plants={accessiblePlants}
                reasonCodes={reasonCodes}
                viewerRole="supervisor"
                onEdit={() => {}}
              />
            </div>
          )}

          {tab === "all" && (
            <div className="entries-workspace-wrapper">
              <div className="page-head" style={{ marginBottom: "10px" }}>
                <div>
                  <h2>Master Shift Entries Register</h2>
                  <p>Plant Admin view — Full override and edit access with silent audit logging.</p>
                </div>
              </div>
              {authorizedEntries.filter((e) => e.status === "locked").length === 0 && authorizedEntries.length > 0 && (
                <div className="banner" style={{ marginBottom: "10px" }}>
                  <strong>Tip —</strong> entries automatically lock once their shift date is past
                  cutoff. Use &quot;Shift Cutoff Lock&quot; in the top bar to force-check now.
                </div>
              )}
              <EntriesTable
                entries={authorizedEntries}
                master={master}
                machines={machines}
                shifts={shifts}
                locations={accessibleLocations}
                plants={accessiblePlants}
                reasonCodes={reasonCodes}
                viewerRole="admin"
                onEdit={tryEdit}
              />
            </div>
          )}

          {tab === "daily_update" && (role === "admin" || role === "plant_head") && (
            <DailyUpdateView
              entries={entries}
              machines={machines}
              plants={accessiblePlants.length > 0 ? accessiblePlants : plants}
              locations={locations}
              master={master}
              shifts={shifts}
              currentUser={currentUser}
              onRefresh={() => {
                fetch("/api/entries")
                  .then((r) => r.json())
                  .then((d) => {
                    if (d?.entries) setEntries(d.entries);
                  })
                  .catch((err) => console.error(err));
              }}
            />
          )}

          {tab === "master" && (
            <div className="master-management-wrapper">
              <div className="page-head">
                <div>
                  <h2>Plant Master Data Management</h2>
                  <p>
                    Manage Locations &amp; Plants, Products (SAP Master), Machines, Shift timings, and
                    Downtime/Rejection reason codes.
                  </p>
                </div>
              </div>
              <MasterAdmin
                master={master}
                setMaster={setMaster}
                machines={machines}
                setMachines={setMachines}
                shifts={shifts}
                setShifts={setShifts}
                reasonCodes={reasonCodes}
                setReasonCodes={setReasonCodes}
                locations={locations}
                setLocations={setLocations}
                plants={plants}
                setPlants={setPlants}
                users={users}
                setUsers={setUsers}
                entries={entries}
              />
            </div>
          )}

          {tab === "dashboard" && (
            <Dashboard
              entries={authorizedEntries}
              master={master}
              machines={machines}
              shifts={shifts}
              reasonCodes={reasonCodes}
              locations={accessibleLocations}
              plants={accessiblePlants}
              selectedPlantId={selectedPlantId}
              selectedMonth={selectedMonth}
              userRole={currentUser?.role || "operator"}
            />
          )}

          {tab === "requests" && role === "plant_head" && (
            <AccessRequests
              requests={accessRequests}
              plants={accessiblePlants}
              currentUser={currentUser}
              onDecide={decideAccessRequest}
            />
          )}

          {tab === "cycle" && (role === "admin" || role === "plant_head") && (
            <CycleTimeTracker
              entries={authorizedEntries}
              master={master}
              machines={machines}
              shifts={shifts}
              reasonCodes={reasonCodes}
              plants={accessiblePlants}
              selectedPlantId={selectedPlantId}
              selectedMonth={selectedMonth}
            />
          )}

          {tab === "audit" && (
            <div>
              <div className="page-head">
                <div>
                  <h2>Plant Security &amp; Audit Trail</h2>
                  <p>
                    Complete historical log of every administrative override made to locked shift
                    records.
                  </p>
                </div>
              </div>
              <AuditLogView log={auditLog} />
            </div>
          )}
        </main>
      </div>

      {editing && (
        <EditModal
          entry={editing}
          master={master}
          machines={machines}
          shifts={shifts}
          reasonCodes={reasonCodes}
          locations={locations}
          plants={plants}
          currentUser={currentUser}
          accessGrants={accessRequests}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
