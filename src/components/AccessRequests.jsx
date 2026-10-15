import { useMemo, useState } from "react";

function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AccessRequests({ requests = [], plants = [], currentUser, onDecide }) {
  const [busy, setBusy] = useState(null);
  const plantName = (id) => plants.find((p) => p.plant_id === id)?.name || id;

  const visible = useMemo(() => {
    const allowed = new Set((currentUser?.assigned_plant_ids || []).map(String));
    const mine =
      currentUser?.role === "admin"
        ? requests
        : requests.filter((r) => allowed.size === 0 || allowed.has(String(r.plant_id)));
    return [...mine].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [requests, currentUser]);

  const pending = visible.filter((r) => r.status === "pending").length;

  async function decide(id, approve) {
    setBusy(id + (approve ? "y" : "n"));
    try {
      await onDecide(id, approve);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ar-page">
      <div className="ar-head">
        <div>
          <h2>Entry access requests</h2>
          <p>Approve a request and that operator can edit those dates for the next 24 hours.</p>
        </div>
        <span className="ar-count">{pending} pending</span>
      </div>
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="left">Operator</th>
              <th>Plant</th>
              <th className="left">Dates</th>
              <th className="left">Note</th>
              <th>Asked</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="ct-empty">
                  No access requests yet.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const open = r.status === "approved" && r.unlock_until && new Date(r.unlock_until).getTime() > Date.now();
              return (
                <tr key={r.id}>
                  <td className="left strong">{r.requested_by_name}</td>
                  <td>{plantName(r.plant_id)}</td>
                  <td className="left">{(r.dates || []).join(", ")}</td>
                  <td className="left">{r.note || "—"}</td>
                  <td>{fmtWhen(r.created_at)}</td>
                  <td>
                    {r.status === "pending" && <span className="ar-pill wait">Pending</span>}
                    {r.status === "approved" && (
                      <span className="ar-pill ok">{open ? `Open till ${fmtWhen(r.unlock_until)}` : "24h finished"}</span>
                    )}
                    {r.status === "rejected" && <span className="ar-pill no">Rejected</span>}
                  </td>
                  <td>
                    {r.status === "pending" ? (
                      <div className="ar-actions">
                        <button type="button" className="ar-yes" disabled={busy} onClick={() => decide(r.id, true)}>
                          Approve 24h
                        </button>
                        <button type="button" className="ar-no" disabled={busy} onClick={() => decide(r.id, false)}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="ar-by">{r.decided_by_name || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
