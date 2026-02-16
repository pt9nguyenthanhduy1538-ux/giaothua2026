// ===== FULL JS (BỎ HẲN PHÁO HOA) — dán đè toàn bộ =====
const presetTimeString = "16:26"; // HH:MM (vẫn giữ để auto mở nếu muốn)

const leftDoor = document.getElementById('leftDoor');
const rightDoor = document.getElementById('rightDoor');
const gap = document.getElementById('gap');

const starsCanvas = document.getElementById('starsCanvas');
const dustCanvas = document.getElementById('dustCanvas');
const glitterCanvas = document.getElementById('glitterCanvas');
const fireworksCanvas = document.getElementById('fireworksCanvas'); // vẫn lấy nhưng sẽ tắt hẳn

const lockBox = document.getElementById('lockBox');
const lockEl = document.getElementById('lock');
const lockRing = document.getElementById('lockRing');
const lockTimeEl = document.getElementById('lockTime');
const enterBtn = document.getElementById('enterBtn');
const btnBurst = document.getElementById('btnBurst');

const bgm = document.getElementById('bgm');

const activateOverlay = document.getElementById('activateOverlay');
const activateBtn = document.getElementById('activateBtn');

const rotateOverlay = document.getElementById('rotateOverlay');

let presetDate = null;
let triggered = false;

const doorDurationMs = 1900;

// Performance scaling
const isMobile = matchMedia("(max-width: 520px)").matches;
// giảm DPR để nhẹ máy
const DPR = Math.min(isMobile ? 1.25 : 1.6, window.devicePixelRatio || 1);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- sfx optional ---------- */
function beep(freq=520, ms=70, type="sine", vol=0.03){
  try{
    const ctx = beep.ctx || (beep.ctx = new (window.AudioContext||window.webkitAudioContext)());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + ms/1000);
  }catch(e){}
}

/* ---------- Fullscreen ---------- */
function requestFullscreen(){
  const el = document.documentElement;
  try{
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen ||
      el.mozRequestFullScreen;

    if (fn) fn.call(el);

    // thử khóa xoay ngang (nếu hỗ trợ)
    setTimeout(() => {
      try{ screen.orientation?.lock?.('landscape'); }catch(e){}
    }, 200);
  }catch(e){}
}

/* ---------- Orientation gate (bắt xoay ngang) ---------- */
function isLandscape(){
  const mq = window.matchMedia?.("(orientation: landscape)");
  if (mq && typeof mq.matches === "boolean") return mq.matches;
  return window.innerWidth > window.innerHeight;
}

function setRotateState(){
  const ok = isLandscape();

  if(!ok){
    rotateOverlay?.classList.remove('hide');
    rotateOverlay?.setAttribute('aria-hidden','false');

    activateOverlay?.classList.add('hide');
    activateOverlay?.setAttribute('aria-hidden','true');
    if(activateBtn) activateBtn.disabled = true;
  }else{
    rotateOverlay?.classList.add('hide');
    rotateOverlay?.setAttribute('aria-hidden','true');

    if(document.body.classList.contains('is-locked')){
      activateOverlay?.classList.remove('hide');
      activateOverlay?.setAttribute('aria-hidden','false');
      if(activateBtn) activateBtn.disabled = false;
    }
  }
}

/* ---------- Time helpers ---------- */
function computePreset(){
  const [h,m] = presetTimeString.split(':').map(n => parseInt(n,10));
  const now = new Date();
  let tgt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h||0, m||0, 0, 0);
  if (tgt <= now) tgt.setDate(tgt.getDate()+1);
  return tgt;
}
function updateClockDisplay(now = new Date()){
  if(!lockTimeEl) return;
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  lockTimeEl.innerText = `${hh}:${mm}:${ss}`;
}

/* neon glow */
function updateNeonGlow(t){
  if(!lockTimeEl) return;
  const pulse = (Math.sin(t*2) + 1) / 2;
  const blur = 10 + Math.round(pulse * 22);
  const glowColor = `rgba(255,230,140,${0.55 + pulse*0.45})`;
  lockTimeEl.style.color = '#ffffff';
  lockTimeEl.style.textShadow = `0 0 ${blur}px ${glowColor}, 0 12px 34px rgba(0,0,0,0.75)`;
}
function neonLoop(ts){
  updateNeonGlow(ts/1000);
  requestAnimationFrame(neonLoop);
}

/* micro shake */
let shakeRAF = null;
function screenShake(ms=520, strength=4){
  if(reduceMotion) return;
  const start = performance.now();
  cancelAnimationFrame(shakeRAF);
  const base = document.body.style.transform;

  function tick(now){
    const t = now - start;
    const k = Math.max(0, 1 - t/ms);
    const dx = Math.sin(t*0.12) * strength * k;
    const dy = Math.cos(t*0.14) * strength * 0.6 * k;
    document.body.style.transform = `translate(${dx}px, ${dy}px)`;
    if(t < ms) shakeRAF = requestAnimationFrame(tick);
    else document.body.style.transform = base || '';
  }
  shakeRAF = requestAnimationFrame(tick);
}

