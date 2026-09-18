import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool, testConnection } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Health check
app.get("/api/health", async (req, res) => {
  const dbOk = await testConnection();
  res.json({ status: "ok", timestamp: new Date().toISOString(), database: dbOk ? "connected" : "disconnected" });
});

// Bootstrap initial data for frontend
app.get("/api/bootstrap", async (req, res) => {
  try {
    const [locations] = await pool.query("SELECT * FROM locations ORDER BY name ASC");
    const [plants] = await pool.query("SELECT * FROM plants ORDER BY name ASC");
    const [users] = await pool.query("SELECT id, username, email, employee_code, name, role, department, assigned_location_ids, assigned_plant_ids FROM users");
    const [shifts] = await pool.query("SELECT * FROM shifts ORDER BY shift_id ASC");
    const [machines] = await pool.query("SELECT * FROM machines ORDER BY machine_no ASC");
    const [products] = await pool.query("SELECT * FROM products ORDER BY sap_code ASC");
    const [reasonCodes] = await pool.query("SELECT * FROM reason_codes");

    // Fetch entries with multi-mold runs
    const [entryRows] = await pool.query("SELECT * FROM production_entries ORDER BY shift_date DESC, created_at DESC LIMIT 500");
    const entryIds = entryRows.map((e) => e.entry_id);

    let runsMap = {};
    if (entryIds.length > 0) {
      const [runs] = await pool.query("SELECT * FROM mold_runs WHERE entry_id IN (?) ORDER BY run_index ASC", [entryIds]);
      const runIds = runs.map((r) => r.run_id);

      let reasonsMap = {};
      if (runIds.length > 0) {
        const [reasons] = await pool.query("SELECT * FROM run_reasons WHERE run_id IN (?)", [runIds]);
        for (const r of reasons) {
          if (!reasonsMap[r.run_id]) reasonsMap[r.run_id] = {};
          reasonsMap[r.run_id][r.reason_id] = Number(r.value);
        }
      }

      for (const r of runs) {
        if (!runsMap[r.entry_id]) runsMap[r.entry_id] = [];
        runsMap[r.entry_id].push({
          run_id: r.run_id,
          run_index: r.run_index,
          start_time: r.start_time,
          end_time: r.end_time,
          sap_code: r.sap_code,
          material_description: r.material_description,
          part_no: r.part_no,
          running_cavity: r.running_cavity,
          hr_mp_declare: r.hr_mp_declare,
          prod_mp_declare: r.prod_mp_declare,
          ok_prod: r.ok_prod,
          run_hour: Number(r.run_hour),
          other_dt_remark: r.other_dt_remark,
          is_continued: Boolean(r.is_continued),
          reasons: reasonsMap[r.run_id] || {},
        });
      }
    }

    const entries = entryRows.map((e) => ({
      entry_id: e.entry_id,
      plant_id: e.plant_id,
      machine_id: e.machine_id,
      shift_date: e.shift_date ? new Date(e.shift_date).toISOString().slice(0, 10) : "",
      shift_id: e.shift_id,
      status: e.status,
      entered_by: e.entered_by,
      entered_by_name: e.entered_by_name,
      locked_at: e.locked_at,
      created_at: e.created_at,
      updated_at: e.updated_at,
      runs: runsMap[e.entry_id] || [],
    }));

    const [auditLogs] = await pool.query("SELECT * FROM audit_logs ORDER BY changed_at DESC LIMIT 200");

    res.json({
      locations,
      plants,
      users: users.map((u) => ({
        ...u,
        assigned_location_ids: typeof u.assigned_location_ids === "string" ? JSON.parse(u.assigned_location_ids) : u.assigned_location_ids,
        assigned_plant_ids: typeof u.assigned_plant_ids === "string" ? JSON.parse(u.assigned_plant_ids) : u.assigned_plant_ids,
      })),
      shifts,
      machines,
      master: products,
      reasonCodes,
      entries,
      auditLog: auditLogs,
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    res.status(500).json({ error: "Failed to load bootstrap data", details: err.message });
  }
});

// Create new production entry
app.post("/api/entries", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { entry_id, plant_id, machine_id, shift_date, shift_id, status = "submitted", entered_by, entered_by_name, runs = [] } = req.body;

    if (!entry_id || !machine_id || !shift_date || !shift_id) {
      return res.status(400).json({ error: "Missing required entry fields" });
    }

    await conn.beginTransaction();

    // Insert entry
    await conn.query(
      `INSERT INTO production_entries (entry_id, plant_id, machine_id, shift_date, shift_id, status, entered_by, entered_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry_id, plant_id, machine_id, shift_date, shift_id, status, entered_by || "u_operator", entered_by_name || "Operator"]
    );

    // Insert runs & reasons
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const runId = r.run_id || `${entry_id}_run_${i + 1}`;

      await conn.query(
        `INSERT INTO mold_runs (run_id, entry_id, run_index, start_time, end_time, sap_code, material_description, part_no, running_cavity, hr_mp_declare, prod_mp_declare, ok_prod, run_hour, other_dt_remark, is_continued)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          entry_id,
          i + 1,
          r.start_time || "07:00",
          r.end_time || "19:00",
          r.sap_code,
          r.material_description || null,
          r.part_no || null,
          Number(r.running_cavity) || 1,
          Number(r.hr_mp_declare) || 0,
          Number(r.prod_mp_declare) || 0,
          Number(r.ok_prod) || 0,
          Number(r.run_hour) || 0,
          r.other_dt_remark || null,
          r.is_continued ? 1 : 0,
        ]
      );

      if (r.reasons && typeof r.reasons === "object") {
        for (const [reason_id, val] of Object.entries(r.reasons)) {
          const numVal = Number(val);
          if (numVal > 0) {
            await conn.query(
              `INSERT INTO run_reasons (run_id, reason_id, value) VALUES (?, ?, ?)`,
              [runId, reason_id, numVal]
            );
          }
        }
      }
    }

    await conn.commit();
    res.json({ success: true, entry_id });
  } catch (err) {
    await conn.rollback();
    console.error("Save entry error:", err);
    res.status(500).json({ error: "Failed to save entry", details: err.message });
  } finally {
    conn.release();
  }
});

