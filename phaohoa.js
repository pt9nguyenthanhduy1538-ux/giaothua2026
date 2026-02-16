(() => {
  // =========================
  // Optimized Canvas Fireworks Show
  // + City skyline layer (like reference image)
  // + Intro overlay: blurred at entry, click to unblur + play music
  // =========================

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: true });

  // Note: Your original code intentionally used DPR = 1 for performance.
  // Keep it as-is.
  const DPR = 1;

  // ====== Intro overlay + background music ======
  const introOverlay = document.getElementById("introOverlay");
  const enterBtn = document.getElementById("enterBtn");
  const bgm = document.getElementById("bgm");

  function showIntro() {
    document.body.classList.add("locked");
    introOverlay?.classList.add("show");
  }
  function hideIntro() {
    document.body.classList.remove("locked");
    introOverlay?.classList.remove("show");
  }

  async function playBgm() {
    if (!bgm) return;
    try {
      bgm.loop = true;
      bgm.volume = 0.38;
      const p = bgm.play();
      if (p && typeof p.then === "function") await p;
    } catch (e) {
      // Autoplay may still be blocked in some unusual cases; fail silently.
      console.warn("BGM play blocked:", e);
    }
  }

  function pauseBgm() {
    if (!bgm) return;
    try {
      bgm.pause();
    } catch {}
  }

  // ====== Canvas sizing ======
  function resize() {
    canvas.width = Math.floor(innerWidth * DPR);
    canvas.height = Math.floor(innerHeight * DPR);
    initStars();
    rebuildCityLayer();
  }
  addEventListener("resize", resize);

  const startBtn = document.getElementById("startBtn");
  const soundBtn = document.getElementById("soundBtn");

  // End overlay
  const endOverlay = document.getElementById("endOverlay");
  function showEndOverlay() { endOverlay?.classList.add("show"); }
  function hideEndOverlay() { endOverlay?.classList.remove("show"); }

  // ===== Helpers =====
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Build final wave schedule: 25 shots spread across durationMs with minimum gap
  function buildRandomSchedule(count, durationMs, minGapMs) {
    let times = Array.from({ length: count }, () => Math.random() * durationMs);
    times.sort((a, b) => a - b);

    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] < minGapMs) times[i] = times[i - 1] + minGapMs;
    }

    const last = times[times.length - 1];
    if (last > durationMs) {
      const scale = durationMs / last;
      times = times.map((t) => t * scale);
    }
    return times.map((t) => Math.floor(t));
  }

  function buildRandomCannons(count) {
    const result = [];
    for (let g = 0; g < 5; g++) {
      const group = [1, 2, 3, 4, 5];
      for (let i = group.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [group[i], group[j]] = [group[j], group[i]];
      }
      result.push(...group);
    }
    for (let i = result.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result.slice(0, count);
  }

  // ===== Colors =====
  const cannonColors = {
    1: { base: "#ff2a2a", glow: "rgba(255,42,42,0.9)" },
    2: { base: "#33ff66", glow: "rgba(51,255,102,0.9)" },
    3: { base: "#ffffff", glow: "rgba(255,255,255,0.9)" }, // dynamic per shot
    4: { base: "#2aa7ff", glow: "rgba(42,167,255,0.9)" },
    5: { base: "#ffd84a", glow: "rgba(255,216,74,0.9)" },
  };

  function rainbowColor(t) {
    const a = 2 * Math.PI * t;
    const r = Math.floor(128 + 127 * Math.sin(a));
    const g = Math.floor(128 + 127 * Math.sin(a + 2.094));
    const b = Math.floor(128 + 127 * Math.sin(a + 4.188));
    return `rgb(${r},${g},${b})`;
  }

  // ===== Cannons positions =====
  function getCannonPositions() {
    const w = canvas.width / DPR;
    const h = canvas.height / DPR;
    const y = h - 40;
    const margin = Math.max(40, w * 0.08);
    const span = w - margin * 2;
    const arr = [];
    for (let i = 1; i <= 5; i++) {
      const x = margin + (span * (i - 1)) / 4;
      arr.push({ id: i, x, y });
    }
    return arr;
  }

  // ===== Stars =====
  const stars = [];
  function initStars() {
    stars.length = 0;
    const w = canvas.width / DPR, h = canvas.height / DPR;
    const count = Math.floor((w * h) / 15000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        tw: Math.random() * 0.8 + 0.2,
        p: Math.random() * Math.PI * 2,
      });
    }
  }

  // ===== City skyline (offscreen pre-render) =====
  const city = document.createElement("canvas");
  const cityCtx = city.getContext("2d");

  // Deterministic RNG (so skyline is stable per resize)
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rebuildCityLayer() {
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;

    city.width = canvas.width;
    city.height = canvas.height;

    // Because DPR=1, no extra scaling needed.
    const c = cityCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);

    const seed = ((W | 0) * 73856093) ^ ((H | 0) * 19349663) ^ 0x9E3779B9;
    const rand = mulberry32(seed);

    // Scene params
    const baseY = Math.floor(H - 6);
    const cityHFront = Math.max(130, Math.floor(H * 0.22));
    const cityHBack  = Math.max(90,  Math.floor(H * 0.14));

    // Subtle haze at bottom
    const haze = c.createLinearGradient(0, baseY - cityHFront - 30, 0, baseY + 10);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(0.55, "rgba(0,0,0,0.18)");
    haze.addColorStop(1, "rgba(0,0,0,0.65)");
    c.fillStyle = haze;
    c.fillRect(0, baseY - cityHFront - 40, W, cityHFront + 70);

    function drawBuildingRow(rowBaseY, rowH, depth) {
      let x = -30;
      const outline = depth === "front" ? "rgba(175,205,255,0.14)" : "rgba(160,190,255,0.08)";
      const fillCol = depth === "front" ? "rgba(10,10,16,0.94)" : "rgba(8,8,12,0.78)";
      const winCol  = depth === "front" ? "rgba(245,250,255,0.88)" : "rgba(230,240,255,0.50)";

      while (x < W + 40) {
        const bw = Math.floor(26 + rand() * (depth === "front" ? 78 : 62));
        const bh = Math.floor(rowH * (0.35 + rand() * 0.65));
        const yTop = Math.floor(rowBaseY - bh);

        // Roof style
        const roof = (rand() * 5) | 0; // 0..4
        const notchW = Math.floor(bw * (0.12 + rand() * 0.18));
        const notchH = Math.floor(10 + rand() * 22);

        c.save();
        c.fillStyle = fillCol;
        c.strokeStyle = outline;
        c.lineWidth = depth === "front" ? 2 : 1.5;
        c.shadowColor = outline;
        c.shadowBlur = depth === "front" ? 10 : 6;

        c.beginPath();
        c.moveTo(x, rowBaseY);

        // left wall up
        c.lineTo(x, yTop + 10);

        // top profile
        if (roof === 0) {
          // simple flat
          c.lineTo(x + bw, yTop + 10);
        } else if (roof === 1) {
          // step roof
          const stepW = Math.floor(bw * (0.22 + rand() * 0.22));
          const stepH = Math.floor(10 + rand() * 24);
          c.lineTo(x + bw - stepW, yTop + 10);
          c.lineTo(x + bw - stepW, yTop - stepH);
          c.lineTo(x + bw, yTop - stepH);
        } else if (roof === 2) {
          // notch
          c.lineTo(x + notchW, yTop + 10);
          c.lineTo(x + notchW, yTop - notchH);
          c.lineTo(x + bw - notchW, yTop - notchH);
          c.lineTo(x + bw - notchW, yTop + 10);
          c.lineTo(x + bw, yTop + 10);
        } else if (roof === 3) {
          // centered tower
          const tw = Math.floor(bw * (0.22 + rand() * 0.18));
          const th = Math.floor(18 + rand() * 30);
          const tx = x + Math.floor((bw - tw) / 2);
          c.lineTo(tx, yTop + 10);
          c.lineTo(tx, yTop - th);
          c.lineTo(tx + tw, yTop - th);
          c.lineTo(tx + tw, yTop + 10);
          c.lineTo(x + bw, yTop + 10);
        } else {
          // small spire
          const sx = x + Math.floor(bw * (0.4 + rand() * 0.2));
          const sh = Math.floor(24 + rand() * 34);
          c.lineTo(sx - 6, yTop + 10);
          c.lineTo(sx, yTop - sh);
          c.lineTo(sx + 6, yTop + 10);
          c.lineTo(x + bw, yTop + 10);
        }

        // right wall down
        c.lineTo(x + bw, rowBaseY);
        c.closePath();

        c.fill();
        c.stroke();

        // Antenna (front row only, sometimes)
        if (depth === "front" && rand() < 0.18) {
          const ax = x + Math.floor(bw * (0.3 + rand() * 0.4));
          const ay = yTop - Math.floor(12 + rand() * 30);
          c.shadowBlur = 0;
          c.strokeStyle = "rgba(200,220,255,0.16)";
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(ax, yTop - 2);
          c.lineTo(ax, ay);
          c.stroke();
          c.fillStyle = "rgba(245,250,255,0.70)";
          c.beginPath();
          c.arc(ax, ay, 2.2, 0, Math.PI * 2);
          c.fill();
        }

        // Windows (keep it cheap — pre-rendered, not animated)
        if (depth === "front") {
          const padX = 8;
          const padY = 18;
          const wAreaW = bw - padX * 2;
          const wAreaH = bh - padY * 2;

          const cellW = 12;
          const cellH = 14;
          const cols = Math.max(1, Math.floor(wAreaW / cellW));
          const rows = Math.max(1, Math.floor(wAreaH / cellH));

          c.shadowBlur = 0;
          for (let ry = 0; ry < rows; ry++) {
            for (let cx = 0; cx < cols; cx++) {
              if (rand() < 0.22) {
                const wx = x + padX + cx * cellW + 2;
                const wy = yTop + padY + ry * cellH + 2;
                const ww = 6 + ((rand() * 3) | 0);
                const wh = 8 + ((rand() * 4) | 0);

                c.fillStyle = winCol;
                c.fillRect(wx, wy, ww, wh);
              }
            }
          }

          // A few brighter "special" windows like the reference
          if (rand() < 0.14) {
            c.fillStyle = "rgba(255,255,255,0.92)";
            c.fillRect(x + 10, yTop + bh * 0.55, 12, 14);
          }
        }

        c.restore();

        // overlap a bit so skyline looks continuous
        x += bw - Math.floor(6 + rand() * 10);
      }
    }

    // Back row first (farther, darker)
    drawBuildingRow(Math.floor(baseY + 8), cityHBack, "back");

    // Front row (more outlines + windows)
    drawBuildingRow(baseY, cityHFront, "front");

    // Ground line
    c.save();
    c.shadowBlur = 0;
    c.strokeStyle = "rgba(255,255,255,0.05)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, baseY + 1);
    c.lineTo(W, baseY + 1);
    c.stroke();
    c.restore();
  }

  function drawCityLayer() {
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    if (city.width > 0) ctx.drawImage(city, 0, 0, W, H);
  }

  // ===== Particle pools =====
  const rockets = [];
  const trails = [];
  const sparks = [];
  const textParticles = [];

  let finalWaveMode = false;

  const MAX_TRAILS_NORMAL = 900;
  const MAX_SPARKS_NORMAL = 1200;
  const MAX_TEXT_NORMAL = 1400;

  const MAX_TRAILS_FINAL = 650;
  const MAX_SPARKS_FINAL = 800;
  const MAX_TEXT_FINAL = 700;

  function capArray(arr, max) {
    if (arr.length > max) arr.splice(0, arr.length - max);
  }

  function addTrail(x, y, color, glow, count = 1) {
    for (let i = 0; i < count; i++) {
      trails.push({
        x: x + (Math.random() - 0.5) * 2,
        y: y + (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        life: 1,
        decay: 0.05 + Math.random() * 0.03,
        r: 1.0 + Math.random() * 1.4,
        color,
        glow,
      });
    }
    capArray(trails, finalWaveMode ? MAX_TRAILS_FINAL : MAX_TRAILS_NORMAL);
  }

  function explode(x, y, color, glow, power = 1) {
    const baseN = finalWaveMode ? 18 : 40;
    const n = Math.floor(baseN * power);

    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (Math.random() ** 0.55) * (2.6 + 1.6 * power);
      sparks.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        g: 0.045 + Math.random() * 0.02,
        life: 1,
        decay: finalWaveMode ? (0.022 + Math.random() * 0.02) : (0.015 + Math.random() * 0.015),
        r: 1.0 + Math.random() * 2.0,
        color,
        glow,
      });
    }

    capArray(sparks, finalWaveMode ? MAX_SPARKS_FINAL : MAX_SPARKS_NORMAL);
    playBoom(power);
  }

  // ===== Audio (WebAudio for booms) =====
  let audioOn = false;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playBoom(power = 1) {
    if (!audioOn) return;
    if (finalWaveMode && Math.random() < 0.45) return;

    ensureAudio();
    const t0 = audioCtx.currentTime;

    const dur = 0.26 + power * 0.07;
    const bufferSize = Math.floor(audioCtx.sampleRate * dur);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const k = i / bufferSize;
      const env = Math.pow(1 - k, 2.0);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(780 - power * 170, t0);
    bp.Q.setValueAtTime(0.9, t0);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(72 - power * 7, t0);
    osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.20);

    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.42, t0 + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);

    noise.connect(bp).connect(gain).connect(audioCtx.destination);
    osc.connect(og).connect(audioCtx.destination);

    noise.start(t0);
    noise.stop(t0 + dur);
    osc.start(t0);
    osc.stop(t0 + 0.30);
  }

  soundBtn?.addEventListener("click", async () => {
    audioOn = !audioOn;
    if (audioOn) {
      ensureAudio();
      await playBgm();
      soundBtn.textContent = "🔊 Tắt âm thanh";
    } else {
      pauseBgm();
      soundBtn.textContent = "🔇 Bật âm thanh";
    }
  });

  // ===== Rockets (clamp explosion points to safe area) =====
  function shoot(cannonId, opts = {}) {
    const pos = getCannonPositions().find((p) => p.id === cannonId);
    if (!pos) return;

    const w = canvas.width / DPR;
    const h = canvas.height / DPR;

    let base = cannonColors[cannonId].base;
    let glow = cannonColors[cannonId].glow;

    if (cannonId === 3) {
      const c = rainbowColor(Math.random());
      base = c;
      glow = c.replace("rgb(", "rgba(").replace(")", ",0.95)");
    }

    const spread = opts.spread ?? (finalWaveMode ? 0.65 : 0.16);
    const topMin = opts.topMin ?? (finalWaveMode ? 0.10 : 0.18);
    const topVar = opts.topVar ?? (finalWaveMode ? 0.55 : 0.18);

    let tx = pos.x + (Math.random() - 0.5) * (w * spread);
    let ty = h * (topMin + Math.random() * topVar);

    // SAFE CLAMP (no off-screen)
    const safeX = 70;
    const safeTop = 80;
    const safeBottom = h * 0.62;
    tx = clamp(tx, safeX, w - safeX);
    ty = clamp(ty, safeTop, safeBottom);

    const dx = tx - pos.x;
    const dy = ty - pos.y;

    const steps = opts.flightSteps ?? (finalWaveMode ? 60 : 70);

    rockets.push({
      x: pos.x,
      y: pos.y - 14,
      vx: dx / steps,
      vy: dy / steps,
      age: 0,
      t: steps,
      color: base,
      glow,
      cannonId,
      word: opts.word || null,
      textSize: opts.textSize || 86,
      power: opts.power || 1,
      anchorX: opts.anchorX,
      anchorY: opts.anchorY,
    });
  }

  // ===== Text as particles (clamp anchors so no half-word) =====
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");

  function spawnTextWord(word, originX, originY, color, glow, sizePx = 86, anchorX = originX, anchorY = originY) {
    off.width = 1000;
    off.height = 260;
    offCtx.clearRect(0, 0, off.width, off.height);

    offCtx.fillStyle = "#fff";
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.font = `800 ${sizePx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    offCtx.fillText(word, off.width / 2, off.height / 2);

    const img = offCtx.getImageData(0, 0, off.width, off.height).data;

    const W = canvas.width / DPR;
    const H = canvas.height / DPR;

    const measured = offCtx.measureText(word).width * 0.75;
    const halfW = measured / 2 + 40;
    const halfH = (sizePx * 0.75) / 2 + 30;

    anchorX = clamp(anchorX, halfW, W - halfW);
    anchorY = clamp(anchorY, halfH, H - halfH - 90);

    const step = Math.max(10, Math.floor(sizePx / 8));
    const points = [];
    const cx = off.width / 2, cy = off.height / 2;

    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        const a = img[(y * off.width + x) * 4 + 3];
        if (a > 30) points.push({ x, y });
      }
    }

    const MAX_POINTS = 520;
    if (points.length > MAX_POINTS) {
      const picked = [];
      for (let i = 0; i < MAX_POINTS; i++) picked.push(points[(Math.random() * points.length) | 0]);
      points.length = 0;
      points.push(...picked);
    }

    const born = performance.now();
    const lifeMs = 3000;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = (p.x - cx) * 0.75;
      const py = (p.y - cy) * 0.75;

      textParticles.push({
        x: originX + (Math.random() - 0.5) * 22,
        y: originY + (Math.random() - 0.5) * 22,
        tx: anchorX + px,
        ty: anchorY + py,
        born,
        lifeMs,
        color,
        glow,
        r: 1.2 + Math.random() * 1.0,
      });
    }

    capArray(textParticles, finalWaveMode ? MAX_TEXT_FINAL : MAX_TEXT_NORMAL);
  }

  // ===== Drawing =====
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawStars(now) {
    for (const s of stars) {
      s.p += 0.03 * s.tw;
      const a = 0.22 + 0.58 * (0.5 + 0.5 * Math.sin(s.p));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCannons(now) {
    const positions = getCannonPositions();
    for (const p of positions) {
      let base = cannonColors[p.id].base;
      let glow = cannonColors[p.id].glow;

      if (p.id === 3) {
        base = rainbowColor((now * 0.00018) % 1);
        glow = base.replace("rgb(", "rgba(").replace(")", ",0.95)");
      }

      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.shadowColor = glow;
      ctx.shadowBlur = finalWaveMode ? 10 : 12;

      ctx.fillStyle = base;
      roundRect(ctx, p.x - 22, p.y - 18, 44, 22, 10);
      ctx.fill();

      ctx.shadowBlur = finalWaveMode ? 12 : 14;
      roundRect(ctx, p.x - 8, p.y - 38, 16, 26, 8);
      ctx.fill();

      ctx.shadowBlur = 10;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.id), p.x, p.y - 8);

      ctx.restore();
    }
  }

  function drawRocket(r) {
    ctx.save();
    ctx.font = "26px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = r.glow;
    ctx.shadowBlur = finalWaveMode ? 10 : 12;
    ctx.fillText("🚀", r.x, r.y);
    ctx.restore();
  }

  function tick(now) {
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = finalWaveMode ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.24)";
    ctx.fillRect(0, 0, W, H);

    drawStars(now);

    // rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.age += 1;
      r.x += r.vx;
      r.y += r.vy;

      addTrail(r.x, r.y + 10, r.color, r.glow, 1);
      drawRocket(r);

      if (r.age >= r.t) {
        explode(r.x, r.y, r.color, r.glow, r.power);

        if (r.word) {
          const ax = (r.anchorX ?? r.x);
          const ay = (r.anchorY ?? r.y);
          spawnTextWord(r.word, r.x, r.y, r.color, r.glow, r.textSize, ax, ay);
        }

        rockets.splice(i, 1);
      }
    }

    ctx.globalCompositeOperation = "lighter";

    // trails
    for (let i = trails.length - 1; i >= 0; i--) {
      const p = trails[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        trails.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = finalWaveMode ? 7 : 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = finalWaveMode ? 8 : 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // text particles
    for (let i = textParticles.length - 1; i >= 0; i--) {
      const tp = textParticles[i];
      const ageMs = now - tp.born;

      const t = Math.min(1, ageMs / 650);
      const e = 1 - Math.pow(1 - t, 3);

      const nx = tp.x + (tp.tx - tp.x) * e;
      const ny = tp.y + (tp.ty - tp.y) * e;

      const fadeStart = tp.lifeMs;
      const fade = ageMs > fadeStart ? (1 - Math.min(1, (ageMs - fadeStart) / 320)) : 1;

      if (ageMs > tp.lifeMs + 340) {
        textParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = 0.95 * fade;
      ctx.fillStyle = tp.color;
      ctx.shadowColor = tp.glow;
      ctx.shadowBlur = 14;

      const done = ageMs > 650;
      const pulse = done ? (0.85 + 0.15 * Math.sin(now * 0.012 + i)) : 1;

      ctx.beginPath();
      ctx.arc(nx, ny, tp.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ===== Static layers on top of particles =====
    ctx.globalCompositeOperation = "source-over";

    // Draw city skyline (covers bottom like the reference)
    drawCityLayer();

    // Cannons in front
    drawCannons(now);

    requestAnimationFrame(tick);
  }

  // ===== Show timeline =====
  async function runShow() {
    startBtn.disabled = true;
    startBtn.textContent = "⏳ Đang chạy...";
    hideEndOverlay();

    // Đợt 1
    const wave1 = [
      { id: 1, word: "mừng" },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5, word: "năm" },
    ];
    for (const s of wave1) {
      shoot(s.id, { word: s.word || null, textSize: 92, power: 1 });
      await sleep(2000);
    }

    // Đợt 2
    const wave2 = [
      { id: 2, word: "mới" },
      { id: 4, word: "2026", textSize: 100 },
    ];
    for (const s of wave2) {
      shoot(s.id, { word: s.word, textSize: s.textSize || 92, power: 1.05 });
      await sleep(2000);
    }

    await sleep(7000);

    // Đợt 3: xếp 1 dòng an toàn
    const parts = ["chúc", "một", "năm", "mới", "vui", "vẻ"];
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    const baseY = H * 0.30;

    const leftSafe = 140;
    const rightSafe = W - 140;
    const usable = Math.max(300, rightSafe - leftSafe);
    const gap = usable / 5;
    const startX = leftSafe;

    for (let i = 0; i < 6; i++) {
      shoot(3, {
        word: parts[i],
        textSize: 86,
        power: 1.1,
        anchorX: startX + gap * i,
        anchorY: baseY
      });
      await sleep(2000);
    }

    await sleep(7000);

    // Đợt 4 lần 1
    const w4a = [
      { id: 1, word: "học" },
      { id: 5, word: "hành" },
      { id: 2, word: "như" },
      { id: 4, word: "ý" },
    ];
    for (const s of w4a) {
      shoot(s.id, { word: s.word, textSize: 92, power: 1.05 });
      await sleep(2000);
    }

    // Đợt 4 lần 2 (đợt kế cuối)
    const w4b = [
      { id: 2, word: "điểm" },
      { id: 4, word: "đạt" },
      { id: 1, word: "như" },
      { id: 5, word: "ý" },
    ];
    for (const s of w4b) {
      shoot(s.id, { word: s.word, textSize: 92, power: 1.1 });
      await sleep(2000);
    }

    await sleep(1200);

    // Final wave: 25 shots / 40s, random
    finalWaveMode = true;

    const finalDurationMs = 40000;
    const finalCount = 25;
    const minGapMs = 900;
    const times = buildRandomSchedule(finalCount, finalDurationMs, minGapMs);
    const cannons = buildRandomCannons(finalCount);

    await new Promise((resolve) => {
      let done = 0;
      for (let i = 0; i < finalCount; i++) {
        setTimeout(() => {
          shoot(cannons[i], {
            power: 1.0,
            spread: 0.65,
            topMin: 0.10,
            topVar: 0.55,
            flightSteps: 58
          });

          done++;
          if (done === finalCount) setTimeout(resolve, 2200);
        }, times[i]);
      }
    });

    finalWaveMode = false;

    // Show end overlay (buttons still clickable)
    showEndOverlay();

    startBtn.textContent = "✅ Xong! (Bấm để chạy lại)";
    startBtn.disabled = false;
  }

  // Start button
  startBtn?.addEventListener("click", () => runShow());

  // Intro overlay "Enter" button: unblur + enable sound + play music + auto-start show
  enterBtn?.addEventListener("click", async () => {
    // Enable sound
    audioOn = true;
    soundBtn.textContent = "🔊 Tắt âm thanh";
    ensureAudio();
    await playBgm();

    hideIntro();
    runShow();
  });

  // ===== Boot =====
  resize();
  requestAnimationFrame(tick);
  showIntro();
})();