/* ---------- Canvas helpers ---------- */
function fitCanvas(canvas){
  if(!canvas) return {ctx:null,w:0,h:0};
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * DPR));
  canvas.height = Math.max(1, Math.floor(rect.height * DPR));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(DPR,0,0,DPR,0,0);
  return {ctx, w: rect.width, h: rect.height};
}

/* ---------- Stars ---------- */
let starsCtx, starsW, starsH, starsArr=[];
function initStars(){
  const o = fitCanvas(starsCanvas);
  starsCtx = o.ctx; starsW = o.w; starsH = o.h;
  starsArr = [];
  if(!starsCtx) return;

  const count = reduceMotion ? 26 : (isMobile ? 40 : 70);
  for(let i=0;i<count;i++){
    starsArr.push({
      x: Math.random()*starsW,
      y: Math.random()*starsH,
      r: Math.random()*1.6 + 0.5,
      speed: 0.6 + Math.random()*1.6,
      phase: Math.random()*Math.PI*2,
      alphaBase: 0.22 + Math.random()*0.70
    });
  }
}
function animateStars(){
  if(!starsCtx) return;
  starsCtx.clearRect(0,0,starsW,starsH);
  const t = performance.now()/1000;
  for(const s of starsArr){
    const a = s.alphaBase * (0.55 + 0.45*Math.sin(t * s.speed + s.phase));
    starsCtx.globalAlpha = a;
    starsCtx.beginPath();
    starsCtx.fillStyle = 'rgba(255,255,255,1)';
    starsCtx.arc(s.x,s.y,s.r,0,Math.PI*2);
    starsCtx.fill();
  }
  starsCtx.globalAlpha = 1;
  requestAnimationFrame(animateStars);
}

/* ---------- Dust ---------- */
let dustCtx, dustW, dustH, dustArr=[];
function initDust(){
  const o = fitCanvas(dustCanvas);
  dustCtx = o.ctx; dustW = o.w; dustH = o.h;
  dustArr = [];
  if(!dustCtx) return;

  const count = reduceMotion ? 14 : (isMobile ? 26 : 46);
  for(let i=0;i<count;i++){
    dustArr.push({
      x: Math.random()*dustW,
      y: Math.random()*dustH,
      r: Math.random()*1.4 + 0.4,
      vx: (Math.random()*2-1) * 0.10,
      vy: -0.08 - Math.random()*0.20,
      a: 0.06 + Math.random()*0.18,
      tw: 0.6 + Math.random()*1.6,
      ph: Math.random()*Math.PI*2
    });
  }
}
function animateDust(){
  if(!dustCtx) return;
  dustCtx.clearRect(0,0,dustW,dustH);
  const t = performance.now()/1000;
  for(const p of dustArr){
    p.x += p.vx;
    p.y += p.vy;
    if(p.y < -10){ p.y = dustH+10; p.x = Math.random()*dustW; }
    if(p.x < -10) p.x = dustW+10;
    if(p.x > dustW+10) p.x = -10;

    const aa = p.a * (0.6 + 0.4*Math.sin(t*p.tw + p.ph));
    dustCtx.globalAlpha = aa;
    dustCtx.beginPath();
    dustCtx.fillStyle = 'rgba(255,220,150,1)';
    dustCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
    dustCtx.fill();
  }
  dustCtx.globalAlpha = 1;
  requestAnimationFrame(animateDust);
}

/* ---------- Glitter ---------- */
let glCtx, glW, glH, glArr=[];
function initGlitter(){
  const o = fitCanvas(glitterCanvas);
  glCtx = o.ctx; glW = o.w; glH = o.h;
  glArr = [];
  if(!glCtx) return;

  const count = reduceMotion ? 20 : (isMobile ? 40 : 80);
  for(let i=0;i<count;i++){
    glArr.push({
      x: Math.random()*glW,
      y: Math.random()*glH,
      s: 0.6 + Math.random()*1.4,
      vy: 0.14 + Math.random()*0.46,
      vx: (Math.random()*2-1) * 0.08,
      a: 0.10 + Math.random()*0.30,
      tw: 1.2 + Math.random()*2.0,
      ph: Math.random()*Math.PI*2,
      hue: 40 + Math.random()*30
    });
  }
}
function animateGlitter(){
  if(!glCtx) return;
  glCtx.clearRect(0,0,glW,glH);
  const t = performance.now()/1000;

  for(const g of glArr){
    g.x += g.vx;
    g.y += g.vy;

    if(g.y > glH + 10){ g.y = -10; g.x = Math.random()*glW; }
    if(g.x < -10) g.x = glW+10;
    if(g.x > glW+10) g.x = -10;

    const tw = (0.6 + 0.4*Math.sin(t*g.tw + g.ph));
    const aa = g.a * tw;
    glCtx.globalAlpha = aa;

    glCtx.beginPath();
    glCtx.fillStyle = `hsla(${g.hue}, 100%, 72%, 1)`;
    glCtx.arc(g.x,g.y,g.s*0.6,0,Math.PI*2);
    glCtx.fill();

    if(tw > 0.88 && !isMobile && !reduceMotion){
      glCtx.globalAlpha = aa * 0.65;
      glCtx.strokeStyle = `rgba(255,255,255,0.9)`;
      glCtx.lineWidth = 1;
      glCtx.beginPath();
      glCtx.moveTo(g.x - 3, g.y); glCtx.lineTo(g.x + 3, g.y);
      glCtx.moveTo(g.x, g.y - 3); glCtx.lineTo(g.x, g.y + 3);
      glCtx.stroke();
    }
  }
  glCtx.globalAlpha = 1;
  requestAnimationFrame(animateGlitter);
}

