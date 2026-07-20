/* Core game loop, physics, combat, story flags */
const Game = (() => {
  let canvas, ctx;
  let chapterIndex = 0;
  let level = null;
  let state = null;
  let cam = { x: 0, y: 0, w: 1280, h: 720 };
  let running = false;
  let lastTs = 0;
  let time = 0;
  let dialogueQueue = [];
  let onChapterWin = null;
  let onGameOver = null;
  let onHud = null;
  let toastTimer = 0;

  function cloneLevel(id) {
    const src = LEVELS[id];
    return JSON.parse(JSON.stringify(src));
  }

  function makeState(lvl) {
    return {
      player: {
        x: lvl.playerStart.x,
        y: lvl.playerStart.y,
        r: 16,
        speed: 165,
        hp: 100,
        maxHp: 100,
        facing: 1,
        moving: false,
        attackT: 0,
        invuln: 0,
        hasBrand: false,
        hasBow: false,
        moly: 0,
      },
      npcs: (lvl.npcs || []).map((n) => ({ ...n })),
      enemies: (lvl.enemies || []).map((e) => ({
        ...e,
        patrolI: 0,
        stun: 0,
        blind: false,
        _dead: false,
      })),
      items: (lvl.items || []).map((i) => ({ ...i, _taken: false })),
      props: lvl.props,
      flags: Object.create(null),
      crew: 0,
      maxCrew: 12,
      objective: STORY.chapters[chapterIndex].objective,
    };
  }

  function start(index, hooks) {
    chapterIndex = index;
    level = cloneLevel(STORY.chapters[index].id);
    state = makeState(level);
    onChapterWin = hooks.onChapterWin;
    onGameOver = hooks.onGameOver;
    onHud = hooks.onHud;
    dialogueQueue = [...STORY.chapters[index].startDialogue];
    running = true;
    lastTs = 0;
    time = 0;
    Input.clear();
    updateHud();
    showDialogue();
  }

  function stop() {
    running = false;
  }

  function restart() {
    start(chapterIndex, { onChapterWin, onGameOver, onHud });
  }

  function attach(c) {
    canvas = c;
    ctx = canvas.getContext("2d");
  }

  function showDialogue() {
    if (!dialogueQueue.length) {
      document.getElementById("dialogue").classList.add("hidden");
      return;
    }
    const d = dialogueQueue[0];
    document.getElementById("dlg-speaker").textContent = d.speaker;
    document.getElementById("dlg-text").textContent = d.text;
    document.getElementById("dialogue").classList.remove("hidden");
  }

  function advanceDialogue() {
    if (!dialogueQueue.length) return false;
    dialogueQueue.shift();
    if (dialogueQueue.length) {
      showDialogue();
    } else {
      document.getElementById("dialogue").classList.add("hidden");
    }
    return true;
  }

  function inDialogue() {
    return dialogueQueue.length > 0;
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    toastTimer = 2.2;
  }

  function updateHud() {
    if (!state || !onHud) return;
    onHud({
      chapter: STORY.chapters[chapterIndex],
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      crew: state.crew,
      maxCrew: Math.max(3, state.maxCrew),
      objective: state.objective,
    });
  }

  function setFlag(name) {
    state.flags[name] = true;
  }

  function hasFlag(name) {
    return !!state.flags[name];
  }

  function circleRect(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function resolveWalls(ent, r) {
    for (const wall of level.walls) {
      if (!circleRect(ent.x, ent.y, r, wall)) continue;
      const nx = Math.max(wall.x, Math.min(ent.x, wall.x + wall.w));
      const ny = Math.max(wall.y, Math.min(ent.y, wall.y + wall.h));
      let dx = ent.x - nx;
      let dy = ent.y - ny;
      const d = Math.hypot(dx, dy) || 0.001;
      const push = r - d + 0.5;
      ent.x += (dx / d) * push;
      ent.y += (dy / d) * push;
    }
    // solid props
    for (const p of level.props) {
      if (
        p.type === "exit" ||
        p.type === "ship" ||
        p.type === "sheep" ||
        p._gone
      )
        continue;
      const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (!circleRect(ent.x, ent.y, r, rect)) continue;
      const nx = Math.max(rect.x, Math.min(ent.x, rect.x + rect.w));
      const ny = Math.max(rect.y, Math.min(ent.y, rect.y + rect.h));
      let dx = ent.x - nx;
      let dy = ent.y - ny;
      const d = Math.hypot(dx, dy) || 0.001;
      const push = r - d + 0.5;
      ent.x += (dx / d) * push;
      ent.y += (dy / d) * push;
    }
  }

  function tryInteract() {
    const p = state.player;
    // NPCs
    for (const n of state.npcs) {
      if (n._gone) continue;
      if (Math.hypot(p.x - n.x, p.y - n.y) > 50) continue;
      if (n.locked && n.needFlag && !hasFlag(n.needFlag)) {
        if (n.kind === "sorceress") {
          dialogueQueue = [
            {
              speaker: "Circe",
              text: "Without moly, you are only meat for my herd. Gather three white blooms, king of nowhere.",
            },
          ];
        } else if (n.kind === "queen") {
          dialogueQueue = [
            {
              speaker: "Penelope",
              text: "The hall still reeks of suitors. Clear my home, stranger — then we will speak of scars.",
            },
          ];
        }
        showDialogue();
        return;
      }
      if (n.recruitable && !n._recruited) {
        n._recruited = true;
        n._gone = true;
        state.crew = Math.min(state.maxCrew, state.crew + 1);
        toast(STORY.toasts.crewSaved);
        setObjective();
        updateHud();
      }
      if (n.dialogue) {
        dialogueQueue = [...n.dialogue];
        showDialogue();
      }
      if (n.onTalkFlag) {
        setFlag(n.onTalkFlag);
        checkWin();
      }
      return;
    }

    // Props
    for (const prop of level.props) {
      if (prop._gone) continue;
      const cx = prop.x + prop.w / 2;
      const cy = prop.y + prop.h / 2;
      if (Math.hypot(p.x - cx, p.y - cy) > Math.max(prop.w, prop.h) * 0.7 + 20)
        continue;

      if (prop.interact === "board") {
        if (state.crew < (prop.needCrew || 0)) {
          dialogueQueue = [
            {
              speaker: "Odysseus",
              text: `We need more men. Rally the crew on the shore (${state.crew}/${prop.needCrew}).`,
            },
          ];
          showDialogue();
          return;
        }
        setFlag("boarded");
        toast(STORY.toasts.chapterClear);
        checkWin();
        return;
      }
      if (prop.interact === "escape") {
        if (prop.needFlag && !hasFlag(prop.needFlag)) {
          dialogueQueue = [
            {
              speaker: "Odysseus",
              text: "The Cyclops still watches the mouth of the cave. Blind him first.",
            },
          ];
          showDialogue();
          return;
        }
        setFlag("escapedCave");
        toast(STORY.toasts.chapterClear);
        checkWin();
        return;
      }
      if (prop.interact === "land") {
        setFlag("landed");
        toast(STORY.toasts.chapterClear);
        checkWin();
        return;
      }
    }
  }

  function setObjective() {
    const id = STORY.chapters[chapterIndex].id;
    if (id === "sea") {
      state.objective =
        state.crew >= 3
          ? "Board the black ship"
          : `Rally crew (${state.crew}/3), then board`;
    } else if (id === "cyclops") {
      state.objective = state.player.hasBrand
        ? hasFlag("cyclopsBlind")
          ? "Escape through the cave mouth"
          : "Strike the sleeping Cyclops"
        : "Find the firebrand in the cave";
    } else if (id === "circe") {
      if (state.player.moly >= 3) {
        state.objective = "Confront Circe at her palace";
        setFlag("moly3");
      } else {
        state.objective = `Gather moly (${state.player.moly}/3)`;
      }
    } else if (id === "sirens") {
      state.objective = "Steer east — avoid the singing rocks";
    } else if (id === "ithaca") {
      const alive = state.enemies.filter((e) => !e._dead).length;
      if (alive === 0) {
        setFlag("suitorsDown");
        state.objective = "Speak with Penelope";
      } else {
        state.objective = state.player.hasBow
          ? `Defeat the suitors (${4 - alive}/4)`
          : "Claim your bow, then clear the hall";
      }
    }
    updateHud();
  }

  function pickItems() {
    const p = state.player;
    for (const it of state.items) {
      if (it._taken) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) > 28) continue;
      it._taken = true;
      if (it.type === "moly") {
        p.moly += 1;
        toast(STORY.toasts.moly);
        setObjective();
      } else if (it.type === "brand") {
        p.hasBrand = true;
        toast(STORY.toasts.brand);
        setObjective();
      } else if (it.type === "bow") {
        p.hasBow = true;
        toast("The bow of Odysseus answers only you");
        setObjective();
      }
    }
  }

  function doAttack() {
    const p = state.player;
    if (p.attackT > 0) return;
    p.attackT = 0.28;
    const range = 48;
    for (const e of state.enemies) {
      if (e._dead) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d > range + e.r) continue;

      if (e.kind === "cyclops") {
        if (!p.hasBrand) {
          toast("Your blade alone cannot pierce that hide — find the brand");
          continue;
        }
        // must be relatively close / "asleep" when far from player aggro... allow if brand
        e.blind = true;
        e.stun = 999;
        e.speed = 0;
        setFlag("cyclopsBlind");
        toast("Polyphemus is blinded! Flee!");
        dialogueQueue = [
          {
            speaker: "Polyphemus",
            text: "Nobody! Nobody has blinded me!",
          },
          {
            speaker: "Odysseus",
            text: "Remember the name when the wine-dark sea asks who bested you — Odysseus of Ithaca!",
          },
        ];
        showDialogue();
        setObjective();
        continue;
      }

      if (e.kind === "pig") {
        // Free with moly or attack gently — free them
        if (p.moly > 0 || true) {
          e._dead = true;
          state.crew += 1;
          toast("A crewman is restored from the swine-curse");
          setObjective();
        }
        continue;
      }

      if (e.kind === "suitor") {
        const dmg = p.hasBow ? 2 : 1;
        e.hp -= dmg;
        e.stun = 0.35;
        if (e.hp <= 0) {
          e._dead = true;
          toast("A suitor falls");
          setObjective();
          checkWin();
        }
      }
    }
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;
    p.hp -= amount;
    p.invuln = 0.9;
    updateHud();
    if (p.hp <= 0) {
      p.hp = 0;
      running = false;
      if (onGameOver) onGameOver();
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e._dead) continue;
      if (e.stun > 0) {
        e.stun -= dt;
        continue;
      }
      if (e.blind) continue;

      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      let vx = 0;
      let vy = 0;

      if (dist < (e.aggro || 200)) {
        vx = ((p.x - e.x) / dist) * e.speed;
        vy = ((p.y - e.y) / dist) * e.speed;
      } else if (e.patrol && e.patrol.length) {
        const target = e.patrol[e.patrolI % e.patrol.length];
        const pd = Math.hypot(target.x - e.x, target.y - e.y);
        if (pd < 12) e.patrolI++;
        else {
          vx = ((target.x - e.x) / pd) * e.speed * 0.5;
          vy = ((target.y - e.y) / pd) * e.speed * 0.5;
        }
      }

      e.x += vx * dt;
      e.y += vy * dt;
      resolveWalls(e, e.r * 0.7);

      // contact damage
      if (dist < e.r + p.r - 4) {
        if (e.kind === "cyclops") hurtPlayer(18);
        else if (e.kind === "suitor") hurtPlayer(10);
        else if (e.kind === "pig") hurtPlayer(6);
      }
    }
  }

  function updateSirens(dt) {
    if (level.theme !== "channel") return;
    const p = state.player;
    // song pull
    if (level.pullZones) {
      for (const z of level.pullZones) {
        if (
          p.x > z.x &&
          p.x < z.x + z.w &&
          p.y > z.y &&
          p.y < z.y + z.h
        ) {
          p.x += z.pullX * dt;
          p.y += z.pullY * dt;
        }
      }
    }
    if (level.hazards) {
      for (const h of level.hazards) {
        if (circleRect(p.x, p.y, p.r, h)) {
          hurtPlayer(h.damage * dt * 2);
        }
      }
    }
  }

  function checkWin() {
    const win = level.win;
    if (!win) return;
    if (win.type === "flag" && hasFlag(win.flag)) {
      running = false;
      setTimeout(() => {
        if (onChapterWin) onChapterWin(chapterIndex);
      }, 600);
    }
  }

  function updateCamera() {
    const p = state.player;
    const viewW = cam.cssW || cam.w / (cam.dpr || 1);
    const viewH = cam.cssH || cam.h / (cam.dpr || 1);
    cam.x = p.x - viewW / 2;
    cam.y = p.y - viewH / 2;
    cam.x = Math.max(0, Math.min(cam.x, level.width - viewW));
    cam.y = Math.max(0, Math.min(cam.y, level.height - viewH));
    cam.w = viewW;
    cam.h = viewH;
  }

  function tick(ts) {
    if (!canvas) return;
    const size = Renderer.resizeCanvas(canvas);
    cam.dpr = size.dpr;
    cam.cssW = size.cssW;
    cam.cssH = size.cssH;

    if (!running && !inDialogue()) {
      // still draw last frame if paused mid-level — handled by main
      return;
    }

    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(dt, 0.05);
    time += dt;

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) {
        document.getElementById("toast").classList.add("hidden");
      }
    }

    if (Input.consumePause()) {
      // bubble to main via custom event
      window.dispatchEvent(new CustomEvent("odyssey-pause"));
    }

    if (inDialogue()) {
      if (Input.consumeInteract()) advanceDialogue();
      Input.consumeAttack();
      draw();
      return;
    }

    if (!running) {
      draw();
      return;
    }

    const p = state.player;
    if (p.attackT > 0) p.attackT -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    const axis = Input.axis();
    p.moving = !!(axis.x || axis.y);
    if (axis.x) p.facing = axis.x > 0 ? 1 : -1;

    let spd = p.speed;
    if (level.theme === "channel") spd = 140;

    p.x += axis.x * spd * dt;
    p.y += axis.y * spd * dt;

    // soft water slow on beach
    if (level.waterZones && level.theme === "beach") {
      for (const w of level.waterZones) {
        if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + w.h) {
          p.y = Math.min(p.y, w.y + 40);
        }
      }
    }

    resolveWalls(p, p.r);
    p.x = Math.max(p.r, Math.min(level.width - p.r, p.x));
    p.y = Math.max(p.r, Math.min(level.height - p.r, p.y));

    pickItems();
    updateEnemies(dt);
    updateSirens(dt);

    if (Input.consumeInteract()) tryInteract();
    if (Input.consumeAttack()) doAttack();

    updateCamera();
    draw();
  }

  function draw() {
    if (!ctx || !level || !state) return;
    const dpr = cam.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cam.cssW, cam.cssH);
    // vignette bg
    ctx.fillStyle = "#05080c";
    ctx.fillRect(0, 0, cam.cssW, cam.cssH);
    Renderer.drawWorld(ctx, level, cam, time, state);

    // hurt flash
    if (state.player.invuln > 0.6) {
      ctx.fillStyle = "rgba(139, 46, 46, 0.2)";
      ctx.fillRect(0, 0, cam.cssW, cam.cssH);
    }

    // edge vignette
    const g = ctx.createRadialGradient(
      cam.cssW / 2,
      cam.cssH / 2,
      cam.cssH * 0.35,
      cam.cssW / 2,
      cam.cssH / 2,
      cam.cssH * 0.85
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.cssW, cam.cssH);
  }

  function loop(ts) {
    tick(ts);
    requestAnimationFrame(loop);
  }

  function beginLoop() {
    requestAnimationFrame(loop);
  }

  function isRunning() {
    return running;
  }

  function setRunning(v) {
    running = v;
    lastTs = 0;
  }

  function getChapterIndex() {
    return chapterIndex;
  }

  return {
    attach,
    start,
    stop,
    restart,
    beginLoop,
    isRunning,
    setRunning,
    getChapterIndex,
    inDialogue,
  };
})();
