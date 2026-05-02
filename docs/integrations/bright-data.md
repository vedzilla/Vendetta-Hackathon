# Integration: Bright Data (Web Access via MCP)

The agent's eyes on the web. Without Bright Data, the agent can't find each company's complaints address or look up the right regulator.

**Docs:** https://docs.brightdata.com
**LLM-friendly index:** https://docs.brightdata.com/llms.txt
**MCP overview:** https://docs.brightdata.com/ai/mcp-server/overview
**Tools reference:** https://docs.brightdata.com/ai/mcp-server/tools

## Mental model

Bright Data exposes ~50 web-scraping tools as a hosted MCP server. We connect the AI SDK to it; the LLM picks which tool to call. The tools fall into:

- **Free tier (Rapid mode):** `search_engine`, `scrape_as_markdown` — works on any URL.
- **Pro tier (we have credits):** structured tools for LinkedIn, Amazon, Instagram, Google Maps, etc. — much faster than scraping.
- **Browser automation:** `scraping_browser_*` tools for sites that need clicks/typing.

For Vendetta, the tools we'll lean on most:

| Tool | Use case |
|------|----------|
| `search_engine` | Find regulator pages, executive contacts, complaints policies |
| `scrape_as_markdown` | Read airline / council complaints policy pages cleanly |
| `extract` | Pull structured data (deadlines, addresses) from forms |
| `web_data_linkedin_person_profile` | Find decision-makers for escalation copy |
| `web_data_google_maps_reviews` | Stretch: pattern-match other people's complaint outcomes |
| `scraping_browser_navigate` + `scraping_browser_type_ref` | Stretch: autofill the regulator's submission form |

## Setup

No npm package — connect via SSE.

`.env.local`:
```
BRIGHT_DATA_TOKEN=<from credits link Saturday morning>
BRIGHT_DATA_PRO=1
BRIGHT_DATA_GROUPS=advanced_scraping,business,social
```

The `groups` parameter is critical — loading all 50+ tools at once bloats the LLM's context window and degrades tool selection. Pre-filter to the groups we actually need:
- `advanced_scraping` — `search_engine`, `scrape_as_markdown`, `extract`
- `business` — Crunchbase, Google Maps reviews, Zoominfo, Zillow
- `social` — LinkedIn, X, Instagram, Facebook, TikTok, YouTube

For a hackathon, this trio covers everything.

## Wrapper module (`src/lib/brightdata.ts`)

```ts
import { experimental_createMCPClient } from "ai";
import type { ToolSet } from "ai";

let _tools: ToolSet | null = null;
let _client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;

export async function getBrightDataTools(): Promise<ToolSet> {
  if (_tools) return _tools;

  const token = process.env.BRIGHT_DATA_TOKEN;
  if (!token) {
    throw new Error("BRIGHT_DATA_TOKEN not set. Get one from the credits link Saturday morning.");
  }

  const params = new URLSearchParams({ token });
  if (process.env.BRIGHT_DATA_PRO === "1") params.set("pro", "1");
  if (process.env.BRIGHT_DATA_GROUPS) params.set("groups", process.env.BRIGHT_DATA_GROUPS);

  _client = await experimental_createMCPClient({
    transport: {
      type: "sse",
      url: `https://mcp.brightdata.com/sse?${params.toString()}`,
    },
  });

  _tools = await _client.tools();
  return _tools;
}

// Optional: clean up MCP connection on app shutdown
export async function closeBrightDataConnection(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _tools = null;
  }
}
```

## Using it in the research step

```ts
// src/workflows/steps/research.ts
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { reasoningModel } from "@/lib/ai";
import { getBrightDataTools } from "@/lib/brightdata";
import { getMemoryContext } from "@/lib/mubit";
import type { Grievance } from "@/types/grievance";

export async function researchTarget(grievance: Grievance) {
  "use step";

  const memory = await getMemoryContext({
    grievanceId: grievance.id,
    query: `Research target for ${grievance.facts.company} — ${grievance.category}`,
  });

  const tools = await getBrightDataTools();
  const writable = getWritable<{ status: string }>();

  const agent = new DurableAgent({
    model: reasoningModel,
    instructions: `
You are a research agent. The user has a ${grievance.category} grievance against
${grievance.facts.company ?? "an unknown company"}.

Your job: find these four things and return them as JSON:
1. The company's official complaints email address
2. The relevant UK or EU regulator and their submission URL
3. The exact statute articles to cite (e.g. "Regulation EC 261/2004, Article 7(1)(b)")
4. Optionally: the customer-experience director's LinkedIn profile

PRIOR LESSONS FROM SIMILAR CAMPAIGNS:
${memory || "(no prior lessons yet)"}

Use search_engine first to discover the right pages. Then scrape_as_markdown to read them.
For LinkedIn lookups, use web_data_linkedin_person_profile directly.
Stream a one-line "status" update before each major action so the user can follow along.
    `.trim(),
    tools,
  });

  const result = await agent.stream({
    messages: [{ role: "user", content: grievance.rawDescription }],
    writable,
  });

  // Extract the structured response from the final assistant message
  const lastMessage = result.messages[result.messages.length - 1];
  // ... parse JSON from lastMessage ...
  return parsedResearch;
}
```

## Tool budget — keep it tight

If the LLM has too many tools loaded, it picks worse ones. Empirically:
- ≤ 10 tools: LLM picks well, low latency.
- 10–25 tools: still OK, slight degradation.
- 25+ tools: noticeable confusion, especially on smaller models.

By setting `BRIGHT_DATA_GROUPS=advanced_scraping,business,social` we should land in the 15–20 tool range. If you see the LLM picking weird tools (e.g. `web_data_tiktok_shop` for a flight-delay query), tighten the groups further.

## Failure handling

Bright Data is rate-limited (5,000 requests/month free, plus your event credits). Wrap calls and degrade gracefully:

```ts
try {
  const research = await researchTarget(grievance);
  // ...
} catch (e) {
  if (e instanceof Error && e.message.includes("rate")) {
    // Fall back to a hardcoded vertical-default address
    return DEFAULT_RESEARCH[grievance.category];
  }
  throw e;
}
```

For the demo: pre-cache the top-5 UK airlines' complaints emails as Mubit `fact` entries so research can short-circuit if Bright Data hiccups.

## What to mention to the Bright Data sponsor

The Bright Data $1k overall winner kicker rewards creative tool use. To maximize your odds, your README + pitch should explicitly call out:
- "Bright Data's MCP gave the agent eyes on the web with one config line."
- "We use search_engine for discovery, scrape_as_markdown for policy pages, and web_data_linkedin_person_profile to find the right exec to escalate to."
- "No custom scrapers, no proxy management, no CAPTCHA fighting."

That's three tools across three tiers — exactly what wins the BD prize on creativity-of-use.
