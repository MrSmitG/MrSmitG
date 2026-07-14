import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.agent import Agent
from agent.config import load_config
from agent.llm import heuristic_plan


def make_agent(tmp_path, mode="dry_run", require_approval=True):
    cfg = load_config(tmp_path)
    cfg.sandbox.workspace_dir = str(tmp_path / "ws")
    cfg.sandbox.mode = mode
    cfg.sandbox.require_approval = require_approval
    # Force the offline planner so tests are deterministic and network-free.
    cfg.llm.base_url = "http://127.0.0.1:1"
    return Agent(cfg)


def test_heuristic_plan_full_pipeline():
    plan = heuristic_plan("Create a sunset over the ocean, edit it and post it to instagram")
    tools = [s["tool"] for s in plan]
    assert tools == ["generate_image", "edit_image", "write_caption", "post_to_instagram"]


def test_heuristic_plan_generate_only():
    plan = heuristic_plan("make a picture of a mountain")
    assert [s["tool"] for s in plan] == ["generate_image"]


def test_full_task_dry_run_completes(tmp_path):
    agent = make_agent(tmp_path, mode="dry_run")
    task = agent.start_task("Create a neon city skyline, edit it and post it to instagram")
    assert task.status == "done", [s.summary for s in task.plan]
    assert task.plan_source == "fallback"
    # An image was generated and an edited image threaded through to the post.
    assert task.last_image
    assert agent.sandbox.resolve_path(task.last_image).exists()
    post_step = task.plan[-1]
    assert post_step.tool == "post_to_instagram"
    assert post_step.data.get("simulated") is True


def test_placeholder_threading(tmp_path):
    agent = make_agent(tmp_path, mode="dry_run")
    task = agent.start_task("generate a beach photo then edit it")
    edit_step = [s for s in task.plan if s.tool == "edit_image"][0]
    # $LAST_IMAGE should have been resolved to the generated file, not the literal.
    assert edit_step.args["source"] != "$LAST_IMAGE"
    assert edit_step.status == "done"


def test_live_mode_pauses_for_approval_then_resumes(tmp_path):
    agent = make_agent(tmp_path, mode="live", require_approval=True)
    task = agent.start_task("Create a coffee photo and post it to instagram")
    assert task.status == "awaiting_approval"
    pending = task.plan[task.cursor]
    assert pending.tool == "post_to_instagram"

    # Denying skips the sensitive step and finishes the task.
    task = agent.approve(task.id, approved=False)
    assert task.status == "done"
    assert task.plan[-1].status == "skipped"


def test_live_mode_denied_does_not_post(tmp_path):
    agent = make_agent(tmp_path, mode="live", require_approval=True)
    task = agent.start_task("Create a dog photo and post it to instagram")
    task = agent.approve(task.id, approved=False)
    outcomes = [e["outcome"] for e in agent.sandbox.audit_log()]
    assert "posted" not in outcomes
