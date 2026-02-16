const $ = (s, r=document)=>r.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;

const card = $("#card");
const bg = $("#bg");
const bctx = bg.getContext("2d", {alpha:true});

const overlay = $("#overlay");
const openOverlay = $("#openOverlay");
const panel = $("#panel");

const stepPill = $("#stepPill");
const hand = $("#hand");

const g1 = $("#g1");
const gDob = $("#gDob");
const g2 = $("#g2");
const g3 = $("#g3");

const t1 = $("#t1");
const tDob = $("#tDob");
const t2 = $("#t2");
const t3 = $("#t3");

const nameBuild = $("#nameBuild");
const letterBtns = [...document.querySelectorAll(".letterBtn")];
const resetNameBtn = $("#resetNameBtn");

const dobDisplay = $("#dobDisplay");
const keypadKeys = [...document.querySelectorAll(".key")];
const dobBackBtn = $("#dobBackBtn");
const dobResetBtn = $("#dobResetBtn");

const emojiBox = $("#emojiBox");
const emojiBtns = [...document.querySelectorAll(".emojiBtn")];

const rateBox = $("#rateBox");
const rateBtns = [...document.querySelectorAll(".rateBtn")];

const confirmBtn = $("#confirmBtn");
const confirmHint = $("#confirmHint");

const cardName = $("#cardName");
const cardMsg = $("#cardMsg");
const cardStatus = $("#cardStatus");
const cardRate = $("#cardRate");
const cardSys = $("#cardSys");
const readyBtn = $("#readyBtn");

const state = {
  step: 1,
  mustName: ["ư","n","g"],
  nameIdx: 0,
  nameTail: "",
  dob: "",
  status: null,
  rate: null,
  confirmEnabled: false,
  readyEnabled: false
};

function fullName(){ return "H" + (state.nameTail || ""); }

function shake(el){
  el.animate(
    [{transform:"translateX(0)"},{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"translateX(0)"}],
    {duration:200}
  );
}

function moveHandToStep(n){
  // đặt icon theo title, không đè chữ (nó ở lề trái)
  const titleEl = (n===1)?t1:(n===2)?tDob:(n===3)?t2:t3;
  const pr = panel.getBoundingClientRect();
  const tr = titleEl.getBoundingClientRect();
  const top = (tr.top - pr.top) + 80; // offset theo panel scroll
  // do hand fixed, cần cộng scrollTop của panel
  const y = panel.scrollTop + (tr.top - pr.top) + 92;
  const panelTop = pr.top; // vị trí panel trên màn hình
  hand.style.top = `${panelTop + (tr.top - pr.top) - 6}px`;
}

function setStep(n){
  state.step = n;
  stepPill.textContent = `STEP ${n}/4`;

  g1.classList.toggle("isDisabled", n !== 1);
  gDob.classList.toggle("isDisabled", n !== 2);
  g2.classList.toggle("isDisabled", n !== 3);
  g3.classList.toggle("isDisabled", n !== 4);

  requestAnimationFrame(()=>{
    if(n === 3) layoutNonOverlapping(emojiBox, emojiBtns, 10);
    if(n === 4) layoutNonOverlapping(rateBox, rateBtns, 10);
    moveHandToStep(n);
  });

  updateUI();
}

function updateUI(){
  cardName.textContent = state.nameTail ? fullName() : "H—";
  cardStatus.textContent = (state.status==="😍") ? "😍" : "—";
  cardRate.textContent = (state.rate==="tuyệt vời") ? "tuyệt vời" : "—";

  nameBuild.textContent = state.nameTail ? state.nameTail : "—";
  dobDisplay.textContent = state.dob.padEnd(8, "_");

  confirmBtn.classList.toggle("isHot", state.confirmEnabled);
  confirmBtn.classList.toggle("isGray", !state.confirmEnabled);
  confirmBtn.classList.toggle("isDisabled", !state.confirmEnabled);

  readyBtn.classList.toggle("isOn", state.readyEnabled);

  cardSys.textContent = state.readyEnabled ? "READY" : `STEP ${state.step}`;
  cardMsg.textContent = state.readyEnabled
    ? "Bấm “Sẵn sàng” để chuyển trang."
    : "Bấm “Nhập dữ liệu” để bắt đầu (👉 chỉ từng dòng).";

  if(state.step===1) confirmHint.textContent = "Bước 1: bấm đúng ư → n → g.";
  if(state.step===2) confirmHint.textContent = "Bước 2: nhập đúng 25122010.";
  if(state.step===3) confirmHint.textContent = "Bước 3: phải chọn 😍.";
  if(state.step===4) confirmHint.textContent = "Bước 4: phải chọn “tuyệt vời” để mở Xác nhận.";
}

