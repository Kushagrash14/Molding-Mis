import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  SEED_MASTER,
  USERS,
  SEED_ENTRIES,
  MACHINES,
  SHIFTS,
  REASON_CODES,
  LOCATIONS,
  PLANTS,
} from "./data/seedData.js";
import {
  todayStr,
  getProductionShiftDate,
  isShiftEntryLocked,
  getActiveShift,
  isDateInUnlockedWindow,
} from "./lib/calculations.js";
import { loadState, saveState, loadSession, saveSession } from "./lib/storage.js";
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
import LoginScreen from "./components/LoginScreen.jsx";

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
  admin: [
    ["all", "All entries"],
    ["master", "Master data"],
    ["dashboard", "Dashboard"],
    ["audit", "Audit log"],
  ],
};

export default function App() {
  const saved = loadState();

  const [master, setMaster] = useState(() => {
    const loaded = saved?.master;
    if (!loaded || !Array.isArray(loaded) || loaded.length < 1500 || !loaded.some((p) => p.plant_id === "2020")) {
      return SEED_MASTER;
    }
    return loaded.map((p) => {
      if (!p.plant_id) {
        return { ...p, plant_id: "1040" };
      }
      return p;
    });
  });

  const [machines, setMachines] = useState(() => {
    const loaded = saved?.machines;
    if (!loaded || !loaded.some((m) => m.plant_id === "1040") || !loaded.some((m) => m.plant_id === "2020")) {
      return MACHINES;
    }
    return loaded
      .filter((m) => !m.machine_id?.startsWith("MC-GN") && !m.machine_id?.startsWith("MC-BHI"))
      .map((m) => {
        const seedM = MACHINES.find((sm) => sm.machine_id === m.machine_id);
        if (seedM) {
          return { ...m, plant_id: seedM.plant_id };
        }
        return m;
      });
  });

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
    return loaded;
  });

  const [users, setUsers] = useState(() => {
    const loaded = saved?.users ?? USERS;
    // Purge demo users (priya, ramesh, suresh)
    const filtered = loaded.filter(
      (u) =>
        !["u_priya", "u_ramesh", "u_suresh"].includes(u.id) &&
        !["priya", "ramesh", "suresh"].includes(u.username)
    );
    const list = [...filtered];
    // Ensure all seed accounts from USERS are present
    for (const su of USERS) {
      if (!list.some((u) => u.id === su.id || u.email?.toLowerCase() === su.email?.toLowerCase())) {
        list.push(su);
      }
    }
    return list.map((u) => {
      if (u.username === "admin" || u.id === "u_admin") {
        return {
          ...u,
          id: "u_admin",
          username: "admin",
          email: "software.2040@pgel.in",
          employee_code: u.employee_code || "PG-001",
          name: "System Administrator",
          role: "admin",
          assigned_location_id: "all",
          assigned_location_ids: ["all"],
          assigned_plant_ids: ["all"],
        };
      }
      return u;
    });
  });

  const [selectedPlantId, setSelectedPlantId] = useState(() => {
    if (saved?.selectedPlantId && saved.selectedPlantId !== "PLANT-U01" && saved.selectedPlantId !== "PLANT-U03") {
      return saved.selectedPlantId;
    }
    return "1040";
  });

  const [selectedShiftDate, setSelectedShiftDate] = useState(() => getProductionShiftDate(shifts));
  const activeShift = useMemo(() => getActiveShift(shifts), [shifts]);
  const [selectedShiftId, setSelectedShiftId] = useState(
    () => activeShift?.shift_id || shifts[0]?.shift_id || "1"
  );

  const [entries, setEntries] = useState(() => {
    const loaded = saved?.entries ?? SEED_ENTRIES;
    return loaded.map((e) => {
      if (e.plant_id === "PLANT-U01" || e.plant_id === "PLANT-U03") {
        return { ...e, plant_id: "1040" };
      }
      return e;
    });
  });
  const [auditLog, setAuditLog] = useState(saved?.auditLog ?? []);

  // Ref to track which machine_ids operator is actively typing in (never overwrite these during sync)
  const dirtyMachinesRef = useRef(new Set());

  // Callback passed to EntryForm so it can report dirty machines in real-time
  const handleDirtyChange = useCallback((dirtySet) => {
    dirtyMachinesRef.current = dirtySet;
  }, []);

  
  // Session State: authenticated user from localStorage session, or null (prompts login)
  const [currentUser, setCurrentUser] = useState(() => {
    const sess = loadSession();
    if (sess) {
      const loadedUsers = saved?.users ?? USERS;
      const match = loadedUsers.find(
        (u) => u.id === sess.id || u.username?.toLowerCase() === sess.username?.toLowerCase()
      );
      if (match) {
        const seedMatch = USERS.find((su) => su.username === match.username || su.id === match.id);
        const assignedLocId = match.assigned_location_id ?? seedMatch?.assigned_location_id ?? "all";
        const assignedLocIds =
          match.assigned_location_ids ??
          (match.assigned_location_id ? [match.assigned_location_id] : seedMatch?.assigned_location_ids ?? ["all"]);
        const assignedPlants = match.assigned_plant_ids ?? seedMatch?.assigned_plant_ids ?? ["all"];
        return {
          ...match,
          assigned_location_id: assignedLocId,
          assigned_location_ids: assignedLocIds,
          assigned_plant_ids: assignedPlants,
        };
      }
      return sess;
    }
    return null;
  });

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

  const [tab, setTab] = useState(() => {
    const sess = loadSession();
    if (sess?.role === "operator") return "entry";
    if (sess?.role === "supervisor") return "browse";
    if (sess?.role === "admin") return "all";
    return "entry";
  });
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
  // Exception: Entries in 1 Sep to 22 Sep 2026 are always kept unlocked.
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

  // Central AWS Cloud Sync: smart merge — never overwrite rows operator is actively editing
  useEffect(() => {
    let isMounted = true;

    // Smart merge: cloud data wins ONLY for machines not currently dirty (being typed in)
    function smartMergeEntries(incomingEntries) {
      setEntries((prev) => {
        const dirty = dirtyMachinesRef.current; // Set<machine_id> currently being edited
        if (!dirty || dirty.size === 0) {
          // No active editing — safe to take cloud data as-is
          return incomingEntries;
        }
        // Build a map of current local entries for fast lookup
        const localMap = new Map(prev.map((e) => [e.entry_id, e]));
        const result = [];
        const handled = new Set();

        // Process cloud entries
        for (const cloudEntry of incomingEntries) {
          const key = `${cloudEntry.shift_date}__${cloudEntry.shift_id}__${cloudEntry.machine_id}__${cloudEntry.plant_id || "1040"}`;
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
            result.push(localVer || cloudEntry);
          } else {
            // Not dirty → cloud is authoritative (another PC may have submitted this)
            result.push(cloudEntry);
          }
          handled.add(key);
        }

        // Preserve any purely local entries (dirty rows not yet on cloud for today)
        for (const localEntry of prev) {
          const key = `${localEntry.shift_date}__${localEntry.shift_id}__${localEntry.machine_id}__${localEntry.plant_id || "1040"}`;
          if (!handled.has(key) && dirty.has(localEntry.machine_id)) {
            result.push(localEntry);
          }
        }

        return result;
      });
    }

    async function syncFromCloud() {
      try {
        const res = await fetch("/api/bootstrap");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        // Deep-compare helper: only update state if data actually changed.
        // This prevents React from re-rendering children (and triggering EntryForm's
        // initialization useEffect) when sync returns identical data every 15s.
        const stableSet = (setter, newData) => {
          setter(prev =>
            JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData
          );
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
      } catch (err) {
        console.log("Cloud sync silent fallback to cache:", err.message);
      }
    }

    syncFromCloud();
    const interval = setInterval(syncFromCloud, 15000);
    const handleFocus = () => syncFromCloud();
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  function handleLogin(user) {
    setCurrentUser(user);
    saveSession(user);
    setTab(
      user.role === "operator" ? "entry" : user.role === "supervisor" ? "browse" : "all"
    );
  }

  function handleLogout() {
    setCurrentUser(null);
    saveSession(null);
    setTab("entry");
  }

  function addEntry(entry) {
    const entryToSave = {
      ...entry,
      entry_id: entry.entry_id || `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      plant_id: entry.plant_id || selectedPlantId || "1040",
      updated_at: new Date().toISOString(),
    };

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

    // Save directly to AWS Cloud
    fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entryToSave),
    }).catch((err) => console.error("Cloud save entry error:", err));
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
        : "All submitted entries are within active shift, grace window (24h standard / 48h Saturday), or 1–22 Sep unlocked window."
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

  function tryEdit(entry) {
    const isLocked = entry.status === "locked" || isShiftEntryLocked(entry, shifts);
    if (currentUser?.role !== "admin" && isLocked) {
      alert("This entry is past the shift cutoff (24h standard / 48h weekend) and is locked. Operators cannot edit locked records.");
      return;
    }
    setEditing(entry);
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
        onShiftDateChange={setSelectedShiftDate}
        selectedShiftId={selectedShiftId}
        onShiftChange={setSelectedShiftId}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
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
            />
          )}

          {tab === "browse" && (
            <div>
              <div className="page-head">
                <div>
                  <h2>Plant Entries Register</h2>
                  <p>Supervisor floor view — real-time monitoring across all machines and shifts.</p>
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
            <div>
              <div className="page-head">
                <div>
                  <h2>Master Shift Entries Register</h2>
                  <p>Plant Admin view — Full override and edit access with silent audit logging.</p>
                </div>
              </div>
              {authorizedEntries.filter((e) => e.status === "locked").length === 0 && authorizedEntries.length > 0 && (
                <div className="banner">
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

          {tab === "master" && (
            <div>
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
              initialPlantId={selectedPlantId}
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
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
