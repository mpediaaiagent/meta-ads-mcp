import mysql from "mysql2/promise";
import { config } from "../../config.js";

// Read-only by construction: every pooled connection is put into a read-only
// transaction mode as soon as it's opened, so a mistake in application code
// can never write to the TruBuddy website DB.
const pool = mysql.createPool({
  host: config.trubuddyDb.host,
  port: config.trubuddyDb.port,
  database: config.trubuddyDb.database,
  user: config.trubuddyDb.user,
  password: config.trubuddyDb.password,
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
