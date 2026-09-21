// Loads environment variables for both the API server and the MCP server.
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3000,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  reportingTimezone: process.env.REPORTING_TIMEZONE || "Asia/Kolkata",

  trubuddyAnalytics: {
    url: process.env.TRUBUDDY_ANALYTICS_URL || "",
  },

  mcpHttp: {
    port: Number(process.env.MCP_HTTP_PORT) || 3001,
    // 127.0.0.1 keeps the SDK's built-in DNS-rebinding protection on for local runs.
    // Override to the real hostname (via allowedHosts too) only once this is deployed
    // behind HTTPS for remote/connector use.
    host: process.env.MCP_HTTP_HOST || "127.0.0.1",
  },
};
