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

/** Push a saved note (original text) into Redis list for quick retrieval. */
export async function pushSavedNote(text: string, source = "user-saved-note") {
  await getRedis().rpush(
    `saved_notes`,
    JSON.stringify({ text, source, ts: Date.now() })
  );
}

/** Get the most recent saved note (most recent last) */
export async function getLastSavedNote() {
  const items = await getRedis().lrange(`saved_notes`, -1, -1);
  if (!items || items.length === 0) return null;
  const entry = items[0];
  if (typeof entry === "string") {
    try {
      return JSON.parse(entry);
    } catch {
      return { text: String(entry) };
    }
  }
  return entry;
}

/** Push a 'needs_fix' correction into Redis for upgrade workflows. */
export async function pushNeedFix(text: string) {
  await getRedis().rpush(
    `needs_fix`,
    JSON.stringify({ text, ts: Date.now() })
  );
}

export async function getNeedFixList() {
  const items = await getRedis().lrange(`needs_fix`, 0, -1);
  return (items || []).map((it) => {
    if (typeof it === "string") {
      try {
        return JSON.parse(it);
      } catch {
        return { text: String(it) };
      }
    }
    return it;
  });
}

export async function removeNeedFixAtIndexes(indexes: number[]) {
  const list = await getRedis().lrange(`needs_fix`, 0, -1);
  const parsed = (list || []).map((it) => {
    if (typeof it === 'string') {
      try { return JSON.parse(it); } catch { return { text: String(it) }; }
    }
    return it;
  });
  const remaining = parsed.filter((_, i) => !indexes.includes(i));
  // replace the list with remaining items
  await getRedis().del(`needs_fix`);
  if (remaining.length > 0) {
    await getRedis().rpush(`needs_fix`, ...remaining.map((r) => JSON.stringify(r)));
  }
}