/**
 * Bright Data MCP — the agent's only web-access path.
 *
 * Tools are exposed via Bright Data's hosted MCP server and consumed via the
 * AI SDK's MCP client interface. We pre-filter to three tool groups so the
 * LLM has ~15–20 tools to pick from rather than the full 50+ catalogue.
 *
 * Cache the connection at module scope: opening an SSE stream per workflow
 * step would be wasteful, and the MCP client is safe to share.
 */

import { experimental_createMCPClient } from "ai";
import type { ToolSet } from "ai";

type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

let _tools: ToolSet | null = null;
let _client: MCPClient | null = null;
let _pending: Promise<ToolSet> | null = null;

async function connect(): Promise<ToolSet> {
  const token = process.env.BRIGHT_DATA_TOKEN;
  if (!token) {
    throw new Error(
      "BRIGHT_DATA_TOKEN not set. Get one from the Bright Data credits link.",
    );
  }

  const params = new URLSearchParams({ token });
  if (process.env.BRIGHT_DATA_PRO === "1") params.set("pro", "1");
  if (process.env.BRIGHT_DATA_GROUPS) {
    params.set("groups", process.env.BRIGHT_DATA_GROUPS);
  }

  _client = await experimental_createMCPClient({
    transport: {
      type: "sse",
      url: `https://mcp.brightdata.com/sse?${params.toString()}`,
    },
  });

  _tools = await _client.tools();
  return _tools;
}

/**
 * Lazily open and cache the Bright Data MCP connection. Concurrent callers
 * share the same in-flight promise so we never open two SSE streams.
 */
export async function getBrightDataTools(): Promise<ToolSet> {
  if (_tools) return _tools;
  if (_pending) return _pending;
  _pending = connect().finally(() => {
    _pending = null;
  });
  return _pending;
}

/**
 * Close the MCP connection. Useful for hot-reload paths and graceful
 * shutdown — production Functions can leave it open.
 */
export async function closeBrightDataClient(): Promise<void> {
  if (_client) {
    try {
      await _client.close();
    } catch (e) {
      console.warn("[brightdata] close failed", e);
    }
    _client = null;
    _tools = null;
  }
}
