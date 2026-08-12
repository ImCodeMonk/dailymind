import { embed, upsertVector } from "@/lib/vectorstore";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pushSavedNote, pushNeedFix } from "@/lib/memory";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    const source = typeof body?.source === "string" ? body.source : "unknown";

    if (!text.trim()) {
      return Response.json(
        { error: "Please provide non-empty text to ingest." },
        { status: 400 }
      );
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const chunks = await splitter.splitText(text);

    for (const [i, chunk] of chunks.entries()) {
      const vector = await embed(chunk);
      await upsertVector(`${source}-${i}`, vector, {
        text: chunk,
        source,
      });
    }

    // Push the original full text into Redis for quick last-note retrieval
    try {
      if (source === "user-saved-note") {
        await pushSavedNote(text, source);
      }
      if (source === "needs_fix") {
        await pushNeedFix(text);
      }
    } catch (err) {
      // non-fatal
      console.warn("Failed to push metadata to Redis", err);
    }

    return Response.json({ chunksStored: chunks.length });
  } catch (error) {
    console.error("Ingest API error:", error);
    return Response.json(
      { error: "Unable to ingest text." },
      { status: 500 }
    );
  }
}