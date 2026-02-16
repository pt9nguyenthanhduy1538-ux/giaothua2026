(() => {
  const $ = (s) => document.querySelector(s);

  const body = document.body;

  // ===== Gate =====
  const gate = $("#gate");
  const startBtn = $("#startBtn");

  // ===== Main =====
  const stamp = $("#stamp");
  const envelope = $("#envelope");
  const peek = $("#peek");
  const hint = $("#hint");
  const resetBtn = $("#resetBtn");

  // ===== Reader =====
  const reader = $("#reader");
  const backdrop = $("#backdrop");
  const closeBtn = $("#closeBtn");
  const replayBtn = $("#replayBtn");
  const typedText = $("#typedText");

  // ===== Music =====
  const bgm = $("#bgm");

  // ====== Nội dung thư (đổi ở đây) ======
  const LETTER_TEXT =
`Hí tình yêu nhỏ của tớ💖

Gửi đến pò ngoan
Chúc pò một năm mới ngập tràn thương yêu, viên mãn mộng
Pò nhớ nè fải luôn vui cười
Pò chớ u phiền, trĩu lòng
Pò nhớ ăn đều, bảo trọng
Pò chớ bỏ bữa, bạo bệnh
Pò buồn thì có Duy
Có gì pò nói để Duy bùn chug
Pò chớ để lòng không kể
Pò ưu tư, Duy sao lơ, vui nổi`;

  // ===== Fullscreen: bật khi bấm Start =====
  function enterFullscreen() {
    const el = document.documentElement;

    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;

    if (!req) return;

    try {
      const p = req.call(el);
      // tránh lỗi "permission denied" spam console
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  // ===== Music: bật khi bấm Start =====
  function fadeInVolume(target = 0.9) {
    if (!bgm) return;
    try { bgm.volume = 0; } catch {}
    let v = 0;
    const id = setInterval(() => {
      v += 0.06;
      try { bgm.volume = Math.min(target, v); } catch {}
      if (v >= target) clearInterval(id);
    }, 30);
  }

  async function startMusic() {
    if (!bgm) return;
    try {
      bgm.currentTime = 0;
      await bgm.play();
      fadeInVolume(0.9);
    } catch {
      // thiếu file / lỗi -> bỏ qua
    }
  }

  /* =========================
     HUMAN TYPEWRITER + KEY SOUND
     ========================= */

  let typeAbort = null;

  // WebAudio "key tick"
  let audioCtx = null;
  let masterGain = null;

  function initKeySound() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.12; // âm lượng tiếng gõ
      masterGain.connect(audioCtx.destination);
    } catch {
      audioCtx = null;
      masterGain = null;
    }
  }

  function keyTick(ch) {
    if (!audioCtx || !masterGain) return;
    if (ch === "\n") return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";

    const base = /[A-Za-z0-9À-ỹ]/.test(ch) ? 220 : 160;
    osc.frequency.setValueAtTime(base + Math.random() * 70, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    osc.connect(gain).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(id);
            reject(new Error("aborted"));
          },
          { once: true }
        );
      }
    });
  }

  function clearTyping() {
    if (typeAbort) typeAbort.abort();
    typeAbort = null;
  }

  async function typeWriterHuman(text, opts = {}) {
    clearTyping();

    const {
      baseDelay = 95,
      jitter = 55,
      spaceExtra = 30,
      newlineExtra = 260,
      commaPause = 240,
      dotPause = 420
    } = opts;

    const controller = new AbortController();
    typeAbort = controller;
    const { signal } = controller;

    typedText.textContent = "";

    // resume audio context nếu bị suspend
    try {
      if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
    } catch {}

    for (let i = 0; i < text.length; i++) {
      if (signal.aborted) return;

      const ch = text[i];
      typedText.textContent += ch;

      keyTick(ch);

      let d = baseDelay + (Math.random() * jitter * 2 - jitter);

      if (ch === " ") d += spaceExtra;
      if (ch === "\n") d += newlineExtra;
      if (/[，,]/.test(ch)) d += commaPause;
      if (/[.!?。！？]/.test(ch)) d += dotPause;

      d = Math.max(25, d);

      try {
        await sleep(d, signal);
      } catch {
        return;
      }
    }
  }

  // ===== Flow =====
  let opened = false;
  let canRead = false;

  function openEnvelope() {
    if (opened) return;
    opened = true;

    stamp.classList.add("pressed");
    envelope.classList.add("open");
    stamp.classList.add("fadeout");

    hint.innerHTML = "Đang mở thư... ✨";

    setTimeout(() => {
      peek.classList.add("show");
      peek.tabIndex = 0;
      canRead = true;
      hint.innerHTML = "Ấn vào <b>lá thư</b> để đọc 💌";
    }, 650);
  }

  function openReader() {
    if (!canRead) return;
    reader.classList.add("show");
    reader.setAttribute("aria-hidden", "false");
    typeWriterHuman(LETTER_TEXT, { baseDelay: 105, jitter: 60 }); // chỉnh chậm hơn ở đây
  }

  function closeReader() {
    reader.classList.remove("show");
    reader.setAttribute("aria-hidden", "true");
    clearTyping();
  }

  // ===== Start Experience =====
  async function startExperience() {
    // fullscreen phải gọi ngay trong cú click để dễ được phép
    enterFullscreen();

    initKeySound();     // tạo audio context trong user gesture
    await startMusic(); // bật nhạc luôn

    body.classList.remove("locked");
    gate.classList.add("hide");
    setTimeout(() => gate.remove(), 380);
  }

  // ===== Events =====
  startBtn?.addEventListener("click", startExperience);

  stamp?.addEventListener("click", (e) => {
    e.stopPropagation();
    openEnvelope();
  });

  peek?.addEventListener("click", (e) => {
    e.stopPropagation();
    openReader();
  });

  backdrop?.addEventListener("click", closeReader);
  closeBtn?.addEventListener("click", closeReader);

  replayBtn?.addEventListener("click", () => {
    typeWriterHuman(LETTER_TEXT, { baseDelay: 105, jitter: 60 });
  });

  function resetAll() {
    opened = false;
    canRead = false;
    closeReader();

    envelope.classList.remove("open");
    stamp.classList.remove("pressed", "fadeout");

    peek.classList.remove("show");
    peek.tabIndex = -1;

    hint.innerHTML = "<b>iuuuuuu</b>💖 ";
  }

  resetBtn?.addEventListener("click", resetAll);
})();
