// Loads environment variables for both the API server and the MCP server.
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3000,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  reportingTimezone: process.env.REPORTING_TIMEZONE || "Asia/Kolkata",

  trubuddyAnalytics: {
    url: process.env.TRUBUDDY_ANALYTICS_URL || "",
  },
};
