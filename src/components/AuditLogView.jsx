export default function AuditLogView({ log }) {
  const sorted = [...log].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
  return (
    <div className="card">
      {sorted.length === 0 && (
        <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>
          No admin overrides yet. Locked-entry edits by admin will appear here.
        </p>
      )}
      {sorted.map((a) => (
        <div className="audit-entry" key={a.id}>
          <div className="a-top">{a.summary}</div>
          <div className="a-meta">
            {a.changed_by_name} \u00b7 {new Date(a.changed_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
