/* App screens, title sea animation, chapter flow */
(function () {
  const screens = {
    title: document.getElementById("screen-title"),
    how: document.getElementById("screen-how"),
    chapter: document.getElementById("screen-chapter"),
    game: document.getElementById("screen-game"),
    pause: document.getElementById("screen-pause"),
    ending: document.getElementById("screen-ending"),
  };

  let chapterIndex = 0;
  let titleAnimId = 0;

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function showOverlay(name, on) {
    screens[name].classList.toggle("active", on);
  }

  /* —— Title canvas: wine-dark sea —— */
  function startTitleSea() {
    const canvas = document.getElementById("title-canvas");
    const ctx = canvas.getContext("2d");
    let t = 0;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(ts) {
      t = ts * 0.001;
      const w = innerWidth;
      const h = innerHeight;
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0a1520");
      sky.addColorStop(0.45, "#1a1828");
      sky.addColorStop(0.7, "#1a2030");
      sky.addColorStop(1, "#0c1820");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // distant mountains
      ctx.fillStyle = "#121820";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      for (let x = 0; x <= w; x += 40) {
        const y =
          h * 0.5 +
          Math.sin(x * 0.008) * 40 +
          Math.sin(x * 0.02) * 18;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();

      // bronze sun / moon low
      const sx = w * 0.72;
      const sy = h * 0.38;
      const sun = ctx.createRadialGradient(sx, sy, 5, sx, sy, 90);
      sun.addColorStop(0, "rgba(232, 200, 74, 0.85)");
      sun.addColorStop(0.4, "rgba(201, 162, 39, 0.35)");
      sun.addColorStop(1, "rgba(201, 162, 39, 0)");
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c84a";
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();

      // sea bands
      const seaTop = h * 0.58;
      const sea = ctx.createLinearGradient(0, seaTop, 0, h);
      sea.addColorStop(0, "#1a2838");
      sea.addColorStop(0.35, "#121c2a");
      sea.addColorStop(0.7, "#0e1520");
      sea.addColorStop(1, "#080c12");
      ctx.fillStyle = sea;
      ctx.fillRect(0, seaTop, w, h - seaTop);

      // animated waves
      for (let layer = 0; layer < 5; layer++) {
        ctx.beginPath();
        const base = seaTop + 20 + layer * 28;
        const amp = 6 + layer * 3;
        const speed = 0.6 + layer * 0.25;
        ctx.moveTo(0, h);
        ctx.lineTo(0, base);
        for (let x = 0; x <= w; x += 8) {
          const y =
            base +
            Math.sin(x * 0.012 + t * speed + layer) * amp +
            Math.sin(x * 0.035 - t * speed * 0.7) * (amp * 0.4);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const alpha = 0.08 + layer * 0.04;
        ctx.fillStyle =
          layer % 2 === 0
            ? `rgba(40, 70, 95, ${alpha})`
            : `rgba(30, 50, 70, ${alpha})`;
        ctx.fill();
      }

      // ship silhouette
      const shipX = w * 0.35 + Math.sin(t * 0.4) * 30;
      const shipY = seaTop + 50 + Math.sin(t * 1.2) * 6;
      ctx.fillStyle = "#0a0c10";
      ctx.beginPath();
      ctx.moveTo(shipX - 70, shipY);
      ctx.quadraticCurveTo(shipX, shipY + 35, shipX + 80, shipY);
      ctx.lineTo(shipX + 60, shipY - 18);
      ctx.lineTo(shipX - 50, shipY - 14);
      ctx.closePath();
      ctx.fill();
      // sail
      ctx.fillStyle = "#2a3038";
      ctx.beginPath();
      ctx.moveTo(shipX + 5, shipY - 95);
      ctx.lineTo(shipX + 8, shipY - 10);
      ctx.lineTo(shipX + 55, shipY - 25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a1e24";
      ctx.fillRect(shipX + 2, shipY - 100, 5, 95);

      // foam particles
      ctx.fillStyle = "rgba(212, 228, 239, 0.35)";
      for (let i = 0; i < 24; i++) {
        const px = ((i * 97 + t * 40) % (w + 20)) - 10;
        const py = seaTop + 40 + ((i * 37) % (h * 0.35));
        ctx.globalAlpha = 0.2 + (i % 4) * 0.1;
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.globalAlpha = 1;

      // subtle grain / stars
      ctx.fillStyle = "rgba(232, 200, 74, 0.5)";
      for (let i = 0; i < 40; i++) {
        const px = (i * 173) % w;
        const py = (i * 97) % (h * 0.5);
        ctx.globalAlpha = 0.15 + Math.sin(t + i) * 0.1;
        ctx.fillRect(px, py, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      titleAnimId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    titleAnimId = requestAnimationFrame(frame);
  }

  function stopTitleSea() {
    cancelAnimationFrame(titleAnimId);
  }

  function openChapter(i) {
    chapterIndex = i;
    const ch = STORY.chapters[i];
    document.getElementById("chapter-label").textContent = ch.label;
    document.getElementById("chapter-title").textContent = ch.title;
    document.getElementById("chapter-blurb").textContent = ch.blurb;
    show("chapter");
  }

  function startChapter() {
    stopTitleSea();
    show("game");
    Game.start(chapterIndex, {
      onChapterWin: (idx) => {
        if (idx >= STORY.chapters.length - 1) {
          document.getElementById("ending-title").textContent =
            STORY.ending.title;
          document.getElementById("ending-text").textContent =
            STORY.ending.text;
          show("ending");
        } else {
          openChapter(idx + 1);
        }
      },
      onGameOver: () => {
        showOverlay("pause", true);
        document.querySelector("#screen-pause h2").textContent = "Fallen";
        document.querySelector("#screen-pause .modal-note").textContent =
          "Poseidon claims another soul. Rise, and try the chapter again.";
      },
      onHud: (data) => {
        document.getElementById("hud-chapter").textContent =
          data.chapter.label + " — " + data.chapter.title;
        document.getElementById("bar-hp").style.width =
          Math.max(0, (data.hp / data.maxHp) * 100) + "%";
        const crewPct = Math.min(100, (data.crew / 3) * 100);
        document.getElementById("bar-crew").style.width = crewPct + "%";
        document.getElementById("hud-objective").textContent = data.objective;
      },
    });
  }

  function resetPauseCopy() {
    document.querySelector("#screen-pause h2").textContent = "Paused";
    document.querySelector("#screen-pause .modal-note").textContent =
      "The wine-dark sea waits.";
  }

  // Wire UI
  document.getElementById("btn-play").addEventListener("click", () => {
    openChapter(0);
  });
  document.getElementById("btn-how").addEventListener("click", () => {
    showOverlay("how", true);
  });
  document.getElementById("btn-how-close").addEventListener("click", () => {
    showOverlay("how", false);
  });
  document.getElementById("btn-start-chapter").addEventListener("click", () => {
    resetPauseCopy();
    startChapter();
  });
  document.getElementById("btn-pause").addEventListener("click", () => {
    Game.setRunning(false);
    resetPauseCopy();
    showOverlay("pause", true);
  });
  document.getElementById("btn-resume").addEventListener("click", () => {
    showOverlay("pause", false);
    if (
      document.querySelector("#screen-pause h2").textContent === "Fallen"
    ) {
      Game.restart();
      return;
    }
    Game.setRunning(true);
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    showOverlay("pause", false);
    resetPauseCopy();
    Game.restart();
  });
  document.getElementById("btn-title").addEventListener("click", () => {
    showOverlay("pause", false);
    Game.stop();
    resetPauseCopy();
    show("title");
    startTitleSea();
  });
  document.getElementById("btn-replay").addEventListener("click", () => {
    openChapter(0);
  });

  window.addEventListener("odyssey-pause", () => {
    if (!screens.game.classList.contains("active")) return;
    if (screens.pause.classList.contains("active")) {
      showOverlay("pause", false);
      Game.setRunning(true);
    } else if (!Game.inDialogue()) {
      Game.setRunning(false);
      resetPauseCopy();
      showOverlay("pause", true);
    }
  });

  // Boot
  Input.bind();
  Game.attach(document.getElementById("game"));
  Game.beginLoop();
  show("title");
  startTitleSea();
})();
