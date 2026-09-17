import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGetMetaAdsAnalyticsTool } from "./tools/getMetaAdsAnalytics.js";

const server = new McpServer({
  name: "meta-ads-mcp",
  version: "0.1.0",
});

registerGetMetaAdsAnalyticsTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
