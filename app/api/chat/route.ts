import { llm } from "@/lib/llm";
import { embed, queryVectors } from "@/lib/vectorstore";
import { getHistory, pushMessage } from "@/lib/memory";

const DEFAULT_SESSION = "local-user";

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
    const context = results
      .map((r) => r.metadata?.text)
      .filter(Boolean)
      .join("\n---\n");

    const history = await getHistory(sessionId);

    const prompt = `Context:\n${context}\n\nConversation so far:\n${history.join("\n")}\n\nUser: ${message}`;
    const result = await llm.invoke(prompt);
    const reply =
      typeof result?.content === "string"
        ? result.content
        : JSON.stringify(result?.content ?? result);

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