openOverlay.addEventListener("click", ()=>{
  overlay.classList.add("isOpen");
  setTimeout(()=>{
    resizeBg();
    setStep(state.step);
  }, 0);
});
overlay.addEventListener("click", ()=>{ /* no close */ });
panel.addEventListener("scroll", ()=>moveHandToStep(state.step), {passive:true});

/* STEP 1 */
letterBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    if(state.step !== 1) return;
    const ch = btn.dataset.ch;
    const need = state.mustName[state.nameIdx];
    if(ch !== need){ shake(btn); return; }

    state.nameTail += ch;
    state.nameIdx += 1;
    btn.classList.add("isUsed");
    updateUI();

    if(state.nameIdx === 3) setStep(2);
    else moveHandToStep(1);
  });
});
resetNameBtn.addEventListener("click", ()=>{
  if(state.step !== 1) return;
  state.nameTail = ""; state.nameIdx = 0;
  letterBtns.forEach(b=>b.classList.remove("isUsed"));
  updateUI(); moveHandToStep(1);
});

/* STEP 2: DOB */
function applyDob(){
  updateUI();
  moveHandToStep(2);

  if(state.dob.length === 8){
    if(state.dob === "25122010"){
      setStep(3);
    } else {
      shake(dobDisplay);
      setTimeout(()=>{
        state.dob = "";
        updateUI(); moveHandToStep(2);
      }, 180);
    }
  }
}
keypadKeys.forEach(k=>{
  k.addEventListener("click", ()=>{
    if(state.step !== 2) return;
    if(state.dob.length >= 8) return;
    state.dob += k.dataset.n;
    applyDob();
  });
});
dobBackBtn.addEventListener("click", ()=>{
  if(state.step !== 2) return;
  state.dob = state.dob.slice(0,-1);
  applyDob();
});
dobResetBtn.addEventListener("click", ()=>{
  if(state.step !== 2) return;
  state.dob = "";
  applyDob();
});

/* STEP 3: status */
emojiBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    if(state.step !== 3) return;
    const emo = btn.dataset.emo;
    state.status = emo;
    emojiBtns.forEach(b=>b.classList.toggle("isPicked", b===btn));

    if(emo === "😍"){ setStep(4); return; }
    moveOneNonOverlapping(emojiBox, emojiBtns, btn, 10);
    updateUI(); moveHandToStep(3);
  });
});

/* STEP 4: rate */
rateBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    if(state.step !== 4) return;
    const rate = btn.dataset.rate;
    state.rate = rate;
    rateBtns.forEach(b=>b.classList.toggle("isPicked", b===btn));

    if(rate === "tuyệt vời"){
      state.confirmEnabled = true;
      updateUI(); moveHandToStep(4);
      return;
    }
    state.confirmEnabled = false;
    shake(btn);
    updateUI(); moveHandToStep(4);
  });
});

/* Confirm -> close overlay + show READY */
confirmBtn.addEventListener("click", ()=>{
  if(!state.confirmEnabled){ shake(confirmBtn); return; }

  cardSys.textContent = "SYNCED";
  cardSys.animate([{opacity:.5},{opacity:1}],{duration:200});

  state.readyEnabled = true;
  updateUI();

  setTimeout(()=> overlay.classList.remove("isOpen"), 220);
});

