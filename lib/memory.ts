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

/**
 * Returns the conversation history for a session as a JSON-string list
 * (each entry is a `{ role, content }` object), most recent last.
 */
export async function getHistory(sessionId: string): Promise<string[]> {
  const raw = await getRedis().lrange(`chat:${sessionId}`, 0, -1);
  return (raw as string[]).slice(-MAX_HISTORY);
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