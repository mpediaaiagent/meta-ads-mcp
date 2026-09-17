import mysql from "mysql2/promise";
import { config } from "../../config.js";

// Read-only by construction: every pooled connection is put into a read-only
// transaction mode as soon as it's opened, so a mistake in application code
// can never write to the TruBuddy website DB.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: false,
});

pool.on("connection", (connection) => {
  connection.query("SET SESSION TRANSACTION READ ONLY");
});

export async function queryTrubuddyDb(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