/* ---------- Fireworks: DISABLED (tắt hẳn) ---------- */
function resizeFireworks(){ /* disabled */ }
function startFireworks(){ /* disabled */ }
function stopFireworks(){ /* disabled */ }

/* ---------- OPEN SEQUENCE ---------- */
function startUnlockSequence(){
  beep(520,70,"sine", isMobile ? 0.022 : 0.03);
  setTimeout(()=>beep(740,70,"sine", isMobile ? 0.020 : 0.028),100);
  setTimeout(()=>beep(980,60,"triangle", isMobile ? 0.018 : 0.024),190);

  leftDoor?.classList.add('open');
  rightDoor?.classList.add('open');
  lockBox?.classList.add('show-border');
  setTimeout(()=> lockRing?.classList.add('show'), 260);

  setTimeout(()=> screenShake(520, isMobile ? 3 : 4), 380);

  setTimeout(()=> {
    document.querySelectorAll('.circle').forEach(c => c.classList.add('fade'));
    gap?.classList.add('open');

    initStars(); animateStars();
    initDust(); animateDust();
    initGlitter(); animateGlitter();
    // startFireworks(); // <<< ĐÃ BỎ
  }, doorDurationMs + 80);

  setTimeout(()=> lockEl?.classList.add('fall'), doorDurationMs + 380);

  setTimeout(()=> {
    enterBtn?.classList.add('show');
    if(btnBurst){
      btnBurst.classList.remove('boom');
      void btnBurst.offsetWidth;
      btnBurst.classList.add('boom');
    }
    beep(1040,60,"triangle", isMobile ? 0.018 : 0.022);
  }, doorDurationMs + 700);
}

/* ---------- preset check (auto mở theo giờ nếu muốn) ---------- */
function updateAndCheck(){
  const now = new Date();
  updateClockDisplay(now);
  if(!triggered && presetDate && now >= presetDate){
    triggered = true;
    startUnlockSequence();
  }
}

/* ---------- unlock app ---------- */
function unlockApp(){
  document.body.classList.remove('is-locked');

  activateOverlay?.classList.add('hide');
  activateOverlay?.setAttribute('aria-hidden','true');

  if(bgm){
    try{
      bgm.volume = 0.9;
      const p = bgm.play();
      if(p && p.catch) p.catch(()=>{});
    }catch(e){}
  }

  setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
}

/* ---------- FORCE OPEN NOW (nút “Tới Giờ Mở Cửa”) ---------- */
function forceOpenNow(){
  if(triggered) return;
  presetDate = new Date(Date.now() - 1000);
  triggered = true;
  startUnlockSequence();
}

/* ---------- init ---------- */
function init(){
  // tắt hẳn canvas pháo hoa để đỡ phải composite vẽ/ghép
  if (fireworksCanvas) fireworksCanvas.style.display = "none";

  setRotateState();
  addEventListener('resize', setRotateState);
  addEventListener('orientationchange', setRotateState);

  presetDate = computePreset();
  updateAndCheck();
  setInterval(updateAndCheck, 1000);
  requestAnimationFrame(neonLoop);

  initStars();
  initDust();
  initGlitter();

  addEventListener('resize', ()=>{
    initStars();
    initDust();
    initGlitter();
  });

  document.addEventListener('fullscreenchange', ()=>{
    setTimeout(()=>{
      initStars();
      initDust();
      initGlitter();
    }, 180);
  });
}
init();

/* ---------- BUTTON: tới giờ + mở cửa ---------- */
activateBtn?.addEventListener('click', ()=> {
  if(!isLandscape()) return;

  beep(980,60,"triangle", isMobile ? 0.018 : 0.03);

  requestFullscreen();
  unlockApp();
  forceOpenNow();
});

/* ENTER BUTTON -> trungtam.html */
enterBtn?.addEventListener('click', ()=> {
  beep(980,60,"triangle", isMobile ? 0.018 : 0.03);
  setTimeout(()=>window.location.href = 'trungtam.html', 80);
});
