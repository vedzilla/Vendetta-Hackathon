import type { ToolSet } from "ai";

export async function getBrightDataTools(): Promise<ToolSet> {
  // Production stub — Bright Data MCP integration deferred.
  // The demo scenarios don't reach research-target steps that would call this.
  return {} as ToolSet;
}

export async function closeBrightDataClient(): Promise<void> {
  // No-op
}
