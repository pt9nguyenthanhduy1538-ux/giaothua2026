/* okhoa.js */
/* =========================
   Helpers
========================= */
const $ = (s)=>document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// âm thanh “hợp vibe” hơn: click / success / error / glitch / warp
function tone(seq, vol=0.035){
  try{
    const AC = tone.ctx || (tone.ctx = new (window.AudioContext||window.webkitAudioContext)());
    const t0 = AC.currentTime + 0.01;
    seq.forEach(([freq, dur, type], i)=>{
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(AC.destination);
      const st = t0 + seq.slice(0,i).reduce((a,b)=>a+b[1],0)/1000;
      o.start(st);
      o.stop(st + dur/1000);
    });
  }catch(e){}
}
const sfx = {
  tap: ()=>tone([[420,35,"sine"]], 0.02),
  back: ()=>tone([[260,50,"sine"]], 0.02),
  ok:  ()=>tone([[620,70,"triangle"],[880,90,"triangle"]], 0.045),
  bad: ()=>tone([[170,120,"sawtooth"]], 0.03),
  glitch: ()=>tone([[520,80,"square"],[260,60,"square"]], 0.03),
  warp: ()=>tone([[120,260,"sine"],[160,260,"sine"],[220,260,"sine"]], 0.028),
};

/* =========================
   DOM refs
========================= */
const canvas = $("#fxCanvas");
const ctx = canvas.getContext("2d");

const alphabetEl = $("#alphabet");
const displayValue = $("#displayValue");
const caret = $("#caret");
const btnBack = $("#btnBack");
const btnEnter = $("#btnEnter");

const toast = $("#toast");
const lockWrap = $("#lockWrap");
const heart = $("#heart");

const modal = $("#modal");
const modalBox = $("#modalBox");
const btnContinue = $("#btnContinue");

const fade = $("#fade");

/* ✅ Gate + music */
const gate = $("#gate");
const btnStart = $("#btnStart");
const bgm = $("#bgm");

/* =========================
   Resize canvas
========================= */
let W=0,H=0,DPR=1;
function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W+"px";
  canvas.style.height = H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize, {passive:true});
resize();

/* =========================
   State
========================= */
const VALID = new Set(["nguyenthanhduy", "lamgiahung"]);

const state = {
  pass: "",
  maxLen: 24,
  unlocked: false,
  lockedInput: true,      // ✅ lúc đầu khoá
  continueStage: 0,
  warpRunning: false,
  particlesRunning: false,
  continueCooling: false,
  booted: false,          // ✅ chưa bấm nút mở cổng
};

/* =========================
   UI enable/disable helpers
========================= */
function setBoardEnabled(on){
  document.querySelectorAll(".key").forEach(k => k.disabled = !on);
}
function setControlsEnabled(on){
  btnBack.disabled = !on;
  btnEnter.disabled = !on;
  caret.style.opacity = on ? 1 : 0;
}

/* =========================
   Alphabet board
========================= */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
LETTERS.forEach(ch=>{
  const b = document.createElement("button");
  b.className = "key";
  b.type = "button";
  b.textContent = ch;
  b.disabled = true; // ✅ ban đầu khoá
  b.addEventListener("click", ()=>{
    if(!state.booted) return;
    if(state.lockedInput) return;
    addChar(ch.toLowerCase());
    sfx.tap();
  });
  alphabetEl.appendChild(b);
});

/* =========================
   Pass render
========================= */
function renderPass(){
  displayValue.textContent = state.pass.length ? state.pass : " ";
  caret.style.opacity = (state.lockedInput || !state.booted) ? 0 : 1;
}

function addChar(c){
  if(state.pass.length >= state.maxLen) return;
  state.pass += c;
  renderPass();

  // hiệu ứng bay lên theo chữ
  if(c === "h"){
    if(Math.random() < 0.45) floatIconFromDisplay("❤", 1.0, 330);
  }
  if(c === "d" || c === "u" || c === "y"){
    const icons = ["🏮","🎆","🌸","🧧","✨"];
    const pick = icons[Math.floor(Math.random()*icons.length)];
    floatIconFromDisplay(pick, 1.0, 45 + Math.random()*40);
  }
}

