import { useState, useMemo, useRef, useEffect } from "react";

export default function SearchableSapSelect({
  value,
  onChange,
  master = [],
  disabled = false,
  isLockedToContinuedMold = false,
  placeholder = "-- Select SAP Product Code --",
  prevShiftSap = null,
  prevMaster = null,
  forceOpen = false,
  onCloseForceOpen = null,
  onTriggerClick = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync external forceOpen
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setHighlightIdx(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      if (onCloseForceOpen) onCloseForceOpen();
    }
  }, [isOpen, onCloseForceOpen]);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter master products based on search term
  const filteredMaster = useMemo(() => {
    if (!search.trim()) return master;
    const term = search.toLowerCase().trim();
    return master.filter((m) => {
      const code = (m.sap_code || "").toLowerCase();
      const part = (m.part_no || "").toLowerCase();
      const desc = (m.material_description || "").toLowerCase();
      return code.includes(term) || part.includes(term) || desc.includes(term);
    });
  }, [master, search]);

  const selectedItem = useMemo(() => {
    if (!value) return null;
    return (
      master.find((m) => m.sap_code === value) || {
        sap_code: value,
        part_no: "",
        material_description: "",
      }
    );
  }, [master, value]);

  function handleSelect(sapCode) {
    onChange(sapCode);
    setIsOpen(false);
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange("");
  }

  // Handle keyboard navigation
  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        if (disabled || isLockedToContinuedMold) return;
        if (onTriggerClick && onTriggerClick()) {
          return;
        }
        setIsOpen(true);
      }
      return;
    }

    const totalItems = (prevShiftSap && !search ? 1 : 0) + filteredMaster.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (prevShiftSap && !search && highlightIdx === 0) {
        handleSelect(prevShiftSap);
      } else {
        const itemIdx = prevShiftSap && !search ? highlightIdx - 1 : highlightIdx;
        if (filteredMaster[itemIdx]) {
          handleSelect(filteredMaster[itemIdx].sap_code);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
      style={{ position: "relative", width: "100%" }}
    >
      {/* Trigger Box (Looks like standard form input) */}
      <div
        onClick={() => {
          if (disabled) return;
          if (isLockedToContinuedMold) {
            // Locked to continued mold: only cross button works
            return;
          }
          if (onTriggerClick && onTriggerClick()) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        tabIndex={disabled || isLockedToContinuedMold ? -1 : 0}
        style={{
          minHeight: "42px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px",
          background: disabled ? "#f8fafc" : isLockedToContinuedMold ? "#f8fafc" : "#ffffff",
          border: isOpen
            ? "1.5px solid #2563eb"
            : disabled
            ? "1.5px solid #e2e8f0"
            : isLockedToContinuedMold
            ? "1.5px solid #bbf7d0"
            : "1.5px solid #cbd5e1",
          borderRadius: "8px",
          cursor: disabled ? "not-allowed" : isLockedToContinuedMold ? "default" : "pointer",
          boxShadow: isOpen ? "0 0 0 3px rgba(37, 99, 235, 0.12)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedItem ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                className="mono"
                style={{
                  fontWeight: 800,
                  color: "#0f172a",
                  fontSize: "12.5px",
                  background: isLockedToContinuedMold ? "#dcfce7" : "#f1f5f9",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  border: isLockedToContinuedMold ? "1px solid #bbf7d0" : "none",
                }}
              >
                {selectedItem.sap_code}
              </span>
              {selectedItem.part_no && (
                <span
                  style={{
                    fontWeight: 700,
                    color: "#1e293b",
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={selectedItem.part_no}
                >
                  {selectedItem.part_no}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
          {selectedItem && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title={isLockedToContinuedMold ? "Remove continued mold (click to reset & re-decide)" : "Clear selection"}
              style={{
                background: isLockedToContinuedMold ? "#fee2e2" : "#f1f5f9",
                border: isLockedToContinuedMold ? "1px solid #fca5a5" : "none",
                borderRadius: "50%",
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                color: isLockedToContinuedMold ? "#dc2626" : "#64748b",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              ✕
            </button>
          )}
          {!isLockedToContinuedMold && (
            <span style={{ fontSize: "11px", color: "#94a3b8", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
              ▼
            </span>
          )}
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "380px",
            maxWidth: "min(520px, 92vw)",
            background: "#ffffff",
            border: "1.5px solid #cbd5e1",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            zIndex: 9999,
            overflow: "hidden",
            maxHeight: "360px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Box Header */}
          <div
            style={{
              padding: "10px 12px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "14px", color: "#64748b" }}>🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIdx(0);
              }}
              placeholder="Search SAP code, part number, or description..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "13px",
                color: "#0f172a",
                outline: "none",
                padding: "2px 0",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "2px 4px",
                }}
              >
                ✕
              </button>
            )}
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, marginLeft: "4px" }}>
              {filteredMaster.length} items
            </span>
          </div>

          {/* Results List */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {/* Quick Action: Carried from Previous Shift */}
            {prevShiftSap && prevMaster && !search && (
              <div
                onClick={() => handleSelect(prevShiftSap)}
                style={{
                  padding: "10px 14px",
                  background: highlightIdx === 0 ? "#ecfdf5" : "#f0fdf4",
                  borderBottom: "1px solid #bbf7d0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        background: "#16a34a",
                        color: "#ffffff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontSize: "10.5px",
                        fontWeight: 800,
                      }}
                    >
                      ⚡ PREV SHIFT MOLD
                    </span>
                    <span className="mono" style={{ fontWeight: 800, color: "#166534", fontSize: "13px" }}>
                      {prevMaster.sap_code}
                    </span>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>
                      {prevMaster.part_no}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#334155", marginTop: "2px" }}>
                    {prevMaster.material_description} · ({prevMaster.cavity || 1} Cav · {prevMaster.shots_per_hour || 60} s/h)
                  </div>
                </div>
                <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 800 }}>
                  Select ➔
                </span>
              </div>
            )}

            {filteredMaster.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                No matching SAP product code found for &quot;<strong>{search}</strong>&quot;.
              </div>
            ) : (
              filteredMaster.map((item, idx) => {
                const isSelected = item.sap_code === value;
                const effectiveIdx = prevShiftSap && !search ? idx + 1 : idx;
                const isHighlighted = effectiveIdx === highlightIdx;

                return (
                  <div
                    key={item.sap_code}
                    onClick={() => handleSelect(item.sap_code)}
                    onMouseEnter={() => setHighlightIdx(effectiveIdx)}
                    style={{
                      padding: "8px 14px",
                      cursor: "pointer",
                      background: isSelected
                        ? "#eff6ff"
                        : isHighlighted
                        ? "#f8fafc"
                        : "#ffffff",
                      borderLeft: isSelected
                        ? "3px solid #2563eb"
                        : "3px solid transparent",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      transition: "background 0.1s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="mono" style={{ fontWeight: 800, color: "#0f172a", fontSize: "12.5px" }}>
                          {item.sap_code}
                        </span>
                        <span style={{ fontWeight: 700, color: "#334155", fontSize: "12.5px" }}>
                          {item.part_no}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                        {item.cavity || 1} Cavity · {item.shots_per_hour || 60} Shots/Hr
                      </div>
                    </div>

                    <div style={{ fontSize: "12px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.material_description || "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
