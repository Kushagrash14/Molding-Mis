import { useState } from "react";
import { formatUserScopeLabel, getUserAccessiblePlants } from "../lib/permissions.js";
import { calculateShiftDuration } from "../lib/calculations.js";
import { SHIFTS } from "../data/seedData.js";
import PlantAccessMatrixSelector from "./PlantAccessMatrixSelector.jsx";

export default function MasterAdmin({
  master,
  setMaster,
  machines,
  setMachines,
  shifts,
  setShifts,
  reasonCodes,
  setReasonCodes,
  locations = [],
  setLocations,
  plants = [],
  setPlants,
  users = [],
  setUsers,
  entries = [],
}) {
  const [activeTab, setActiveTab] = useState("products");

  // Search states
  const [searchProduct, setSearchProduct] = useState("");
  const [productPlantFilter, setProductPlantFilter] = useState("all");
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(50);
  const [searchMachine, setSearchMachine] = useState("");
  const [machinePlantFilter, setMachinePlantFilter] = useState("all");
  const [searchShift, setSearchShift] = useState("");
  const [searchReason, setSearchReason] = useState("");
  const [reasonFilterCat, setReasonFilterCat] = useState("all");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchPlant, setSearchPlant] = useState("");
  const [searchUser, setSearchUser] = useState("");

  // Edit states (item being edited, or null)
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingMachine, setEditingMachine] = useState(null);
  const [editingShift, setEditingShift] = useState(null);
  const [editingReason, setEditingReason] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingPlant, setEditingPlant] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // New item form states
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    employee_code: "",
    name: "",
    role: "operator",
    department: "",
    scope_type: "custom", // "all" | "custom"
    assigned_plant_ids: ["PLANT-U02"],
    assigned_location_ids: ["LOC-GN"],
  });

  const [newProduct, setNewProduct] = useState({
    sap_code: "",
    part_no: "",
    material_description: "",
    cavity: 1,
    shots_per_hour: 60,
    price: 0,
    part_wt: 0,
    run_wt: 0,
    manpower: 2,
    plant_id: plants[0]?.plant_id || "1040",
  });

  const [newMachine, setNewMachine] = useState({
    machine_id: "",
    machine_no: "",
    plant_id: plants[0]?.plant_id || "1040",
  });

  const [newShift, setNewShift] = useState({
    shift_id: "",
    name: "",
    start_time: "06:00",
    end_time: "14:00",
    break_mins: 0,
  });

  const SHIFT_PRESETS = [
    { label: "☀️ Shift 1 (07:00–19:00 · 12h Day)", id: "1", name: "Shift 1 (Day)", start: "07:00", end: "19:00", breakMins: 0 },
    { label: "🌙 Shift 2 (19:00–07:00 · 12h Night)", id: "2", name: "Shift 2 (Night)", start: "19:00", end: "07:00", breakMins: 0 },
    { label: "🌅 Shift A (06:00–14:00 · 8h)", id: "A", name: "Shift A", start: "06:00", end: "14:00", breakMins: 0 },
    { label: "🌇 Shift B (14:00–22:00 · 8h)", id: "B", name: "Shift B", start: "14:00", end: "22:00", breakMins: 0 },
    { label: "🌌 Shift C (22:00–06:00 · 8h Night)", id: "C", name: "Shift C", start: "22:00", end: "06:00", breakMins: 0 },
    { label: "🏢 General (09:00–17:30 · 8h)", id: "G", name: "General Shift", start: "09:00", end: "17:30", breakMins: 30 },
  ];

  const [newReason, setNewReason] = useState({
    reason_id: "",
    name: "",
    category: "rejection",
    unit: "qty",
  });

  const [newLocation, setNewLocation] = useState({
    name: "",
  });

  const [newPlant, setNewPlant] = useState({
    plant_id: "",
    name: "",
    location_id: locations[0]?.location_id || "LOC-GN",
  });

  // ==========================
  // LOCATIONS CRUD
  // ==========================
  function handleAddLocation() {
    const cleanName = newLocation.name.trim();
    if (!cleanName) {
      alert("Please enter a Location Name (e.g. Pune, Bhiwadi, Greater Noida).");
      return;
    }
    if (locations.some((l) => l.name.toLowerCase() === cleanName.toLowerCase())) {
      alert(`Location "${cleanName}" already exists.`);
      return;
    }

    let baseId = "LOC-" + cleanName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    let cleanId = baseId;
    let counter = 1;
    while (locations.some((l) => l.location_id === cleanId)) {
      cleanId = `${baseId}-${counter++}`;
    }

    setLocations((prev) => [
      ...prev,
      {
        location_id: cleanId,
        name: cleanName,
      },
    ]);
    setNewLocation({ name: "" });
  }

  function handleSaveLocationEdit() {
    if (!editingLocation) return;
    setLocations((prev) =>
      prev.map((l) => (l.location_id === editingLocation.location_id ? { location_id: editingLocation.location_id, name: editingLocation.name.trim() } : l))
    );
    setEditingLocation(null);
  }

  function handleDeleteLocation(locId) {
    const attachedPlants = plants.filter((p) => p.location_id === locId);
    if (attachedPlants.length > 0) {
      alert(
        `Cannot delete location "${locId}" because ${attachedPlants.length} plant(s) are assigned to it. Please reassign or delete those plants first.`
      );
      return;
    }
    if (confirm(`Are you sure you want to delete Location "${locId}"?`)) {
      setLocations((prev) => prev.filter((l) => l.location_id !== locId));
    }
  }

  // ==========================
  // PLANTS CRUD
  // ==========================
  function handleAddPlant() {
    const cleanCode = newPlant.plant_id.trim().toUpperCase();
    const cleanName = newPlant.name.trim();
    if (!cleanCode || !cleanName) {
      alert("Both Plant Code (e.g. PLANT-U05) and Plant Name (e.g. Unit-05) are required.");
      return;
    }
    if (plants.some((p) => p.plant_id.toUpperCase() === cleanCode)) {
      alert(`Plant Code "${cleanCode}" already exists.`);
      return;
    }

    setPlants((prev) => [
      ...prev,
      {
        plant_id: cleanCode,
        name: cleanName,
        location_id: newPlant.location_id || (locations[0] ? locations[0].location_id : "LOC-GN"),
      },
    ]);
    setNewPlant({
      plant_id: "",
      name: "",
      location_id: locations[0]?.location_id || "LOC-GN",
    });
  }

  function handleSavePlantEdit() {
    if (!editingPlant) return;
    setPlants((prev) =>
      prev.map((p) => (p.plant_id === editingPlant.plant_id ? {
        plant_id: editingPlant.plant_id,
        name: editingPlant.name.trim(),
        location_id: editingPlant.location_id,
      } : p))
    );
    setEditingPlant(null);
  }

  function handleDeletePlant(plantId) {
    if (confirm(`Are you sure you want to delete Plant "${plantId}"?`)) {
      setPlants((prev) => prev.filter((p) => p.plant_id !== plantId));
    }
  }

  // ==========================
  // PRODUCT (SAP MASTER) CRUD
  // ==========================
  function handleAddProduct() {
    const cleanSap = newProduct.sap_code.trim();
    if (!cleanSap || !newProduct.part_no.trim()) {
      alert("SAP Code and Part Number are required.");
      return;
    }
    if (master.some((m) => m.sap_code.toLowerCase() === cleanSap.toLowerCase())) {
      alert(`SAP Code "${cleanSap}" already exists.`);
      return;
    }

    setMaster((prev) => [
      ...prev,
      {
        ...newProduct,
        sap_code: cleanSap,
        part_no: newProduct.part_no.trim(),
        material_description: newProduct.material_description.trim(),
        cavity: Number(newProduct.cavity) || 1,
        shots_per_hour: Number(newProduct.shots_per_hour) || 60,
        price: Number(newProduct.price) || 0,
        part_wt: Number(newProduct.part_wt) || 0,
        run_wt: Number(newProduct.run_wt) || 0,
        manpower: Number(newProduct.manpower) || 2,
        plant_id: newProduct.plant_id || plants[0]?.plant_id || "1040",
      },
    ]);

    setNewProduct({
      sap_code: "",
      part_no: "",
      material_description: "",
      cavity: 2,
      shots_per_hour: 60,
      price: 50.0,
      part_wt: 0.15,
      run_wt: 0.0,
      manpower: 2,
      plant_id: newProduct.plant_id || plants[0]?.plant_id || "1040",
    });
  }

  function handleSaveProductEdit() {
    if (!editingProduct) return;
    setMaster((prev) =>
      prev.map((m) => (m.sap_code === editingProduct.sap_code ? editingProduct : m))
    );
    setEditingProduct(null);
  }

  function handleDeleteProduct(sap_code) {
    if (confirm(`Are you sure you want to remove SAP product "${sap_code}" from Master?`)) {
      setMaster((prev) => prev.filter((m) => m.sap_code !== sap_code));
    }
  }

  // ==========================
  // MACHINES MASTER CRUD
  // ==========================
  function handleAddMachine() {
    const cleanId = newMachine.machine_id.trim().toUpperCase();
    const cleanName = newMachine.machine_no.trim();
    if (!cleanId || !cleanName) {
      alert("Both Machine ID (e.g. MC-99) and Machine Name (e.g. INJ-99 Toshiba 650T) are required.");
      return;
    }
    if (machines.some((m) => m.machine_id.toUpperCase() === cleanId)) {
      alert(`Machine ID "${cleanId}" already exists.`);
      return;
    }

    setMachines((prev) => [
      ...prev,
      {
        machine_id: cleanId,
        machine_no: cleanName,
        plant_id: newMachine.plant_id || plants[0]?.plant_id || "1040",
      },
    ]);
    setNewMachine({
      machine_id: "",
      machine_no: "",
      plant_id: plants[0]?.plant_id || "1040",
    });
  }

  function handleSaveMachineEdit() {
    if (!editingMachine) return;
    setMachines((prev) =>
      prev.map((m) => (m.machine_id === editingMachine.machine_id ? editingMachine : m))
    );
    setEditingMachine(null);
  }

  function handleDeleteMachine(machine_id) {
    const isUsedInEntries = entries.some((e) => e.machine_id === machine_id);
    if (isUsedInEntries) {
      alert(
        `Cannot delete Machine "${machine_id}" because it is already referenced in logged production records.`
      );
      return;
    }
    if (confirm(`Are you sure you want to delete Machine "${machine_id}"?`)) {
      setMachines((prev) => prev.filter((m) => m.machine_id !== machine_id));
    }
  }

  // ==========================
  // SHIFTS MASTER CRUD
  // ==========================
  function handleApplyTwoShiftStandard() {
    if (confirm("Reset configured shift master to PGEL Standard 2-Shift Schedule (Shift 1: 07:00–19:00 Day & Shift 2: 19:00–07:00 Night)? Existing entries will retain their logged shift records.")) {
      setShifts(SHIFTS);
    }
  }

  function applyShiftPreset(preset) {
    setNewShift({
      shift_id: preset.id,
      name: preset.name,
      start_time: preset.start,
      end_time: preset.end,
      break_mins: preset.breakMins,
    });
  }

  function handleAddShift() {
    const cleanId = newShift.shift_id.trim().toUpperCase();
    const shiftName = (newShift.name || `Shift ${cleanId}`).trim();
    if (!cleanId) {
      alert("Shift ID (e.g. A, B, C, D, G) is required.");
      return;
    }
    if (!newShift.start_time || !newShift.end_time) {
      alert("Both Start Time and End Time are required.");
      return;
    }
    if (shifts.some((s) => s.shift_id.toUpperCase() === cleanId)) {
      alert(`Shift ID "${cleanId}" already exists.`);
      return;
    }

    const { netHours, isOvernight } = calculateShiftDuration(
      newShift.start_time,
      newShift.end_time,
      newShift.break_mins
    );

    const generatedCode = `${shiftName} (${newShift.start_time}–${newShift.end_time} · ${netHours}h${isOvernight ? " 🌙" : ""})`;

    setShifts((prev) => [
      ...prev,
      {
        shift_id: cleanId,
        name: shiftName,
        start_time: newShift.start_time,
        end_time: newShift.end_time,
        break_mins: Number(newShift.break_mins) || 0,
        planned_hours: netHours,
        is_overnight: isOvernight,
        code: generatedCode,
      },
    ]);
    setNewShift({
      shift_id: "",
      name: "",
      start_time: "06:00",
      end_time: "14:00",
      break_mins: 0,
    });
  }

  function handleSaveShiftEdit() {
    if (!editingShift) return;
    const { netHours, isOvernight } = calculateShiftDuration(
      editingShift.start_time,
      editingShift.end_time,
      editingShift.break_mins
    );
    const shiftName = (editingShift.name || `Shift ${editingShift.shift_id}`).trim();
    const generatedCode = `${shiftName} (${editingShift.start_time}–${editingShift.end_time} · ${netHours}h${isOvernight ? " 🌙" : ""})`;

    setShifts((prev) =>
      prev.map((s) =>
        s.shift_id === editingShift.shift_id
          ? {
              ...editingShift,
              name: shiftName,
              planned_hours: netHours,
              is_overnight: isOvernight,
              code: generatedCode,
            }
          : s
      )
    );
    setEditingShift(null);
  }

  function handleDeleteShift(shift_id) {
    const isUsedInEntries = entries.some((e) => e.shift_id === shift_id);
    if (isUsedInEntries) {
      alert(
        `Cannot delete Shift "${shift_id}" because historical shift production records exist under this shift.`
      );
      return;
    }
    if (confirm(`Are you sure you want to delete Shift "${shift_id}"?`)) {
      setShifts((prev) => prev.filter((s) => s.shift_id !== shift_id));
    }
  }

  // ==========================
  // REASON CODES CRUD
  // ==========================
  function handleAddReason() {
    const cleanName = newReason.name.trim().toUpperCase();
    if (!cleanName) {
      alert("Reason name is required.");
      return;
    }
    const autoId =
      newReason.reason_id.trim() ||
      `${newReason.category === "rejection" ? "rej" : newReason.category === "planned_dt" ? "pdt" : "udt"}_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    if (reasonCodes.some((r) => r.reason_id.toLowerCase() === autoId.toLowerCase())) {
      alert(`Reason Code ID "${autoId}" already exists.`);
      return;
    }

    const unit = newReason.category === "rejection" ? "qty" : "min";
    setReasonCodes((prev) => [
      ...prev,
      {
        reason_id: autoId,
        name: cleanName,
        category: newReason.category,
        unit,
      },
    ]);

    setNewReason({
      reason_id: "",
      name: "",
      category: "rejection",
      unit: "qty",
    });
  }

  function handleSaveReasonEdit() {
    if (!editingReason) return;
    setReasonCodes((prev) =>
      prev.map((r) => (r.reason_id === editingReason.reason_id ? editingReason : r))
    );
    setEditingReason(null);
  }

  function handleDeleteReason(reason_id) {
    const isUsedInEntries = entries.some((e) =>
      (e.reasons || []).some((r) => r.reason_id === reason_id && Number(r.value) > 0)
    );
    if (isUsedInEntries) {
      alert(
        `Cannot delete Reason Code "${reason_id}" because it has already been recorded in historical production entries. Deleting it would corrupt past OEE & MIS data records.`
      );
      return;
    }
    if (confirm(`Are you sure you want to delete reason code "${reason_id}"?`)) {
      setReasonCodes((prev) => prev.filter((r) => r.reason_id !== reason_id));
    }
  }

  // Filtered lists
  const filteredProducts = master.filter((m) => {
    if (productPlantFilter !== "all" && (m.plant_id || "1040") !== productPlantFilter) {
      return false;
    }
    const q = searchProduct.toLowerCase();
    return (
      m.sap_code.toLowerCase().includes(q) ||
      m.part_no.toLowerCase().includes(q) ||
      m.material_description.toLowerCase().includes(q)
    );
  });

  const effectiveProdPageSize =
    prodPageSize === "all" ? Math.max(filteredProducts.length, 1) : Number(prodPageSize);
  const totalProdPages = Math.max(1, Math.ceil(filteredProducts.length / effectiveProdPageSize));
  const currentProdPage = Math.min(Math.max(1, prodPage), totalProdPages);
  const paginatedProducts =
    prodPageSize === "all"
      ? filteredProducts
      : filteredProducts.slice(
          (currentProdPage - 1) * effectiveProdPageSize,
          currentProdPage * effectiveProdPageSize
        );

  const filteredMachines = machines.filter((m) => {
    if (machinePlantFilter !== "all" && (m.plant_id || "1040") !== machinePlantFilter) {
      return false;
    }
    const q = searchMachine.toLowerCase();
    return (
      m.machine_id.toLowerCase().includes(q) ||
      m.machine_no.toLowerCase().includes(q)
    );
  });

  const filteredShifts = shifts.filter(
    (s) =>
      s.shift_id.toLowerCase().includes(searchShift.toLowerCase()) ||
      s.code.toLowerCase().includes(searchShift.toLowerCase())
  );

  const filteredReasons = reasonCodes.filter((r) => {
    if (reasonFilterCat !== "all" && r.category !== reasonFilterCat) return false;
    if (
      searchReason &&
      !r.name.toLowerCase().includes(searchReason.toLowerCase()) &&
      !r.reason_id.toLowerCase().includes(searchReason.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredLocations = locations.filter(
    (l) =>
      l.location_id?.toLowerCase().includes(searchLocation.toLowerCase()) ||
      l.name?.toLowerCase().includes(searchLocation.toLowerCase())
  );

  const filteredPlants = plants.filter(
    (p) =>
      p.plant_id?.toLowerCase().includes(searchPlant.toLowerCase()) ||
      p.name?.toLowerCase().includes(searchPlant.toLowerCase())
  );

  // ==========================
  // USERS MASTER CRUD
  // ==========================
  function handleAddUser() {
    const cleanUsername = newUser.username.trim().toLowerCase();
    const cleanEmail = (newUser.email || `${cleanUsername}@pgel.in`).trim().toLowerCase();
    const cleanName = newUser.name.trim();
    const cleanEmpCode = newUser.employee_code.trim().toUpperCase();

    if (!cleanUsername || !cleanName) {
      alert("Username and Full Name are required.");
      return;
    }
    if (users.some((u) => u.username?.toLowerCase() === cleanUsername)) {
      alert(`Username "${cleanUsername}" already exists.`);
      return;
    }

    let assignedLoc = "all";
    let assignedPlants = ["all"];
    let assignedLocs = ["all"];

    if (newUser.scope_type === "all") {
      assignedPlants = ["all"];
      assignedLocs = ["all"];
      assignedLoc = "all";
    } else {
      const validPlants = (newUser.assigned_plant_ids || []).filter((id) => id !== "all");
      if (validPlants.length === 0) {
        alert("Please select at least one manufacturing plant / unit for this user.");
        return;
      }
      assignedPlants = validPlants;
      assignedLocs = (newUser.assigned_location_ids || []).filter((id) => id !== "all");
      const firstPlant = plants.find((p) => assignedPlants.includes(p.plant_id));
      assignedLoc = firstPlant ? firstPlant.location_id : locations[0]?.location_id || "LOC-GN";
    }

    const createdUser = {
      id: "u_" + cleanUsername,
      username: cleanUsername,
      email: cleanEmail,
      employee_code: cleanEmpCode || `PG-${Math.floor(100 + Math.random() * 900)}`,
      name: cleanName,
      role: newUser.role,
      department:
        newUser.department.trim() ||
        (newUser.role === "admin" ? "Plant Management" : "Shop Floor Operation"),
      assigned_location_id: assignedLoc,
      assigned_location_ids: assignedLocs,
      assigned_plant_ids: assignedPlants,
    };

    setUsers((prev) => [...prev, createdUser]);
    setNewUser({
      username: "",
      email: "",
      employee_code: "",
      name: "",
      role: "operator",
      department: "",
      scope_type: "custom",
      assigned_plant_ids: [plants[0]?.plant_id || "PLANT-U02"],
      assigned_location_ids: [locations[0]?.location_id || "LOC-GN"],
    });
  }

  function startEditUser(u) {
    const isAll =
      !u.assigned_plant_ids ||
      u.assigned_plant_ids.includes("all") ||
      u.assigned_location_id === "all" ||
      (Array.isArray(u.assigned_location_ids) && u.assigned_location_ids.includes("all"));

    const accessible = getUserAccessiblePlants(u, plants, locations);
    const initialPlantIds = isAll
      ? ["all"]
      : accessible.map((p) => p.plant_id);
    const initialLocIds = isAll
      ? ["all"]
      : Array.isArray(u.assigned_location_ids)
      ? u.assigned_location_ids
      : u.assigned_location_id
      ? [u.assigned_location_id]
      : [];

    setEditingUser({
      ...u,
      scope_type: isAll ? "all" : "custom",
      assigned_plant_ids: initialPlantIds,
      assigned_location_ids: initialLocIds,
    });
  }

  function handleSaveUserEdit() {
    if (!editingUser) return;
    let assignedLoc = "all";
    let assignedPlants = ["all"];
    let assignedLocs = ["all"];

    if (editingUser.scope_type === "all") {
      assignedPlants = ["all"];
      assignedLocs = ["all"];
      assignedLoc = "all";
    } else {
      const validPlants = (editingUser.assigned_plant_ids || []).filter((id) => id !== "all");
      if (validPlants.length === 0) {
        alert("Please select at least one manufacturing plant / unit for this user.");
        return;
      }
      assignedPlants = validPlants;
      assignedLocs = (editingUser.assigned_location_ids || []).filter((id) => id !== "all");
      const firstPlant = plants.find((p) => assignedPlants.includes(p.plant_id));
      assignedLoc = firstPlant ? firstPlant.location_id : locations[0]?.location_id || "LOC-GN";
    }

    const updated = {
      ...editingUser,
      assigned_location_id: assignedLoc,
      assigned_location_ids: assignedLocs,
      assigned_plant_ids: assignedPlants,
    };

    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditingUser(null);
  }

  function handleDeleteUser(id) {
    const target = users.find((u) => u.id === id);
    if (target?.username === "admin") {
      alert("Root admin account cannot be deleted.");
      return;
    }
    if (confirm(`Are you sure you want to delete user "${target?.name || id}"?`)) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.employee_code?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div>
      {/* Master Center Header & Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div className="master-nav-tabs">
          <button
            className={`btn small ${activeTab === "products" ? "" : "secondary"}`}
            onClick={() => setActiveTab("products")}
          >
            📦 Products / SAP ({master.length})
          </button>
          <button
            className={`btn small ${activeTab === "plants_locations" ? "" : "secondary"}`}
            onClick={() => setActiveTab("plants_locations")}
          >
            🏢 Locations &amp; Plants ({locations.length} / {plants.length})
          </button>
          <button
            className={`btn small ${activeTab === "machines" ? "" : "secondary"}`}
            onClick={() => setActiveTab("machines")}
          >
            🏭 Machines ({machines.length})
          </button>
          <button
            className={`btn small ${activeTab === "shifts" ? "" : "secondary"}`}
            onClick={() => setActiveTab("shifts")}
          >
            ⏰ Shifts ({shifts.length})
          </button>
          <button
            className={`btn small ${activeTab === "reasons" ? "" : "secondary"}`}
            onClick={() => setActiveTab("reasons")}
          >
            ⚠️ Reasons ({reasonCodes.length})
          </button>
          {setUsers && (
            <button
              className={`btn small ${activeTab === "users" ? "" : "secondary"}`}
              onClick={() => setActiveTab("users")}
            >
              👥 Users &amp; Roles ({users.length})
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. LOCATIONS & PLANTS MASTER TAB */}
      {/* ========================================================= */}
      {activeTab === "plants_locations" && (
        <div>
          {/* LOCATIONS SECTION */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📍 Factory Locations</span>
                  <span className="badge-count blue">{locations.length} ACTIVE</span>
                </h3>
                <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "2px 0 0" }}>
                  Geographical manufacturing locations (Greater Noida, Pune, Bhiwadi).
                </p>
              </div>

              <div className="search-box-pro">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search locations..."
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                />
                {searchLocation && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setSearchLocation("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="table-wrap" style={{ marginBottom: "16px" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>Location ID</th>
                    <th>Location Name</th>
                    <th style={{ width: "160px" }}>Active Plants</th>
                    <th style={{ width: "160px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocations.map((l) => {
                    const plantCount = plants.filter((p) => p.location_id === l.location_id).length;
                    return (
                      <tr key={l.location_id}>
                        <td className="mono" style={{ fontWeight: 700, color: "var(--brand-primary)" }}>
                          {l.location_id}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: "13px" }}>📍 {l.name}</td>
                        <td>
                          <span className="badge-count blue">{plantCount} Plant(s)</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="btn small secondary"
                              onClick={() => setEditingLocation({ ...l })}
                            >
                              Edit
                            </button>
                            <button
                              className="btn small secondary"
                              style={{ color: "var(--danger, #dc2626)" }}
                              onClick={() => handleDeleteLocation(l.location_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Location Form */}
            <div
              style={{
                background: "var(--bg-subtle, #f8f9fa)",
                padding: "14px",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <h4
                style={{
                  fontSize: "11px",
                  color: "var(--brand-primary)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.5px",
                  marginBottom: "10px",
                }}
              >
                + ADD NEW FACTORY LOCATION
              </h4>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-row" style={{ flex: 1, minWidth: "260px" }}>
                  <label>Location Name *</label>
                  <input
                    value={newLocation.name}
                    placeholder="e.g. Pune, Bhiwadi, Greater Noida"
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  />
                </div>
                <div>
                  <button className="btn small" onClick={handleAddLocation} style={{ height: "36px" }}>
                    + Add Location
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PLANTS SECTION */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🏭 Manufacturing Plants / Units</span>
                  <span className="badge-count green">{plants.length} CONFIGURED</span>
                </h3>
                <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "2px 0 0" }}>
                  Operating manufacturing units (Unit-01, Unit-02, Unit-03, Unit-04).
                </p>
              </div>

              <div className="search-box-pro">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search plant name or code..."
                  value={searchPlant}
                  onChange={(e) => setSearchPlant(e.target.value)}
                />
                {searchPlant && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setSearchPlant("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="table-wrap" style={{ marginBottom: "16px" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>Plant Code</th>
                    <th>Plant / Unit Name</th>
                    <th>Location Hub</th>
                    <th style={{ width: "160px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlants.map((p) => {
                    const loc = locations.find((l) => l.location_id === p.location_id);
                    return (
                      <tr key={p.plant_id}>
                        <td className="mono" style={{ fontWeight: 700, color: "#16a34a" }}>
                          {p.plant_id}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: "13px" }}>🏭 {p.name}</td>
                        <td>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "#e0f2fe",
                              color: "#0369a1",
                              fontWeight: 600,
                              fontSize: "12px",
                            }}
                          >
                            📍 {loc ? loc.name : p.location_id}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="btn small secondary"
                              onClick={() => setEditingPlant({ ...p })}
                            >
                              Edit
                            </button>
                            <button
                              className="btn small secondary"
                              style={{ color: "var(--danger, #dc2626)" }}
                              onClick={() => handleDeletePlant(p.plant_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Plant Form */}
            <div
              style={{
                background: "var(--bg-subtle, #f8f9fa)",
                padding: "14px",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <h4
                style={{
                  fontSize: "11px",
                  color: "var(--brand-primary)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.5px",
                  marginBottom: "10px",
                }}
              >
                + ADD NEW MANUFACTURING PLANT / UNIT
              </h4>
              <div className="grid3" style={{ gap: "10px" }}>
                <div className="form-row">
                  <label>Plant Code *</label>
                  <input
                    value={newPlant.plant_id}
                    placeholder="e.g. PLANT-U05"
                    onChange={(e) => setNewPlant({ ...newPlant, plant_id: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Plant Name *</label>
                  <input
                    value={newPlant.name}
                    placeholder="e.g. Unit-05"
                    onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Assigned Location Hub *</label>
                  <select
                    value={newPlant.location_id}
                    onChange={(e) => setNewPlant({ ...newPlant, location_id: e.target.value })}
                  >
                    {locations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: "12px" }}>
                <button className="btn small" onClick={handleAddPlant}>
                  + Add Plant / Unit
                </button>
              </div>
            </div>
          </div>

          {/* Edit Location Modal */}
          {editingLocation && (
            <div className="modal-back" onClick={() => setEditingLocation(null)}>
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "440px" }}
              >
                <div className="modal-head">
                  <div>
                    <h3>Edit Location — {editingLocation.location_id}</h3>
                    <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                      Update location city name.
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setEditingLocation(null)}>
                    ✕
                  </button>
                </div>

                <div className="form-row" style={{ marginBottom: "16px" }}>
                  <label>Location Name *</label>
                  <input
                    value={editingLocation.name}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, name: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn secondary" onClick={() => setEditingLocation(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleSaveLocationEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Plant Modal */}
          {editingPlant && (
            <div className="modal-back" onClick={() => setEditingPlant(null)}>
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "480px" }}
              >
                <div className="modal-head">
                  <div>
                    <h3>Edit Plant / Unit — {editingPlant.plant_id}</h3>
                    <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                      Update plant name, code, or location mapping.
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setEditingPlant(null)}>
                    ✕
                  </button>
                </div>

                <div className="form-row" style={{ marginBottom: "12px" }}>
                  <label>Plant Code *</label>
                  <input
                    value={editingPlant.plant_id}
                    onChange={(e) =>
                      setEditingPlant({ ...editingPlant, plant_id: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="form-row" style={{ marginBottom: "12px" }}>
                  <label>Plant Name *</label>
                  <input
                    value={editingPlant.name}
                    onChange={(e) => setEditingPlant({ ...editingPlant, name: e.target.value })}
                  />
                </div>
                <div className="form-row" style={{ marginBottom: "16px" }}>
                  <label>Assigned Location Hub *</label>
                  <select
                    value={editingPlant.location_id}
                    onChange={(e) =>
                      setEditingPlant({ ...editingPlant, location_id: e.target.value })
                    }
                  >
                    {locations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn secondary" onClick={() => setEditingPlant(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleSavePlantEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PRODUCTS / SAP MASTER TAB */}
      {/* ========================================================= */}
      {activeTab === "products" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div className="search-box-pro" style={{ width: "360px" }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by SAP Code, Part Number, or Description..."
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setProdPage(1);
                  }}
                />
                {searchProduct && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => {
                      setSearchProduct("");
                      setProdPage(1);
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-muted)" }}>Plant:</span>
                <select
                  value={productPlantFilter}
                  onChange={(e) => {
                    setProductPlantFilter(e.target.value);
                    setProdPage(1);
                  }}
                  style={{
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  <option value="all">All Plants ({master.length})</option>
                  {plants.map((p) => {
                    const count = master.filter((m) => (m.plant_id || "1040") === p.plant_id).length;
                    return (
                      <option key={p.plant_id} value={p.plant_id}>
                        {p.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
              Showing {filteredProducts.length} of {master.length} parts
            </span>
          </div>

          <div className="table-wrap" style={{ marginBottom: "18px" }}>
            <table style={{ minWidth: "1220px" }}>
              <thead>
                <tr>
                  <th style={{ width: "110px", minWidth: "110px", textAlign: "center" }}>Plant</th>
                  <th style={{ width: "130px", minWidth: "130px" }}>SAP Code</th>
                  <th style={{ width: "170px", minWidth: "160px" }}>Part No.</th>
                  <th style={{ minWidth: "260px" }}>Description</th>
                  <th style={{ width: "80px", minWidth: "80px", textAlign: "center" }}>Cavity</th>
                  <th style={{ width: "90px", minWidth: "90px", textAlign: "center" }}>Shots/hr</th>
                  <th style={{ width: "100px", minWidth: "100px", textAlign: "right" }}>Price (₹)</th>
                  <th style={{ width: "110px", minWidth: "110px", textAlign: "right" }}>Part Wt (kg)</th>
                  <th style={{ width: "110px", minWidth: "110px", textAlign: "right" }}>Run Wt (kg)</th>
                  <th style={{ width: "80px", minWidth: "80px", textAlign: "center" }}>Std MP</th>
                  <th style={{ width: "130px", minWidth: "130px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "32px", color: "var(--ink-faint)" }}>
                      No matching products found.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((m) => (
                    <tr key={m.sap_code}>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: (m.plant_id || "1040") === "1040" ? "#e0f2fe" : "#f1f5f9",
                            color: (m.plant_id || "1040") === "1040" ? "#0369a1" : "#475569",
                            border: "1px solid",
                            borderColor: (m.plant_id || "1040") === "1040" ? "#bae6fd" : "#cbd5e1",
                          }}
                        >
                          {m.plant_id || "1040"}
                        </span>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {m.sap_code}
                      </td>
                      <td>
                        <div
                          title={m.part_no}
                          className="cell-truncate"
                          style={{ maxWidth: "160px" }}
                        >
                          {m.part_no}
                        </div>
                      </td>
                      <td>
                        <div
                          title={m.material_description}
                          className="cell-truncate"
                          style={{ maxWidth: "280px", fontWeight: 500 }}
                        >
                          {m.material_description}
                        </div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{m.cavity}</td>
                      <td style={{ textAlign: "center" }}>{m.shots_per_hour}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>₹{Number(m.price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{m.part_wt} kg</td>
                      <td style={{ textAlign: "right" }}>{m.run_wt} kg</td>
                      <td style={{ textAlign: "center" }}>{m.manpower}</td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button
                            className="btn small secondary"
                            onClick={() => setEditingProduct({ ...m })}
                          >
                            Edit
                          </button>
                          <button
                            className="btn small secondary"
                            style={{ color: "var(--danger, #dc2626)" }}
                            onClick={() => handleDeleteProduct(m.sap_code)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="table-pagination">
              <div>
                Showing{" "}
                <strong>
                  {filteredProducts.length === 0
                    ? 0
                    : (currentProdPage - 1) * effectiveProdPageSize + 1}
                </strong>
                {"–"}
                <strong>
                  {Math.min(currentProdPage * effectiveProdPageSize, filteredProducts.length)}
                </strong>{" "}
                of <strong>{filteredProducts.length}</strong> parts
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Rows:</span>
                  <select
                    value={prodPageSize}
                    onChange={(e) => {
                      setProdPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                      setProdPage(1);
                    }}
                    style={{
                      padding: "3px 8px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value="all">All ({filteredProducts.length})</option>
                  </select>
                </div>

                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    disabled={currentProdPage <= 1}
                    onClick={() => setProdPage(1)}
                    title="First page"
                  >
                    « First
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={currentProdPage <= 1}
                    onClick={() => setProdPage((p) => Math.max(1, p - 1))}
                    title="Previous page"
                  >
                    ‹ Prev
                  </button>
                  <span style={{ padding: "0 6px", fontWeight: 600 }}>
                    Page {currentProdPage} of {totalProdPages}
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={currentProdPage >= totalProdPages}
                    onClick={() => setProdPage((p) => Math.min(totalProdPages, p + 1))}
                    title="Next page"
                  >
                    Next ›
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={currentProdPage >= totalProdPages}
                    onClick={() => setProdPage(totalProdPages)}
                    title="Last page"
                  >
                    Last »
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Add Product Card */}
          <div className="card">
            <h4
              style={{
                fontSize: "12px",
                marginBottom: "12px",
                color: "var(--brand-primary, #0284c7)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.5px",
              }}
            >
              + ADD NEW SAP PRODUCT MASTER SPEC
            </h4>
            <div className="grid3">
              <div className="form-row">
                <label>Assigned Plant / Unit *</label>
                <select
                  value={newProduct.plant_id || plants[0]?.plant_id || "1040"}
                  onChange={(e) => setNewProduct({ ...newProduct, plant_id: e.target.value })}
                >
                  {plants.map((p) => {
                    const l = locations.find((loc) => loc.location_id === p.location_id);
                    return (
                      <option key={p.plant_id} value={p.plant_id}>
                        {p.name} {l ? `(${l.name})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>SAP Code *</label>
                <input
                  value={newProduct.sap_code}
                  placeholder="e.g. 7010009999"
                  onChange={(e) => setNewProduct({ ...newProduct, sap_code: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Part No. *</label>
                <input
                  value={newProduct.part_no}
                  placeholder="e.g. PN-9999"
                  onChange={(e) => setNewProduct({ ...newProduct, part_no: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Material Description</label>
                <input
                  value={newProduct.material_description}
                  placeholder="e.g. FRONT PANEL PP BLACK"
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, material_description: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <label>Mold Cavity</label>
                <input
                  type="number"
                  min="1"
                  value={newProduct.cavity}
                  onChange={(e) => setNewProduct({ ...newProduct, cavity: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Standard Shots / Hour</label>
                <input
                  type="number"
                  min="1"
                  value={newProduct.shots_per_hour}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, shots_per_hour: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <label>Unit Price (₹ / pc)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Part Weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={newProduct.part_wt}
                  onChange={(e) => setNewProduct({ ...newProduct, part_wt: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Runner Weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={newProduct.run_wt}
                  onChange={(e) => setNewProduct({ ...newProduct, run_wt: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Standard Manpower</label>
                <input
                  type="number"
                  min="1"
                  value={newProduct.manpower}
                  onChange={(e) => setNewProduct({ ...newProduct, manpower: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: "14px" }}>
              <button className="btn" onClick={handleAddProduct}>
                Add To Product Master
              </button>
            </div>
          </div>

          {/* Edit Product Modal */}
          {editingProduct && (
            <div className="modal-back" onClick={() => setEditingProduct(null)}>
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "680px" }}
              >
                <div className="modal-head">
                  <div>
                    <h3>Edit Product Master — {editingProduct.sap_code}</h3>
                    <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                      Update standard mold cavity, shots per hour, weights, or unit pricing.
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setEditingProduct(null)}>
                    ✕
                  </button>
                </div>

                <div className="grid2" style={{ gap: "12px", marginBottom: "14px" }}>
                  <div className="form-row">
                    <label>Assigned Plant / Unit</label>
                    <select
                      value={editingProduct.plant_id || "1040"}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, plant_id: e.target.value })
                      }
                    >
                      {plants.map((p) => {
                        const l = locations.find((loc) => loc.location_id === p.location_id);
                        return (
                          <option key={p.plant_id} value={p.plant_id}>
                            {p.name} {l ? `(${l.name})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Part Number</label>
                    <input
                      value={editingProduct.part_no}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, part_no: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Material Description</label>
                    <input
                      value={editingProduct.material_description}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          material_description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Mold Cavity</label>
                    <input
                      type="number"
                      min="1"
                      value={editingProduct.cavity}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, cavity: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Shots / Hour</label>
                    <input
                      type="number"
                      min="1"
                      value={editingProduct.shots_per_hour}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shots_per_hour: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Price (₹ / pc)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingProduct.price}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Part Weight (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={editingProduct.part_wt}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, part_wt: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Runner Weight (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={editingProduct.run_wt}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, run_wt: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Standard Manpower</label>
                    <input
                      type="number"
                      min="1"
                      value={editingProduct.manpower}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, manpower: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn secondary" onClick={() => setEditingProduct(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleSaveProductEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MACHINES MASTER TAB */}
      {/* ========================================================= */}
      {activeTab === "machines" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div className="search-box-pro" style={{ width: "360px" }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search machine ID or make/tonnage..."
                  value={searchMachine}
                  onChange={(e) => setSearchMachine(e.target.value)}
                />
                {searchMachine && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setSearchMachine("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-muted)" }}>Plant:</span>
                <select
                  value={machinePlantFilter}
                  onChange={(e) => setMachinePlantFilter(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  <option value="all">All Plants ({machines.length})</option>
                  {plants.map((p) => {
                    const count = machines.filter((m) => (m.plant_id || "1040") === p.plant_id).length;
                    return (
                      <option key={p.plant_id} value={p.plant_id}>
                        {p.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
              {filteredMachines.length} machines configured
            </span>
          </div>

          <div className="table-wrap" style={{ marginBottom: "18px" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "140px" }}>Machine ID</th>
                  <th>Machine Name / Make / Tonnage</th>
                  <th style={{ width: "230px" }}>Assigned Plant / Unit</th>
                  <th style={{ width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMachines.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ink-faint)" }}>
                      No machines found for the selected plant.
                    </td>
                  </tr>
                ) : (
                  filteredMachines.map((m) => {
                  const p = plants.find((x) => x.plant_id === m.plant_id);
                  const l = p ? locations.find((loc) => loc.location_id === p.location_id) : null;
                  return (
                    <tr key={m.machine_id}>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--brand-primary)" }}>
                        {m.machine_id}
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.machine_no}</td>
                      <td>
                        {p ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: "#f1f5f9",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            <span>🏭</span>
                            <span>{p.name}</span>
                            {l && <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>({l.name})</span>}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-faint)", fontSize: "12px" }}>— Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn small secondary"
                            onClick={() => setEditingMachine({ ...m })}
                          >
                            Edit
                          </button>
                          <button
                            className="btn small secondary"
                            style={{ color: "var(--danger, #dc2626)" }}
                            onClick={() => handleDeleteMachine(m.machine_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

          {/* Add Machine Card */}
          <div className="card">
            <h4
              style={{
                fontSize: "12px",
                marginBottom: "12px",
                color: "var(--brand-primary, #0284c7)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.5px",
              }}
            >
              + ADD NEW MACHINE MASTER
            </h4>
            <div className="grid3" style={{ gap: "14px" }}>
              <div className="form-row">
                <label>Machine ID *</label>
                <input
                  value={newMachine.machine_id}
                  placeholder="e.g. MC-99 or MC-50"
                  onChange={(e) => setNewMachine({ ...newMachine, machine_id: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Machine Display Name &amp; Spec *</label>
                <input
                  value={newMachine.machine_no}
                  placeholder="e.g. INJ-99 (Toshiba 650T)"
                  onChange={(e) => setNewMachine({ ...newMachine, machine_no: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Assigned Plant / Unit *</label>
                <select
                  value={newMachine.plant_id || (plants[0] ? plants[0].plant_id : "")}
                  onChange={(e) => setNewMachine({ ...newMachine, plant_id: e.target.value })}
                >
                  {plants.map((p) => {
                    const l = locations.find((loc) => loc.location_id === p.location_id);
                    return (
                      <option key={p.plant_id} value={p.plant_id}>
                        {p.name} {l ? `(${l.name})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "14px" }}>
              <button className="btn" onClick={handleAddMachine}>
                Add Machine
              </button>
            </div>
          </div>

          {/* Edit Machine Modal */}
          {editingMachine && (
            <div className="modal-back" onClick={() => setEditingMachine(null)}>
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "480px" }}
              >
                <div className="modal-head">
                  <div>
                    <h3>Edit Machine — {editingMachine.machine_id}</h3>
                    <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                      Update machine line designation, tonnage details, or plant assignment.
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setEditingMachine(null)}>
                    ✕
                  </button>
                </div>

                <div className="form-row" style={{ marginBottom: "14px" }}>
                  <label>Machine Name &amp; Tonnage</label>
                  <input
                    value={editingMachine.machine_no}
                    onChange={(e) =>
                      setEditingMachine({ ...editingMachine, machine_no: e.target.value })
                    }
                  />
                </div>

                <div className="form-row" style={{ marginBottom: "16px" }}>
                  <label>Assigned Plant / Unit</label>
                  <select
                    value={editingMachine.plant_id || ""}
                    onChange={(e) =>
                      setEditingMachine({ ...editingMachine, plant_id: e.target.value })
                    }
                  >
                    {plants.map((p) => {
                      const l = locations.find((loc) => loc.location_id === p.location_id);
                      return (
                        <option key={p.plant_id} value={p.plant_id}>
                          {p.name} {l ? `(${l.name})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn secondary" onClick={() => setEditingMachine(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleSaveMachineEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SHIFTS MASTER TAB */}
      {/* ========================================================= */}
      {activeTab === "shifts" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div className="search-box-pro">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search shifts by ID or timing..."
                value={searchShift}
                onChange={(e) => setSearchShift(e.target.value)}
              />
              {searchShift && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => setSearchShift("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
              {filteredShifts.length} shifts configured
            </span>
          </div>

          <div className="table-wrap" style={{ marginBottom: "18px" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>Shift ID</th>
                  <th>Shift Name</th>
                  <th style={{ width: "180px" }}>Timing Window</th>
                  <th style={{ width: "130px" }}>Planned Hours</th>
                  <th style={{ width: "120px" }}>Break Deduct</th>
                  <th style={{ width: "150px" }}>Type / Schedule</th>
                  <th style={{ width: "150px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((s) => (
                  <tr key={s.shift_id}>
                    <td className="mono" style={{ fontWeight: 700, color: "var(--brand-primary)" }}>
                      Shift {s.shift_id}
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.name || `Shift ${s.shift_id}`}</td>
                    <td className="mono" style={{ fontSize: "12.5px" }}>
                      {s.start_time && s.end_time ? (
                        <span>⏰ {s.start_time} – {s.end_time}</span>
                      ) : (
                        <span>{s.code}</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
                        }}
                      >
                        {s.planned_hours ? `${s.planned_hours} hrs` : "8.0 hrs"}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                      {s.break_mins ? `${s.break_mins} mins` : "0 min"}
                    </td>
                    <td>
                      {s.is_overnight ? (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#1e1b4b",
                            color: "#e0e7ff",
                          }}
                        >
                          🌙 Overnight
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: "#f1f5f9",
                            color: "#475569",
                          }}
                        >
                          ☀️ Same Day
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn small secondary"
                          onClick={() => setEditingShift({ ...s })}
                        >
                          Edit
                        </button>
                        <button
                          className="btn small secondary"
                          style={{ color: "var(--danger, #dc2626)" }}
                          onClick={() => handleDeleteShift(s.shift_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Shift Card */}
          <div className="card">
            <h4
              style={{
                fontSize: "12px",
                marginBottom: "12px",
                color: "var(--brand-primary, #0284c7)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.5px",
              }}
            >
              + ADD NEW SHIFT SCHEDULE
            </h4>

            {/* Quick 1-Click Presets */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
                  ⚡ 1-Click Industrial Shift Presets (Click to Auto-fill)
                </label>
                <button
                  type="button"
                  className="btn small secondary"
                  style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", background: "#f0f9ff", border: "1px solid #bae6fd" }}
                  onClick={handleApplyTwoShiftStandard}
                  title="Reset configured shifts to PGEL 2-Shift standard (07:00–19:00 & 19:00–07:00)"
                >
                  🏭 Reset to PGEL Standard 2-Shift System
                </button>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {SHIFT_PRESETS.map((pre) => (
                  <button
                    key={pre.id}
                    type="button"
                    className="btn small secondary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    onClick={() => applyShiftPreset(pre)}
                  >
                    {pre.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid3" style={{ gap: "14px", marginBottom: "14px" }}>
              <div className="form-row">
                <label>Shift ID (Short Code) *</label>
                <input
                  value={newShift.shift_id}
                  placeholder="e.g. A, B, C, D, or G"
                  onChange={(e) => setNewShift({ ...newShift, shift_id: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Shift Name / Description *</label>
                <input
                  value={newShift.name}
                  placeholder="e.g. Morning Shift"
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Unpaid Break / Meal (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={newShift.break_mins}
                  placeholder="0"
                  onChange={(e) => setNewShift({ ...newShift, break_mins: Math.max(0, Number(e.target.value)) })}
                />
              </div>
            </div>

            <div className="grid2" style={{ gap: "14px" }}>
              <div className="form-row">
                <label>Start Time (24-Hour) *</label>
                <input
                  type="time"
                  value={newShift.start_time}
                  onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                  style={{ height: "42px", fontSize: "14px" }}
                />
              </div>
              <div className="form-row">
                <label>End Time (24-Hour) *</label>
                <input
                  type="time"
                  value={newShift.end_time}
                  onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                  style={{ height: "42px", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Dynamic Real-time Duration Preview */}
            {(() => {
              const dur = calculateShiftDuration(newShift.start_time, newShift.end_time, newShift.break_mins);
              return (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "10px 14px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12.5px",
                    color: "#166534",
                    fontWeight: 600,
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>⏱️</span>
                    <span>
                      Planned Working Hours: <strong>{dur.netHours} hrs</strong> ({dur.netMinutes} mins)
                    </span>
                    {Number(newShift.break_mins) > 0 && (
                      <span style={{ color: "#15803d", fontSize: "11.5px" }}>
                        (Gross: {dur.grossHours}h minus {newShift.break_mins}m break)
                      </span>
                    )}
                  </div>
                  {dur.isOvernight && (
                    <span
                      style={{
                        background: "#1e1b4b",
                        color: "#e0e7ff",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      🌙 Overnight Shift (Crosses Midnight)
                    </span>
                  )}
                </div>
              );
            })()}

            <div style={{ marginTop: "14px" }}>
              <button className="btn" onClick={handleAddShift}>
                Add Shift Schedule
              </button>
            </div>
          </div>

          {/* Edit Shift Modal */}
          {editingShift && (
            <div className="modal-back" onClick={() => setEditingShift(null)}>
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "520px" }}
              >
                <div className="modal-head">
                  <div>
                    <h3>Edit Shift Schedule — Shift {editingShift.shift_id}</h3>
                    <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                      Update shift timing window, break deduction, or schedule name.
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setEditingShift(null)}>
                    ✕
                  </button>
                </div>

                <div className="form-row" style={{ marginBottom: "14px" }}>
                  <label>Shift Name</label>
                  <input
                    value={editingShift.name || `Shift ${editingShift.shift_id}`}
                    onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                  />
                </div>

                <div className="grid2" style={{ gap: "12px", marginBottom: "14px" }}>
                  <div className="form-row">
                    <label>Start Time (24h)</label>
                    <input
                      type="time"
                      value={editingShift.start_time || "06:00"}
                      onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                      style={{ height: "42px", fontSize: "14px" }}
                    />
                  </div>
                  <div className="form-row">
                    <label>End Time (24h)</label>
                    <input
                      type="time"
                      value={editingShift.end_time || "14:00"}
                      onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                      style={{ height: "42px", fontSize: "14px" }}
                    />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: "14px" }}>
                  <label>Unpaid Break / Lunch (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={editingShift.break_mins || 0}
                    onChange={(e) => setEditingShift({ ...editingShift, break_mins: Math.max(0, Number(e.target.value)) })}
                  />
                </div>

                {/* Edit Duration Preview */}
                {(() => {
                  const dur = calculateShiftDuration(
                    editingShift.start_time || "06:00",
                    editingShift.end_time || "14:00",
                    editingShift.break_mins || 0
                  );
                  return (
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "10px 12px",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#166534",
                        fontWeight: 600,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>⏱️ Planned: <strong>{dur.netHours} hrs</strong> ({dur.netMinutes} mins)</span>
                      {dur.isOvernight && (
                        <span style={{ background: "#1e1b4b", color: "#e0e7ff", padding: "2px 6px", borderRadius: "4px", fontSize: "10.5px" }}>
                          🌙 Overnight
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn secondary" onClick={() => setEditingShift(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleSaveShiftEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. REASON CODES (DOWNTIMES & REJECTIONS) TAB */}
      {/* ========================================================= */}
      {activeTab === "reasons" && (
        <div>
          {/* Category Filter & Search Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                className={`btn small ${reasonFilterCat === "all" ? "" : "secondary"}`}
                onClick={() => setReasonFilterCat("all")}
              >
                All Categories ({reasonCodes.length})
              </button>
              <button
                className={`btn small ${reasonFilterCat === "rejection" ? "" : "secondary"}`}
                onClick={() => setReasonFilterCat("rejection")}
                style={{ color: "var(--danger, #ef4444)" }}
              >
                🔴 Rejections ({reasonCodes.filter((r) => r.category === "rejection").length})
              </button>
              <button
                className={`btn small ${reasonFilterCat === "planned_dt" ? "" : "secondary"}`}
                onClick={() => setReasonFilterCat("planned_dt")}
                style={{ color: "var(--brand-primary, #0284c7)" }}
              >
                🔵 Planned DT ({reasonCodes.filter((r) => r.category === "planned_dt").length})
              </button>
              <button
                className={`btn small ${reasonFilterCat === "unplanned_dt" ? "" : "secondary"}`}
                onClick={() => setReasonFilterCat("unplanned_dt")}
                style={{ color: "var(--warn, #f59e0b)" }}
              >
                🟠 Unplanned DT ({reasonCodes.filter((r) => r.category === "unplanned_dt").length})
              </button>
            </div>

            <div className="search-box-pro">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search reason code or name..."
                value={searchReason}
                onChange={(e) => setSearchReason(e.target.value)}
              />
              {searchReason && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => setSearchReason("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap" style={{ marginBottom: "18px" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "180px" }}>Reason ID</th>
                  <th>Reason Name</th>
                  <th style={{ width: "160px" }}>Category</th>
                  <th style={{ width: "100px" }}>Unit</th>
                  <th style={{ width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReasons.map((r) => {
                  let badgeColor = "#ef4444";
                  let catLabel = "Rejection Defect";
                  if (r.category === "planned_dt") {
                    badgeColor = "#0284c7";
                    catLabel = "Planned Downtime";
                  } else if (r.category === "unplanned_dt") {
                    badgeColor = "#f59e0b";
                    catLabel = "Unplanned Downtime";
                  }

                  return (
                    <tr key={r.reason_id}>
                      <td className="mono" style={{ fontSize: "12px" }}>
                        {r.reason_id}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: badgeColor,
                            background: `${badgeColor}15`,
                            border: `1px solid ${badgeColor}30`,
                          }}
                        >
                          {catLabel}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                          {r.unit === "qty" ? "Pieces (Pcs)" : "Minutes (min)"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn small secondary"
                            onClick={() => setEditingReason({ ...r })}
                          >
                            Edit
                          </button>
                          <button
                            className="btn small secondary"
                            style={{ color: "var(--danger, #dc2626)" }}
                            onClick={() => handleDeleteReason(r.reason_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Reason Code Card */}
          <div className="card">
            <h4
              style={{
                fontSize: "12px",
                marginBottom: "12px",
                color: "var(--brand-primary, #0284c7)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.5px",
              }}
            >
              + ADD NEW REASON / DEFECT CODE
            </h4>
            <div className="grid3" style={{ gap: "14px" }}>
              <div className="form-row">
                <label>Reason Name *</label>
                <input
                  value={newReason.name}
                  placeholder="e.g. FLASH / BURR or WATER CHILLER"
                  onChange={(e) => setNewReason({ ...newReason, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Category *</label>
                <select
                  value={newReason.category}
                  onChange={(e) =>
                    setNewReason({
                      ...newReason,
                      category: e.target.value,
                      unit: e.target.value === "rejection" ? "qty" : "min",
                    })
                  }
                >
                  <option value="rejection">🔴 Rejection Defect (Pieces)</option>
                  <option value="planned_dt">🔵 Planned Downtime (Minutes)</option>
                  <option value="unplanned_dt">🟠 Unplanned Downtime (Minutes)</option>
                </select>
              </div>
              <div className="form-row">
                <label>Reason ID (Optional, auto-generated)</label>
                <input
                  value={newReason.reason_id}
                  placeholder="Leave empty for auto-ID"
                  onChange={(e) => setNewReason({ ...newReason, reason_id: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: "14px" }}>
              <button className="btn" onClick={handleAddReason}>
                Add Reason Code
              </button>
            </div>
          </div>

          {/* Edit Reason Modal */}
          {editingReason && (
            <div className="modal-back" onClick={() => setEditingReason(null)}>
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "480px" }}
              >
                <div className="modal-head">
                  <div>
                    <h3>Edit Reason — {editingReason.reason_id}</h3>
                    <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                      Update reason name or classification category.
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setEditingReason(null)}>
                    ✕
                  </button>
                </div>

                <div className="form-row" style={{ marginBottom: "14px" }}>
                  <label>Reason Name</label>
                  <input
                    value={editingReason.name}
                    onChange={(e) =>
                      setEditingReason({ ...editingReason, name: e.target.value.toUpperCase() })
                    }
                  />
                </div>

                <div className="form-row" style={{ marginBottom: "16px" }}>
                  <label>Category</label>
                  <select
                    value={editingReason.category}
                    onChange={(e) =>
                      setEditingReason({
                        ...editingReason,
                        category: e.target.value,
                        unit: e.target.value === "rejection" ? "qty" : "min",
                      })
                    }
                  >
                    <option value="rejection">🔴 Rejection Defect (Pieces)</option>
                    <option value="planned_dt">🔵 Planned Downtime (Minutes)</option>
                    <option value="unplanned_dt">🟠 Unplanned Downtime (Minutes)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn secondary" onClick={() => setEditingReason(null)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleSaveReasonEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. USERS & ROLES MASTER TAB */}
      {/* ========================================================= */}
      {activeTab === "users" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink-title)" }}>
                Plant Users &amp; Access Credentials
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--ink-faint)" }}>
                Manage Shop Floor Operators, Supervisors, and Plant Administrators with secure password authentication.
              </p>
            </div>
            <div className="search-box-pro">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search user, name, code, or role..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
              {searchUser && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => setSearchUser("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap" style={{ marginBottom: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>EMP CODE</th>
                  <th>FULL NAME</th>
                  <th>USERNAME</th>
                  <th>ROLE</th>
                  <th>ASSIGNED UNIT / LOCATION</th>
                  <th>DEPARTMENT</th>
                  <th>EMAIL (FOR OTP LOGIN)</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "20px", color: "var(--ink-faint)" }}>
                      No plant users match the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {u.employee_code || "—"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td className="mono" style={{ color: "var(--brand-primary)" }}>
                        {u.username}
                      </td>
                      <td>
                        <span className={`role-pill role-${u.role}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", fontWeight: 700 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            background: "#f1f5f9",
                            borderRadius: "4px",
                            border: "1px solid #e2e8f0",
                          }}
                          title={
                            getUserAccessiblePlants(u, plants, locations)
                              .map((p) => p.name)
                              .join(", ") || "No units"
                          }
                        >
                          {formatUserScopeLabel(u, plants, locations)}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                        {u.department || "—"}
                      </td>
                      <td className="mono" style={{ fontSize: "12px", color: "var(--brand-primary)" }}>
                        {u.email || `${u.username}@pgel.in`}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn small secondary"
                            onClick={() => startEditUser(u)}
                            title="Edit User or Update Email"
                          >
                            ✏️ Edit / Access
                          </button>
                          {u.username !== "admin" && (
                            <button
                              className="btn small secondary"
                              style={{ color: "var(--danger, #dc2626)" }}
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add User Form */}
          <div
            style={{
              background: "var(--bg-subtle, #f8f9fa)",
              padding: "14px",
              borderRadius: "8px",
              border: "1px dashed #cbd5e1",
            }}
          >
            <h4
              style={{
                fontSize: "11px",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.5px",
                marginBottom: "10px",
              }}
            >
              + REGISTER NEW PLANT USER
            </h4>
            <div className="grid3" style={{ gap: "10px", marginBottom: "10px" }}>
              <div className="form-row">
                <label>Username / Login ID *</label>
                <input
                  value={newUser.username}
                  placeholder="e.g. rohit"
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value.toLowerCase().trim() })
                  }
                />
              </div>
              <div className="form-row">
                <label>Full Name *</label>
                <input
                  value={newUser.name}
                  placeholder="e.g. Rohit Verma"
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Employee Code</label>
                <input
                  value={newUser.employee_code}
                  placeholder="e.g. PG-215"
                  onChange={(e) =>
                    setNewUser({ ...newUser, employee_code: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>

            <div className="grid3" style={{ gap: "10px", marginBottom: "12px" }}>
              <div className="form-row">
                <label>Email (For OTP Login) *</label>
                <input
                  type="email"
                  value={newUser.email || ""}
                  placeholder="e.g. rohit.verma@pgel.in"
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value.toLowerCase().trim() })}
                />
              </div>
              <div className="form-row">
                <label>System Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="operator">Operator (Entry &amp; My entries)</option>
                  <option value="supervisor">Supervisor (Plant Register)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>
              <div className="form-row">
                <label>Department / Line</label>
                <input
                  value={newUser.department}
                  placeholder="e.g. Injection Molding Line 3"
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                />
              </div>
            </div>

            {/* Plant & Location Authorization Matrix */}
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 700,
                  fontSize: "11px",
                  color: "var(--brand-primary)",
                  letterSpacing: "0.5px",
                }}
              >
                PLANT &amp; LOCATION AUTHORIZATION MATRIX *
              </label>
              <PlantAccessMatrixSelector
                locations={locations}
                plants={plants}
                scopeType={newUser.scope_type || "custom"}
                selectedPlantIds={newUser.assigned_plant_ids || []}
                selectedLocationIds={newUser.assigned_location_ids || []}
                onChange={(matrixState) => {
                  setNewUser({
                    ...newUser,
                    scope_type: matrixState.scope_type,
                    assigned_plant_ids: matrixState.assigned_plant_ids,
                    assigned_location_ids: matrixState.assigned_location_ids,
                  });
                }}
              />
            </div>

            <button type="button" className="btn small" onClick={handleAddUser}>
              + Add Plant User
            </button>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="modal-backdrop" onClick={() => setEditingUser(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "640px", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-head">
              <div>
                <h3>Edit User &amp; Access Scope — {editingUser.username}</h3>
                <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
                  Update user profile, credentials, and customize plant/location authorization matrix.
                </p>
              </div>
              <button className="modal-close" onClick={() => setEditingUser(null)}>
                ✕
              </button>
            </div>

            <div className="grid2" style={{ gap: "12px", marginBottom: "12px" }}>
              <div className="form-row">
                <label>Full Name *</label>
                <input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Employee Code</label>
                <input
                  value={editingUser.employee_code || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, employee_code: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>

            <div className="grid3" style={{ gap: "12px", marginBottom: "14px" }}>
              <div className="form-row">
                <label>Role *</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="form-row">
                <label>Registered Email (For OTP) *</label>
                <input
                  type="email"
                  value={editingUser.email || ""}
                  placeholder="e.g. user@pgel.in"
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value.toLowerCase().trim() })}
                />
              </div>
              <div className="form-row">
                <label>Department / Line</label>
                <input
                  value={editingUser.department || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                />
              </div>
            </div>

            {/* Plant & Location Authorization Matrix */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 700,
                  fontSize: "11px",
                  color: "var(--brand-primary)",
                  letterSpacing: "0.5px",
                }}
              >
                PLANT &amp; LOCATION AUTHORIZATION MATRIX *
              </label>
              <PlantAccessMatrixSelector
                locations={locations}
                plants={plants}
                scopeType={editingUser.scope_type || "custom"}
                selectedPlantIds={editingUser.assigned_plant_ids || []}
                selectedLocationIds={editingUser.assigned_location_ids || []}
                onChange={(matrixState) => {
                  setEditingUser({
                    ...editingUser,
                    scope_type: matrixState.scope_type,
                    assigned_plant_ids: matrixState.assigned_plant_ids,
                    assigned_location_ids: matrixState.assigned_location_ids,
                  });
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
              <button className="btn" onClick={handleSaveUserEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