function backspace(){
  if(!state.pass.length) return;
  state.pass = state.pass.slice(0,-1);
  renderPass();
  sfx.back();
}

function normalizePass(p){ return (p||"").trim().toLowerCase(); }

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1100);
}

/* =========================
   Keyboard
========================= */
window.addEventListener("keydown", (e)=>{
  if(!state.booted) return;
  if(state.lockedInput) return;

  if(e.key === "Backspace"){ e.preventDefault(); backspace(); return; }
  if(e.key === "Enter"){ e.preventDefault(); tryUnlock(); return; }
  const k = e.key.toLowerCase();
  if(k.length === 1 && k >= "a" && k <= "z"){
    addChar(k);
    sfx.tap();
  }
}, {passive:false});

/* =========================
   Buttons
========================= */
btnBack.addEventListener("click", ()=>{
  if(!state.booted) return;
  if(state.lockedInput) return;
  backspace();
});
btnEnter.addEventListener("click", ()=>{
  if(!state.booted) return;
  if(state.lockedInput) return;
  tryUnlock();
});

function tryUnlock(){
  if(state.unlocked) return;
  const p = normalizePass(state.pass);
  if(VALID.has(p)){
    unlockSequence();
  }else{
    showToast("sai rồi bé ơi nhập lại đi");
    lockWrap.animate(
      [{transform:"translateX(0)"},{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"translateX(0)"}],
      {duration:260, iterations:1}
    );
    sfx.bad();
  }
}

/* =========================
   Unlock sequence
========================= */
async function unlockSequence(){
  state.unlocked = true;
  state.lockedInput = true;
  renderPass();

  sfx.ok();
  lockWrap.classList.add("unlocked");
  heart.disabled = false;

  sparkleBurst(W*0.5, H*0.28, prefersReduced ? 70 : 120);
}

/* =========================
   Heart click -> disintegrate
========================= */
heart.addEventListener("click", async ()=>{
  if(!state.booted) return;
  if(state.particlesRunning || state.warpRunning) return;
  state.particlesRunning = true;

  const rect = heart.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;

  heart.style.pointerEvents = "none";
  heart.animate([{opacity:1, transform:"scale(1)"},{opacity:0, transform:"scale(.9)"}],
    {duration:260, fill:"forwards", easing:"ease"});

  particleDisintegrate(cx, cy, prefersReduced ? 260 : 700);
  sfx.glitch();
  await sleep(prefersReduced ? 250 : 900);

  showModal();
  state.particlesRunning = false;
});

/* =========================
   Modal + continue glitch stages (cooldown 5s mỗi lần)
========================= */
function showModal(){
  state.continueStage = 0;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  modalBox.classList.remove("glitch-1","glitch-2","glitch-3","collapse");
}

function hideModal(){
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
}

function setContinueCooldown(ms=5000){
  state.continueCooling = true;
  btnContinue.disabled = true;
  btnContinue.classList.add("cooldown");
  setTimeout(()=>{
    state.continueCooling = false;
    btnContinue.disabled = false;
    btnContinue.classList.remove("cooldown");
  }, ms);
}

btnContinue.addEventListener("click", async ()=>{
  if(!state.booted) return;
  if(state.continueCooling) return;

  state.continueStage++;
  setContinueCooldown(5000);

  if(state.continueStage === 1){
    modalBox.classList.add("glitch-1");
    sfx.glitch();
    return;
  }

  if(state.continueStage === 2){
    modalBox.classList.remove("glitch-1");
    modalBox.classList.add("glitch-2");
    sfx.glitch();
    return;
  }

  if(state.continueStage === 3){
    modalBox.classList.remove("glitch-2");
    modalBox.classList.add("glitch-3");
    startFullScreenGlitch(5000);
    sfx.glitch();

    await sleep(5100);

    modalBox.classList.add("collapse");
    await sleep(520);
    hideModal();

    startWarpAndNavigate();
  }
});

/* =========================
   Fullscreen glitch overlay
========================= */
let glitchUntil = 0;
function startFullScreenGlitch(ms){
  glitchUntil = performance.now() + ms;
}

/* =========================
   Particles (spark + dust + float icons)
========================= */
const particles = [];
function addParticle(p){ particles.push(p); }

