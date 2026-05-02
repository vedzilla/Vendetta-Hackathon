/**
 * Bright Data MCP — the agent's only web-access path.
 * Tools are exposed via MCP and consumed via the AI SDK's tool interface.
 *
 * Implementation in Block A→B (Terminal 1).
 */

import type { ToolSet } from "ai";

export async function getBrightDataTools(): Promise<ToolSet> {
  throw new Error("not implemented: getBrightDataTools");
}

export async function closeBrightDataClient(): Promise<void> {
  throw new Error("not implemented: closeBrightDataClient");
}