/* Ready -> go to another file */
readyBtn.addEventListener("click", ()=>{
  if(!state.readyEnabled) return;
  window.location.href = "secretmodel.html";
});

/* ======================================================
   Random layout (no overlap)
====================================================== */
function layoutNonOverlapping(container, btns, pad=8){
  const r = container.getBoundingClientRect();
  const cw = r.width, ch = r.height;
  if(cw < 10 || ch < 10) return;

  container.style.position = "relative";

  const sizes = btns.map(b=>({ w: b.offsetWidth, h: b.offsetHeight }));
  const placed = [];
  for(let i=0;i<btns.length;i++){
    const b = btns[i];
    b.style.position = "absolute";
    const w = sizes[i].w, h = sizes[i].h;

    const pos = findSpot(cw, ch, w, h, placed, pad, 120);
    placed.push({x:pos.x, y:pos.y, w, h});
    b.style.left = `${pos.x}px`;
    b.style.top  = `${pos.y}px`;
  }
}
function moveOneNonOverlapping(container, btns, targetBtn, pad=8){
  const r = container.getBoundingClientRect();
  const cw = r.width, ch = r.height;
  if(cw < 10 || ch < 10) return;

  const placed = [];
  btns.forEach(b=>{
    if(b === targetBtn) return;
    const x = parseFloat(b.style.left || "0");
    const y = parseFloat(b.style.top  || "0");
    placed.push({x,y,w:b.offsetWidth,h:b.offsetHeight});
  });

  const w = targetBtn.offsetWidth;
  const h = targetBtn.offsetHeight;
  const pos = findSpot(cw, ch, w, h, placed, pad, 160);
  targetBtn.style.left = `${pos.x}px`;
  targetBtn.style.top  = `${pos.y}px`;
}
function findSpot(cw, ch, w, h, placed, pad, attempts=100){
  const minX = pad, minY = pad;
  const maxX = Math.max(minX, cw - w - pad);
  const maxY = Math.max(minY, ch - h - pad);

  for(let k=0;k<attempts;k++){
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    const cand = {x,y,w,h};
    if(!intersectsAny(cand, placed, pad)) return {x,y};
  }
  return {x:minX, y:minY};
}
function intersectsAny(a, list, pad){
  for(const b of list){
    if(!(
      a.x + a.w + pad < b.x ||
      a.x > b.x + b.w + pad ||
      a.y + a.h + pad < b.y ||
      a.y > b.y + b.h + pad
    )) return true;
  }
  return false;
}

/* ======================================================
   3D Tilt (mobile)
====================================================== */
let tiltTarget = { rx:0, ry:0, px:50, py:50, p:0 };
let tiltState  = { rx:0, ry:0, px:50, py:50, p:0 };
let isDown=false;

function setCardVars(s){
  card.style.setProperty("--rx", `${s.rx}deg`);
  card.style.setProperty("--ry", `${s.ry}deg`);
  card.style.setProperty("--px", `${s.px}%`);
  card.style.setProperty("--py", `${s.py}%`);
  card.style.setProperty("--p",  `${s.p}`);
}
function pointToTilt(clientX, clientY, pressed){
  const r = card.getBoundingClientRect();
  const x = clamp((clientX - r.left) / r.width, 0, 1);
  const y = clamp((clientY - r.top) / r.height, 0, 1);
  tiltTarget.px = x*100;
  tiltTarget.py = y*100;
  const max = 11;
  tiltTarget.rx = lerp(+max, -max, y);
  tiltTarget.ry = lerp(-max, +max, x);
  tiltTarget.p = pressed ? 1 : 0.22;
}
function resetTilt(){
  tiltTarget.rx=0; tiltTarget.ry=0;
  tiltTarget.px=50; tiltTarget.py=50;
  tiltTarget.p=0;
}
function onDown(e){
  isDown=true;
  card.classList.add("isPress");
  const p = e.touches ? e.touches[0] : e;
  pointToTilt(p.clientX, p.clientY, true);
}
function onMove(e){
  const p = e.touches ? e.touches[0] : e;
  if(e.touches && !isDown) return;
  pointToTilt(p.clientX, p.clientY, isDown);
}
function onUp(){
  isDown=false;
  card.classList.remove("isPress");
  tiltTarget.p = 0.10;
}
card.addEventListener("mousedown", onDown);
window.addEventListener("mousemove", onMove);
window.addEventListener("mouseup", onUp);
card.addEventListener("touchstart", onDown, {passive:true});
window.addEventListener("touchmove", onMove, {passive:true});
window.addEventListener("touchend", onUp, {passive:true});
window.addEventListener("touchcancel", onUp, {passive:true});
card.addEventListener("mouseleave", ()=>{ if(!isDown) resetTilt(); });