function sparkleBurst(x,y,n=60){
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const sp = 1.2 + Math.random()*4.8;
    addParticle({
      kind:"spark",
      x,y,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      life: 520 + Math.random()*820,
      t: 0,
      size: 1 + Math.random()*2.4,
      alpha: 1,
      hue: Math.random() < 0.6 ? 50 : 330
    });
  }
}

function particleDisintegrate(x,y,n=520){
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const r = (Math.random()**0.55) * 52;
    const px = x + Math.cos(a)*r;
    const py = y + Math.sin(a)*r;
    const sp = 0.6 + Math.random()*5.8;
    const drift = (Math.random()-0.5)*0.35;
    addParticle({
      kind:"dust",
      x: px, y: py,
      vx: Math.cos(a)*sp + drift,
      vy: Math.sin(a)*sp - (0.8+Math.random()*1.8),
      g: 0.045 + Math.random()*0.07,
      swirl: (Math.random()-0.5)*0.07,
      life: 920 + Math.random()*980,
      t: 0,
      size: 0.8 + Math.random()*1.9,
      alpha: 1,
      hue: 330 + Math.random()*20
    });
  }
}

function floatIconFromDisplay(char, scale=1, hue=50){
  const el = displayValue;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width * (0.30 + Math.random()*0.40);
  const y = r.top + r.height * (0.30 + Math.random()*0.50);
  const vy = - (0.55 + Math.random()*1.2);
  addParticle({
    kind:"icon",
    x, y,
    vx: (Math.random()-0.5)*0.25,
    vy,
    g: -0.000,
    life: 900 + Math.random()*900,
    t:0,
    alpha: 1,
    text: char,
    size: (18 + Math.random()*12) * scale,
    rot: (Math.random()-0.5)*0.02,
    hue
  });
}

/* =========================
   Warp: starfield + orbit planets + extra stars
========================= */
let warp = {
  on:false,
  start:0,
  duration:20000,
  speed:0.7,
  targetSpeed:22,
  stars:[],
  twinkles:[],
  orbitPlanets:[],
  nextPlanetAt:0
};

function initTwinkles(n){
  warp.twinkles = [];
  for(let i=0;i<n;i++){
    warp.twinkles.push({
      x: Math.random()*W,
      y: Math.random()*H,
      r: Math.random()*1.6,
      a: 0.15 + Math.random()*0.55,
      tw: 0.002 + Math.random()*0.006,
      hue: Math.random()<0.12 ? 200 : (Math.random()<0.08 ? 300 : 0)
    });
  }
}

function initStars(count){
  warp.stars = [];
  const cx = W/2, cy = H/2;
  for(let i=0;i<count;i++){
    warp.stars.push({
      x: (Math.random()*2-1)*W,
      y: (Math.random()*2-1)*H,
      z: Math.random()*W,
      px: cx, py: cy,
      tint: Math.random() < 0.18 ? 200 : (Math.random()<0.10 ? 320 : 0)
    });
  }
}

function spawnOrbitPlanet(){
  const side = Math.random()<0.5 ? -1 : 1;
  const baseR = Math.min(W,H) * (0.22 + Math.random()*0.24);
  const angle = (side<0 ? Math.PI : 0) + (Math.random()-0.5)*0.55;
  return {
    angle,
    angVel: side * (0.0025 + Math.random()*0.0042),
    rad: baseR * (0.75 + Math.random()*0.7),
    size: 14 + Math.random()*70,
    hue: 180 + Math.random()*180,
    alpha: 0.12 + Math.random()*0.24,
    ring: Math.random() < 0.45,
    life: 5200 + Math.random()*5000,
    t: 0
  };
}

function maybeSpawnPlanet(now){
  if(now < warp.nextPlanetAt) return;
  warp.nextPlanetAt = now + (prefersReduced ? 4200 : (2800 + Math.random()*3200));
  warp.orbitPlanets.push(spawnOrbitPlanet());
}

