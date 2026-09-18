import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { SEED_MASTER, MACHINES, SHIFTS, LOCATIONS, PLANTS, REASON_CODES, USERS } from "../../src/data/seedData.js";

dotenv.config();

const dbHost = process.env.DB_HOST || "localhost";
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME || "molding_mis_db";

async function main() {
  console.log("=== Initializing AWS RDS MySQL Database ===");
  console.log("Connecting to:", dbHost, "Port:", dbPort, "User:", dbUser);

  // 1. Connect without database name to ensure DB exists
  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
  });

  console.log(`Creating database if not exists: ${dbName}...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();

  // 2. Connect to database
  const db = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  console.log("Creating tables...");

  await db.query(`
    CREATE TABLE IF NOT EXISTS locations (
      location_id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS plants (
      plant_id VARCHAR(50) PRIMARY KEY,
      location_id VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100),
      employee_code VARCHAR(50),
      name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL,
      department VARCHAR(100),
      assigned_location_ids JSON,
      assigned_plant_ids JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      shift_id VARCHAR(10) PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      break_mins INT DEFAULT 0,
      planned_hours DECIMAL(4,2) NOT NULL,
      is_overnight BOOLEAN DEFAULT FALSE,
      code VARCHAR(100)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS machines (
      machine_id VARCHAR(50) PRIMARY KEY,
      machine_no VARCHAR(100) NOT NULL,
      plant_id VARCHAR(50) NOT NULL,
      FOREIGN KEY (plant_id) REFERENCES plants(plant_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      sap_code VARCHAR(50) PRIMARY KEY,
      part_no VARCHAR(100),
      material_description VARCHAR(255) NOT NULL,
      cavity INT DEFAULT 1,
      shots_per_hour INT DEFAULT 60,
      price DECIMAL(10,2) DEFAULT 1.00,
      part_wt DECIMAL(8,4) DEFAULT 0.0000,
      run_wt DECIMAL(8,4) DEFAULT 0.0000,
      manpower INT DEFAULT 1
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reason_codes (
      reason_id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(30) NOT NULL,
      unit VARCHAR(20) DEFAULT 'qty'
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS production_entries (
      entry_id VARCHAR(50) PRIMARY KEY,
      plant_id VARCHAR(50) NOT NULL,
      machine_id VARCHAR(50) NOT NULL,
      shift_date DATE NOT NULL,
      shift_id VARCHAR(10) NOT NULL,
      status VARCHAR(20) DEFAULT 'submitted',
      entered_by VARCHAR(50) NOT NULL,
      entered_by_name VARCHAR(100),
      locked_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
      FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
      FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS mold_runs (
      run_id VARCHAR(60) PRIMARY KEY,
      entry_id VARCHAR(50) NOT NULL,
      run_index INT NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      sap_code VARCHAR(50) NOT NULL,
      material_description VARCHAR(255),
      part_no VARCHAR(100),
      running_cavity INT NOT NULL,
      hr_mp_declare INT DEFAULT 0,
      prod_mp_declare INT DEFAULT 0,
      ok_prod INT DEFAULT 0,
      run_hour DECIMAL(5,2) DEFAULT 0.00,
      other_dt_remark TEXT,
      is_continued BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (entry_id) REFERENCES production_entries(entry_id) ON DELETE CASCADE,
      FOREIGN KEY (sap_code) REFERENCES products(sap_code)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS run_reasons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      run_id VARCHAR(60) NOT NULL,
      reason_id VARCHAR(50) NOT NULL,
      value DECIMAL(8,2) NOT NULL,
      remark TEXT,
      FOREIGN KEY (run_id) REFERENCES mold_runs(run_id) ON DELETE CASCADE,
      FOREIGN KEY (reason_id) REFERENCES reason_codes(reason_id)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(60) PRIMARY KEY,
      entry_id VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      summary TEXT NOT NULL,
      changed_by VARCHAR(50) NOT NULL,
      changed_by_name VARCHAR(100),
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  console.log("Seeding reference data...");

  // Seed Locations
  for (const loc of LOCATIONS) {
    await db.query(
      `INSERT INTO locations (location_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [loc.location_id, loc.name]
    );
  }

  // Seed Plants
  for (const p of PLANTS) {
    await db.query(
      `INSERT INTO plants (plant_id, location_id, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [p.plant_id, p.location_id, p.name]
    );
  }

  // Seed Users
  for (const u of USERS) {
    await db.query(
      `INSERT INTO users (id, username, email, employee_code, name, role, department, assigned_location_ids, assigned_plant_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role)`,
      [
        u.id,
        u.username,
        u.email || null,
        u.employee_code || null,
        u.name,
        u.role,
        u.department || null,
        JSON.stringify(u.assigned_location_ids || ["all"]),
        JSON.stringify(u.assigned_plant_ids || ["all"]),
      ]
    );
  }

  // Seed Shifts
  for (const s of SHIFTS) {
    await db.query(
      `INSERT INTO shifts (shift_id, name, start_time, end_time, break_mins, planned_hours, is_overnight, code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), start_time = VALUES(start_time), end_time = VALUES(end_time)`,
      [s.shift_id, s.name, s.start_time, s.end_time, s.break_mins || 0, s.planned_hours, s.is_overnight ? 1 : 0, s.code]
    );
  }

  // Seed Machines (85 machines)
  console.log(`Seeding ${MACHINES.length} machines...`);
  for (const m of MACHINES) {
    await db.query(
      `INSERT INTO machines (machine_id, machine_no, plant_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE machine_no = VALUES(machine_no)`,
      [m.machine_id, m.machine_no, m.plant_id]
    );
  }

  // Seed Reason Codes
  for (const r of REASON_CODES) {
    await db.query(
      `INSERT INTO reason_codes (reason_id, name, category, unit) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category)`,
      [r.reason_id, r.name, r.category, r.unit || "qty"]
    );
  }

  // Seed Products (1,146 SAP codes) in batch
  console.log(`Seeding ${SEED_MASTER.length} products from Budget 1 master...`);
  const batchSize = 100;
  for (let i = 0; i < SEED_MASTER.length; i += batchSize) {
    const chunk = SEED_MASTER.slice(i, i + batchSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = chunk.flatMap((p) => [
      p.sap_code,
      p.part_no || "",
      p.material_description || "",
      p.cavity || 1,
      p.shots_per_hour || 60,
      p.price || 1.0,
      p.part_wt || 0,
      p.run_wt || 0,
      p.manpower || 1,
    ]);

    await db.query(
      `INSERT INTO products (sap_code, part_no, material_description, cavity, shots_per_hour, price, part_wt, run_wt, manpower)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         part_no = VALUES(part_no),
         material_description = VALUES(material_description),
         cavity = VALUES(cavity),
         shots_per_hour = VALUES(shots_per_hour),
         price = VALUES(price),
         part_wt = VALUES(part_wt),
         run_wt = VALUES(run_wt),
         manpower = VALUES(manpower)`,
      values
    );
  }

  console.log("Database initialized and reference data seeded successfully! 🚀");
  await db.end();
}

main().catch((err) => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});
