// trungtam.js (FULL + ENTRY GATE + FULLSCREEN KEEP)
// - Vào trang: mờ + đứng im + chưa phát nhạc
// - Bấm nút giữa: mở khóa -> xin fullscreen -> chạy toàn bộ hiệu ứng + phát nhạc
// - Các click/Enter sau đó: nếu đang muốn fullscreen mà bị thoát, sẽ xin fullscreen lại

(() => {
  // =========================
  // FULLSCREEN HELPERS
  // =========================
  const FS_KEY = "tet_fs_wanted";

  function safeSSSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }
  function safeSSGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  }

  function requestFullscreen() {
    const el = document.documentElement;
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;

    if (!req) return Promise.reject(new Error("Fullscreen not supported"));
    try {
      const p = req.call(el);
      return p && typeof p.then === "function" ? p : Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function wantFullscreenOn() {
    safeSSSet(FS_KEY, "1");
  }

  function ensureFullscreen() {
    if (safeSSGet(FS_KEY) !== "1") return;
    if (isFullscreen()) return;
    requestFullscreen().catch(() => {});
  }

  // Nếu tab đã “muốn fullscreen”, thì mọi click/Enter/Space sẽ xin fullscreen lại (nếu đang bị thoát)
  function setupKeepFullscreen() {
    if (safeSSGet(FS_KEY) !== "1") return;

    // pointerdown: chắc ăn hơn click trên mobile
    window.addEventListener(
      "pointerdown",
      () => ensureFullscreen(),
      { capture: true, passive: true }
    );

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" || e.key === " ") ensureFullscreen();
      },
      { capture: true }
    );
  }

  setupKeepFullscreen();

  // =========================
  // ENTRY GATE
  // =========================
  const gate = document.getElementById("entryGate");
  const entryBtn = document.getElementById("entryBtn");
  const bgm = document.getElementById("bgm");

  let started = false;

  // focus cho “ngầu” + tiện bấm Enter
  setTimeout(() => entryBtn?.focus(), 60);

  function unlock() {
    if (started) return;
    started = true;

    // 0) Fullscreen (phải nằm trong user gesture)
    wantFullscreenOn();
    ensureFullscreen();

    // 1) Fade gate
    if (gate) {
      gate.classList.add("hide");
      gate.setAttribute("aria-hidden", "true");
      setTimeout(() => gate.remove(), 650);
    }

    // 2) Play music (sau user gesture => auto-play OK)
    if (bgm) {
      bgm.volume = 0.7;
      const p = bgm.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }

    // 3) Start app
    startApp();
  }

  entryBtn?.addEventListener("click", unlock);
  gate?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      unlock();
    }
  });

  // =========================
  // MAIN APP (chỉ chạy sau khi unlock)
  // =========================
  function startApp() {
    // =========================
    // 1) GATE / PROGRESS LOGIC
    // =========================
    const REQUIRED_KEYS = ["btn_lixi", "btn_phongbao", "btn_phaoron"];
    const LS_PREFIX = "tet_gate_";

    const controls = document.querySelectorAll(".btn[data-key]");
    const hintEl = document.getElementById("progressHint");
    const loveBtn = document.getElementById("loveNoteBtn");

    // Modal elements
    const modal = document.getElementById("gateModal");
    const modalBackdrop = document.getElementById("modalBackdrop");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    // Modal content nodes
    const modalCard = modal?.querySelector(".modal-card");
    const modalBadge = modal?.querySelector(".modal-badge");
    const modalTitle = modal?.querySelector(".modal-title");
    const modalDesc = modal?.querySelector(".modal-desc");

    // Success UI (created once)
    let goBtn = null;

    // Heart canvas (in modal)
    let heartCanvas = null;
    let heartCtx = null;
    let heartAnim = null;
    let heartParticles = [];
    let lastSpawnT = 0;

    function safeLSSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
    function safeLSGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
    function safeLSRemove(k) { try { localStorage.removeItem(k); } catch {} }

    function setDone(key) { safeLSSet(LS_PREFIX + key, "1"); }
    function isDone(key) { return safeLSGet(LS_PREFIX + key) === "1"; }
    function countDone() { return REQUIRED_KEYS.reduce((acc, k) => acc + (isDone(k) ? 1 : 0), 0); }
    function resetProgress() {
      REQUIRED_KEYS.forEach(k => safeLSRemove(LS_PREFIX + k));
      refreshUI();
    }

    function refreshUI() {
      controls.forEach(a => {
        const key = a.getAttribute("data-key");
        if (isDone(key)) a.classList.add("visited");
        else a.classList.remove("visited");
      });
      const done = countDone();
      if (hintEl) hintEl.textContent = `Tiến độ: ${done}/3 nút đã kích hoạt`;
    }

    function openModal() {
      if (!modal) return;
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      // nếu đang muốn fullscreen mà bị thoát, mở modal cũng xin lại luôn
      ensureFullscreen();
    }
    function closeModal() {
      if (!modal) return;
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      stopHeartShow();
    }

    controls.forEach(a => {
      a.addEventListener("click", () => {
        ensureFullscreen();
        const key = a.getAttribute("data-key");
        setDone(key);
        refreshUI();
      }, { passive: true });
    });

    function showNotReadyModal() {
      if (!modalTitle || !modalDesc || !modalBadge || !modalCloseBtn) return;

      modalBadge.textContent = "⚠️";
      modalTitle.textContent = "chưa đủ điều kiện đâu bé ơi";
      modalDesc.textContent = "Bấm đủ 3 nút bên dưới (mỗi nút 1 lần) rồi quay lại bấm 💝 nha.";

      modalCloseBtn.textContent = "Thoát";
      modalCloseBtn.style.display = "block";

      if (goBtn) goBtn.style.display = "none";
      if (heartCanvas) heartCanvas.style.display = "none";

      openModal();
    }

    function ensureSuccessUI() {
      if (!modalCard) return;

      if (!heartCanvas) {
        heartCanvas = document.createElement("canvas");
        heartCanvas.className = "heartshow-canvas";
        heartCanvas.setAttribute("aria-hidden", "true");
        heartCanvas.style.width = "100%";
        heartCanvas.style.height = "150px";
        heartCanvas.style.display = "block";
        heartCanvas.style.marginTop = "10px";
        heartCanvas.style.borderRadius = "12px";
        heartCanvas.style.background = "rgba(0,0,0,0.10)";
        heartCanvas.style.border = "1px solid rgba(0,0,0,0.06)";
        modalCard.appendChild(heartCanvas);
        heartCtx = heartCanvas.getContext("2d");
      }

      if (!goBtn) {
        goBtn = document.createElement("button");
        goBtn.type = "button";
        goBtn.className = "modal-close";
        goBtn.textContent = "goooo";
        goBtn.style.marginTop = "10px";
        modalCard.appendChild(goBtn);

        goBtn.addEventListener("click", () => {
          ensureFullscreen();
          wantFullscreenOn(); // giữ “ý định fullscreen” cho trang kế tiếp (nếu trang kế tiếp cũng có script xin fullscreen)
          resetProgress();
          window.location.href = "okhoa.html";
        });
      }
    }

    function showSuccessModal() {
      if (!modalTitle || !modalDesc || !modalBadge || !modalCloseBtn) return;

      ensureSuccessUI();

      modalBadge.textContent = "🎉";
      modalTitle.textContent = "ĐỦ ĐIỀU KIỆN RỒI NÈ!";
      modalDesc.textContent = "Trái tim đang “bật mood” 😼 Ấn “goooo” để nhận bất ngờ. (Sau đó tiến độ reset lại)";

      modalCloseBtn.textContent = "Thoát";
      modalCloseBtn.style.display = "block";

      if (goBtn) goBtn.style.display = "block";
      if (heartCanvas) heartCanvas.style.display = "block";

      openModal();
      startHeartShow();
    }

    loveBtn?.addEventListener("click", () => {
      ensureFullscreen();
      const done = countDone();
      if (done < 3) {
        showNotReadyModal();
        return;
      }
      showSuccessModal();
    });

    modalCloseBtn?.addEventListener("click", () => { ensureFullscreen(); closeModal(); });
    modalBackdrop?.addEventListener("click", () => { ensureFullscreen(); closeModal(); });

    refreshUI();

    // =========================
    // 2) PETALS (lightweight)
    // =========================
    const petalsWrap = document.querySelector(".petals");
    function makePetals() {
      if (!petalsWrap) return;
      petalsWrap.innerHTML = "";
      const isMobile = matchMedia("(max-width: 880px)").matches;
      const count = isMobile ? 12 : 18;

      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "petal";

        const left = Math.random() * 100;
        const dx = (Math.random() - 0.5) * 140;
        const dur = (Math.random() * 4 + 7);
        const delay = Math.random() * 6;
        const scale = (Math.random() * 0.7 + 0.7);

        p.style.left = left + "vw";
        p.style.setProperty("--dx", dx.toFixed(0) + "px");
        p.style.setProperty("--dur", dur.toFixed(2) + "s");
        p.style.animationDelay = (-delay).toFixed(2) + "s";
        p.style.transform = `scale(${scale.toFixed(2)})`;

        petalsWrap.appendChild(p);
      }
    }
    makePetals();
    window.addEventListener("resize", () => {
      clearTimeout(window.__petal_t);
      window.__petal_t = setTimeout(makePetals, 250);
    }, { passive: true });

    // =========================
    // 3) HEART SHOW (loop)
    // =========================
    function resizeHeartCanvas() {
      if (!heartCanvas || !heartCtx) return;
      const rect = heartCanvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const w = Math.max(240, Math.floor(rect.width));
      const h = Math.max(120, Math.floor(rect.height));
      heartCanvas.width = w * dpr;
      heartCanvas.height = h * dpr;
      heartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawHeart(ctx, x, y, size, color, alpha, rot = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      const s = size;
      ctx.moveTo(0, -0.35 * s);
      ctx.bezierCurveTo(0.55 * s, -0.95 * s, 1.30 * s, -0.10 * s, 0, 0.85 * s);
      ctx.bezierCurveTo(-1.30 * s, -0.10 * s, -0.55 * s, -0.95 * s, 0, -0.35 * s);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    function spawnSmallHearts(nowMs) {
      if (!heartCanvas) return;
      const rect = heartCanvas.getBoundingClientRect();
      const w = Math.max(240, rect.width);
      const h = Math.max(120, rect.height);

      const isMobile = matchMedia("(max-width: 880px)").matches;
      const spawnEvery = isMobile ? 120 : 90;
      if (nowMs - lastSpawnT < spawnEvery) return;
      lastSpawnT = nowMs;

      const baseX = w * 0.5;
      const baseY = h + 12;

      const k = isMobile ? 1 : 2;
      for (let i = 0; i < k; i++) {
        const sx = baseX + (Math.random() - 0.5) * (w * 0.35);
        const size = 6 + Math.random() * 7;
        const up = 1.2 + Math.random() * 1.6;
        heartParticles.push({
          x: sx,
          y: baseY,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -up,
          g: 0.005 + Math.random() * 0.008,
          size,
          rot: (Math.random() - 0.5) * 0.8,
          vr: (Math.random() - 0.5) * 0.03,
          life: 220 + Math.random() * 90,
          alpha: 0.95
        });
      }

      const cap = isMobile ? 140 : 220;
      if (heartParticles.length > cap) heartParticles.splice(0, heartParticles.length - cap);
    }

    function heartShowLoop(t) {
      if (!heartCtx || !heartCanvas) return;

      const rect = heartCanvas.getBoundingClientRect();
      const w = Math.max(240, rect.width);
      const h = Math.max(120, rect.height);

      heartCtx.clearRect(0, 0, w, h);

      heartCtx.save();
      heartCtx.globalAlpha = 1;
      heartCtx.fillStyle = "rgba(0,0,0,0.10)";
      heartCtx.fillRect(0, 0, w, h);
      heartCtx.restore();

      spawnSmallHearts(t);

      const time = t / 1000;
      const pulse = 1 + 0.06 * Math.sin(time * 3.2);
      const centerX = w * 0.5;
      const centerY = h * 0.50;
      const bigSize = Math.min(w, h) * 0.22 * pulse;

      drawHeart(heartCtx, centerX, centerY, bigSize * 1.08, "rgba(255, 80, 120, 0.35)", 0.55);
      drawHeart(heartCtx, centerX, centerY, bigSize, "rgba(255, 70, 110, 0.85)", 1);

      heartCtx.save();
      heartCtx.globalAlpha = 0.55;
      for (let i = 0; i < 6; i++) {
        const ang = time * 0.9 + i;
        const rr = bigSize * (1.10 + 0.08 * Math.sin(time * 2 + i));
        const sx = centerX + Math.cos(ang) * rr;
        const sy = centerY + Math.sin(ang) * rr * 0.55;
        heartCtx.beginPath();
        heartCtx.fillStyle = "rgba(255, 220, 230, 0.85)";
        heartCtx.arc(sx, sy, 1.6, 0, Math.PI * 2);
        heartCtx.fill();
      }
      heartCtx.restore();

      for (let p of heartParticles) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;

        const lifeRatio = Math.max(0, Math.min(1, p.life / 260));
        const fadeTop = Math.max(0, Math.min(1, (p.y / (h * 0.45))));
        p.alpha = 0.95 * lifeRatio * (0.4 + 0.6 * fadeTop);

        const pick = ((p.x * 13 + p.y * 7) | 0) % 3;
        let col = "rgba(255, 90, 140, 0.85)";
        if (pick === 1) col = "rgba(255, 70, 110, 0.85)";
        if (pick === 2) col = "rgba(255, 235, 242, 0.90)";

        drawHeart(heartCtx, p.x, p.y, p.size, col, p.alpha, p.rot);
      }

      heartParticles = heartParticles.filter(p => p.life > 0 && p.y > -30);
      heartAnim = requestAnimationFrame(heartShowLoop);
    }

    function startHeartShow() {
      if (!heartCanvas || !heartCtx) return;
      stopHeartShow();
      resizeHeartCanvas();
      heartParticles = [];
      lastSpawnT = 0;

      window.addEventListener("resize", resizeHeartCanvas, { passive: true });
      heartAnim = requestAnimationFrame(heartShowLoop);
    }

    function stopHeartShow() {
      if (heartAnim) cancelAnimationFrame(heartAnim);
      heartAnim = null;
      window.removeEventListener("resize", resizeHeartCanvas);
      heartParticles = [];
      if (heartCtx && heartCanvas) {
        const rect = heartCanvas.getBoundingClientRect();
        heartCtx.clearRect(0, 0, rect.width, rect.height);
      }
    }

    // =========================
    // 4) CANVAS NEON MESSAGE
    // =========================
    const canvas = document.getElementById("messageCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const phrases = [
      "Chúc mừng năm mới",
      "Năm mới vui vẻ, nhiều niềm vui",
      "Một năm vạn sự như ý, vạn điều như mơ"
    ];

    const SAMPLE_STEPS_TRY = [4, 6, 8];
    const MAX_PARTICLES = 520;
    const BASE_PART_SIZE = 2.2;
    const SPEED = 3.6;
    const WAIT_AFTER = 3500;
    const FONT_FAMILY = "Inter, system-ui, Arial, sans-serif";
    const MAX_DPR = 1.4;

    const TRAIL_ALPHA = 0.22;

    let DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let W = 0, H = 0;
    let particles = [];
    let baseOffset = 0;
    let currentTextWidth = 0;
    let anim = null;
    let running = false;
    let phraseIndex = 0;

    function resizeCanvas() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(120, Math.floor(r.width));
      H = Math.max(40, Math.floor(r.height));
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function samplePointsForText(offCtx, offW, offH, step) {
      const img = offCtx.getImageData(0, 0, offW, offH).data;
      const pts = [];
      for (let y = 0; y < offH; y += step) {
        for (let x = 0; x < offW; x += step) {
          const idx = (y * offW + x) * 4 + 3;
          if (img[idx] > 128) pts.push({ x, y });
        }
      }
      return pts;
    }

    function buildParticlesForText(text) {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");

      let fontSize = Math.floor(H * 0.84);
      octx.font = `${fontSize}px ${FONT_FAMILY}`;
      let metrics = octx.measureText(text);
      const padding = 20;

      off.width = Math.ceil(metrics.width) + padding;
      off.height = H;

      while (metrics.width > W * 3 && fontSize > 10) {
        fontSize = Math.floor(fontSize * 0.9);
        octx.font = `${fontSize}px ${FONT_FAMILY}`;
        metrics = octx.measureText(text);
        off.width = Math.ceil(metrics.width) + padding;
      }

      octx.clearRect(0, 0, off.width, off.height);
      octx.fillStyle = "#000";
      octx.textBaseline = "middle";
      octx.font = `${fontSize}px ${FONT_FAMILY}`;
      octx.fillText(text, 8, off.height / 2);

      let points = [];
      for (let step of SAMPLE_STEPS_TRY) {
        points = samplePointsForText(octx, off.width, off.height, step);
        if (points.length <= MAX_PARTICLES * 1.15) break;
      }

      if (points.length > MAX_PARTICLES) {
        const filtered = [];
        const jump = Math.ceil(points.length / MAX_PARTICLES);
        for (let i = 0; i < points.length; i += jump) filtered.push(points[i]);
        points = filtered;
      }

      const parts = points.map(p => {
        const startX = W + (Math.random() * (W * 0.28) + 20);
        const startY = p.y + (Math.random() - 0.5) * 6;
        return {
          x: startX,
          y: startY,
          tx: p.x,
          ty: p.y,
          r: BASE_PART_SIZE * (0.7 + Math.random() * 1.0),
          alpha: 0.75 + Math.random() * 0.45,
          vx: 0,
          vy: 0,
          phase: Math.random() * Math.PI * 2
        };
      });

      const textWidth = metrics.width + padding;
      return { parts, textWidth };
    }

    function startPhrase(i) {
      const built = buildParticlesForText(phrases[i]);
      particles = built.parts;
      currentTextWidth = built.textWidth;
      baseOffset = W + 40;

      if (!running) {
        running = true;
        anim = requestAnimationFrame(loop);
      }
    }

    function loop() {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(0,0,0,${TRAIL_ALPHA})`;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";
      const now = performance.now() / 1000;

      for (let p of particles) {
        const targetX = baseOffset + p.tx;

        const dx = targetX - p.x;
        p.vx += dx * 0.06;
        p.vx *= 0.86;
        p.x += p.vx - SPEED * 0.03;

        const dy = p.ty - p.y;
        p.vy += dy * 0.06;
        p.vy *= 0.86;
        p.y += p.vy;

        const pulse = 1 + 0.2 * Math.sin(now * 3 + p.phase);
        const rr = p.r * pulse;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,70,70,${Math.max(0.06, p.alpha * 0.12)})`;
        ctx.shadowColor = "rgba(255,90,90,0.7)";
        ctx.shadowBlur = 16;
        ctx.arc(p.x, p.y, rr * 3.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,70,70,${p.alpha})`;
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        const a = Math.max(0.12, 0.5 + 0.5 * Math.sin(now * 2 + p.phase));
        ctx.fillStyle = `rgba(255,215,215,${0.55 + 0.35 * a})`;
        ctx.arc(p.x + rr * 0.78, p.y - rr * 0.36, rr * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      baseOffset -= SPEED;

      if (baseOffset + currentTextWidth < -60) {
        cancelAnimationFrame(anim);
        running = false;
        setTimeout(() => {
          phraseIndex = (phraseIndex + 1) % phrases.length;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          startPhrase(phraseIndex);
        }, WAIT_AFTER);
        return;
      }

      anim = requestAnimationFrame(loop);
    }

    function start() {
      DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      resizeCanvas();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      setTimeout(() => startPhrase(phraseIndex), 220);

      window.addEventListener("resize", () => {
        DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        resizeCanvas();
        if (anim) cancelAnimationFrame(anim);
        running = false;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        setTimeout(() => startPhrase(phraseIndex), 180);
      }, { passive: true });
    }

    start();
  }
})();