function startWarpAndNavigate(){
  if(state.warpRunning) return;
  state.warpRunning = true;

  document.body.classList.add("warp-mode");
  sfx.warp();

  warp.on = true;
  warp.start = performance.now();
  warp.speed = 0.8;
  warp.targetSpeed = prefersReduced ? 8 : 22;

  initStars(Math.floor(clamp(W*H/8200, 320, 1300)));
  initTwinkles(Math.floor(clamp(W*H/14000, 140, 520)));
  warp.orbitPlanets = [];
  warp.nextPlanetAt = performance.now() + 1200;

  setTimeout(()=> fade.classList.add("show"), prefersReduced ? 8500 : 18500);
  setTimeout(()=> window.location.href = "secret.html", prefersReduced ? 10000 : 20000);
}

/* =========================
   Animation loop (✅ khóa hiệu ứng trước khi boot)
========================= */
let lastT = performance.now();
function loop(t){
  const dt = Math.min(32, t-lastT);
  lastT = t;

  // ✅ chưa bấm "MỞ CỔNG" -> không chạy hiệu ứng
  if(!state.booted){
    ctx.clearRect(0,0,W,H);
    requestAnimationFrame(loop);
    return;
  }

  if(warp.on){
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0,0,W,H);
    drawNebula(t);
    drawTwinkles(t);
  }else{
    ctx.clearRect(0,0,W,H);
    drawTwinkles(t, true);
  }

  if(t < glitchUntil){
    drawNoise(0.22);
  }

  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.t += dt;
    const k = p.t / p.life;
    if(k >= 1){ particles.splice(i,1); continue; }

    if(p.kind === "spark"){
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.985; p.vy *= 0.985;
      p.alpha = 1 - k;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = `hsla(${p.hue},90%,70%,1)`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }else if(p.kind === "dust"){
      const ang = Math.atan2(p.vy, p.vx) + p.swirl;
      const sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(ang)*sp;
      p.vy = Math.sin(ang)*sp + p.g*dt;
      p.x += p.vx; p.y += p.vy;

      p.alpha = (1-k) * 0.95;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = `hsla(${p.hue},90%,70%,1)`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }else if(p.kind === "icon"){
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      p.alpha = (1-k);

      ctx.globalAlpha = p.alpha;
      ctx.font = `900 ${p.size}px ui-sans-serif, system-ui`;
      ctx.fillStyle = `hsla(${p.hue},90%,70%,1)`;
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    }
  }

  if(warp.on){
    const elapsed = t - warp.start;
    const prog = clamp(elapsed / warp.duration, 0, 1);
    const ease = prog*prog*(3-2*prog);
    warp.speed = 0.8 + ease*(warp.targetSpeed-0.8);

    drawWarp(warp.speed, dt, ease);
    maybeSpawnPlanet(t);
    drawOrbitPlanets(dt, ease);

    if(prog >= 1) warp.on = false;
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function drawNebula(t){
  const cx = W/2, cy = H/2;
  const r = Math.max(W,H)*0.65;
  const g = ctx.createRadialGradient(
    cx + Math.sin(t*0.0004)*40,
    cy + Math.cos(t*0.00035)*30,
    10,
    cx, cy, r
  );
  g.addColorStop(0, "rgba(120,80,255,0.08)");
  g.addColorStop(0.45, "rgba(0,0,0,0)");
  g.addColorStop(0.78, "rgba(0,160,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

function drawTwinkles(t, light=false){
  if(!warp.twinkles.length) initTwinkles(Math.floor(clamp(W*H/14000, 140, 520)));
  const base = light ? 0.65 : 1;
  for(const s of warp.twinkles){
    const a = clamp(s.a + Math.sin(t*s.tw)*0.10, 0.06, 0.9) * base;
    const hue = s.hue || 0;
    ctx.globalAlpha = a;
    ctx.fillStyle = hue ? `hsla(${hue},90%,80%,1)` : "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawWarp(speed, dt, ease){
  const cx = W/2, cy = H/2;
  ctx.lineWidth = 1;

  for(let i=0;i<warp.stars.length;i++){
    const s = warp.stars[i];
    s.z -= speed * (dt*0.72);
    if(s.z <= 1){
      warp.stars[i] = {
        x: (Math.random()*2-1)*W,
        y: (Math.random()*2-1)*H,
        z: W,
        px: cx, py: cy,
        tint: Math.random() < 0.18 ? 200 : (Math.random()<0.10 ? 320 : 0)
      };
      continue;
    }

    const k = 420 / s.z;
    const x = cx + s.x * k;
    const y = cy + s.y * k;

    const px = s.px, py = s.py;
    s.px = x; s.py = y;

    const a = clamp((speed/warp.targetSpeed) * 0.95, 0.08, 0.95);
    const hue = s.tint ? s.tint : 0;
    const col = hue ? `hsla(${hue},90%,75%,${a})` : `rgba(255,255,255,${a})`;

    const stretch = 1 + ease*3.4;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x + (x-px)*0.15*stretch, y + (y-py)*0.15*stretch);
    ctx.stroke();

    ctx.fillStyle = hue ? `hsla(${hue},90%,80%,${clamp(a+0.15,0,1)})` : `rgba(255,255,255,${clamp(a+0.15,0,1)})`;
    ctx.fillRect(x, y, 1.3, 1.3);
  }

  const vg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W,H)*0.65);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.58)");
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);
}