// Update production entry
app.put("/api/entries/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const entryId = req.params.id;
    const { status, runs = [], auditEntry } = req.body;

    await conn.beginTransaction();

    if (status) {
      await conn.query("UPDATE production_entries SET status = ? WHERE entry_id = ?", [status, entryId]);
    }

    // Replace runs if provided
    if (runs && runs.length > 0) {
      await conn.query("DELETE FROM mold_runs WHERE entry_id = ?", [entryId]);

      for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        const runId = r.run_id || `${entryId}_run_${i + 1}`;

        await conn.query(
          `INSERT INTO mold_runs (run_id, entry_id, run_index, start_time, end_time, sap_code, material_description, part_no, running_cavity, hr_mp_declare, prod_mp_declare, ok_prod, run_hour, other_dt_remark, is_continued)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            runId,
            entryId,
            i + 1,
            r.start_time || "07:00",
            r.end_time || "19:00",
            r.sap_code,
            r.material_description || null,
            r.part_no || null,
            Number(r.running_cavity) || 1,
            Number(r.hr_mp_declare) || 0,
            Number(r.prod_mp_declare) || 0,
            Number(r.ok_prod) || 0,
            Number(r.run_hour) || 0,
            r.other_dt_remark || null,
            r.is_continued ? 1 : 0,
          ]
        );

        if (r.reasons && typeof r.reasons === "object") {
          for (const [reason_id, val] of Object.entries(r.reasons)) {
            const numVal = Number(val);
            if (numVal > 0) {
              await conn.query(
                `INSERT INTO run_reasons (run_id, reason_id, value) VALUES (?, ?, ?)`,
                [runId, reason_id, numVal]
              );
            }
          }
        }
      }
    }

    // Insert audit entry if provided
    if (auditEntry) {
      await conn.query(
        `INSERT INTO audit_logs (id, entry_id, action, summary, changed_by, changed_by_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          auditEntry.id || `aud_${Date.now()}`,
          entryId,
          auditEntry.action || "UPDATE",
          auditEntry.summary || "Entry updated",
          auditEntry.changed_by || "u_admin",
          auditEntry.changed_by_name || "Admin",
        ]
      );
    }

    await conn.commit();
    res.json({ success: true, entry_id: entryId });
  } catch (err) {
    await conn.rollback();
    console.error("Update entry error:", err);
    res.status(500).json({ error: "Failed to update entry", details: err.message });
  } finally {
    conn.release();
  }
});

// Run lock-cutoff
app.post("/api/lock-cutoff", async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE production_entries SET status = 'locked', locked_at = NOW() WHERE status = 'submitted' AND created_at < DATE_SUB(NOW(), INTERVAL 12 HOUR)"
    );
    res.json({ success: true, lockedCount: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: "Lock cutoff error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Molding MIS Backend API running on port ${PORT}`);
});
