import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import load_config
from agent.sandbox import Sandbox
from agent.tools import build_registry
from agent.tools.base import ToolContext


def make_ctx(tmp_path, mode="dry_run"):
    cfg = load_config(tmp_path)
    cfg.sandbox.workspace_dir = str(tmp_path / "ws")
    cfg.sandbox.mode = mode
    sb = Sandbox(cfg)
    return ToolContext(config=cfg, sandbox=sb, llm=None), sb


def test_generate_image_creates_file(tmp_path):
    ctx, sb = make_ctx(tmp_path)
    tools = build_registry(ctx)
    res = tools["generate_image"].run({"prompt": "a calm ocean sunset", "filename": "s.png", "size": 512})
    assert res.ok
    out = sb.resolve_path(res.artifact)
    assert out.exists()
    with Image.open(out) as im:
        assert im.size == (512, 512)


def test_edit_image_pipeline(tmp_path):
    ctx, sb = make_ctx(tmp_path)
    tools = build_registry(ctx)
    tools["generate_image"].run({"prompt": "forest", "filename": "src.png", "size": 400})
    res = tools["edit_image"].run({
        "source": "src.png",
        "operations": [{"op": "square"}, {"op": "sepia"},
                       {"op": "text", "value": "Hello", "position": "bottom"}],
        "output": "edited.png",
    })
    assert res.ok, res.summary
    assert sb.resolve_path("edited.png").exists()
    assert res.data["operations"] == ["square", "sepia", "text"]


def test_edit_image_rejects_missing_source(tmp_path):
    ctx, _ = make_ctx(tmp_path)
    tools = build_registry(ctx)
    res = tools["edit_image"].run({"source": "nope.png", "operations": []})
    assert not res.ok


def test_write_caption_fallback(tmp_path):
    ctx, _ = make_ctx(tmp_path)
    tools = build_registry(ctx)
    res = tools["write_caption"].run({"topic": "golden hour beach", "hashtag_count": 5})
    assert res.ok
    assert len(res.data["hashtags"]) == 5
    assert all(h.startswith("#") for h in res.data["hashtags"])
    assert res.data["caption"]


def test_instagram_dry_run_simulates(tmp_path):
    ctx, sb = make_ctx(tmp_path, mode="dry_run")
    tools = build_registry(ctx)
    tools["generate_image"].run({"prompt": "cat", "filename": "cat.png", "size": 300})
    res = tools["post_to_instagram"].run({"image": "cat.png", "caption": "hi #cat"})
    assert res.ok
    assert res.data["simulated"] is True
    assert "SIMULATED" in res.summary


def test_instagram_rejects_missing_image(tmp_path):
    ctx, _ = make_ctx(tmp_path)
    tools = build_registry(ctx)
    res = tools["post_to_instagram"].run({"image": "ghost.png", "caption": "x"})
    assert not res.ok


def test_list_files(tmp_path):
    ctx, sb = make_ctx(tmp_path)
    tools = build_registry(ctx)
    tools["generate_image"].run({"prompt": "x", "filename": "a.png", "size": 256})
    res = tools["list_files"].run({})
    assert res.ok
    names = [f["name"] for f in res.data["files"]]
    assert "a.png" in names