/* ======================================================
   Background stars (mobile optimized)
   - DPR capped to 1.25
   - fewer stars
   - draw at ~30fps
====================================================== */
let W=0,H=0,DPR=1;
const stars=[];
let STAR_COUNT=110; // desktop default
let lastDraw = 0;

function isMobile(){
  return matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function resizeBg(){
  const mobile = isMobile();
  DPR = Math.min(mobile ? 1.25 : 1.6, window.devicePixelRatio || 1);

  STAR_COUNT = mobile ? 70 : 120;

  W = bg.width  = Math.floor(innerWidth * DPR);
  H = bg.height = Math.floor(innerHeight * DPR);
  bg.style.width = innerWidth + "px";
  bg.style.height = innerHeight + "px";

  stars.length=0;
  for(let i=0;i<STAR_COUNT;i++){
    stars.push({
      x: Math.random()*W,
      y: Math.random()*H,
      z: Math.random(),
      r: lerp(0.6,1.4,Math.random())*DPR,
      s: lerp(0.08,0.32,Math.random())*DPR,
      tw: Math.random()*Math.PI*2
    });
  }
}
window.addEventListener("resize", ()=>{
  resizeBg();
  if(overlay.classList.contains("isOpen")){
    if(state.step===3) layoutNonOverlapping(emojiBox, emojiBtns, 10);
    if(state.step===4) layoutNonOverlapping(rateBox, rateBtns, 10);
    moveHandToStep(state.step);
  }
}, {passive:true});
resizeBg();

function drawBg(){
  bctx.clearRect(0,0,W,H);

  // nhẹ hơn: bỏ radial gradient lớn, chỉ fill mờ
  bctx.globalAlpha = 1;
  bctx.fillStyle = "rgba(0,0,0,0.10)";
  bctx.fillRect(0,0,W,H);

  const px = (tiltState.ry/11)*18*DPR;
  const py = (-tiltState.rx/11)*14*DPR;

  for(const st of stars){
    st.tw += 0.010*(0.7+st.z);
    const tw = 0.6 + 0.4*Math.sin(st.tw);

    st.y += st.s*(0.55+st.z);
    if(st.y > H + 10*DPR) st.y = -10*DPR;

    const x = st.x + px*(0.2+st.z);
    const y = st.y + py*(0.2+st.z);

    bctx.globalAlpha = 0.16 + 0.22*tw;
    bctx.beginPath();
    bctx.arc(x,y,st.r,0,Math.PI*2);
    bctx.fillStyle = "rgba(245,241,255,1)";
    bctx.fill();
  }
}

/* ===== Main loop ===== */
function loop(ts){
  // tilt smoothing
  const t = 0.085;
  tiltState.rx = lerp(tiltState.rx, tiltTarget.rx, t);
  tiltState.ry = lerp(tiltState.ry, tiltTarget.ry, t);
  tiltState.px = lerp(tiltState.px, tiltTarget.px, t);
  tiltState.py = lerp(tiltState.py, tiltTarget.py, t);
  tiltState.p  = lerp(tiltState.p,  tiltTarget.p,  0.10);
  setCardVars(tiltState);

  // draw bg ~30fps
  if(!lastDraw || ts - lastDraw > 33){
    drawBg();
    lastDraw = ts;
  }

  requestAnimationFrame(loop);
}

setStep(1);
updateUI();
requestAnimationFrame(loop);
