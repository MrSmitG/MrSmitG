const $ = (sel) => document.querySelector(sel);
const messages = $("#messages");
const composer = $("#composer");
const input = $("#input");
const sendBtn = $("#send");

const TOOL_ICONS = {
  generate_image: "🎨",
  edit_image: "✂️",
  write_caption: "✍️",
  post_to_instagram: "📤",
  list_files: "📁",
};

function scrollDown() {
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(role, html) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = html;
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  scrollDown();
  return wrap;
}

function stepIcon(tool) {
  return TOOL_ICONS[tool] || "•";
}

function renderStep(step) {
  const parts = [];
  parts.push(`<div class="step ${step.status}">`);
  parts.push(`<div class="icon">${step.status === "done" ? "✓" : step.status === "error" ? "!" : step.status === "skipped" ? "–" : stepIcon(step.tool)}</div>`);
  parts.push(`<div class="body">`);
  parts.push(`<div class="tool-name">${stepIcon(step.tool)} ${step.tool}</div>`);
  if (step.why) parts.push(`<div class="why">${escapeHtml(step.why)}</div>`);
  if (step.summary) parts.push(`<div class="summary">${escapeHtml(step.summary)}</div>`);

  const caption = step.data && (step.data.full || step.data.caption);
  if (caption) parts.push(`<div class="caption-box">${escapeHtml(caption)}</div>`);

  if (step.artifact && /\.(png|jpg|jpeg)$/i.test(step.artifact)) {
    parts.push(`<img class="thumb" src="/media/${encodeURIComponent(step.artifact)}?t=${Date.now()}" alt="${escapeHtml(step.artifact)}" />`);
  }
  parts.push(`</div></div>`);
  return parts.join("");
}

function renderTask(task) {
  const parts = [`<div class="plan">`];
  parts.push(`<div class="plan-head">Plan <span class="src">${task.plan_source === "llm" ? "local LLM" : "built-in planner"}</span></div>`);
  task.steps.forEach((s) => parts.push(renderStep(s)));

  if (task.status === "awaiting_approval") {
    const step = task.steps[task.cursor];
    parts.push(`
      <div class="approval">
        <p>⚠️ This step needs your approval before it runs for real.</p>
        <div class="detail">${escapeHtml(task.pending_detail || (step && step.tool))}</div>
        <div class="buttons">
          <button class="btn approve" data-task="${task.id}" data-approved="true">Approve &amp; run</button>
          <button class="btn deny" data-task="${task.id}" data-approved="false">Skip this step</button>
        </div>
      </div>`);
  }
  parts.push(`</div>`);
  return parts.join("");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function wireApprovalButtons(container) {
  container.querySelectorAll(".btn[data-task]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      container.querySelectorAll(".btn").forEach((b) => (b.disabled = true));
      const task = await postJson("/api/approve", {
        task_id: btn.dataset.task,
        approved: btn.dataset.approved === "true",
      });
      const wrap = container.closest(".msg");
      const bubble = wrap.querySelector(".bubble");
      bubble.innerHTML = renderTask(task);
      wireApprovalButtons(bubble);
      scrollDown();
    });
  });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function loadStatus() {
  try {
    const s = await (await fetch("/api/status")).json();
    const modePill = $("#mode-pill");
    modePill.textContent = s.mode === "live" ? "LIVE" : "dry-run (safe)";
    modePill.className = "pill " + (s.mode === "live" ? "danger" : "good");

    const llmPill = $("#llm-pill");
    llmPill.textContent = s.llm_available ? s.llm_model : "fallback planner";
    llmPill.className = "pill " + (s.llm_available ? "good" : "warn");

    const igPill = $("#ig-pill");
    igPill.textContent = s.instagram_enabled ? "enabled" : "off";
    igPill.className = "pill " + (s.instagram_enabled ? "good" : "warn");

    $("#workspace-path").textContent = "📂 " + s.workspace;

    const list = $("#tools-list");
    list.innerHTML = "";
    (s.tools || []).forEach((t) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${stepIcon(t.name)} ${t.name}</span><span class="risk ${t.risk}">${t.risk}</span>`;
      list.appendChild(li);
    });
  } catch (e) {
    console.error("status failed", e);
  }
}

async function submitMessage(text) {
  addMessage("user", escapeHtml(text));
  const thinking = addMessage("agent", `<span class="typing">Planning and working…</span>`);
  sendBtn.disabled = true;
  try {
    const task = await postJson("/api/chat", { message: text });
    thinking.querySelector(".bubble").innerHTML = renderTask(task);
    wireApprovalButtons(thinking.querySelector(".bubble"));
  } catch (e) {
    thinking.querySelector(".bubble").innerHTML = "Something went wrong. Is the server running?";
  } finally {
    sendBtn.disabled = false;
    scrollDown();
  }
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  submitMessage(text);
});

document.querySelectorAll(".example").forEach((btn) => {
  btn.addEventListener("click", () => submitMessage(btn.textContent.trim()));
});

loadStatus();
