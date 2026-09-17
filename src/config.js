// Loads environment variables for both the API server and the MCP server.
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3000,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  reportingTimezone: process.env.REPORTING_TIMEZONE || "Asia/Kolkata",

  trubuddyDb: {
    host: process.env.TRUBUDDY_DB_HOST,
    port: Number(process.env.TRUBUDDY_DB_PORT) || 3306,
    database: process.env.TRUBUDDY_DB_DATABASE,
    user: process.env.TRUBUDDY_DB_USER,
    password: process.env.TRUBUDDY_DB_PASSWORD || "",
  },

  trubuddyProductCatalogPath: process.env.TRUBUDDY_PRODUCT_CATALOG_PATH,
};
