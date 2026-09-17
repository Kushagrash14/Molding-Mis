import React from "react";

/**
 * PlantAccessMatrixSelector
 * Industrial-grade Plant & Location Authorization Matrix Component.
 * Supports:
 * - Enterprise / Corporate full access (All Plants & Locations)
 * - Multi-plant selection within a single location (e.g. Unit-01 + Unit-02)
 * - Multi-location selection (e.g. Greater Noida + Ahmednagar)
 * - Cross-location hybrid selection (e.g. Unit-01 in Gr. Noida + Unit-04 in Bhiwadi)
 */
export default function PlantAccessMatrixSelector({
  locations = [],
  plants = [],
  scopeType = "custom", // 'all' | 'custom'
  selectedPlantIds = [],
  selectedLocationIds = [],
  onChange,
}) {
  const isCorporateAll = scopeType === "all";

  // Handle switching between Corporate All vs Custom Matrix
  function handleModeChange(mode) {
    if (mode === "all") {
      onChange({
        scope_type: "all",
        assigned_plant_ids: ["all"],
        assigned_location_ids: ["all"],
      });
    } else {
      // Default to currently selected plants or fallback to first plant
      const fallbackPlantId = plants[0]?.plant_id || "PLANT-U02";
      const initialPlants =
        selectedPlantIds.filter((id) => id !== "all").length > 0
          ? selectedPlantIds.filter((id) => id !== "all")
          : [fallbackPlantId];

      const initialLocs =
        selectedLocationIds.filter((id) => id !== "all").length > 0
          ? selectedLocationIds.filter((id) => id !== "all")
          : [plants.find((p) => p.plant_id === initialPlants[0])?.location_id || "LOC-GN"];

      onChange({
        scope_type: "custom",
        assigned_plant_ids: initialPlants,
        assigned_location_ids: initialLocs,
      });
    }
  }

  // Check if an individual plant is selected
  function isPlantSelected(plantId) {
    if (isCorporateAll) return true;
    return selectedPlantIds.includes(plantId);
  }

  // Toggle individual plant
  function togglePlant(plant) {
    if (isCorporateAll) return;

    let newPlants = [...selectedPlantIds.filter((id) => id !== "all")];
    if (newPlants.includes(plant.plant_id)) {
      newPlants = newPlants.filter((id) => id !== plant.plant_id);
    } else {
      newPlants.push(plant.plant_id);
    }

    // Sync location IDs based on selected plants
    const locPlants = plants.filter((p) => p.location_id === plant.location_id);
    const locPlantsSelected = locPlants.filter((p) => newPlants.includes(p.plant_id));
    let newLocs = [...selectedLocationIds.filter((id) => id !== "all")];

    if (locPlants.length > 0 && locPlantsSelected.length === locPlants.length) {
      if (!newLocs.includes(plant.location_id)) newLocs.push(plant.location_id);
    } else {
      newLocs = newLocs.filter((id) => id !== plant.location_id);
    }

    onChange({
      scope_type: "custom",
      assigned_plant_ids: newPlants,
      assigned_location_ids: newLocs,
    });
  }

  // Toggle entire location (All plants in this location)
  function toggleLocation(location) {
    if (isCorporateAll) return;

    const locPlants = plants.filter((p) => p.location_id === location.location_id);
    const locPlantIds = locPlants.map((p) => p.plant_id);
    const currentSelected = selectedPlantIds.filter((id) => id !== "all");
    const allLocPlantsSelected = locPlantIds.every((id) => currentSelected.includes(id));

    let newPlants = [...currentSelected];
    let newLocs = [...selectedLocationIds.filter((id) => id !== "all")];

    if (allLocPlantsSelected) {
      // Uncheck all plants in this location
      newPlants = newPlants.filter((id) => !locPlantIds.includes(id));
      newLocs = newLocs.filter((id) => id !== location.location_id);
    } else {
      // Check all plants in this location
      locPlantIds.forEach((id) => {
        if (!newPlants.includes(id)) newPlants.push(id);
      });
      if (!newLocs.includes(location.location_id)) {
        newLocs.push(location.location_id);
      }
    }

    onChange({
      scope_type: "custom",
      assigned_plant_ids: newPlants,
      assigned_location_ids: newLocs,
    });
  }

  // Select all units across all locations
  function handleSelectAll() {
    onChange({
      scope_type: "custom",
      assigned_plant_ids: plants.map((p) => p.plant_id),
      assigned_location_ids: locations.map((l) => l.location_id),
    });
  }

  // Clear all selections
  function handleClearAll() {
    onChange({
      scope_type: "custom",
      assigned_plant_ids: [],
      assigned_location_ids: [],
    });
  }

  // Derive selection stats for custom view
  const activePlantCount = isCorporateAll
    ? plants.length
    : selectedPlantIds.filter((id) => id !== "all").length;

  const spannedLocCount = isCorporateAll
    ? locations.length
    : new Set(
        plants
          .filter((p) => selectedPlantIds.includes(p.plant_id))
          .map((p) => p.location_id)
      ).size;

  return (
    <div className="access-matrix-wrapper">
      {/* Scope Mode Selector Tabs */}
      <div className="matrix-scope-mode-tabs">
        <label
          className={`matrix-mode-pill ${isCorporateAll ? "active corporate" : ""}`}
          onClick={() => handleModeChange("all")}
        >
          <input
            type="radio"
            name="scope_mode"
            checked={isCorporateAll}
            onChange={() => handleModeChange("all")}
          />
          <span className="pill-content">
            <span className="pill-title">🌐 Corporate / All Plants</span>
            <span className="pill-sub">Full access across all present &amp; future units</span>
          </span>
        </label>

        <label
          className={`matrix-mode-pill ${!isCorporateAll ? "active custom" : ""}`}
          onClick={() => handleModeChange("custom")}
        >
          <input
            type="radio"
            name="scope_mode"
            checked={!isCorporateAll}
            onChange={() => handleModeChange("custom")}
          />
          <span className="pill-content">
            <span className="pill-title">🎯 Custom Plant &amp; Location Matrix</span>
            <span className="pill-sub">Assign 1 plant, 2 plants in 1 location, or multiple locations</span>
          </span>
        </label>
      </div>

      {/* MATRIX CONTROLS & CHECKLIST (When Custom is Selected) */}
      {!isCorporateAll ? (
        <div className="matrix-body">
          {/* Quick Toolbar */}
          <div className="matrix-toolbar">
            <div className="matrix-stats-chip">
              <span className="stats-dot"></span>
              <strong>{activePlantCount}</strong> of {plants.length} Unit(s) Selected &middot;{" "}
              <strong>{spannedLocCount}</strong> Location(s) Spanned
            </div>

            <div className="matrix-quick-btns">
              <button
                type="button"
                className="btn-matrix-action"
                onClick={handleSelectAll}
                title="Select all manufacturing units"
              >
                ⚡ Select All Units
              </button>
              <button
                type="button"
                className="btn-matrix-action secondary"
                onClick={handleClearAll}
                title="Clear current selection"
              >
                ✕ Clear All
              </button>
            </div>
          </div>

          {activePlantCount === 0 && (
            <div className="matrix-alert-warning">
              ⚠️ <strong>No units selected:</strong> User will not be able to log entries or view production data. Please select at least one unit.
            </div>
          )}

          {/* Grouped Location Cards */}
          <div className="matrix-locations-list">
            {locations.map((loc) => {
              const locPlants = plants.filter((p) => p.location_id === loc.location_id);
              const selectedInLoc = locPlants.filter((p) =>
                selectedPlantIds.includes(p.plant_id)
              );
              const isAllLoc =
                locPlants.length > 0 && selectedInLoc.length === locPlants.length;
              const isPartialLoc =
                selectedInLoc.length > 0 && selectedInLoc.length < locPlants.length;

              return (
                <div
                  key={loc.location_id}
                  className={`matrix-location-card ${isAllLoc ? "loc-all-selected" : isPartialLoc ? "loc-partial-selected" : ""}`}
                >
                  {/* Location Header with Master Checkbox */}
                  <div
                    className="matrix-loc-header"
                    onClick={(e) => {
                      if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
                        toggleLocation(loc);
                      }
                    }}
                  >
                    <div className="loc-title-group">
                      <input
                        type="checkbox"
                        checked={isAllLoc}
                        ref={(el) => {
                          if (el) el.indeterminate = isPartialLoc;
                        }}
                        onChange={() => toggleLocation(loc)}
                        title={`Select / deselect all plants in ${loc.name}`}
                      />
                      <div>
                        <span className="loc-name">📍 {loc.name}</span>
                      </div>
                    </div>

                    <div className="loc-action-group">
                      <span className="loc-badge-count">
                        {selectedInLoc.length} / {locPlants.length} Units
                      </span>
                      <button
                        type="button"
                        className="btn-text-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLocation(loc);
                        }}
                      >
                        {isAllLoc ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                  </div>

                  {/* Plants inside this Location */}
                  <div className="matrix-plants-grid">
                    {locPlants.map((plant) => {
                      const isChecked = isPlantSelected(plant.plant_id);
                      return (
                        <label
                          key={plant.plant_id}
                          className={`matrix-plant-tile ${isChecked ? "tile-checked" : ""}`}
                          onClick={(e) => {
                            if (e.target.tagName !== "INPUT") {
                              e.preventDefault();
                              togglePlant(plant);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePlant(plant)}
                          />
                          <div className="plant-tile-info">
                            <span className="plant-tile-title">🏭 {plant.name}</span>
                            <span className="plant-tile-desc">
                              Code: {plant.plant_id}
                            </span>
                          </div>
                          {isChecked && <span className="plant-check-icon">✓</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="matrix-corporate-notice">
          <div className="corp-icon">🏢</div>
          <div>
            <div className="corp-title">ENTERPRISE CORPORATE ACCESS ACTIVATED</div>
            <div className="corp-subtitle">
              This user has unrestricted permissions across all {plants.length} plant units in {locations.length} locations (Greater Noida, Pune, Bhiwadi, and any new plants added in Master).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
