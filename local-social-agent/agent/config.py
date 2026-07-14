"""Configuration loading and typed access.

Reads an optional ``config.yaml`` from the project root and merges it on top of a
set of safe defaults. Nothing here ever raises on a missing file - the agent must
always be able to boot with zero configuration.
"""

from __future__ import annotations

import copy
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict

import yaml

DEFAULTS: Dict[str, Any] = {
    "llm": {
        "provider": "ollama",
        "base_url": "http://127.0.0.1:11434",
        "model": "llama3.1",
        "timeout": 60,
    },
    "sandbox": {
        "workspace_dir": "workspace_data",
        "mode": "dry_run",
        "require_approval": True,
        "max_posts_per_hour": 5,
        "max_steps_per_task": 12,
    },
    "instagram": {
        "enabled": True,
    },
    "server": {
        "host": "127.0.0.1",
        "port": 8765,
    },
}


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge ``override`` into a copy of ``base``."""
    result = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


@dataclass
class LLMConfig:
    provider: str = "ollama"
    base_url: str = "http://127.0.0.1:11434"
    model: str = "llama3.1"
    timeout: int = 60


@dataclass
class SandboxConfig:
    workspace_dir: str = "workspace_data"
    mode: str = "dry_run"
    require_approval: bool = True
    max_posts_per_hour: int = 5
    max_steps_per_task: int = 12


@dataclass
class InstagramConfig:
    enabled: bool = True


@dataclass
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 8765


@dataclass
class Config:
    root_dir: Path
    llm: LLMConfig = field(default_factory=LLMConfig)
    sandbox: SandboxConfig = field(default_factory=SandboxConfig)
    instagram: InstagramConfig = field(default_factory=InstagramConfig)
    server: ServerConfig = field(default_factory=ServerConfig)

    @property
    def workspace_path(self) -> Path:
        """Absolute path to the sandboxed workspace directory."""
        wd = Path(self.sandbox.workspace_dir)
        if not wd.is_absolute():
            wd = self.root_dir / wd
        return wd


def load_config(root_dir: Path | str | None = None) -> Config:
    """Load configuration, merging ``config.yaml`` (if present) over defaults."""
    root = Path(root_dir) if root_dir else Path(__file__).resolve().parent.parent
    cfg_path = root / "config.yaml"

    data: Dict[str, Any] = {}
    if cfg_path.exists():
        with cfg_path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}

    merged = _deep_merge(DEFAULTS, data)

    # Environment overrides for the most operationally-relevant knobs.
    env_mode = os.environ.get("AGENT_SANDBOX_MODE")
    if env_mode:
        merged["sandbox"]["mode"] = env_mode

    return Config(
        root_dir=root,
        llm=LLMConfig(**merged["llm"]),
        sandbox=SandboxConfig(**merged["sandbox"]),
        instagram=InstagramConfig(**merged["instagram"]),
        server=ServerConfig(**merged["server"]),
    )
