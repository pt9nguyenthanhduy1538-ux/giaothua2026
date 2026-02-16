/* hoiuc.js */
(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });

  const soundBtn = document.getElementById('soundBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');

  // =========================================================
  // [ADD] Boot overlay + <audio> BGM
  // - Khi mới vào: đang "locked", không autoplay.
  // - Khi bấm "Mở timeline" hoặc bấm soundBtn lúc đang khóa:
  //   -> remove locked + ẩn overlay + resume AudioContext + play <audio>
  // =========================================================
  const boot = document.getElementById('boot');
  const unlockBtn = document.getElementById('unlockBtn');
  const bgm = document.getElementById('bgm');

  let unlocked = false;

  // đảm bảo ban đầu không phát nhạc
  if (bgm){
    bgm.muted = true;
    bgm.volume = 0.75;
    // không gọi play() ở đây để tránh bị chặn autoplay
  }

  function safePlayMedia(el){
    if (!el) return;
    const p = el.play();
    if (p && typeof p.catch === "function"){
      p.catch(() => {}); // tránh warning NotAllowedError trong console
    }
  }

  function setBgmOn(on){
    if (!bgm) return;
    bgm.muted = !on;
    if (on) safePlayMedia(bgm);
    else bgm.pause();
  }

  function setSound(on){
    // AudioContext / WebAudio phải resume trong user gesture
    Audio.resume();
    Audio.setOn(on);

    // đồng bộ <audio>
    setBgmOn(on);

    // cập nhật UI
    setSoundUI();
  }

  function unlockPage(){
    if (unlocked) return;
    unlocked = true;

    document.body.classList.remove('locked');
    if (boot) boot.classList.add('hide');

    // Mở khóa xong: bật âm + phát nhạc
    setSound(true);
  }

  if (unlockBtn){
    unlockBtn.addEventListener('click', unlockPage);
  }

  // ---------- Utils ----------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const easeInOut = (t)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const rand = (a,b)=>a+Math.random()*(b-a);

  // ---------- Resize ----------
  let W=0,H=0,DPR=1;
  function resize(){
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(innerWidth * DPR);
    H = Math.floor(innerHeight * DPR);
    canvas.width = W; canvas.height = H;
  }
  addEventListener('resize', resize, {passive:true});
  resize();

  // ---------- Audio ----------
  const Audio = (() => {
    let ac=null, master=null, on=false;

    function ensure(){
      if (ac) return;
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);

      // soft ambient bed
      const noise = ac.createBufferSource();
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const data = buf.getChannelData(0);
      let last=0;
      for(let i=0;i<data.length;i++){
        const w = Math.random()*2-1;
        last = (last + 0.02*w)/1.02;
        data[i] = last*0.16;
      }
      noise.buffer = buf;
      noise.loop = true;

      const lp = ac.createBiquadFilter();
      lp.type='lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 0.6;

      const g = ac.createGain();
      g.gain.value = 0.06;
      noise.connect(lp); lp.connect(g); g.connect(master);
      noise.start();
    }

    function resume(){ ensure(); if (ac.state!=='running') ac.resume(); }

    function setOn(v){
      ensure();
      on = v;
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(on ? 0.9 : 0.0, t+0.25);
    }

    function pluck(freq, amp=0.18, dur=0.12){
      if (!on) return;
      const t = ac.currentTime;

      const o = ac.createOscillator();
      const g = ac.createGain();
      const lp = ac.createBiquadFilter();

      o.type='sine';
      o.frequency.setValueAtTime(freq, t);
      lp.type='lowpass';
      lp.frequency.setValueAtTime(2400, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);

      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); o.stop(t+dur+0.03);

      // tiny click
      const src=ac.createBufferSource();
      const b=ac.createBuffer(1, ac.sampleRate*0.03, ac.sampleRate);
      const d=b.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
      src.buffer=b;

      const hp=ac.createBiquadFilter();
      hp.type='highpass'; hp.frequency.value=1200;

      const ng=ac.createGain();
      ng.gain.setValueAtTime(0.0001,t);
      ng.gain.exponentialRampToValueAtTime(0.05,t+0.005);
      ng.gain.exponentialRampToValueAtTime(0.0001,t+0.03);

      src.connect(hp); hp.connect(ng); ng.connect(master);
      src.start(t); src.stop(t+0.04);
    }

    function shatterPop(){
      if (!on) return;
      const t=ac.currentTime;

      const src=ac.createBufferSource();
      const b=ac.createBuffer(1, ac.sampleRate*0.09, ac.sampleRate);
      const d=b.getChannelData(0);
      for(let i=0;i<d.length;i++){
        const x=i/d.length;
        d[i]=(Math.random()*2-1)*(1-x);
      }
      src.buffer=b;

      const bp=ac.createBiquadFilter();
      bp.type='bandpass'; bp.frequency.value=1900; bp.Q.value=1.0;

      const g=ac.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.22,t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);

      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t); src.stop(t+0.18);
    }

    return { resume, setOn, pluck, shatterPop, get on(){return on;} };
  })();

  function setSoundUI(){
    if (!soundBtn) return;
    soundBtn.textContent = Audio.on ? "🔊 Âm: Bật" : "🔇 Âm: Tắt";
  }

  // ---------- Timeline ----------
  const START=2010, END=2025;
  const YEARS = Array.from({length: END-START+1}, (_,i)=>START+i);
  const N = YEARS.length;

  const STEP_X = 760;
  const SWING_Y = 0.50;
  const SPEED_SEG_PER_SEC = 0.014;

  const NOTE_W = 140;
  const NOTE_H = 90;

  const NEON = {
    glowA: 'rgba(0, 255, 210, 0.20)',
    glowB: 'rgba(0, 180, 255, 0.22)',
    glowC: 'rgba(140, 90, 255, 0.16)',
    hot:   'rgba(0, 255, 210, 0.72)',
    core:  'rgba(235, 255, 255, 0.92)'
  };

  // ---------- Camera ----------
  const cam = { x:0, y:0, z:1, shake:0 };

  function beginCamera(){
    ctx.save();
    ctx.translate(W*0.5, H*0.5);
    let sx=0, sy=0;
    if (cam.shake > 0){
      sx = (Math.random()*2-1) * cam.shake * DPR;
      sy = (Math.random()*2-1) * cam.shake * DPR;
    }
    ctx.translate(sx, sy);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-W*0.5 + cam.x, -H*0.5 + cam.y);
  }
  function endCamera(){ ctx.restore(); }

  function worldToScreen(wx, wy){
    const sx = W*0.5 + ( (wx + cam.x) - W*0.5 ) * cam.z;
    const sy = H*0.5 + ( (wy + cam.y) - H*0.5 ) * cam.z;
    return { x:sx, y:sy };
  }

  // ---------- Background stars ----------
  let stars = [];
  function makeStars(){
    const count = Math.floor((W*H) / (DPR*DPR) / 16000);
    stars = [];
    for (let i=0;i<count;i++){
      stars.push({
        x: Math.random()*W,
        y: Math.random()*H,
        r: (Math.random()*1.8 + 0.2)*DPR,
        a: Math.random()*0.55 + 0.10,
        tw: Math.random()*1.5 + 0.4,
        ph: Math.random()*Math.PI*2
      });
    }
  }
  makeStars();
  addEventListener('resize', makeStars, {passive:true});

  function drawBg(time){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#01010a');
    g.addColorStop(1,'#02021a');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,W,H);

    for (const s of stars){
      const tw = 0.5 + 0.5*Math.sin(time*s.tw + s.ph);
      ctx.globalAlpha = s.a * (0.70 + 0.30*tw);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r*(0.80+0.25*tw), 0, Math.PI*2);
      ctx.fill();
    }

    const vg = ctx.createRadialGradient(W*0.5,H*0.55,Math.min(W,H)*0.15, W*0.5,H*0.55, Math.min(W,H)*0.92);
    vg.addColorStop(0,'rgba(0,0,0,0)');
    vg.addColorStop(1,'rgba(0,0,0,0.82)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,W,H);
  }

  // ---------- Build points ----------
  function buildPoints(){
    const baseY = 0.52 * H;
    const totalLen = (N-1) * STEP_X * DPR;
    const xStart = -totalLen/2;

    const pts=[];
    for(let i=0;i<N;i++){
      const x = xStart + i * STEP_X * DPR;

      const t = i/(N-1);
      const w1 = Math.sin(i*0.85) * 0.75;
      const w2 = Math.sin(i*0.33 + 1.3) * 0.60;
      const spikes =
        (i===3 ?  1.0 : 0) +
        (i===6 ? -1.2 : 0) +
        (i===10? -1.1 : 0) +
        (i===13?  1.2 : 0) +
        (i===15? -0.9 : 0);

      const amp = SWING_Y * H * (0.85 + 0.15*Math.sin(t*Math.PI));
      const y = baseY + (w1 + w2 + spikes*0.35) * amp * 0.28;

      pts.push({ year: YEARS[i], x, y });
    }
    return pts;
  }

  // ---------- Drawing primitives ----------
  function roundRect(c, x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);
    c.beginPath();
    c.moveTo(x+rr,y);
    c.arcTo(x+w,y,x+w,y+h,rr);
    c.arcTo(x+w,y+h,x,y+h,rr);
    c.arcTo(x,y+h,x,y,rr);
    c.arcTo(x,y,x+w,y,rr);
    c.closePath();
  }

  function drawNoteOnContext(c, x,y,txt, alpha=1, scale=1){
    const w = NOTE_W*DPR*scale;
    const h = NOTE_H*DPR*scale;
    const r = 18*DPR*scale;
    const left = x - w/2;
    const top  = y - h/2;

    c.save();
    c.globalAlpha = 0.60*alpha;
    c.fillStyle = 'rgba(0,0,0,0.60)';
    roundRect(c, left+10*DPR*scale, top+12*DPR*scale, w, h, r);
    c.fill();
    c.restore();

    c.save();
    c.globalAlpha = alpha;
    const g = c.createLinearGradient(0, top, 0, top+h);
    g.addColorStop(0,'rgba(248,248,250,0.98)');
    g.addColorStop(1,'rgba(220,222,232,0.98)');
    c.fillStyle=g;
    roundRect(c, left, top, w, h, r);
    c.fill();

    c.strokeStyle = 'rgba(0,0,0,0.14)';
    c.lineWidth = 1.2*DPR*scale;
    c.stroke();

    c.fillStyle = 'rgba(0,0,0,0.78)';
    c.font = `${Math.floor(26*DPR*scale)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    c.textAlign='center';
    c.textBaseline='middle';
    c.fillText(String(txt), x, y);

    c.restore();
  }

  function drawPinOnContext(c, x,y,alpha=1, scale=1){
    const headY = y - (NOTE_H*DPR*scale)/2 - 14*DPR*scale;
    const r = 12*DPR*scale;

    c.save();
    c.globalAlpha = 0.45*alpha;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.beginPath();
    c.ellipse(x+3*DPR*scale, headY+14*DPR*scale, 14*DPR*scale, 6*DPR*scale, 0, 0, Math.PI*2);
    c.fill();

    const g = c.createRadialGradient(x-7*DPR*scale, headY-7*DPR*scale, 2*DPR*scale, x, headY, 22*DPR*scale);
    g.addColorStop(0,'rgba(255,160,160,1)');
    g.addColorStop(0.55,'rgba(235,60,60,1)');
    g.addColorStop(1,'rgba(140,18,18,1)');

    c.globalAlpha = 1*alpha;
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, headY, r, 0, Math.PI*2);
    c.fill();

    c.strokeStyle = 'rgba(220,225,235,0.95)';
    c.lineWidth = 2.6*DPR*scale;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, headY + r*0.6);
    c.lineTo(x, headY + r*0.6 + 34*DPR*scale);
    c.stroke();

    c.restore();
  }

  function drawNote(x,y,txt,alpha=1,scale=1){ drawNoteOnContext(ctx, x,y,txt,alpha,scale); }
  function drawPin(x,y,alpha=1,scale=1){ drawPinOnContext(ctx, x,y,alpha,scale); }

  function drawNeonSegment(x0,y0,x1,y1,alpha=1){
    ctx.save();
    ctx.lineCap='round';

    ctx.globalAlpha = alpha * 0.12;
    ctx.strokeStyle = NEON.glowC;
    ctx.lineWidth = 30*DPR;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

    ctx.globalAlpha = alpha * 0.16;
    ctx.strokeStyle = NEON.glowB;
    ctx.lineWidth = 22*DPR;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

    ctx.globalAlpha = alpha * 0.22;
    ctx.strokeStyle = NEON.glowA;
    ctx.lineWidth = 16*DPR;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

    ctx.globalAlpha = alpha * 0.36;
    ctx.strokeStyle = NEON.hot;
    ctx.lineWidth = 7*DPR;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

    ctx.globalAlpha = alpha * 0.95;
    ctx.strokeStyle = NEON.core;
    ctx.lineWidth = 3.2*DPR;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

    ctx.restore();
  }

  function drawFadeOverlay(alpha){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  function drawNeonText(str, alpha, y, size){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font = `${Math.floor(size*DPR)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    ctx.fillStyle = 'rgba(0,180,255,0.18)';
    ctx.shadowColor = 'rgba(0,180,255,0.55)';
    ctx.shadowBlur = 26*DPR;
    ctx.fillText(str, W*0.5, y);

    ctx.shadowColor = 'rgba(0,255,210,0.65)';
    ctx.shadowBlur = 18*DPR;
    ctx.fillStyle = 'rgba(0,255,210,0.40)';
    ctx.fillText(str, W*0.5, y);

    ctx.shadowColor = 'rgba(235,255,255,0.95)';
    ctx.shadowBlur = 10*DPR;
    ctx.fillStyle = 'rgba(235,255,255,0.95)';
    ctx.fillText(str, W*0.5, y);

    ctx.restore();
  }

  function drawMarker(x,y,alpha=1){
    ctx.save();
    ctx.globalAlpha = 0.95*alpha;
    ctx.fillStyle = 'rgba(235,255,255,0.96)';
    ctx.beginPath(); ctx.arc(x, y, 5.2*DPR, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 0.35*alpha;
    ctx.fillStyle = 'rgba(0,255,210,0.55)';
    ctx.beginPath(); ctx.arc(x, y, 20*DPR, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 1*alpha;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font = `${Math.floor(28*DPR)}px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, system-ui`;
    ctx.fillText("🍉", x, y);

    ctx.restore();
  }

  // ---------- Head travel ----------
  let headS = 0;
  function headPos(points, s){
    const i = Math.floor(clamp(s, 0, N-1));
    const t = clamp(s - i, 0, 1);
    if (i >= N-1) return { x: points[N-1].x, y: points[N-1].y, i: N-1, t: 1 };
    const p0 = points[i], p1 = points[i+1];
    return { x: lerp(p0.x,p1.x,t), y: lerp(p0.y,p1.y,t), i, t };
  }

  const fixedSegs = [];
  function addFixedSeg(i){
    if (i < 0 || i >= N-1) return;
    const p0 = points[i], p1 = points[i+1];
    fixedSegs.push({x0:p0.x,y0:p0.y,x1:p1.x,y1:p1.y});
  }
  function drawFixedSegs(alpha=1){
    for (const s of fixedSegs) drawNeonSegment(s.x0,s.y0,s.x1,s.y1,alpha);
  }
  function drawCurrentPartialToHead(){
    const s = clamp(headS, 0, N-1);
    const i = Math.floor(s);
    const t = s - i;
    if (i >= N-1) return;
    const p0 = points[i], p1 = points[i+1];
    drawNeonSegment(p0.x,p0.y, lerp(p0.x,p1.x,t), lerp(p0.y,p1.y,t), 1);
  }

  // ---------- Tone per year ----------
  const scaleYears = [261.63, 293.66, 329.63, 392.00, 440.00, 493.88, 523.25, 587.33];
  function toneForIndex(i){
    const base = scaleYears[i % scaleYears.length];
    const octave = (i % 5 === 0) ? 0.5 : (i % 7 === 0 ? 1.5 : 1.0);
    return base * octave;
  }
  let lastMilestone = -1;

  // ---------- World + visibility for sweep ----------
  let points = buildPoints();
  let yearVisible = new Array(N).fill(true);
  let segVisible  = new Array(N-1).fill(true);

  function setCamToWorld(x,y,zoom,smooth=0.12){
    cam.x = lerp(cam.x, -(x - W*0.5), smooth);
    cam.y = lerp(cam.y, -(y - H*0.5), smooth);
    cam.z = lerp(cam.z, zoom, 0.10);
  }
  function computeFullViewCam(){
    const xMin = points[0].x, xMax = points[N-1].x;
    const yMin = Math.min(...points.map(p=>p.y));
    const yMax = Math.max(...points.map(p=>p.y));
    const xCenter = (xMin + xMax)/2;
    const yCenter = (yMin + yMax)/2;

    const worldW = (xMax - xMin) + 900*DPR;
    const worldH = (yMax - yMin) + 850*DPR;
    const zx = W / worldW;
    const zy = H / worldH;
    const fitZ = clamp(Math.min(zx, zy), 0.14, 0.60);
    return { xCenter, yCenter, fitZ };
  }

  function drawVisibleSegments(){
    for (let i=0;i<fixedSegs.length;i++){
      if (!segVisible[i]) continue;
      const s = fixedSegs[i];
      drawNeonSegment(s.x0,s.y0,s.x1,s.y1,1);
    }
  }

  // ---------- Realistic shatter: detach & fall (no V explosion) ----------
  const shardCanvas = document.createElement('canvas');
  const shardCtx = shardCanvas.getContext('2d');

  const shards = [];
  const cracks = [];
  let shatterActive = false;
  let shatterT = 0;

  const SHATTER = {
    duration: 2.6,
    detachStart: 0.35,
    detachSpan: 1.55,
    gravity: 820,
    wind: 40,
    fadePow: 1.8,
    killBelow: 1.08
  };

  function makeSnapshotForYear(yearText){
    const w = Math.floor((NOTE_W*1.25) * DPR);
    const h = Math.floor((NOTE_H*1.65) * DPR);
    shardCanvas.width = w;
    shardCanvas.height = h;
    shardCtx.clearRect(0,0,w,h);

    const cx = w/2;
    const cy = h/2 + 14*DPR;

    drawNoteOnContext(shardCtx, cx, cy, yearText, 1, 1);
    drawPinOnContext(shardCtx, cx, cy, 1, 1);

    return { canvas: shardCanvas, w, h };
  }

  function generateTriangleShards(snapshot, gridX=8, gridY=6){
    const pts = [];
    const w = snapshot.w, h = snapshot.h;
    const jx = w * 0.02;
    const jy = h * 0.02;

    for (let gy=0; gy<=gridY; gy++){
      for (let gx=0; gx<=gridX; gx++){
        let x = (gx/gridX)*w;
        let y = (gy/gridY)*h;
        const edge = (gx===0 || gx===gridX || gy===0 || gy===gridY);
        x += edge ? rand(-jx*0.12, jx*0.12) : rand(-jx, jx);
        y += edge ? rand(-jy*0.12, jy*0.12) : rand(-jy, jy);
        x = clamp(x, 0, w);
        y = clamp(y, 0, h);
        pts.push({x,y,gx,gy});
      }
    }
    const idx = (gx,gy)=> gy*(gridX+1)+gx;

    const tris = [];
    for (let gy=0; gy<gridY; gy++){
      for (let gx=0; gx<gridX; gx++){
        const p00 = pts[idx(gx,gy)];
        const p10 = pts[idx(gx+1,gy)];
        const p01 = pts[idx(gx,gy+1)];
        const p11 = pts[idx(gx+1,gy+1)];
        if (Math.random() < 0.5){
          tris.push([p00,p10,p11]);
          tris.push([p00,p11,p01]);
        } else {
          tris.push([p00,p10,p01]);
          tris.push([p10,p11,p01]);
        }
      }
    }
    return tris;
  }

  function startShatterAtYear(yearIndex){
    const p = points[yearIndex];
    const noteWX = p.x;
    const noteWY = p.y - 130*DPR;

    const sc = worldToScreen(noteWX, noteWY);
    const cx = sc.x;
    const cy = sc.y;

    // subtle cracks
    cracks.length = 0;
    const crackCount = 8;
    for (let i=0;i<crackCount;i++){
      const ang = (Math.PI*2) * (i/crackCount) + rand(-0.22, 0.22);
      const len = rand(0.18, 0.38) * Math.min(W,H);
      cracks.push({x0:cx,y0:cy,x1:cx+Math.cos(ang)*len,y1:cy+Math.sin(ang)*len,a:1});
    }

    const snap = makeSnapshotForYear(points[yearIndex].year);
    const tris = generateTriangleShards(snap, 8, 6);

    shards.length = 0;
    const centerLocal = { x: snap.w/2, y: snap.h/2 + 14*DPR };

    for (const tri of tris){
      const mx = (tri[0].x + tri[1].x + tri[2].x)/3;
      const my = (tri[0].y + tri[1].y + tri[2].y)/3;

      const ox = (mx - centerLocal.x);
      const oy = (my - centerLocal.y);

      // bottom pieces detach earlier
      const bias = clamp((my / snap.h), 0, 1);
      const releaseTime = SHATTER.detachStart + bias*SHATTER.detachSpan + rand(-0.10, 0.12);

      const vx0 = rand(-SHATTER.wind, SHATTER.wind) * DPR;
      const vy0 = rand(40, 180) * DPR;

      const life = rand(1.6, 2.6);
      shards.push({
        img: snap.canvas,
        iw: snap.w,
        ih: snap.h,
        tri: [{x:tri[0].x, y:tri[0].y},{x:tri[1].x, y:tri[1].y},{x:tri[2].x, y:tri[2].y}],
        x: cx + ox,
        y: cy + oy,
        vx: vx0,
        vy: vy0,
        rot: rand(-0.25, 0.25),
        vr: rand(-2.2, 2.2),
        life,
        maxLife: life,
        cx: mx,
        cy: my,
        released: false,
        releaseTime
      });
    }

    shatterActive = true;
    shatterT = 0;
    Audio.shatterPop();
  }

  function updateShatter(dt){
    if (!shatterActive) return;
    shatterT += dt;

    for (let i=cracks.length-1;i>=0;i--){
      cracks[i].a -= dt*0.55;
      if (cracks[i].a <= 0) cracks.splice(i,1);
    }

    for (let i=shards.length-1;i>=0;i--){
      const s = shards[i];

      if (!s.released && shatterT >= s.releaseTime) {
        s.released = true;
        s.vy += rand(120, 260) * DPR;
        s.vx += rand(-60, 60) * DPR;
      }

      if (s.released){
        s.vy += SHATTER.gravity * DPR * dt;
        s.vx *= Math.pow(0.992, dt*60);
        s.vy *= Math.pow(0.997, dt*60);
        s.x  += s.vx * dt;
        s.y  += s.vy * dt;
        s.rot += s.vr * dt;
      }

      s.life -= dt;

      // mảnh rớt xuống là mất luôn
      if (s.y > H * SHATTER.killBelow || s.life <= 0){
        shards.splice(i,1);
      }
    }

    if (shatterT > SHATTER.duration && shards.length === 0){
      shatterActive = false;
    }
  }

  function drawShatter(){
    if (!shatterActive && cracks.length===0 && shards.length===0) return;

    // cracks
    ctx.save();
    ctx.strokeStyle = 'rgba(235,255,255,0.75)';
    ctx.lineWidth = 1.2*DPR;
    for (const c of cracks){
      ctx.globalAlpha = 0.40*c.a;
      ctx.beginPath();
      ctx.moveTo(c.x0, c.y0);
      ctx.lineTo(c.x1, c.y1);
      ctx.stroke();
    }
    ctx.restore();

    // textured shards
    for (const s of shards){
      const a = clamp(s.life / s.maxLife, 0, 1);
      const alpha = Math.pow(a, SHATTER.fadePow);
      const holdAlpha = s.released ? 1 : 0.85;

      ctx.save();
      ctx.globalAlpha = 0.95 * alpha * holdAlpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);

      const t0 = s.tri[0], t1 = s.tri[1], t2 = s.tri[2];
      const cx = s.cx, cy = s.cy;

      ctx.beginPath();
      ctx.moveTo(t0.x - cx, t0.y - cy);
      ctx.lineTo(t1.x - cx, t1.y - cy);
      ctx.lineTo(t2.x - cx, t2.y - cy);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(s.img, -cx, -cy);

      // tiny edge glint
      ctx.globalAlpha = 0.08 * alpha * holdAlpha;
      ctx.strokeStyle = 'rgba(235,255,255,0.9)';
      ctx.lineWidth = 1.4*DPR;
      ctx.stroke();

      ctx.restore();
    }
  }

  // ---------- Welcome letters (no afterimage) ----------
  const welcomeText = "chào mừng";
  let letters = [];
  function initLetters(){
    letters = [];
    const chars = [...welcomeText];
    ctx.save();
    ctx.font = `${Math.floor(72*DPR)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const totalW = widths.reduce((a,b)=>a+b,0) + (chars.length-1)*10*DPR;
    let x = W*0.5 - totalW/2;
    for (let i=0;i<chars.length;i++){
      letters.push({
        ch: chars[i],
        x: x + widths[i]/2,
        y: H*0.45,
        vy: rand(220, 520)*DPR,
        rot: rand(-0.16, 0.16),
        vr: rand(-1.2, 1.2),
        delay: rand(0.0, 1.2),
        a: 1,
        started: false
      });
      x += widths[i] + 10*DPR;
    }
    ctx.restore();
  }
  function updateLetters(dt, tLocal){
    for (const L of letters){
      if (!L.started && tLocal >= L.delay) L.started = true;
      if (!L.started) continue;
      L.y += L.vy * dt;
      L.rot += L.vr * dt;
      const fade = clamp((L.y - H*0.62)/(H*0.30), 0, 1);
      L.a = 1 - fade;
    }
  }
  function drawLetters(){
    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font = `${Math.floor(72*DPR)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    for (const L of letters){
      if (L.a <= 0.01) continue;
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.rot);
      ctx.globalAlpha = L.a;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(235,255,255,0.95)';
      ctx.fillText(L.ch, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- Spotlight beam for 2026 ----------
  function drawSpotlightBeam(cx, cy){
    ctx.save();
    const topY = -40*DPR;
    const beamWTop = 70*DPR;
    const beamWBot = 260*DPR;
    const botY = cy + 30*DPR;

    ctx.beginPath();
    ctx.moveTo(cx - beamWTop/2, topY);
    ctx.lineTo(cx + beamWTop/2, topY);
    ctx.lineTo(cx + beamWBot/2, botY);
    ctx.lineTo(cx - beamWBot/2, botY);
    ctx.closePath();

    const g = ctx.createLinearGradient(cx, topY, cx, botY);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.50, 'rgba(0,255,210,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fill();

    const rg = ctx.createRadialGradient(cx, cy-10*DPR, 20*DPR, cx, cy, 280*DPR);
    rg.addColorStop(0, 'rgba(235,255,255,0.22)');
    rg.addColorStop(0.35, 'rgba(0,255,210,0.12)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0,0,W,H);

    ctx.restore();
  }

  // ---------- 2026: green blob orbit + fading trail + 6 dots that make music ----------
  const TRAIL_LIFE = 1.2;
  const trailSegs = []; // {x0,y0,x1,y1,born}
  function addTrailSeg(x0,y0,x1,y1,t){
    trailSegs.push({x0,y0,x1,y1,born:t});
    if (trailSegs.length > 1400) trailSegs.splice(0, trailSegs.length-1400);
  }
  function trailAlpha(seg,t){
    const age = t - seg.born;
    const a = 1 - clamp(age/TRAIL_LIFE, 0, 1);
    return a*a;
  }
  function cleanupTrail(t){
    while (trailSegs.length && (t - trailSegs[0].born) > (TRAIL_LIFE + 0.3)) trailSegs.shift();
  }
  function drawTrail(t){
    for (const s of trailSegs){
      const a = trailAlpha(s,t);
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = 0.18*a;
      ctx.strokeStyle = 'rgba(80,255,120,0.55)';
      ctx.lineWidth = 12*DPR;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s.x0,s.y0); ctx.lineTo(s.x1,s.y1); ctx.stroke();

      ctx.globalAlpha = 0.65*a;
      ctx.strokeStyle = 'rgba(80,255,120,0.90)';
      ctx.lineWidth = 3.2*DPR;
      ctx.beginPath(); ctx.moveTo(s.x0,s.y0); ctx.lineTo(s.x1,s.y1); ctx.stroke();
      ctx.restore();
    }
  }

  // 6 dots around the orbit: angles and tones
  const orbit = {
    r: 135,         // base radius (in CSS px before DPR)
    ang: 0,
    speed: 1.25,    // rad/sec
    hitR: 14,       // hit radius in px (before DPR)
    dots: []        // will init
  };

  // a nice 6-note motif (pentatonic-ish + one extra)
  const sixNotes = [392.00, 440.00, 493.88, 587.33, 659.25, 783.99]; // G4 A4 B4 D5 E5 G5

  function initOrbitDots(){
    orbit.dots = [];
    for (let i=0;i<6;i++){
      const a = (Math.PI*2) * (i/6) - Math.PI/2; // start at top
      orbit.dots.push({
        ang: a,
        freq: sixNotes[i],
        armed: true
      });
    }
  }
  initOrbitDots();

  let blobLast = null;

  function drawOrbitDots(cx, cy){
    // dots on the orbit ring
    for (const d of orbit.dots){
      const x = cx + Math.cos(d.ang) * orbit.r * DPR;
      const y = cy + Math.sin(d.ang) * orbit.r * DPR;

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(235,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(x, y, 3.2*DPR, 0, Math.PI*2);
      ctx.fill();

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = 'rgba(80,255,120,0.65)';
      ctx.beginPath();
      ctx.arc(x, y, 10*DPR, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateAndDrawGreenBlob(cx,cy,dt,tAbs){
    orbit.ang += dt * orbit.speed;

    const r = orbit.r * DPR;
    const x = cx + Math.cos(orbit.ang) * r;
    const y = cy + Math.sin(orbit.ang) * r;

    // trail
    if (blobLast) addTrailSeg(blobLast.x, blobLast.y, x, y, tAbs);
    blobLast = {x,y};

    // collision with dots => play note
    const hitRadius = orbit.hitR * DPR;
    for (const d of orbit.dots){
      const dx = (cx + Math.cos(d.ang)*r) - x;
      const dy = (cy + Math.sin(d.ang)*r) - y;
      const dist2 = dx*dx + dy*dy;

      if (dist2 <= hitRadius*hitRadius){
        if (d.armed){
          d.armed = false;
          Audio.pluck(d.freq, 0.16, 0.13);
        }
      } else {
        // re-arm once the blob leaves the dot zone
        d.armed = true;
      }
    }

    // blob
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(235,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x,y, 4.6*DPR, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(80,255,120,0.95)';
    ctx.beginPath(); ctx.arc(x,y, 9.0*DPR, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = 'rgba(80,255,120,0.55)';
    ctx.beginPath(); ctx.arc(x,y, 22*DPR, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ---------- State machine ----------
  // 0 travel 2010->2025
  // 1 zoom-out full view
  // 2 shake
  // 3 "tạm biệt" 4s + fade 0.6
  // 4 zoom to 2010
  // 5 sweep shatter each year: start shatter -> remove year -> next
  // 6 "chào mừng" 4s
  // 7 letters fall random
  // 8 2026 spotlight + orbit music (runs forever)
  let phase=0, phaseT=0;
  let paused=false;

  let sweepIndex=0, sweepT=0, sweepState=0;

  function resetAll(){
    points = buildPoints();
    fixedSegs.length = 0;
    headS = 0;
    lastMilestone = -1;

    yearVisible = new Array(N).fill(true);
    segVisible  = new Array(N-1).fill(true);

    phase=0; phaseT=0;
    cam.x=0; cam.y=0; cam.z=1; cam.shake=0;

    // shatter
    shatterActive=false;
    shatterT=0;
    shards.length=0;
    cracks.length=0;

    // letters
    letters.length=0;

    // orbit
    trailSegs.length=0;
    blobLast = null;
    orbit.ang = 0;
    initOrbitDots();

    sweepIndex=0; sweepT=0; sweepState=0;
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function frame(now){
    const dt0 = (now-last)/1000; last=now;
    const dt = paused ? 0 : Math.min(0.033, dt0);
    const timeSec = now/1000;

    drawBg(timeSec);
    updateShatter(dt);
    cleanupTrail(timeSec);

    phaseT += dt;

    // ----- Phase update -----
    if (phase === 0){
      const prev = headS;
      headS = clamp(headS + dt * SPEED_SEG_PER_SEC * (N-1), 0, N-1);

      const prevI = Math.floor(prev);
      const nowI  = Math.floor(headS);
      if (nowI > prevI) addFixedSeg(prevI);

      const near = Math.round(headS);
      const dist = Math.abs(headS - near);
      if (dist < 0.03 && near !== lastMilestone){
        lastMilestone = near;
        Audio.pluck(toneForIndex(near));
      }

      const hp = headPos(points, headS);
      setCamToWorld(hp.x, hp.y, 1.25, 0.12);

      if (headS >= N-1 - 1e-6){
        phase = 1; phaseT = 0;
      }
    }

    if (phase === 1){
      const { xCenter, yCenter, fitZ } = computeFullViewCam();
      setCamToWorld(xCenter, yCenter, fitZ, 0.12);
      if (phaseT > 1.6){ phase = 2; phaseT = 0; }
    }

    if (phase === 2){
      const { xCenter, yCenter, fitZ } = computeFullViewCam();
      setCamToWorld(xCenter, yCenter, fitZ, 0.12);
      cam.shake = lerp(cam.shake, 10, 0.12);
      if (phaseT > 1.2){
        cam.shake = 0;
        phase = 3; phaseT = 0;
      }
    }

    if (phase === 3){
      const { xCenter, yCenter, fitZ } = computeFullViewCam();
      setCamToWorld(xCenter, yCenter, fitZ, 0.12);
      if (phaseT > 4.6){
        phase = 4; phaseT = 0;
      }
    }

    if (phase === 4){
      const p0 = points[0];
      setCamToWorld(p0.x, p0.y, 1.35, 0.16);
      if (phaseT > 1.0){
        phase = 5; phaseT = 0;
        sweepIndex=0; sweepT=0; sweepState=0;
      }
    }

    if (phase === 5){
      sweepT += dt;
      const p = points[sweepIndex];
      setCamToWorld(p.x, p.y, 1.35, 0.18);

      if (sweepState === 0){
        // settle
        if (sweepT > 0.25){
          sweepState = 1;
          sweepT = 0;

          // start shatter: visible note removed immediately, shards take over
          startShatterAtYear(sweepIndex);
          yearVisible[sweepIndex] = false;
          if (sweepIndex < N-1) segVisible[sweepIndex] = false;
          if (sweepIndex-1 >= 0) segVisible[sweepIndex-1] = false;
        }
      } else if (sweepState === 1){
        // wait until most shards have dropped enough
        if (sweepT > 1.15){
          sweepState = 2;
          sweepT = 0;
        }
      } else if (sweepState === 2){
        // next
        sweepIndex++;
        sweepState = 0;
        sweepT = 0;
        if (sweepIndex >= N){
          phase = 6; phaseT = 0;
        }
      }
    }

    if (phase === 6){
      const { xCenter, yCenter, fitZ } = computeFullViewCam();
      setCamToWorld(xCenter, yCenter, fitZ, 0.12);
      if (phaseT > 4.0){
        phase = 7; phaseT = 0;
        initLetters();
      }
    }

    if (phase === 7){
      const { xCenter, yCenter, fitZ } = computeFullViewCam();
      setCamToWorld(xCenter, yCenter, fitZ, 0.12);
      updateLetters(dt, phaseT);

      const allGone = letters.length ? letters.every(l => l.a <= 0.01) : false;
      if (phaseT > 3.6 || allGone){
        phase = 8; phaseT = 0;
        trailSegs.length = 0;
        blobLast = null;
        orbit.ang = 0;
        initOrbitDots();
      }
    }

    if (phase === 8){
      cam.x = lerp(cam.x, 0, 0.12);
      cam.y = lerp(cam.y, 0, 0.12);
      cam.z = lerp(cam.z, 1.0, 0.12);
      cam.shake = 0;
    }

    // ---------- Render world ----------
    beginCamera();

    if (phase <= 3){
      drawFixedSegs(1);
      drawCurrentPartialToHead();

      for (let i=0;i<N;i++){
        const p = points[i];
        const noteY = p.y - 130*DPR;
        drawNote(p.x, noteY, p.year, 1, 1);
        drawPin(p.x, noteY, 1, 1);
      }

      const hp = headPos(points, headS);
      drawMarker(hp.x, hp.y, 1);
    }

    if (phase === 4 || phase === 5){
      drawVisibleSegments();
      for (let i=0;i<N;i++){
        if (!yearVisible[i]) continue;
        const p = points[i];
        const noteY = p.y - 130*DPR;
        drawNote(p.x, noteY, p.year, 1, 1);
        drawPin(p.x, noteY, 1, 1);
      }
      if (phase === 5 && sweepIndex < N){
        drawMarker(points[sweepIndex].x, points[sweepIndex].y, 1);
      }
    }

    endCamera();

    // ---------- Overlays ----------
    if (phase === 3){
      const hold = 4.0;
      const fade = 0.6;
      let a = 1;
      if (phaseT > hold) a = 1 - clamp((phaseT - hold)/fade, 0, 1);
      drawFadeOverlay(0.35);
      drawNeonText("tạm biệt", a, H*0.52, 86);
    }

    if (phase === 5){
      drawFadeOverlay(0.05);
      drawShatter(); // real “rụng từng mảnh”
    }

    if (phase === 6){
      drawFadeOverlay(0.35);
      drawNeonText("chào mừng", 1.0, H*0.52, 80);
    }

    if (phase === 7){
      drawFadeOverlay(0.28);
      drawLetters();
    }

    if (phase === 8){
      drawFadeOverlay(0.55);

      const cx = W*0.5;
      const cy = H*0.54;

      // spotlight straight down
      drawSpotlightBeam(cx, cy);

      // 2026 big note
      drawNote(cx, cy, "2026", 1, 1.65);
      drawPin(cx, cy, 1, 1.65);

      // orbit dots + trail + blob
      drawOrbitDots(cx, cy);
      drawTrail(timeSec);
      updateAndDrawGreenBlob(cx, cy, dt, timeSec);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- Helpers for spotlight ----------
  function drawSpotlightBeam(cx, cy){
    ctx.save();
    const topY = -40*DPR;
    const beamWTop = 70*DPR;
    const beamWBot = 260*DPR;
    const botY = cy + 30*DPR;

    ctx.beginPath();
    ctx.moveTo(cx - beamWTop/2, topY);
    ctx.lineTo(cx + beamWTop/2, topY);
    ctx.lineTo(cx + beamWBot/2, botY);
    ctx.lineTo(cx - beamWBot/2, botY);
    ctx.closePath();

    const g = ctx.createLinearGradient(cx, topY, cx, botY);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.50, 'rgba(0,255,210,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fill();

    const rg = ctx.createRadialGradient(cx, cy-10*DPR, 20*DPR, cx, cy, 280*DPR);
    rg.addColorStop(0, 'rgba(235,255,255,0.22)');
    rg.addColorStop(0.35, 'rgba(0,255,210,0.12)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0,0,W,H);

    ctx.restore();
  }

  // ---------- Controls ----------
  if (soundBtn){
    // [REPLACE] Khi đang khóa: bấm soundBtn sẽ mở khóa.
    //          Khi đã mở: soundBtn toggle âm + mp3.
    soundBtn.addEventListener('click', () => {
      if (!unlocked) unlockPage();
      else setSound(!Audio.on);
    });
  }

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  });

  restartBtn.addEventListener('click', () => resetAll());

  addEventListener('keydown', (e) => {
    if (e.code === 'Space'){
      e.preventDefault();
      paused = !paused;
      pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
    }
    if (e.key.toLowerCase() === 'r') resetAll();

    // [REPLACE] phím M đồng bộ với mp3 + hỗ trợ mở khóa
    if (e.key.toLowerCase() === 'm' && soundBtn){
      Audio.resume();
      if (!unlocked) unlockPage();
      else setSound(!Audio.on);
    }
  }, {passive:false});

  setSoundUI();
  resetAll();
})();
