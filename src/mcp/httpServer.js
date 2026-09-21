import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config.js";
import { createMcpServer } from "./createServer.js";

// Remote entry point for this MCP server, reachable over the network (the
// stdio entry point in server.js only works for one local process at a time).
// This is what a hosted connector (Claude Code `--transport http`, a Claude.ai
// custom connector, MCP Inspector against a URL, etc.) talks to instead of
// spawning `node src/mcp/server.js` on their own machine.
//
// Stateful mode: each MCP session (one Claude conversation's connection to this
// server) gets its own McpServer + transport pair, tracked by the
// `mcp-session-id` header, matching the MCP Streamable HTTP spec.

const app = createMcpExpressApp({ host: config.mcpHttp.host });

const transportsBySessionId = {};

async function handleMcpPost(req, res) {
  const sessionId = req.headers["mcp-session-id"];

  try {
    let transport;

    if (sessionId && transportsBySessionId[sessionId]) {
      transport = transportsBySessionId[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const server = createMcpServer();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transportsBySessionId[newSessionId] = transport;
        },
      });

      transport.onclose = () => {
        const closedSessionId = transport.sessionId;
        if (closedSessionId) {
          delete transportsBySessionId[closedSessionId];
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP POST request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

async function handleMcpSessionRequest(req, res) {
  const sessionId = req.headers["mcp-session-id"];

  if (!sessionId || !transportsBySessionId[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transportsBySessionId[sessionId];
  await transport.handleRequest(req, res);
}

app.post("/mcp", handleMcpPost);
app.get("/mcp", handleMcpSessionRequest);
app.delete("/mcp", handleMcpSessionRequest);

app.listen(config.mcpHttp.port, () => {
  console.log(
    `meta-ads-mcp Streamable HTTP server listening on http://localhost:${config.mcpHttp.port}/mcp`
  );
});

process.on("SIGINT", async () => {
  for (const sessionId of Object.keys(transportsBySessionId)) {
    try {
      await transportsBySessionId[sessionId].close();
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
    delete transportsBySessionId[sessionId];
  }
  process.exit(0);
});
