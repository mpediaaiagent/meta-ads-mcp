import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetMetaAdsAnalyticsTool } from "./tools/getMetaAdsAnalytics.js";

// Shared factory so both the stdio entry point (server.js, local Claude Desktop
// use) and the Streamable HTTP entry point (httpServer.js, remote connector use)
// register the exact same tools the exact same way.
export function createMcpServer() {
  const server = new McpServer({
    name: "meta-ads-mcp",
    version: "0.1.0",
  });

  registerGetMetaAdsAnalyticsTool(server);

  return server;
}
