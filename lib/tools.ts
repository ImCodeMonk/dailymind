import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { embed, upsertVector } from "@/lib/vectorstore";

/**
 * Web search via the Tavily REST API.
 *
 * NOTE: The installed @langchain/community version only ships
 * `TavilySearchAPIRetriever` (a retriever, not an agent tool), so rather than
 * depend on a specific package version we call Tavily's HTTP endpoint directly.
 * Needs TAVILY_API_KEY in .env.local (free tier: https://tavily.com).
 */
export const searchTool = tool(
  async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY must be set in .env.local");
    }
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 3,
        search_depth: "basic",
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily search failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    const results = data.results ?? [];
    if (results.length === 0) return "No results found for that query.";
    return results
      .map((r) => `- ${r.title ?? "(no title)"}: ${r.content ?? ""}\n  ${r.url ?? ""}`)
      .join("\n");
  },
  {
    name: "web_search",
    description:
      "Search the live web for up-to-date information. Use for current events, recent news, or anything not in the user's notes.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// Only allow numbers, math operators/parens, whitespace and letter-based
// function names, while blocking anything that could execute arbitrary code.
const ALLOWED_CHARS = /^[0-9a-zA-Z+\-*/().,\s%]+$/;
const DANGEROUS =
  /\b(function|constructor|prototype|__proto__|import|require|globalThis|global|process|fetch|eval|while|for|do|return)\b/i;

export const calculatorTool = tool(
  async ({ expression }) => {
    if (!ALLOWED_CHARS.test(expression) || DANGEROUS.test(expression)) {
      return "Error: expression contains disallowed characters or keywords.";
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expression});`);
    return String(fn());
  },
  {
    name: "calculator",
    description:
      "Evaluate a basic arithmetic expression, e.g. '2+3*4', '10/2', or 'Math.sqrt(144)'.",
    schema: z.object({
      expression: z.string().describe("The math expression to evaluate"),
    }),
  }
);

export const saveNoteTool = tool(
  async ({ note }) => {
    const vector = await embed(note);
    await upsertVector(`note-${Date.now()}`, vector, {
      text: note,
      source: "user-saved-note",
    });
    return `Saved ✓ I've stored that in your notes: "${note}".`;
  },
  {
    name: "save_note",
    description:
      "Save a piece of information the user wants remembered long-term. It gets embedded and stored in the knowledge base.",
    schema: z.object({
      note: z.string().describe("The information to remember"),
    }),
  }
);
