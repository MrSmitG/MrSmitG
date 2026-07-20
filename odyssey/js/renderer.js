/* Canvas rendering — simple but detailed procedural art */
const Renderer = (() => {
  function drawWorld(ctx, level, cam, t, state) {
    const theme = level.theme;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Floor
    drawFloor(ctx, level, theme, t);

    // Water
    if (level.waterZones) {
      for (const w of level.waterZones) drawWater(ctx, w, t, theme);
    }

    // Walls / cliffs
    for (const wall of level.walls) drawWall(ctx, wall, theme);

    // Props
    for (const p of level.props) {
      if (p._gone) continue;
      drawProp(ctx, p, t, theme);
    }

    // Items
    for (const it of state.items) {
      if (it._taken) continue;
      drawItem(ctx, it, t);
    }

    // Enemies
    for (const e of state.enemies) {
      if (e._dead) continue;
      drawEnemy(ctx, e, t);
    }

    // NPCs
    for (const n of state.npcs) {
      if (n._gone) continue;
      drawNpc(ctx, n, t);
    }

    // Player
    drawPlayer(ctx, state.player, t);

    // Attack arc
    if (state.player.attackT > 0) {
      drawAttack(ctx, state.player);
    }

    // Ambient particles
    drawAmbient(ctx, level, cam, t, theme);

    ctx.restore();
  }

  function drawFloor(ctx, level, theme, t) {
    if (theme === "beach") {
      const g = ctx.createLinearGradient(0, 0, 0, level.height);
      g.addColorStop(0, "#3a4a38");
      g.addColorStop(0.35, "#6a7a4a");
      g.addColorStop(0.55, "#c4a574");
      g.addColorStop(0.75, "#b89560");
      g.addColorStop(1, "#1a3040");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, level.width, level.height);
      // dunes
      ctx.fillStyle = "rgba(180, 140, 80, 0.25)";
      for (let i = 0; i < 12; i++) {
        const x = (i * 197) % level.width;
        const y = 400 + ((i * 83) % 400);
        ctx.beginPath();
        ctx.ellipse(x, y, 80 + (i % 3) * 30, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // foam line
      ctx.strokeStyle = "rgba(212, 228, 239, 0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < level.width; x += 20) {
        const y = 1160 + Math.sin(x * 0.02 + t * 2) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (theme === "cave") {
      ctx.fillStyle = "#1a1816";
      ctx.fillRect(0, 0, level.width, level.height);
      ctx.fillStyle = "#2a2420";
      for (let i = 0; i < 40; i++) {
        const x = (i * 137) % level.width;
        const y = (i * 211) % level.height;
        ctx.fillRect(x, y, 40 + (i % 5) * 10, 30);
      }
      // lava cracks
      ctx.strokeStyle = "rgba(180, 60, 20, 0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(200 + i * 180, 200);
        ctx.quadraticCurveTo(
          300 + i * 180,
          500 + Math.sin(t + i) * 40,
          250 + i * 180,
          900
        );
        ctx.stroke();
      }
    } else if (theme === "grove") {
      const g = ctx.createRadialGradient(
        level.width / 2,
        level.height / 2,
        100,
        level.width / 2,
        level.height / 2,
        level.width / 1.2
      );
      g.addColorStop(0, "#3a5a3a");
      g.addColorStop(0.5, "#2a4030");
      g.addColorStop(1, "#1a2818");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, level.width, level.height);
      // flower dots
      for (let i = 0; i < 60; i++) {
        const x = (i * 173) % level.width;
        const y = (i * 291) % level.height;
        ctx.fillStyle = i % 2 ? "rgba(200, 120, 140, 0.35)" : "rgba(220, 200, 100, 0.3)";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === "channel") {
      ctx.fillStyle = "#0a1218";
      ctx.fillRect(0, 0, level.width, level.height);
    } else if (theme === "palace") {
      ctx.fillStyle = "#2a241c";
      ctx.fillRect(0, 0, level.width, level.height);
      // mosaic floor
      for (let y = 100; y < level.height - 100; y += 48) {
        for (let x = 80; x < level.width - 80; x += 48) {
          ctx.fillStyle = ((x + y) / 48) % 2 === 0 ? "#3a3228" : "#322a22";
          ctx.fillRect(x, y, 48, 48);
          ctx.strokeStyle = "rgba(201, 162, 39, 0.08)";
          ctx.strokeRect(x, y, 48, 48);
        }
      }
    }
  }

  function drawWater(ctx, w, t, theme) {
    const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
    if (theme === "beach" || theme === "channel") {
      g.addColorStop(0, "#1a3048");
      g.addColorStop(0.4, "#122838");
      g.addColorStop(1, "#0a1828");
    } else {
      g.addColorStop(0, "#1a3a40");
      g.addColorStop(1, "#0e2828");
    }
    ctx.fillStyle = g;
    ctx.fillRect(w.x, w.y, w.w, w.h);

    // wave lines
    ctx.strokeStyle = "rgba(100, 160, 190, 0.2)";
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 6; row++) {
      ctx.beginPath();
      const baseY = w.y + 20 + row * (w.h / 6);
      for (let x = w.x; x < w.x + w.w; x += 12) {
        const yy = baseY + Math.sin(x * 0.03 + t * 1.5 + row) * 4;
        if (x === w.x) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // sparkles
    ctx.fillStyle = "rgba(212, 228, 239, 0.4)";
    for (let i = 0; i < 8; i++) {
      const sx = w.x + ((Math.sin(t * 0.7 + i * 2.1) * 0.5 + 0.5) * w.w);
      const sy = w.y + ((Math.cos(t * 0.5 + i * 1.7) * 0.5 + 0.5) * w.h);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  function drawWall(ctx, wall, theme) {
    if (theme === "cave") {
      ctx.fillStyle = "#0e0c0a";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = "#3a3028";
      ctx.fillRect(wall.x, wall.y, wall.w, 6);
    } else if (theme === "palace") {
      ctx.fillStyle = "#4a4034";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = "rgba(201, 162, 39, 0.2)";
      ctx.fillRect(wall.x + 4, wall.y + 4, wall.w - 8, 4);
    } else {
      ctx.fillStyle = theme === "grove" ? "#1a2814" : "#2a3030";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      // rock texture
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(
          wall.x + (i * 17) % Math.max(1, wall.w - 10),
          wall.y + (i * 23) % Math.max(1, wall.h - 10),
          8,
          6
        );
      }
    }
  }

  function drawProp(ctx, p, t, theme) {
    const { x, y, w, h, type } = p;
    if (type === "ship") {
      // hull
      ctx.fillStyle = "#1a1210";
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.4);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 1.2, x + w, y + h * 0.4);
      ctx.lineTo(x + w * 0.9, y);
      ctx.lineTo(x + w * 0.1, y);
      ctx.closePath();
      ctx.fill();
      // sail
      ctx.fillStyle = "#d4c4a0";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y - 90);
      ctx.lineTo(x + w * 0.5 + 10, y + 10);
      ctx.lineTo(x + w * 0.85, y - 10);
      ctx.closePath();
      ctx.fill();
      // mast
      ctx.fillStyle = "#5a4030";
      ctx.fillRect(x + w * 0.48, y - 100, 8, 110);
      // bronze trim
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 2;
      ctx.stroke();
      // bob
      ctx.save();
      ctx.translate(0, Math.sin(t * 2) * 3);
      ctx.restore();
    } else if (type === "rock" || type === "sirenRock") {
      ctx.fillStyle = type === "sirenRock" ? "#3a4550" : "#4a4840";
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w * 0.15, y + h * 0.3);
      ctx.lineTo(x + w * 0.5, y);
      ctx.lineTo(x + w * 0.85, y + h * 0.35);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * 0.4);
      ctx.lineTo(x + w * 0.5, y + 8);
      ctx.lineTo(x + w * 0.55, y + h * 0.45);
      ctx.fill();
      if (type === "sirenRock") {
        // siren silhouette
        ctx.fillStyle = "rgba(180, 200, 220, 0.5)";
        const sx = x + w / 2;
        const sy = y + 20 + Math.sin(t * 3) * 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(sx - 6, sy + 8, 12, 20);
        // song rings
        ctx.strokeStyle = `rgba(180, 210, 230, ${0.2 + Math.sin(t * 4) * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 30 + Math.sin(t * 5) * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (type === "tree") {
      ctx.fillStyle = "#3a2818";
      ctx.fillRect(x + w * 0.35, y + h * 0.4, w * 0.3, h * 0.6);
      ctx.fillStyle = "#4a6a38";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.35, w * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a7a40";
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.45, w * 0.55, 0, Math.PI * 2);
      ctx.arc(x + w * 0.7, y + h * 0.4, w * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "ruin") {
      ctx.fillStyle = "#5a5048";
      ctx.fillRect(x, y + h * 0.3, w * 0.25, h * 0.7);
      ctx.fillRect(x + w * 0.75, y + h * 0.2, w * 0.25, h * 0.8);
      ctx.fillRect(x + w * 0.2, y, w * 0.6, h * 0.25);
      ctx.fillStyle = "rgba(201, 162, 39, 0.3)";
      ctx.fillRect(x + w * 0.3, y + 8, w * 0.4, 4);
    } else if (type === "exit") {
      ctx.fillStyle = "rgba(201, 162, 39, 0.25)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      ctx.setLineDash([]);
      ctx.fillStyle = "#e8c84a";
      ctx.font = "12px Cinzel, serif";
      ctx.fillText("→", x + w / 2 - 6, y + h / 2 + 4);
    } else if (type === "sheep") {
      ctx.fillStyle = "#e8e0d0";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a2018";
      ctx.beginPath();
      ctx.arc(x + w * 0.8, y + h * 0.4, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "crate") {
      ctx.fillStyle = "#8a6a40";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#5a4020";
      ctx.strokeRect(x, y, w, h);
    } else if (type === "palace") {
      ctx.fillStyle = "#6a5a48";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#8a7060";
      ctx.fillRect(x + 20, y + 40, 40, 60);
      ctx.fillRect(x + w - 60, y + 40, 40, 60);
      // columns
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#d4c4a0";
        ctx.fillRect(x + 20 + i * 40, y + 10, 14, h - 20);
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(x + 18 + i * 40, y + 5, 18, 8);
      }
    } else if (type === "throne") {
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(x, y + 20, w, h - 10);
      ctx.fillRect(x + 10, y, w - 20, 30);
      ctx.fillStyle = "#8a7020";
      ctx.fillRect(x + 5, y + 25, w - 10, 8);
    } else if (type === "table") {
      ctx.fillStyle = "#5a4030";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#8a2020";
      ctx.beginPath();
      ctx.ellipse(x + 30, y + 15, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "hearth") {
      ctx.fillStyle = "#3a2a20";
      ctx.fillRect(x, y, w, h);
      const flicker = 0.7 + Math.sin(t * 10) * 0.3;
      ctx.fillStyle = `rgba(220, 100, 30, ${flicker})`;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + h - 10);
      ctx.lineTo(x + w / 2, y + 5);
      ctx.lineTo(x + w - 20, y + h - 10);
      ctx.fill();
    }
  }

  function drawItem(ctx, it, t) {
    const bob = Math.sin(t * 3 + it.x) * 4;
    ctx.save();
    ctx.translate(it.x, it.y + bob);
    if (it.type === "moly") {
      ctx.fillStyle = "#e8e8f0";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6a8a50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, 16);
      ctx.stroke();
      ctx.fillStyle = "#7aaa50";
      ctx.beginPath();
      ctx.ellipse(-6, 8, 6, 3, -0.5, 0, Math.PI * 2);
      ctx.ellipse(6, 8, 6, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.type === "brand") {
      ctx.fillStyle = "#5a3020";
      ctx.fillRect(-3, -4, 6, 28);
      ctx.fillStyle = `rgba(255, 120, 40, ${0.7 + Math.sin(t * 8) * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(0, -22);
      ctx.lineTo(8, -4);
      ctx.fill();
    } else if (it.type === "bow") {
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 16, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = "#d4c4a0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-1.2) * 16, Math.sin(-1.2) * 16);
      ctx.lineTo(Math.cos(1.2) * 16, Math.sin(1.2) * 16);
      ctx.stroke();
    }
    // glow
    ctx.fillStyle = "rgba(201, 162, 39, 0.15)";
    ctx.beginPath();
    ctx.arc(0, 0, 20 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(ctx, e, t) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.kind === "cyclops") {
      const s = e.r;
      // body
      ctx.fillStyle = "#5a4a40";
      ctx.beginPath();
      ctx.ellipse(0, 10, s * 0.85, s * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.fillStyle = "#6a5a50";
      ctx.beginPath();
      ctx.arc(0, -s * 0.5, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // single eye
      if (!e.blind) {
        ctx.fillStyle = "#1a1a10";
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.55, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c04020";
        ctx.beginPath();
        ctx.arc(0, -s * 0.55, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(2, -s * 0.58, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#2a2018";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, -s * 0.55);
        ctx.lineTo(12, -s * 0.55);
        ctx.stroke();
      }
      // club
      ctx.fillStyle = "#4a3020";
      ctx.save();
      ctx.rotate(Math.sin(t * 2) * 0.15 + 0.4);
      ctx.fillRect(s * 0.5, -10, 18, 70);
      ctx.restore();
    } else if (e.kind === "pig") {
      ctx.fillStyle = "#c4788a";
      ctx.beginPath();
      ctx.ellipse(0, 4, e.r, e.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a06070";
      ctx.beginPath();
      ctx.arc(e.r * 0.6, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a1a18";
      ctx.fillRect(e.r * 0.9, -2, 6, 4);
      // sad human eyes hint
      ctx.fillStyle = "#efe6d4";
      ctx.beginPath();
      ctx.arc(e.r * 0.5, -4, 2, 0, Math.PI * 2);
      ctx.arc(e.r * 0.75, -4, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "suitor") {
      ctx.fillStyle = "#4a3a50";
      ctx.beginPath();
      ctx.arc(0, -8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a5070";
      ctx.fillRect(-10, 2, 20, 22);
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(8, 0, 4, 18);
      // wine cup
      ctx.fillStyle = "#8a2020";
      ctx.beginPath();
      ctx.moveTo(-14, 4);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-9, 12);
      ctx.lineTo(-13, 12);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNpc(ctx, n, t) {
    ctx.save();
    ctx.translate(n.x, n.y);
    const bob = Math.sin(t * 2 + n.x) * 2;

    if (n.kind === "goddess") {
      // soft aura
      const grd = ctx.createRadialGradient(0, bob, 5, 0, bob, 50);
      grd.addColorStop(0, "rgba(212, 228, 239, 0.45)");
      grd.addColorStop(1, "rgba(212, 228, 239, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, bob, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d4e4ef";
      ctx.beginPath();
      ctx.arc(0, bob - 16, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a8c0d4";
      ctx.fillRect(-12, bob - 2, 24, 28);
      // owl hint / helmet plume
      ctx.fillStyle = "#c9a227";
      ctx.beginPath();
      ctx.moveTo(0, bob - 30);
      ctx.lineTo(-6, bob - 18);
      ctx.lineTo(6, bob - 18);
      ctx.fill();
    } else if (n.kind === "sorceress") {
      ctx.fillStyle = "#c4788a";
      ctx.beginPath();
      ctx.arc(0, bob - 14, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a2840";
      ctx.fillRect(-14, bob, 28, 30);
      // staff
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, bob - 40);
      ctx.lineTo(18, bob + 30);
      ctx.stroke();
      ctx.fillStyle = `rgba(180, 100, 200, ${0.4 + Math.sin(t * 3) * 0.2})`;
      ctx.beginPath();
      ctx.arc(18, bob - 44, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (n.kind === "queen") {
      ctx.fillStyle = "#e8d4b8";
      ctx.beginPath();
      ctx.arc(0, bob - 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a6a50";
      ctx.fillRect(-12, bob, 24, 28);
      ctx.fillStyle = "#c9a227";
      ctx.beginPath();
      ctx.moveTo(-10, bob - 24);
      ctx.lineTo(10, bob - 24);
      ctx.lineTo(0, bob - 34);
      ctx.fill();
    } else if (n.kind === "crew") {
      ctx.fillStyle = n.color || "#8a7060";
      ctx.beginPath();
      ctx.arc(0, bob - 12, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a4840";
      ctx.fillRect(-10, bob, 20, 22);
    } else {
      ctx.fillStyle = n.color || "#aaa";
      ctx.beginPath();
      ctx.arc(0, bob, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // nameplate
    if (n.name) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      const tw = ctx.measureText(n.name).width || n.name.length * 6;
      ctx.font = "11px Cinzel, serif";
      ctx.fillRect(-tw / 2 - 4, bob + 32, tw + 8, 14);
      ctx.fillStyle = "#c9a227";
      ctx.textAlign = "center";
      ctx.fillText(n.name, 0, bob + 42);
    }
    ctx.restore();
  }

  function drawPlayer(ctx, p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const walk = p.moving ? Math.sin(t * 12) * 2 : 0;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // cloak
    ctx.fillStyle = "#2a3040";
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.quadraticCurveTo(-18 + walk, 20, -8, 28);
    ctx.lineTo(8, 28);
    ctx.quadraticCurveTo(18 - walk, 20, 14, 0);
    ctx.fill();

    // torso / bronze armor
    ctx.fillStyle = "#8a7020";
    ctx.fillRect(-11, -4, 22, 24);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(-11, 2, 22, 4);
    ctx.fillRect(-11, 12, 22, 3);

    // head
    ctx.fillStyle = "#c4a080";
    ctx.beginPath();
    ctx.arc(0, -16, 11, 0, Math.PI * 2);
    ctx.fill();

    // helmet
    ctx.fillStyle = "#6a5a40";
    ctx.beginPath();
    ctx.arc(0, -18, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(-2, -36, 4, 16);
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(-8, -28);
    ctx.lineTo(8, -28);
    ctx.fill();

    // sword
    if (p.facing >= 0) {
      ctx.save();
      ctx.translate(12, 4);
      ctx.rotate(p.attackT > 0 ? -0.9 : 0.2);
      ctx.fillStyle = "#d4d0c8";
      ctx.fillRect(0, -4, 26, 4);
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(-4, -6, 8, 8);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(-12, 4);
      ctx.rotate(p.attackT > 0 ? 0.9 : -0.2);
      ctx.fillStyle = "#d4d0c8";
      ctx.fillRect(-26, -4, 26, 4);
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(-4, -6, 8, 8);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawAttack(ctx, p) {
    const ang = p.facing >= 0 ? -0.4 : Math.PI + 0.4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(201, 162, 39, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 42, ang - 0.6, ang + 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawAmbient(ctx, level, cam, t, theme) {
    if (theme === "beach" || theme === "channel") {
      ctx.fillStyle = "rgba(212, 228, 239, 0.5)";
      for (let i = 0; i < 20; i++) {
        const px =
          cam.x +
          ((i * 97 + t * 30 * (1 + (i % 3))) % (cam.w + 40));
        const py = cam.y + 80 + ((i * 53) % (cam.h - 100));
        if (theme === "channel" || py > level.height - 250) {
          ctx.globalAlpha = 0.3 + (i % 3) * 0.15;
          ctx.fillRect(px, py, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (theme === "cave") {
      // torch glow near brand area vaguely
      ctx.fillStyle = "rgba(180, 80, 20, 0.05)";
      ctx.beginPath();
      ctx.arc(420, 350, 120 + Math.sin(t * 3) * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function resizeCanvas(canvas) {
    const parent = canvas.parentElement;
    const hud = parent.querySelector(".hud");
    const hudH = hud ? hud.offsetHeight : 0;
    const w = parent.clientWidth;
    const h = parent.clientHeight - hudH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    return { w: canvas.width, h: canvas.height, dpr, cssW: w, cssH: h };
  }

  return { drawWorld, resizeCanvas };
})();
