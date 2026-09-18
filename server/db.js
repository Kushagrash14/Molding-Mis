import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "molding_mis_db",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MySQL successfully!");
    connection.release();
    return true;
  } catch (err) {
    console.error("MySQL connection error:", err.message);
    return false;
  }
}
