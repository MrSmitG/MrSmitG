import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import load_config
from agent.sandbox import ApprovalRequired, RiskLevel, Sandbox, SandboxError


def make_sandbox(tmp_path, **overrides):
    cfg = load_config(tmp_path)
    cfg.sandbox.workspace_dir = str(tmp_path / "ws")
    for k, v in overrides.items():
        setattr(cfg.sandbox, k, v)
    return Sandbox(cfg)


def test_path_jail_blocks_traversal(tmp_path):
    sb = make_sandbox(tmp_path)
    with pytest.raises(SandboxError):
        sb.resolve_path("../secret.txt")
    with pytest.raises(SandboxError):
        sb.resolve_path("/etc/passwd")
    with pytest.raises(SandboxError):
        sb.resolve_path("")


def test_path_jail_allows_inside(tmp_path):
    sb = make_sandbox(tmp_path)
    p = sb.resolve_path("sub/img.png")
    assert str(p).startswith(str(sb.workspace.resolve()))


def test_safe_action_never_gated(tmp_path):
    sb = make_sandbox(tmp_path)
    assert sb.check_action("generate_image", RiskLevel.SAFE, "x") is None


def test_sensitive_dry_run_simulates(tmp_path):
    sb = make_sandbox(tmp_path, mode="dry_run")
    reason = sb.check_action("post", RiskLevel.SENSITIVE, "img")
    assert reason and "simulated" in reason.lower()


def test_sensitive_live_requires_approval(tmp_path):
    sb = make_sandbox(tmp_path, mode="live", require_approval=True)
    with pytest.raises(ApprovalRequired):
        sb.check_action("post", RiskLevel.SENSITIVE, "img", approved=False)
    # Once approved it proceeds (returns None).
    assert sb.check_action("post", RiskLevel.SENSITIVE, "img", approved=True) is None


def test_rate_limit(tmp_path):
    sb = make_sandbox(tmp_path, mode="live", require_approval=False, max_posts_per_hour=2)
    sb.check_action("post", RiskLevel.SENSITIVE, "1", approved=True)
    sb.check_action("post", RiskLevel.SENSITIVE, "2", approved=True)
    with pytest.raises(SandboxError):
        sb.check_action("post", RiskLevel.SENSITIVE, "3", approved=True)
