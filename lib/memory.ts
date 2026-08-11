import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

// How many stored messages (user + assistant turns) to feed back into the
// prompt, oldest first. Keeps long sessions from blowing up the context window.
const MAX_HISTORY = 20;

export type ChatMessage = { role: string; content: string };

/**
 * Returns the conversation history for a session as `{ role, content }`
 * objects, most recent last.
 *
 * NOTE: @upstash/redis enables automatic deserialization by default, so a JSON
 * value stored with rpush is already parsed back into an object on lrange.
 * We handle both cases (object already deserialized, or a raw JSON string).
 */
export async function getHistory(sessionId: string): Promise<ChatMessage[]> {
  const raw = await getRedis().lrange(`chat:${sessionId}`, 0, -1);
  return (raw as unknown[])
    .slice(-MAX_HISTORY)
    .map((entry): ChatMessage => {
      if (entry && typeof entry === "object") return entry as ChatMessage;
      if (typeof entry === "string") {
        try {
          return JSON.parse(entry) as ChatMessage;
        } catch {
          return { role: "unknown", content: entry };
        }
      }
      return { role: "unknown", content: String(entry) };
    });
}

/** Appends a single message (role: "user" | "assistant") to a session. */
export async function pushMessage(
  sessionId: string,
  role: string,
  content: string
) {
  await getRedis().rpush(
    `chat:${sessionId}`,
    JSON.stringify({ role, content })
  );
}