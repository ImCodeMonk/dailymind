import { llm } from "@/lib/llm";
import { embed, queryVectors } from "@/lib/vectorstore";
import { getHistory, pushMessage } from "@/lib/memory";
import { searchTool, calculatorTool, saveNoteTool } from "@/lib/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const DEFAULT_SESSION = "local-user";

// The ReAct agent can decide to call tools (web search, calculator, save note)
// instead of only answering from RAG context.
const agent = createReactAgent({
  llm,
  tools: [searchTool, calculatorTool, saveNoteTool],
});

/**
 * Extract a clean, human-readable answer from the agent's message trace.
 * It ignores user/tool messages and AI messages that only carry pending tool
 * calls, and strips any lingering <tool_name>{"..."}</tool_name> wrappers so
 * raw tool calls / tool results never leak into the chat reply.
 */
function extractReply(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as {
      getType?: () => string;
      role?: string;
      content?: unknown;
      tool_calls?: unknown[];
    };
    const kind = typeof msg?.getType === "function" ? msg.getType() : msg?.role;
    const calledTool = Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0;
    if (kind === "ai" && !calledTool && typeof msg?.content === "string") {
      const text = (msg.content as string)
        .replace(/<[a-z_]+>\s*\{[\s\S]*?\}\s*<\/[a-z_]+>/gi, "")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

/** True if this run invoked the save_note tool at any point. */
function usedSaveNote(messages: unknown[]): boolean {
  return messages.some((m) => {
    const msg = m as { tool_calls?: { name?: string }[]; content?: unknown };
    return (
      (Array.isArray(msg?.tool_calls) &&
        msg.tool_calls.some((tc) => tc?.name === "save_note")) ||
      (typeof msg?.content === "string" && /\bsave_note\b/.test(msg.content))
    );
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const message =
      typeof body === "string"
        ? body
        : typeof body?.message === "string"
          ? body.message
          : "";
    const sessionId =
      typeof body?.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId
        : DEFAULT_SESSION;

    if (!message.trim()) {
      return Response.json(
        { error: "Please provide a non-empty message." },
        { status: 400 }
      );
    }

    const queryVector = await embed(message);
    const results = await queryVectors(queryVector, 4);

    // Phase 8: prioritize verified corrections so corrected info leads the context.
    const sortedResults = [...results].sort((a, b) => {
      const aCorr = a.metadata?.source === "verified_correction" ? 0 : 1;
      const bCorr = b.metadata?.source === "verified_correction" ? 0 : 1;
      return aCorr - bCorr;
    });
    const context = sortedResults
      .map((r) => r.metadata?.text)
      .filter(Boolean)
      .join("\n---\n");

    const history = await getHistory(sessionId);

    const systemPrompt = `You are DailyMind, a personal assistant.
  Notes context:
  ${context || "(none yet)"}

  If the notes are not enough, use tools: web_search, calculator, or save_note.

  Rules:
  - Never invent facts. If you don't know, reply: "I don't have any idea about that yet."
  - After saving a note, confirm briefly with "Saved ✓".
  - Do not list or dump the stored notes in replies. If the user asks about stored items, show only the single most recent saved item in one concise sentence.
  - After delete operations, confirm briefly with "Deleted ✓" and do not print the full memory contents.`;

    const result = await agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    });

    let reply = extractReply(result.messages);
    if (!reply) {
      // The agent ended without prose (e.g. it only emitted a tool call).
      reply = usedSaveNote(result.messages)
        ? "Saved ✓ I'll keep that in mind."
        : "Done.";
    }

    await pushMessage(sessionId, "user", message);
    await pushMessage(sessionId, "assistant", reply);

    return Response.json({ reply, sessionId });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Unable to process your message." },
      { status: 500 }
    );
  }
}