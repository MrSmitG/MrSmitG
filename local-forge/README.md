# LocalForge

**Cursor-like AI coding IDE that runs on your local LLM** — chat, inline edit, and multi-file agent — with a Model Hub to choose download location and pull models.

Cursor itself is closed-source; LocalForge is an open alternative with the same core workflows, wired to **Ollama**, **LM Studio**, or any **OpenAI-compatible** local server.

## Features

| Cursor-style feature | LocalForge |
|---|---|
| Ask / Chat | Ask mode with workspace context |
| Inline edit (⌘/Ctrl+K) | Editor bottom bar + keyboard shortcut |
| Composer / Agent | Edit + Agent modes with applyable file edits |
| Model picker | Model Hub catalog + installed models |
| Cloud models | **Replaced by local models you download** |

Also included:

- **Choose model download location** (saved as config; used as `OLLAMA_MODELS` when pulling)
- File tree + Monaco editor + tabs
- Streaming responses over SSE
- Demo workspace so you can try immediately

## Quick start

### 1. Install a local LLM runtime

**Option A — Ollama (recommended for downloads)**

```bash
# https://ollama.com
ollama serve
```

**Option B — LM Studio**

Start the local server (default `http://127.0.0.1:1234/v1`).

**Option C — llama.cpp / vLLM / etc.**

Any OpenAI-compatible `/v1/chat/completions` endpoint.

**Option D — Demo provider**

LocalForge ships with a `demo` provider so you can explore the UI without a GPU or model download. Switch to Ollama in Model Hub for real inference.

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

- `provider` — `ollama` | `lmstudio` | `openai-compatible`
- `baseUrl` — local server URL
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
