const Input = (() => {
  const keys = Object.create(null);
  const touch = { up: false, down: false, left: false, right: false };
  let interactPressed = false;
  let attackPressed = false;
  let pausePressed = false;

  function codeOf(e) {
    return e.code || e.key;
  }

  function onDown(e) {
    const c = codeOf(e);
    keys[c] = true;
    if (
      c === "KeyE" ||
      c === "Enter" ||
      e.key === "e" ||
      e.key === "E" ||
      e.key === "Enter"
    ) {
      interactPressed = true;
    }
    if (c === "Space" || e.key === " ") {
      e.preventDefault();
      attackPressed = true;
    }
    if (c === "Escape" || e.key === "Escape") {
      pausePressed = true;
    }
  }

  function onUp(e) {
    keys[codeOf(e)] = false;
  }

  function bindTouch() {
    const pad = document.getElementById("touch-pad");
    if (!pad) return;

    function setDir(dir, val) {
      if (dir in touch) touch[dir] = val;
    }

    pad.querySelectorAll("[data-dir]").forEach((btn) => {
      const dir = btn.getAttribute("data-dir");
      const start = (e) => {
        e.preventDefault();
        setDir(dir, true);
      };
      const end = (e) => {
        e.preventDefault();
        setDir(dir, false);
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointerleave", end);
      btn.addEventListener("pointercancel", end);
    });

    const atk = document.getElementById("touch-attack");
    const talk = document.getElementById("touch-interact");
    if (atk) {
      atk.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        attackPressed = true;
      });
    }
    if (talk) {
      talk.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        interactPressed = true;
      });
    }
  }

  function bind() {
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    bindTouch();
  }

  function axis() {
    let x = 0;
    let y = 0;
    if (keys.ArrowLeft || keys.KeyA || touch.left) x -= 1;
    if (keys.ArrowRight || keys.KeyD || touch.right) x += 1;
    if (keys.ArrowUp || keys.KeyW || touch.up) y -= 1;
    if (keys.ArrowDown || keys.KeyS || touch.down) y += 1;
    if (x && y) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function consumeInteract() {
    if (!interactPressed) return false;
    interactPressed = false;
    return true;
  }

  function consumeAttack() {
    if (!attackPressed) return false;
    attackPressed = false;
    return true;
  }

  function consumePause() {
    if (!pausePressed) return false;
    pausePressed = false;
    return true;
  }

  function clear() {
    interactPressed = false;
    attackPressed = false;
    pausePressed = false;
  }

  return { bind, axis, consumeInteract, consumeAttack, consumePause, clear, keys };
})();
