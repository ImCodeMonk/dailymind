"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SESSION_ID = "local-user";
const STORAGE_KEY = "dailymind-session";

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

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        // ignore invalid storage data
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

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

  const userCount = messages.filter((message) => message.role === "user").length;
  const assistantCount = messages.filter(
    (message) => message.role === "assistant"
  ).length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
      <aside className="flex min-h-[540px] flex-col gap-6 rounded-[32px] border border-zinc-200 bg-white/90 p-6 shadow-2xl shadow-zinc-200/30 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20 lg:w-[360px]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-sky-500/10 p-5 text-sky-950 dark:bg-sky-500/10 dark:text-sky-100">
            <p className="text-sm uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">
              DailyMind overview
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Your Personal AI Second Brain</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              DailyMind remembers your chats and notes, answers questions from
              your saved memory, and helps you stay organized with one
              intelligent assistant.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-zinc-950/80">
              <span>Stored chats</span>
              <strong>{messages.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-zinc-950/80">
              <span>User turns</span>
              <strong>{userCount}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-zinc-950/80">
              <span>Assistant replies</span>
              <strong>{assistantCount}</strong>
            </div>
          </div>
        </div>

        <div className="space-y-4 overflow-hidden">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              What DailyMind does
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <li>• Keeps your conversation context and memory visible.</li>
              <li>• Uses notes and saved data to answer questions.</li>
              <li>• Learns from your feedback and corrections.</li>
              <li>• Supports search, math, and note saving tools.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Session memory
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Your chat history is stored in your browser and shown here for easy review. Every question and answer becomes part of the session memory.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Recent history
          </h2>
          <div className="mt-4 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
            {messages.length === 0 ? (
              <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                No memory yet. Start by asking a question or saving a note.
              </p>
            ) : (
              [...messages]
                .slice(-12)
                .reverse()
                .map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className="rounded-3xl border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      <span>{message.role === "user" ? "You" : "DailyMind"}</span>
                      <span className="grow border-t border-zinc-200 dark:border-zinc-800" />
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                      {message.content}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-[540px] flex-1 flex-col rounded-[32px] border border-zinc-200 bg-white/90 p-6 shadow-2xl shadow-zinc-200/30 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20">
        <div className="mb-6 rounded-[32px] bg-gradient-to-r from-emerald-500/10 via-sky-100/60 to-violet-500/10 p-6 text-zinc-900 dark:from-emerald-500/10 dark:via-slate-900/60 dark:to-violet-500/10 dark:text-zinc-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500 dark:text-emerald-300">
                DailyMind Assistant
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Talk to your second brain</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Ask questions, save notes, and get helpful answers that remember your session context and stored memory.
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-white/90 px-4 py-3 text-sm text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              Ready to use on Vercel
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {messages.length === 0 && !loading ? (
            <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
              <p className="text-lg font-semibold">Start your first session</p>
              <p className="mt-3 max-w-xl mx-auto text-sm leading-6">
                Use the sidebar to review your memory and session history, then ask DailyMind anything — notes, tasks, ideas, or quick facts.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={
                  "group mb-4 rounded-[28px] px-5 py-4 shadow-sm transition-all duration-200 " +
                  (m.role === "user"
                    ? "self-end bg-slate-950 text-white dark:bg-slate-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100")
                }
              >
                <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  <span>{m.role === "user" ? "You" : "DailyMind"}</span>
                  <span>{m.role === "user" ? "asked" : "answered"}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7">{m.content}</p>

                {m.role === "assistant" && (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <button
                      onClick={() => rateUp(i)}
                      title="Good answer"
                      className={
                        "rounded-full border px-3 py-1 transition-colors " +
                        (feedback[i] === "up"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400 dark:text-emerald-200"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500")
                      }
                    >
                      👍 Helpful
                    </button>
                    <button
                      onClick={() => rateDown(i)}
                      title="Wrong answer — provide a correction"
                      className={
                        "rounded-full border px-3 py-1 transition-colors " +
                        (feedback[i] === "down"
                          ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:border-rose-400 dark:text-rose-200"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500")
                      }
                    >
                      👎 Needs fix
                    </button>
                    {feedback[i] === "up" && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Thanks for teaching DailyMind.
                      </span>
                    )}
                    {feedback[i] === "down" && correctionFor !== i && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Add a correction below.
                      </span>
                    )}
                  </div>
                )}

                {correctionFor === i && (
                  <form
                    className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitCorrection(i);
                    }}
                  >
                    <input
                      autoFocus
                      className="min-w-0 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      placeholder="Enter the correct answer"
                      disabled={submitting}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={submitting || !correction.trim()}
                        className="rounded-2xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                      >
                        Save correction
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrectionFor(null)}
                        className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-500">⚠️ {error}</p>
        )}

        {notice && (
          <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-300">
            {notice}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row">
          <input
            className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-sky-400 dark:focus:ring-sky-800"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask DailyMind anything..."
            disabled={loading}
          />
          <button
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send message
          </button>
        </div>
      </section>
    </main>
  );
}
