# 🧠 DailyMind — Your Personal AI Second Brain

A **100% free-tier** AI assistant that remembers your notes, chats with you, and can search the web, do math, and save long-term memories — built on a **RAG + agent pipeline** that runs entirely in the cloud (nothing heavy runs on your laptop).

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind) + **LangChain.js** · **Groq** (LLM) · **Upstash Vector** (RAG) · **Upstash Redis** (chat memory) · **Cohere** (embeddings) · **Tavily** (web search) · **Vercel** (deploy).

---

## ✨ Features

- **RAG on your notes** — ingest notes/text (and PDFs via `pdf-parse`) and ask questions answered from your own knowledge base.
- **Multi-turn memory** — conversations persist across page refreshes thanks to Redis.
- **Agent with tools** — the model decides on its own to **search the web**, run the **calculator**, or **save a note**.
- **Chat UI** — a clean, light/dark theme-aware browser chat window.
- **Self-improving RAG** — a 👍/👎 feedback loop stores corrections and **prioritizes them** next time.
- **Honest answers** — it says *"I don't have any idea about that yet"* instead of making things up, and confirms every saved note with a ✅.

---

## 🧱 Tech stack

| Layer | Tool | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router, TS, Tailwind) | Web app + API routes |
| LLM | Groq (`llama-3.1-8b-instant`) | Chat responses |
| Embeddings | Cohere (`embed-english-v3.0`) | Turn text into vectors |
| Vector DB | Upstash Vector | Store & search your notes |
| Chat memory | Upstash Redis | Conversation history |
| Web search | Tavily | Live web answers |
| Agent runtime | LangChain.js + LangGraph | Tool-calling agent |
| Deploy | Vercel | Hosting |

---

## ✅ Prerequisites

- **Node.js 18+** (LTS recommended)
- A GitHub account
- Free API keys from **Groq**, **Upstash** (Vector **and** Redis), **Cohere**, and **Tavily** (a **Vercel** account for deploying).
  > No credit card is required anywhere. Full account setup is in `personal-ai-second-brain-plan.md` → **Phase 0** (that file is a sibling of this folder).

---

## 🚀 Getting started

### 1. Clone & install

```bash
git clone https://github.com/ImCodeMonk/dailymind.git
cd dailymind
npm install
```

### 2. Add your API keys

Copy the template to a local file and fill in **all seven** values (the real secrets live only in `.env.local`, never committed):

```bash
cp .env.example .env.local   # macOS/Linux
# PowerShell: Copy-Item .env.example .env.local
```

```bash
GROQ_API_KEY=
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TAVILY_API_KEY=
COHERE_API_KEY=
```

> ⚠️ `.env.local` is gitignored — never commit it. It is the **only** thing keeping your secrets safe.

| Variable | Where to get it | Used for |
|---|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | Chat (LLM) |
| `UPSTASH_VECTOR_REST_URL` / `TOKEN` | [Upstash](https://console.upstash.com) → create a **Vector** index | RAG retrieval |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | Upstash → create a **Redis** database | Chat memory |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) | Web search tool |
| `COHERE_API_KEY` | [dashboard.cohere.com](https://dashboard.cohere.com) | Embeddings |

### 3. Run locally

```bash
npm run dev
```

Open **http://localhost:3000** and start chatting.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at `localhost:3000` |
| `npm run build` | Production build (also runs the TypeScript check) |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## 🧪 Using DailyMind

### In the browser
Open http://localhost:3000 and try:
- **Web search** — *"Who won the most recent FIFA World Cup final?"*
- **Calculator** — *"What is 25 * 4 + 100 / 5?"*
- **Save a note** — *"Remember that my gym membership renews in March."* → **Saved ✓**
- **Memory / RAG** — *"What did I just ask you to remember?"*

If it can't answer, it honestly says *"I don't have any idea about that yet."* Use the 👍/👎 buttons under any answer to teach it — corrections are stored and prioritized next time.

### Ingest notes via the API (Windows / PowerShell)

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/ingest -Method Post -ContentType "application/json" -Body '{"text":"My rent is due on the 5th of every month.","source":"finance-notes"}'
```

### API endpoints

| Method | Path | Body | Purpose |
|---|---|---|---|
| `POST` | `/api/chat` | `{ "message": "...", "sessionId": "..." }` | Send a message, get a reply |
| `POST` | `/api/ingest` | `{ "text": "...", "source": "..." }` | Embed & store a note chunk |

---

## 📁 Project structure

```
dailymind/
├─ app/
│  ├─ page.tsx            # Chat UI (includes 👍/👎 feedback)
│  └─ api/
│     ├─ chat/route.ts    # Agent: RAG + memory + tools
│     └─ ingest/route.ts  # Embed & store notes
├─ lib/
│  ├─ llm.ts              # Groq client
│  ├─ vectorstore.ts      # Cohere embeddings + Upstash Vector
│  ├─ memory.ts           # Redis chat history
│  └─ tools.ts            # web_search / calculator / save_note
├─ public/                # Static assets
├─ .env.local             # Your secrets (gitignored)
└─ package.json
```

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → import the `dailymind` repo.
3. In **Environment Variables**, paste **all seven keys** from `.env.local`.
4. Click **Deploy**. Every push to `main` auto-redeploys afterwards.

---

## 📚 Documentation

A full, step-by-step build guide (accounts, every phase's code, and verification) is in `personal-ai-second-brain-plan.md` — a sibling file of this repo (Phases 0 → 10).

## 📄 License

> *"Your second brain should be free — just like your curiosity."* 😄

Released for personal and educational use. Built as a **zero-cost** learning project with Groq, Upstash, Cohere, Tavily, and Vercel.

Learn from it, remix it, and build your own DailyMind. 🚀
