# Local Social Agent

A **local-first AI agent** that runs entirely on your own Mac. You tell it what to
do in plain English — *"create a golden-hour beach photo, edit it, and prepare an
Instagram post"* — and it plans the steps, generates and edits the image, writes a
caption with hashtags, and gets everything ready to publish.

Every action runs through a **safety sandbox**. Anything that would touch the
outside world (like posting online) is **simulated by default** and only ever
runs for real after you explicitly switch to live mode *and* approve it.

```
You ─▶ Web chat ─▶ Agent ─▶ Planner (local LLM or built-in fallback)
                              │
                              ▼
                    Sandbox (path jail + approval gate + rate limit + audit log)
                              │
              ┌───────────────┼─────────────────┬──────────────┐
              ▼               ▼                  ▼              ▼
        generate_image    edit_image       write_caption   post_to_instagram
```

## Highlights

- **100% local.** No cloud APIs. Uses [Ollama](https://ollama.com) if it's running;
  otherwise a deterministic built-in planner keeps everything working offline.
- **Safe by design.** File access is jailed to a workspace folder, external posts
  are simulated in `dry_run` mode, live posting needs credentials **and** a click
  to approve, posting is rate-limited, and every action is written to an audit log.
- **Real image pipeline.** Offline procedural image generator (Pillow) plus a photo
  editor (crop-to-square, brightness/contrast/saturation, sepia, blur, sharpen,
  text overlay). Optional Stable Diffusion backend if you have `diffusers`+`torch`.
- **Clean chat UI.** Watch the agent's plan execute step-by-step, preview the images
  it makes, review the caption, and approve the final post.

## Quick start (macOS)

```bash
cd local-social-agent
./run.sh
```

Then open <http://127.0.0.1:8765>. `run.sh` creates a virtualenv, installs
dependencies, and launches the server. To run it manually instead:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m agent.server
```

### (Optional) enable a real local LLM

```bash
brew install ollama       # or download from ollama.com
ollama pull llama3.1
ollama serve              # if it isn't already running
```

The agent auto-detects Ollama. If it's unreachable, the sidebar shows
`fallback planner` and everything still works.

## Safety & modes

The default mode is `dry_run`: posting to Instagram is **simulated**, writing a
receipt to the workspace instead of hitting the network — perfect for rehearsing
the whole flow.

To actually publish (at your own risk — automating Instagram may violate its
Terms of Service):

1. Copy `config.example.yaml` to `config.yaml` and set `sandbox.mode: live`.
2. Export credentials (they are **never** stored in the repo):
   ```bash
   export INSTAGRAM_USERNAME="your_handle"
   export INSTAGRAM_PASSWORD="your_password"
   ```
3. Install the optional publisher: `pip install instagrapi`.
4. In the chat, the final "post" step will pause and ask you to **Approve**.

You can also flip the mode for a single run without editing config:

```bash
AGENT_SANDBOX_MODE=live python -m agent.server
```

## Configuration

All settings live in `config.yaml` (see `config.example.yaml` for the annotated
defaults): the LLM provider/model, the sandbox mode & approval requirement, the
per-hour posting rate limit, the max steps per task, and the server host/port.

## Tools the agent can use

| Tool | Risk | What it does |
| --- | --- | --- |
| `generate_image` | safe | Create an image from a text prompt (offline procedural or Stable Diffusion). |
| `edit_image` | safe | Crop-to-square, brightness/contrast/saturation, sepia, blur, sharpen, resize, text overlay. |
| `write_caption` | safe | Draft an Instagram caption + hashtags (LLM or built-in). |
| `list_files` | safe | List everything in the workspace. |
| `post_to_instagram` | sensitive | Publish an image + caption — simulated unless live mode + approval. |

## Tests

```bash
python -m pytest -q          # or: python -m unittest discover -s tests
```

## Project layout

```
local-social-agent/
├── agent/
│   ├── config.py       # config loading (+ safe defaults)
│   ├── sandbox.py      # path jail, approval gate, rate limit, audit log
│   ├── llm.py          # Ollama client + heuristic fallback planner
│   ├── agent.py        # plan + execute orchestrator with approval pauses
│   ├── server.py       # FastAPI API + static UI host
│   └── tools/          # generate_image, edit_image, caption, files, instagram
├── web/                # chat UI (index.html, styles.css, app.js)
├── tests/              # unit + integration tests
├── config.example.yaml
├── requirements.txt
└── run.sh
```
