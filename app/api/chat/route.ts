import { llm } from "@/lib/llm";
import { embed, queryVectors } from "@/lib/vectorstore";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const message =
      typeof body === "string"
        ? body
        : typeof body?.message === "string"
          ? body.message
          : "";

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

    const prompt = `Use this context if relevant:\n${context}\n\nQuestion: ${message}`;
    const result = await llm.invoke(prompt);
    const reply =
      typeof result?.content === "string"
        ? result.content
        : JSON.stringify(result?.content ?? result);

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Unable to process your message." },
      { status: 500 }
    );
  }
}