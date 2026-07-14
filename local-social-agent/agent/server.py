"""FastAPI application: JSON API + static web chat UI.

Run with:  python -m agent.server   (or ./run.sh)
Everything binds to localhost by default - this app is meant to stay on your Mac.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .agent import Agent
from .config import load_config

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"


class ChatRequest(BaseModel):
    message: str


class ApproveRequest(BaseModel):
    task_id: str
    approved: bool


def create_app(agent: Optional[Agent] = None) -> FastAPI:
    config = load_config(ROOT)
    agent = agent or Agent(config)
    app = FastAPI(title="Local Social Agent", version="0.1.0")

    @app.get("/api/status")
    def status():
        return {
            "mode": agent.sandbox.mode,
            "require_approval": config.sandbox.require_approval,
            "llm_available": agent.llm.refresh_availability(),
            "llm_model": config.llm.model,
            "instagram_enabled": config.instagram.enabled,
            "workspace": str(agent.sandbox.workspace),
            "tools": agent.tool_specs(),
        }

    @app.post("/api/chat")
    def chat(req: ChatRequest):
        if not req.message.strip():
            raise HTTPException(status_code=400, detail="message is empty")
        task = agent.start_task(req.message)
        return task.to_dict()

    @app.post("/api/approve")
    def approve(req: ApproveRequest):
        try:
            task = agent.approve(req.task_id, req.approved)
        except KeyError:
            raise HTTPException(status_code=404, detail="task not found")
        return task.to_dict()

    @app.get("/api/task/{task_id}")
    def get_task(task_id: str):
        task = agent.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        return task.to_dict()

    @app.get("/api/audit")
    def audit():
        return {"audit": agent.sandbox.audit_log()}

    @app.get("/media/{path:path}")
    def media(path: str):
        """Serve a file from the sandboxed workspace (images, receipts)."""
        try:
            resolved = agent.sandbox.resolve_path(path)
        except Exception:
            raise HTTPException(status_code=400, detail="invalid path")
        if not resolved.exists() or not resolved.is_file():
            raise HTTPException(status_code=404, detail="not found")
        return FileResponse(resolved)

    if WEB_DIR.exists():
        app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")

    return app


app = create_app()


def main() -> None:
    import uvicorn

    config = load_config(ROOT)
    uvicorn.run(app, host=config.server.host, port=config.server.port, log_level="info")


if __name__ == "__main__":
    main()
