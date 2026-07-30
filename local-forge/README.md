# LocalForge

**Cursor-like AI coding IDE that runs on your local LLM** — chat, inline edit, and multi-file agent — with a Model Hub to choose download location and pull models.

Cursor itself is closed-source; LocalForge is an open alternative with the same core workflows, wired to **Ollama**, **LM Studio**, or any **OpenAI-compatible** local server.

## Features

| Cursor-style feature | LocalForge |
|---|---|
| Ask / Chat | Ask mode with workspace context + `@file` mentions |
| Inline edit (⌘/Ctrl+K) | Editor bottom bar + keyboard shortcut |
| Composer / Agent | Edit mode + **Agent tool loop** (read/search/list/write/finish) |
| Diff review | Diff preview before apply |
| Command palette | ⌘/Ctrl+P |
| Terminal | ⌘/Ctrl+` workspace shell |
| Model picker | Model Hub catalog + installed models |
| Project rules | `.localforgerules` |
| Cloud models | **Replaced by local / offline engines** |
| Air-gapped use | **Offline mode** — no internet, no CDN, localhost only |
| Chat history | Persistent **sessions** + markdown export |
| Undo agent edits | **Checkpoints** before apply |
| SCM | Git status / diff panel |
| Find | Find in files (⌘⇧F) |
| Ghost text | Tab autocomplete from local model |
| **Graph LLM** | Code knowledge graph + GraphRAG for Ask/Edit/Agent |

Also included:

- **Offline mode** (default on): blocks model downloads, rejects non-localhost providers, ships fonts + Monaco locally (no Google/jsDelivr)
- **Offline engine** (`demo` provider): works with zero GPU and zero network
- **Choose model download location** (used as `OLLAMA_MODELS` when you temporarily disable offline mode to pull)
- File tree + Monaco editor + tabs
- Streaming responses over SSE
- Demo workspace so you can try immediately

## Quick start

### Fully offline (no internet)

```bash
cd local-forge
npm install   # once, while you have network — or copy node_modules from another machine
npm run dev
```

1. Open Model Hub — **Offline mode** should be ON
2. Provider: **Offline engine** (or Ollama/LM Studio on `127.0.0.1` with models already on disk)
3. Code — nothing leaves the machine

> Tip: to download a new Ollama model, temporarily disable Offline mode, pull, then turn Offline mode back on.

### 1. Install a local LLM runtime (optional for real models)

**Option A — Ollama (localhost)**

```bash
ollama serve
```

**Option B — LM Studio (localhost)**

Start the local server (default `http://127.0.0.1:1234/v1`).

**Option C — llama.cpp / vLLM / etc. on localhost**

Any OpenAI-compatible `/v1/chat/completions` endpoint on `127.0.0.1`.

**Option D — Offline engine (built-in)**

No GPU, no model files, no internet. Good for UI + agent-flow testing; switch to Ollama for real coding quality.

### 2. Run LocalForge

```bash
cd local-forge
npm install
npm run dev
```

- UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

### 3. Download a model

1. Click **Model Hub**
2. Set **Model download location** (any folder with enough disk space)
3. Save provider settings (Ollama by default)
4. Download something like **Qwen2.5 Coder 7B**
5. Click **Use model**

### 4. Code

Open files from the demo workspace (or set your project path in **Settings**), then use Ask / Edit / Agent.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | API + Vite together |
| `npm run build` | Production UI build |
| `npm start` | Serve API (+ built UI when `NODE_ENV=production`) |
| `npm test` | Unit tests |
| `npm run lint` | Typecheck |

## Configuration

Stored in `local-forge/.local-forge/config.json`:

- `provider` — `demo` (offline engine) | `ollama` | `lmstudio` | `openai-compatible`
- `offlineMode` — when `true`, block downloads and non-localhost providers
- `baseUrl` — local server URL (`127.0.0.1` / `localhost` required in offline mode)
- `modelsPath` — where downloads should live
- `workspacePath` — project root LocalForge can read/write
- `selectedModel` — active model id

## How edits work

In Edit/Agent modes the model is instructed to emit:

````
```path=relative/file.ts
full new file contents
```
````

You can **Apply edits** from the chat panel (or let Agent apply when enabled).

## Security notes

- File access is sandboxed to `workspacePath`
- No cloud LLM calls by design — only your configured local base URL
- Treat Agent mode like any tool with write access to your project

## Stack

React + Vite + Monaco · Express · TypeScript · Ollama / OpenAI-compatible APIs
