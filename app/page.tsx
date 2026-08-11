"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SESSION_ID = "local-user";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [correctionFor, setCorrectionFor] = useState<number | null>(null);
  const [correction, setCorrection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the view scrolled to the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "(no reply)" },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Find the user question that a given assistant answer replies to.
  function findQuestionIndex(assistantIdx: number): number {
    for (let j = assistantIdx - 1; j >= 0; j--) {
      if (messages[j].role === "user") return j;
    }
    return -1;
  }

  function rateUp(i: number) {
    setFeedback((f) => ({ ...f, [i]: "up" }));
    setCorrectionFor((c) => (c === i ? null : c));
    setNotice(null);
  }

  function rateDown(i: number) {
    setFeedback((f) => ({ ...f, [i]: "down" }));
    setCorrectionFor(i);
    setNotice(null);
  }

  // Phase 8: send the user's correction to /api/ingest as a verified correction,
  // paired with the original question so it retrieves well.
  async function submitCorrection(assistantIdx: number) {
    const text = correction.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setNotice(null);
    const qIdx = findQuestionIndex(assistantIdx);
    const question = qIdx >= 0 ? messages[qIdx].content : "";
    const payload = {
      text: question
        ? `Question: ${question}\nCorrection: ${text}`
        : text,
      source: "verified_correction",
    };
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save correction.");
      setCorrectionFor(null);
      setCorrection("");
      setNotice("✅ Correction saved — it will be prioritized next time.");
    } catch (err) {
      setNotice(
        err instanceof Error
          ? `⚠️ ${err.message}`
          : "⚠️ Failed to save correction."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col bg-background px-4 py-6">
      <header className="mb-4 flex items-center gap-2 border-b pb-4">
        <h1 className="text-2xl font-bold">🧠 DailyMind</h1>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          your second brain
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && !loading && (
          <p className="mt-10 text-center text-zinc-400 dark:text-zinc-500">
            Ask me anything — from your own notes, live web info, or math.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <span
              className={
                "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-foreground text-background"
                  : "bg-zinc-100 text-foreground dark:bg-zinc-800")
              }
            >
              {m.content}
            </span>

            {m.role === "assistant" && (
              <div className="mt-1 flex items-center gap-1 text-sm">
                <button
                  onClick={() => rateUp(i)}
                  title="Good answer"
                  className={
                    "rounded px-1.5 py-0.5 transition-colors " +
                    (feedback[i] === "up"
                      ? "bg-emerald-100 dark:bg-emerald-900"
                      : "opacity-60 hover:opacity-100")
                  }
                >
                  👍
                </button>
                <button
                  onClick={() => rateDown(i)}
                  title="Wrong answer — provide a correction"
                  className={
                    "rounded px-1.5 py-0.5 transition-colors " +
                    (feedback[i] === "down"
                      ? "bg-rose-100 dark:bg-rose-900"
                      : "opacity-60 hover:opacity-100")
                  }
                >
                  👎
                </button>
                {feedback[i] === "up" && (
                  <span className="ml-1 text-xs text-zinc-500">Thanks!</span>
                )}
                {feedback[i] === "down" && correctionFor !== i && (
                  <span className="ml-1 text-xs text-zinc-500">
                    Marked as incorrect.
                  </span>
                )}
                {correctionFor === i && (
                  <form
                    className="ml-1 flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitCorrection(i);
                    }}
                  >
                    <input
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-zinc-400"
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      placeholder="What's the correct answer?"
                      disabled={submitting}
                    />
                    <button
                      type="submit"
                      disabled={submitting || !correction.trim()}
                      className="rounded-lg bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorrectionFor(null)}
                      className="rounded-lg px-2 py-1 text-xs text-zinc-500"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-left">
            <span className="inline-block rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-400 dark:bg-zinc-800">
              Thinking…
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mb-2 text-center text-sm text-red-500">⚠️ {error}</p>
      )}

      {notice && (
        <p className="mb-2 text-center text-sm text-zinc-600 dark:text-zinc-300">
          {notice}
        </p>
      )}

      <div className="flex gap-2 border-t pt-3">
        <input
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask DailyMind anything..."
          disabled={loading}
        />
        <button
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </main>
  );
}
