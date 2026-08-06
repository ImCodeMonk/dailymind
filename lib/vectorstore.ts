import { Index } from "@upstash/vector";
import { CohereClient } from "cohere-ai";

let _vectorIndex: Index | null = null;
let _cohere: CohereClient | null = null;

function getVectorIndex(): Index {
  if (!_vectorIndex) {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set in .env.local"
      );
    }
    _vectorIndex = new Index({ url, token });
  }
  return _vectorIndex;
}

function getCohere(): CohereClient {
  if (!_cohere) {
    const token = process.env.COHERE_API_KEY;
    if (!token) {
      throw new Error("COHERE_API_KEY must be set in .env.local");
    }
    _cohere = new CohereClient({ token });
  }
  return _cohere;
}

export async function embed(text: string) {
  const res = await getCohere().embed({
    texts: [text],
    model: "embed-english-v3.0",
    inputType: "search_document",
  });
  if (res.responseType === "embeddings_by_type") {
    return res.embeddings.float?.[0] ?? [];
  }
  return res.embeddings[0];
}

export async function upsertVector(
  id: string,
  vector: number[],
  metadata: Record<string, unknown>
) {
  return getVectorIndex().upsert({ id, vector, metadata });
}

export async function queryVectors(
  vector: number[],
  topK: number
): Promise<{ metadata?: Record<string, unknown> }[]> {
  const results = await getVectorIndex().query({
    vector,
    topK,
    includeMetadata: true,
  });
  return results as { metadata?: Record<string, unknown> }[];
}