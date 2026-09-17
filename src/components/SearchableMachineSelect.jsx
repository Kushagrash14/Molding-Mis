import { useState, useMemo, useRef, useEffect } from "react";

export default function SearchableMachineSelect({
  value,
  onChange,
  machines = [],
  disabled = false,
  placeholder = "-- Select Machine --",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

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
    }
  }, [isOpen]);

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

  // Filter machines based on search query
  const filteredMachines = useMemo(() => {
    if (!search.trim()) return machines;
    const term = search.toLowerCase().trim();
    return machines.filter((m) => {
      const id = (m.machine_id || "").toLowerCase();
      const no = (m.machine_no || "").toLowerCase();
      return id.includes(term) || no.includes(term);
    });
  }, [machines, search]);

  const selectedMachine = useMemo(() => {
    if (!value) return null;
    return machines.find((m) => m.machine_id === value) || {
      machine_id: value,
      machine_no: value,
    };
  }, [machines, value]);

  function handleSelect(machineId) {
    onChange(machineId);
    setIsOpen(false);
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange("");
  }

  // Keyboard navigation
  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        if (disabled) return;
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % Math.max(1, filteredMachines.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev - 1 + filteredMachines.length) % Math.max(1, filteredMachines.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredMachines[highlightIdx]) {
        handleSelect(filteredMachines[highlightIdx].machine_id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", width: "100%" }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Box */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        style={{
          minHeight: "38px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: disabled ? "#f8fafc" : "#ffffff",
          border: isOpen
            ? "1.5px solid var(--brand-primary, #0284c7)"
            : disabled
            ? "1.5px solid #e2e8f0"
            : "1.5px solid #cbd5e1",
          borderRadius: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: isOpen ? "0 0 0 3px rgba(2, 132, 199, 0.12)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedMachine ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className="mono"
                style={{
                  fontWeight: 800,
                  color: "#0f172a",
                  fontSize: "12px",
                  background: "#f1f5f9",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #e2e8f0",
                }}
              >
                {selectedMachine.machine_id}
              </span>
              <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>
                {selectedMachine.machine_no}
              </span>
            </div>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
          {selectedMachine && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
          <span
            style={{
              fontSize: "10px",
              color: "#94a3b8",
              transform: isOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.15s ease",
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            border: "1.5px solid #cbd5e1",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            zIndex: 9999,
            overflow: "hidden",
            maxHeight: "340px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: "8px 12px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "13px", color: "#64748b" }}>🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIdx(0);
              }}
              placeholder="Search machine no., make, tonnage (e.g. INJ-01, 700T)..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "13px",
                color: "#0f172a",
                outline: "none",
                padding: "3px 0",
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
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, whiteSpace: "nowrap" }}>
              {filteredMachines.length} machines
            </span>
          </div>

          {/* Results List */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {filteredMachines.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                No machines found matching "{search}".
              </div>
            ) : (
              filteredMachines.map((m, idx) => {
                const isSelected = m.machine_id === value;
                const isHighlighted = idx === highlightIdx;

                return (
                  <div
                    key={m.machine_id}
                    onClick={() => handleSelect(m.machine_id)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    style={{
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: isSelected
                        ? "#f0fdf4"
                        : isHighlighted
                        ? "#f1f5f9"
                        : "transparent",
                      borderLeft: isSelected
                        ? "3px solid #16a34a"
                        : isHighlighted
                        ? "3px solid var(--brand-primary, #0284c7)"
                        : "3px solid transparent",
                      transition: "background 0.1s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                      <span
                        className="mono"
                        style={{
                          fontWeight: 800,
                          color: isSelected ? "#166534" : "#0f172a",
                          fontSize: "12px",
                          background: isSelected ? "#dcfce7" : "#f1f5f9",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: isSelected ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                          minWidth: "60px",
                          textAlign: "center",
                        }}
                      >
                        {m.machine_id}
                      </span>
                      <span
                        style={{
                          fontWeight: isSelected ? 800 : 600,
                          color: isSelected ? "#166534" : "#1e293b",
                          fontSize: "13px",
                        }}
                      >
                        {m.machine_no}
                      </span>
                    </div>

                    {isSelected && (
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#16a34a",
                          fontWeight: 800,
                          marginLeft: "8px",
                        }}
                      >
                        ✓
                      </span>
                    )}
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