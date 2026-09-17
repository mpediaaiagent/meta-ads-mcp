// Loads environment variables for both the API server and the MCP server.
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3000,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  reportingTimezone: process.env.REPORTING_TIMEZONE || "Asia/Kolkata",

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
  },

  trubuddyAnalytics: {
    url: process.env.TRUBUDDY_ANALYTICS_URL || "",
    secret: process.env.TRUBUDDY_ANALYTICS_SECRET || "",
  },

  productCatalogPath: process.env.PRODUCT_CATALOG_PATH || "src/api/data/allProducts.json",
};
