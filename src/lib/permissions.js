/**
 * Plant & Location-Based Access Control (RBAC & Multi-Plant Security)
 * Helper functions to determine user authorization scopes across manufacturing units.
 * Supports enterprise multi-plant authorization matrix:
 * - Corporate / All Plants
 * - Multiple plants in a single location (e.g. Unit-01 + Unit-02)
 * - Multiple whole locations (e.g. Greater Noida + Ahmednagar)
 * - Cross-location hybrid selection (e.g. Unit-01 in Gr. Noida + Unit-04 in Bhiwadi)
 */

/**
 * Returns the exact list of plants a user is authorized to access.
 */
export function getUserAccessiblePlants(user, plants = [], locations = []) {
  if (!user) return [];

  // Super Admin / Corporate Head Office access
  const isCorporateAll =
    !user.assigned_plant_ids ||
    user.assigned_plant_ids.includes("all") ||
    user.assigned_location_id === "all" ||
    (Array.isArray(user.assigned_location_ids) && user.assigned_location_ids.includes("all"));

  if (isCorporateAll) {
    return plants;
  }

  const assignedPlantSet = new Set(
    Array.isArray(user.assigned_plant_ids) ? user.assigned_plant_ids : []
  );
  const assignedLocSet = new Set(
    Array.isArray(user.assigned_location_ids)
      ? user.assigned_location_ids
      : user.assigned_location_id
      ? [user.assigned_location_id]
      : []
  );

  // A plant is accessible if its plant_id is explicitly selected
  // OR if its parent location_id is selected!
  return plants.filter(
    (p) => assignedPlantSet.has(p.plant_id) || assignedLocSet.has(p.location_id)
  );
}

/**
 * Returns the list of locations containing accessible plants for this user.
 */
export function getUserAccessibleLocations(user, plants = [], locations = []) {
  if (!user) return [];

  const accessiblePlants = getUserAccessiblePlants(user, plants, locations);
  const accessibleLocIds = new Set(accessiblePlants.map((p) => p.location_id));
  return locations.filter((l) => accessibleLocIds.has(l.location_id));
}

/**
 * Checks if a user has permission to view or submit records for a specific plant ID.
 */
export function isUserAuthorizedForPlant(user, plantId, plants = [], locations = []) {
  if (!user || !plantId) return false;
  const accessiblePlants = getUserAccessiblePlants(user, plants, locations);
  return accessiblePlants.some((p) => p.plant_id === plantId);
}

/**
 * Returns a human-friendly string describing the user's access scope.
 */
export function formatUserScopeLabel(user, plants = [], locations = []) {
  if (!user) return "No Access";

  const isCorporateAll =
    !user.assigned_plant_ids ||
    user.assigned_plant_ids.includes("all") ||
    user.assigned_location_id === "all" ||
    (Array.isArray(user.assigned_location_ids) && user.assigned_location_ids.includes("all"));

  const accessiblePlants = getUserAccessiblePlants(user, plants, locations);

  if (accessiblePlants.length === 0) {
    return "🚫 No Units Assigned";
  }

  if (isCorporateAll || (plants.length > 0 && accessiblePlants.length === plants.length)) {
    return "🌐 Corporate (All Plants)";
  }

  // Single unit assigned
  if (accessiblePlants.length === 1) {
    const p = accessiblePlants[0];
    const loc = locations.find((l) => l.location_id === p.location_id);
    return `🏭 ${p.name}${loc ? ` (${loc.name})` : ""}`;
  }

  // Check how many distinct locations are represented
  const distinctLocIds = [...new Set(accessiblePlants.map((p) => p.location_id))];

  // Case 1: All assigned plants belong to the SAME location
  if (distinctLocIds.length === 1) {
    const locId = distinctLocIds[0];
    const loc = locations.find((l) => l.location_id === locId);
    const locName = loc ? loc.name : "Location";
    const totalInLoc = plants.filter((p) => p.location_id === locId).length;

    // If every unit in this location is assigned
    if (totalInLoc > 0 && accessiblePlants.length === totalInLoc) {
      return `📍 All Units in ${locName} (${totalInLoc})`;
    }
    // Specific subset of units in this location (e.g. Unit-01, Unit-02)
    return `🏭 ${accessiblePlants.map((p) => p.name).join(", ")} (${locName})`;
  }

  // Case 2: Spans multiple locations
  // Check if every unit of the spanned locations is included
  const allPlantsInSpannedLocs = plants.filter((p) => distinctLocIds.includes(p.location_id));
  if (
    allPlantsInSpannedLocs.length > 0 &&
    allPlantsInSpannedLocs.length === accessiblePlants.length
  ) {
    const locNames = distinctLocIds
      .map((lid) => locations.find((l) => l.location_id === lid)?.name || lid)
      .join(", ");
    return `📍 ${distinctLocIds.length} Full Locations (${locNames})`;
  }

  // Case 3: Mixed custom units across multiple locations
  if (accessiblePlants.length <= 3) {
    return `🏭 ${accessiblePlants.map((p) => p.name).join(", ")}`;
  }

  return `🏭 ${accessiblePlants.length} Units (${distinctLocIds.length} Locations)`;
}
