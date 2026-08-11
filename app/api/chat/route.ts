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

    const systemPrompt = `You are DailyMind, the user's personal assistant.
Relevant context (from the user's notes):
${context || "(no relevant notes found)"}
If the context doesn't answer the question, use your tools: web_search for live or current info, calculator for math, and save_note to remember something long-term.`;

    const result = await agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    });

    const last = result.messages[result.messages.length - 1];
    const reply =
      typeof last?.content === "string"
        ? last.content
        : JSON.stringify(last?.content ?? last ?? result);

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