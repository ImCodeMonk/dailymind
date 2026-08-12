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
  const [corrections, setCorrections] = useState<string[]>([]);
  const [confirmOpenMain, setConfirmOpenMain] = useState(false);
  const [confirmMainAction, setConfirmMainAction] = useState<'delete' | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState({
    what: false,
    why: false,
    how: false,
  });
  const [selectedAction, setSelectedAction] = useState<
    "question" | "reminder" | "list" | null
  >(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const savedCorrections = window.localStorage.getItem("dailymind-corrections");
    if (savedCorrections) {
      try {
        const parsed = JSON.parse(savedCorrections) as string[];
        if (Array.isArray(parsed)) setCorrections(parsed);
      } catch {}
    }
  }, []);

  async function promoteCorrectionToNote(text: string, idx: number) {
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: "user-saved-note" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save note.");
      // remove from local corrections
      setCorrections((c) => c.filter((_, i) => i !== idx));
      try {
        window.localStorage.setItem(
          "dailymind-corrections",
          JSON.stringify(corrections.filter((_, i) => i !== idx))
        );
      } catch {}
      setNotice("✅ Saved ✓");
    } catch (err) {
      setNotice(err instanceof Error ? `⚠️ ${err.message}` : "⚠️ Save failed.");
    }
  }
  function deleteLocalCorrection(idx: number) {
    setCorrections((c) => c.filter((_, i) => i !== idx));
    try {
      window.localStorage.setItem(
        "dailymind-corrections",
        JSON.stringify(corrections.filter((_, i) => i !== idx))
      );
    } catch {}
    setNotice("✅ Correction deleted.");
  }

  function askPromote(idx: number) {
    // Promotion removed: open delete confirm instead.
    setConfirmIndex(idx);
    setConfirmMainAction('delete');
    setConfirmOpenMain(true);
  }

  function askDeleteCorrection(idx: number) {
    setConfirmIndex(idx);
    setConfirmMainAction('delete');
    setConfirmOpenMain(true);
  }

  async function doConfirmMain() {
    // Promotions are handled server-side via corrections API; local promote flow removed.
    if (confirmMainAction === 'delete' && confirmIndex !== null) {
      deleteLocalCorrection(confirmIndex);
    }
    setConfirmOpenMain(false);
    setConfirmMainAction(null);
    setConfirmIndex(null);
  }

  async function showLastSavedNote() {
    try {
      const res = await fetch("/api/notes/last");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch last note.");
      if (!data.last) setNotice("No saved notes yet.");
      else setNotice(`Latest saved: ${data.last.text?.slice(0, 180)}`);
    } catch (err) {
      setNotice(err instanceof Error ? `⚠️ ${err.message}` : "⚠️ Failed.");
    }
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [messages]);

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
      const assistantMessage = data.reply ?? "(no reply)";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: assistantMessage },
      ]);
      if (assistantMessage.includes("Saved ✓")) {
        setNotice("✅ It is added and saved.");
      } else if (selectedAction === "reminder") {
        setNotice("✅ Reminder added.");
      } else if (selectedAction === "list") {
        setNotice("✅ List added.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
      setSelectedAction(null);
      setShowActionMenu(false);
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
      source: "needs_fix",
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
      // persist locally for quick access
      setCorrections((c) => [text, ...c]);
      try {
        window.localStorage.setItem(
          "dailymind-corrections",
          JSON.stringify([text, ...corrections])
        );
      } catch {}
      setNotice("✅ Correction saved — it will be used to improve answers.");
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

  function toggleCard(card: "what" | "why" | "how") {
    setExpandedCards((prev) => ({ ...prev, [card]: !prev[card] }));
  }

  function deleteHistoryItem(actualIndex: number) {
    setMessages((current) => current.filter((_, index) => index !== actualIndex));
    setFeedback((current) => {
      const next: Record<number, "up" | "down"> = {};
      Object.entries(current).forEach(([key, value]) => {
        const idx = Number(key);
        if (idx < actualIndex) next[idx] = value;
        else if (idx > actualIndex) next[idx - 1] = value;
      });
      return next;
    });
    setNotice("✅ Item deleted.");
  }

  function clearSession() {
    setMessages([]);
    setFeedback({});
    setCorrectionFor(null);
    setNotice("✅ Session memory deleted.");
  }

  function chooseAction(action: "question" | "reminder" | "list") {
    setSelectedAction(action);
    setShowActionMenu(false);
    setNotice(
      action === "question"
        ? "Ask your question in a natural sentence."
        : action === "reminder"
        ? "Reminder format added. Describe what you want to remember."
        : "List format added. Enter each item as a short line."
    );
    setInput("");
    inputRef.current?.focus();
  }

  const userCount = messages.filter((message) => message.role === "user").length;
  const assistantCount = messages.filter(
    (message) => message.role === "assistant"
  ).length;

  return (
    <main className="mx-auto flex h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 lg:flex-row lg:items-start">
      <aside className="flex min-h-0 flex-1 flex-col gap-6 rounded-[32px] border border-zinc-200 bg-white/90 p-5 shadow-2xl shadow-zinc-200/30 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20 lg:max-w-[360px]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-to-r from-sky-500/15 to-emerald-500/10 p-5 text-slate-950 dark:from-sky-400/15 dark:to-emerald-400/10 dark:text-slate-100">
            <p className="text-sm uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">
              DailyMind overview
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Your AI memory companion</h1>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              Store your chat history, manage reminders, and ask questions that remember what you told DailyMind.
            </p>
          </div>

          <div className="grid gap-3 rounded-3xl bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <div className="flex items-start justify-between rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-zinc-950/80">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Stored chats
                </p>
                <p className="mt-1 text-sm font-semibold">Conversation items</p>
              </div>
              <strong className="text-xl">{messages.length}</strong>
            </div>
            <div className="flex items-start justify-between rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-zinc-950/80">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  User turns
                </p>
                <p className="mt-1 text-sm font-semibold">Questions asked</p>
              </div>
              <strong className="text-xl">{userCount}</strong>
            </div>
            <div className="flex items-start justify-between rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-zinc-950/80">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Assistant replies
                </p>
                <p className="mt-1 text-sm font-semibold">Answers given</p>
              </div>
              <strong className="text-xl">{assistantCount}</strong>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Use + to choose an action
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Tap the plus icon next to the input box to pick a question, reminder, or list action.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <button
              type="button"
              onClick={() => toggleCard("what")}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              <span>Why it exists</span>
              <span>{expandedCards.what ? "−" : "+"}</span>
            </button>
            {expandedCards.what && (
              <div className="border-t border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                DailyMind keeps your questions, reminders, and notes together so the assistant can answer with the context you already provided.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <button
              type="button"
              onClick={() => toggleCard("how")}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              <span>How it works</span>
              <span>{expandedCards.how ? "−" : "+"}</span>
            </button>
            {expandedCards.how && (
              <div className="border-t border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                It stores your session locally, uses your recent messages for context, and saves corrections so future replies improve.
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Recent history
            </h2>
            <button
              type="button"
              onClick={clearSession}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Clear
            </button>
          </div>
          <div className="mt-4 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 220 }}>
            {messages.length === 0 ? (
              <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                No memory yet. Start by asking a question or saving a note.
              </p>
            ) : (
              [...messages]
                .slice(-10)
                .reverse()
                .map((message, index) => {
                  const actualIndex = messages.length - 1 - index;
                  return (
                    <div
                      key={`${message.role}-${actualIndex}`}
                      className="group relative rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <button
                        type="button"
                        onClick={() => deleteHistoryItem(actualIndex)}
                        className="absolute right-3 top-3 rounded-full border border-transparent bg-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Delete
                      </button>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        <span>{message.role === "user" ? "You" : "DailyMind"}</span>
                        <span className="grow border-t border-zinc-200 dark:border-zinc-800" />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                        {message.content}
                      </p>
                    </div>
                  );
                })
            )}
          </div>
              {corrections.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <h3 className="text-sm font-semibold">Corrections (Needs fix)</h3>
                  <div className="mt-2 space-y-2">
                    {corrections.map((c, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 rounded-2xl bg-white p-2">
                        <div className="text-sm text-zinc-700">{c}</div>
                        <div className="flex gap-2">
                          <button onClick={() => askDeleteCorrection(i)} className="text-xs text-rose-600">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {confirmOpenMain && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="rounded bg-white p-6">
                            <p className="mb-4">Are you sure you want to delete this correction?</p>
                          <div className="flex gap-2">
                            <button onClick={() => doConfirmMain()} className="rounded bg-emerald-600 px-4 py-2 text-white">Yes</button>
                            <button onClick={() => { setConfirmOpenMain(false); setConfirmMainAction(null); setConfirmIndex(null); }} className="rounded border px-4 py-2">Cancel</button>
                          </div>
                  </div>
                </div>
              )}
        </div>
      </aside>

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white/90 p-5 pb-28 shadow-2xl shadow-zinc-200/30 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20">
        <div className="mb-5 rounded-[32px] bg-gradient-to-r from-emerald-500/10 via-sky-100/50 to-violet-500/10 p-5 text-zinc-900 dark:from-emerald-500/10 dark:via-slate-900/60 dark:to-violet-500/10 dark:text-zinc-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500 dark:text-emerald-300">
                DailyMind Assistant
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Chat like WhatsApp</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Smart chat bubbles, quick actions, and local memory management for a friendly, responsive experience.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {messages.length === 0 && !loading ? (
            <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
              <p className="text-lg font-semibold">Start your first session</p>
              <p className="mt-3 max-w-xl mx-auto text-sm leading-6">
                Tap a quick action or type a question, reminder, or list and DailyMind will save or answer it.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={
                  "mb-4 flex w-full transition duration-200 " +
                  (m.role === "user" ? "justify-end" : "justify-start")
                }
              >
                <div
                  className={
                    "max-w-[90%] rounded-[24px] px-5 py-4 text-sm leading-7 shadow-sm " +
                    (m.role === "user"
                      ? "bg-slate-950 text-white dark:bg-slate-900"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100")
                  }
                >
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                    <span>{m.role === "user" ? "You" : "DailyMind"}</span>
                    <span>{m.role === "user" ? "asked" : "answered"}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.content}</p>

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

        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 py-4 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-0 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <div className="relative">
                <input
                  ref={inputRef}
                  className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3 pr-14 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-sky-400 dark:focus:ring-sky-800"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={
                    selectedAction === "reminder"
                      ? "Type your reminder..."
                      : selectedAction === "list"
                      ? "Type your list items..."
                      : "Ask DailyMind anything..."
                  }
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowActionMenu((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-slate-950 text-lg font-semibold text-white shadow transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
                  aria-label="Open action menu"
                >
                  +
                </button>
              </div>
              {showActionMenu && (
                <div className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-3xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    Quick actions
                  </p>
                  <button
                    type="button"
                    onClick={() => chooseAction("question")}
                    className="mb-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Ask a question
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseAction("reminder")}
                    className="mb-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Add a reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseAction("list")}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Create a list
                  </button>
                </div>
              )}
            </div>
            <button
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