function drawOrbitPlanets(dt, ease){
  const cx = W/2, cy = H/2;

  for(let i=warp.orbitPlanets.length-1;i>=0;i--){
    const p = warp.orbitPlanets[i];
    p.t += dt;
    if(p.t >= p.life){
      warp.orbitPlanets.splice(i,1);
      continue;
    }

    p.angle += p.angVel * (1 + ease*3.2) * dt;

    const orbitX = cx + Math.cos(p.angle) * p.rad;
    const orbitY = cy + Math.sin(p.angle) * (p.rad*0.45);

    const a = (p.alpha + ease*0.10) * (1 - (p.t/p.life)*0.2);
    ctx.globalAlpha = a;

    const g = ctx.createRadialGradient(
      orbitX - p.size*0.25,
      orbitY - p.size*0.25,
      4,
      orbitX, orbitY,
      p.size*1.15
    );
    g.addColorStop(0, `hsla(${p.hue},90%,70%,1)`);
    g.addColorStop(0.65, `hsla(${p.hue+25},80%,45%,0.9)`);
    g.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(orbitX, orbitY, p.size, 0, Math.PI*2);
    ctx.fill();

    ctx.globalAlpha = a*0.85;
    ctx.strokeStyle = `hsla(${p.hue},90%,75%,0.7)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(orbitX, orbitY, p.size*1.02, 0, Math.PI*2);
    ctx.stroke();

    if(p.ring){
      ctx.globalAlpha = a*0.65;
      ctx.strokeStyle = `hsla(${p.hue+40},90%,70%,0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(orbitX, orbitY+2, p.size*1.35, p.size*0.45, -0.35, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

function drawNoise(alpha=0.2){
  const n = 1400;
  ctx.globalAlpha = alpha;
  for(let i=0;i<n;i++){
    const x = Math.random()*W;
    const y = Math.random()*H;
    const v = Math.random() < 0.5 ? 255 : 180;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x,y,1,1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  const y = (performance.now()*0.6)%H;
  ctx.fillRect(0, y, W, 2);
  ctx.globalAlpha = 1;
}

/* =========================
   ✅ Gate start: mở khóa + phát nhạc
========================= */
async function startExperience(){
  if(state.booted) return;
  state.booted = true;

  // bật input
  state.lockedInput = false;
  setControlsEnabled(true);
  setBoardEnabled(true);
  renderPass();

  // gỡ blur
  document.body.classList.remove("locked");

  // hiệu ứng mở cổng
  if(gate){
    gate.classList.add("hide");
    gate.setAttribute("aria-hidden","true");
    setTimeout(()=>gate.remove(), 520);
  }

  // phát nhạc (chạy được vì là click user)
  try{
    if(bgm){
      bgm.volume = 0.55;
      await bgm.play();
    }
  }catch(e){
    // nếu trình duyệt chặn, báo nhẹ
    showToast("Bật âm thanh/cho phép autoplay rồi bấm lại nha");
  }

  // bonus: burst nhẹ cho “đã mở”
  sparkleBurst(W*0.5, H*0.35, prefersReduced ? 40 : 80);
  sfx.ok();
}

btnStart?.addEventListener("click", startExperience);

/* =========================
   Init (locked)
========================= */
renderPass();
setControlsEnabled(false);
initTwinkles(Math.floor(clamp(W*H/14000, 140, 520)));
