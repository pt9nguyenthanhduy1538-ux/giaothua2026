(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  const btnBack  = document.getElementById("btnBack");
  const btnPause = document.getElementById("btnPause");
  const btnAuto  = document.getElementById("btnAuto");
  const btnMute  = document.getElementById("btnMute");

  // Overlay + nhạc mp3
  const startOverlay = document.getElementById("startOverlay");
  const btnStart = document.getElementById("btnStart");
  const bgm = document.getElementById("bgm");

  // ---------- Utils ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, t) => {
    t = clamp((t - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeInOutCubic = (t) => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // ---------- Resize ----------
  let W=0, H=0, DPR=1;
  function resize() {
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);

  // ---------- Palette ----------
  const palette = {
    bg: "#000000",
    leaf:    { r: 170, g: 255, b: 220 },
    leaf2:   { r: 110, g: 255, b: 170 },
    white:   { r: 245, g: 255, b: 252 },
    accent1: { r: 150, g: 210, b: 255 },
    accent2: { r: 210, g: 160, b: 255 },
    stamen:  { r: 255, g: 214, b: 120 },
    stamen2: { r: 255, g: 185, b: 80  },
  };
  const rgba = (c, a) => `rgba(${c.r|0},${c.g|0},${c.b|0},${a})`;

  // ---------- Scene timing (tụ lâu hơn) ----------
  const phaseDur = [2.2, 8.4, 3.4, 2.9, 7.6, 4.4];
  const totalDur = phaseDur.reduce((a,b)=>a+b,0);
  function getPhase(time) {
    let acc=0;
    for (let i=0;i<phaseDur.length;i++){
      const d=phaseDur[i];
      if (time < acc+d) return { idx:i, localT:(time-acc)/d, acc };
      acc+=d;
    }
    return { idx: phaseDur.length-1, localT:1, acc: totalDur-phaseDur[phaseDur.length-1] };
  }

  // ---------- Orbit controls (drag rotate + zoom) ----------
  const orbit = {
    yaw: 0, pitch: -0.18, zoom: 1.0,
    dragging: false, lastX: 0, lastY: 0,
    auto: true,
    ROT_PERIOD: 18.0 // 360° / 18s
  };

  function clampPitch(p){ return clamp(p, -0.95, 0.28); }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    orbit.dragging = true;
    orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!orbit.dragging) return;
    const dx = e.clientX - orbit.lastX;
    const dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    orbit.yaw += dx * 0.006;
    orbit.pitch = clampPitch(orbit.pitch + dy * 0.004);
  });
  canvas.addEventListener("pointerup", (e) => {
    orbit.dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    orbit.zoom = clamp(orbit.zoom * (delta > 0 ? 1.06 : 0.94), 0.7, 1.6);
  }, { passive:false });

  // pinch zoom
  let pinchDist = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist = Math.hypot(dx, dy);
    }
  }, { passive:true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length === 2 && pinchDist != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const ratio = d / pinchDist;
      orbit.zoom = clamp(orbit.zoom * ratio, 0.7, 1.6);
      pinchDist = d;
    }
  }, { passive:true });
  canvas.addEventListener("touchend", (e) => {
    if (!e.touches || e.touches.length < 2) pinchDist = null;
  }, { passive:true });

  // ---------- Projection ----------
  const cam = { fov: 520, zOff: 720, spin: 0 };

  function rotateY(x, z, a) {
    const cs=Math.cos(a), sn=Math.sin(a);
    return { x: x*cs + z*sn, z: -x*sn + z*cs };
  }
  function rotateX(y, z, a) {
    const cs=Math.cos(a), sn=Math.sin(a);
    return { y: y*cs - z*sn, z: y*sn + z*cs };
  }
  function project3D(x, y, z, cx, cy) {
    let ry = rotateY(x, z, orbit.yaw); x = ry.x; z = ry.z;
    let rx = rotateX(y, z, orbit.pitch); y = rx.y; z = rx.z;

    const cs=Math.cos(cam.spin), sn=Math.sin(cam.spin);
    const xx = x*cs - y*sn;
    const yy = x*sn + y*cs;

    const depth = (cam.zOff / orbit.zoom + z);
    const s = (cam.fov * orbit.zoom) / Math.max(90, depth);
    return { x: cx + xx*s, y: cy + yy*s, s, depth };
  }

  // ---------- Music (mp3) ----------
  const music = {
    started: false,
    muted: false,
    volume: 0.55,
  };

  function playMusic() {
    if (!bgm) return;
    bgm.loop = true;
    bgm.volume = music.volume;
    bgm.muted = music.muted;
    const p = bgm.play();
    if (p && typeof p.catch === "function") p.catch(()=>{});
    music.started = true;
    updateMuteBtn();
  }

  function stopMusic() {
    if (!bgm) return;
    bgm.pause();
  }

  function updateMuteBtn() {
    btnMute.textContent = music.muted ? "🔇 âm thanh: OFF" : "🔊 âm thanh: ON";
  }

  // ---------- FULLSCREEN (THÊM) ----------
  function goFullscreen(el = document.documentElement) {
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||   // Safari
      el.msRequestFullscreen;         // old Edge
    if (!fn) return;
    try {
      const p = fn.call(el);
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  // Giữ lại hàm gọi trong effect (nhưng không dùng SFX nữa)
  function whoosh(){ /* no-op */ }
  function sparkle(){ /* no-op */ }

  // ---------- Visual: Vignette ----------
  function drawVignette(){
    const g = ctx.createRadialGradient(W*0.5, H*0.5, Math.min(W,H)*0.1, W*0.5, H*0.5, Math.max(W,H)*0.78);
    g.addColorStop(0,"rgba(0,0,0,0)");
    g.addColorStop(1,"rgba(0,0,0,0.78)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
  }

  // ---------- Stars ----------
  class Star {
    constructor(){ this.reset(true); }
    reset(init=false){
      this.baseR = rand(0.6,1.9);
      this.tw = rand(0,TAU);
      this.twSpd = rand(0.8,2.2);
      this.p = rand(0.15,1.0);

      const ang = rand(0,TAU);
      const rad = Math.pow(Math.random(),0.3)*Math.min(W,H)*rand(0.35,0.70);
      this.x = Math.cos(ang)*rad;
      this.y = Math.sin(ang)*rad;
      this.z = init ? rand(-200,900) : rand(-500,800);
    }
    update(dt, swirlAmt, pullAmt, omega){
      this.tw += dt*this.twSpd;

      const ang = omega*dt*(0.30+0.70*swirlAmt);
      const cs=Math.cos(ang), sn=Math.sin(ang);
      const x=this.x, y=this.y;
      this.x = x*cs - y*sn;
      this.y = x*sn + y*cs;

      const pull = pullAmt*dt;
      this.x *= (1-pull);
      this.y *= (1-pull);

      this.z += dt*lerp(5,42,swirlAmt)*(0.15+0.85*pullAmt);
      if (this.z>1400) this.z=-650;

      if (pullAmt>0.8 && (this.x*this.x+this.y*this.y)<14) this.reset(false);
    }
    draw(cx, cy, swirlAmt, fogAmt){
      const pr = project3D(this.x,this.y,this.z,cx,cy);
      const tw = 0.65 + 0.35*Math.sin(this.tw);
      const r = this.baseR*(0.55+1.15*pr.s)*(0.9+0.4*swirlAmt);
      const a = clamp((0.10+0.55*this.p)*tw*(1-0.55*fogAmt), 0, 0.85);

      const c = (Math.random()<0.012 && swirlAmt>0.55) ? pick([palette.accent1,palette.accent2,palette.white]) : palette.white;

      ctx.beginPath();
      ctx.fillStyle = rgba(c,a);
      ctx.arc(pr.x,pr.y,r,0,TAU);
      ctx.fill();

      if (swirlAmt>0.45 && this.p>0.6){
        ctx.beginPath();
        ctx.fillStyle = rgba(c,a*0.26);
        ctx.arc(pr.x,pr.y,r*3.0,0,TAU);
        ctx.fill();
      }
    }
  }

  // ---------- Mist ----------
  class MistPuff{
    constructor(){ this.reset(); }
    reset(){
      this.x = rand(-0.1,1.1)*W;
      this.y = rand(-0.1,1.1)*H;
      this.r = rand(70,240);
      this.a = rand(0.02,0.07);
      this.vx = rand(-10,10);
      this.vy = rand(-6,6);
      this.c = pick([palette.white,palette.leaf,palette.accent2]);
    }
    update(dt, flow){
      this.x += this.vx*dt*flow;
      this.y += this.vy*dt*flow;
      if (this.x<-this.r) this.x=W+this.r;
      if (this.x>W+this.r) this.x=-this.r;
      if (this.y<-this.r) this.y=H+this.r;
      if (this.y>H+this.r) this.y=-this.r;
    }
    draw(fogAmt){
      const a = this.a*fogAmt;
      if (a<=0.0001) return;
      const g = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r);
      g.addColorStop(0, rgba(this.c,a));
      g.addColorStop(1, rgba(this.c,0));
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(this.x,this.y,this.r,0,TAU);
      ctx.fill();
    }
  }

  // ---------- Particles (3 loại) ----------
  class MagicDust{
    constructor(){ this.reset(true); this.prev=null; }
    reset(init=false){
      const ang=rand(0,TAU);
      const rad=Math.pow(Math.random(),0.55)*Math.min(W,H)*rand(0.25,1.0);
      this.x=Math.cos(ang)*rad; this.y=Math.sin(ang)*rad; this.z=init?rand(-150,650):rand(-350,650);
      this.vx=rand(-14,14); this.vy=rand(-8,18); this.vz=rand(-8,16);
      this.r=rand(0.7,2.2);
      this.c=(Math.random()<0.55)?palette.leaf:palette.leaf2;
      this.life=rand(3.5,8.5); this.age=rand(0,this.life);
      this.tw=rand(0,TAU); this.twSpd=rand(1.0,2.6);
      this.prev=null;
    }
    update(dt, swirlAmt, pullAmt, omega){
      this.age+=dt; this.tw+=dt*this.twSpd;
      this.prev={x:this.x,y:this.y,z:this.z};

      this.x+=this.vx*dt; this.y+=this.vy*dt; this.z+=this.vz*dt;

      const swirlK = lerp(0.10,1.0,smoothstep(0.2,1.0,swirlAmt));
      const ang = omega*dt*0.68*swirlK;
      const cs=Math.cos(ang), sn=Math.sin(ang);
      const x=this.x, y=this.y;
      this.x=x*cs - y*sn;
      this.y=x*sn + y*cs;

      const pull=(pullAmt*pullAmt)*dt*0.78;
      this.x*=(1-pull); this.y*=(1-pull);

      if (this.age>this.life) this.reset(false);
      if (Math.abs(this.x)>W*1.4 || Math.abs(this.y)>H*1.4) this.reset(false);
    }
    draw(cx,cy,fogAmt){
      const pr=project3D(this.x,this.y,this.z,cx,cy);
      const tw=0.7+0.3*Math.sin(this.tw);
      const a=clamp((0.11+0.20*tw)*(1-0.45*fogAmt),0,0.36);
      const rr=this.r*(0.6+pr.s)*(0.9+0.4*tw);

      if (this.prev){
        const pp=project3D(this.prev.x,this.prev.y,this.prev.z,cx,cy);
        ctx.beginPath();
        ctx.strokeStyle=rgba(this.c,a*0.35);
        ctx.lineWidth=Math.max(0.6,rr*0.8);
        ctx.moveTo(pp.x,pp.y); ctx.lineTo(pr.x,pr.y);
        ctx.stroke();
      }

      const g=ctx.createRadialGradient(pr.x,pr.y,0,pr.x,pr.y,rr*4.0);
      g.addColorStop(0, rgba(this.c,a*1.7));
      g.addColorStop(0.55, rgba(palette.leaf,a*0.65));
      g.addColorStop(1, rgba(palette.white,0));
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(pr.x,pr.y,rr*4.0,0,TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle=rgba(palette.white,a*0.55);
      ctx.arc(pr.x,pr.y,rr*0.9,0,TAU);
      ctx.fill();
    }
  }

  class LeafFlake{
    constructor(){ this.reset(true); }
    reset(init=false){
      this.x=rand(-0.55,0.55)*W;
      this.y=rand(-0.65,0.65)*H;
      this.z=init?rand(-180,520):rand(-260,520);
      this.vy=rand(18,55); this.vx=rand(-8,8);
      this.spin=rand(0,TAU); this.spinSpd=rand(-2.4,2.4);
      this.size=rand(1.2,3.2);
      this.c=pick([palette.leaf,palette.leaf2,palette.white]);
      this.life=rand(4,10); this.age=rand(0,this.life);
      this.wob=rand(0,TAU); this.wobSpd=rand(0.7,1.6);
    }
    update(dt, swirlAmt, pullAmt, omega){
      this.age+=dt; this.wob+=dt*this.wobSpd; this.spin+=dt*this.spinSpd;
      this.x += (this.vx + 10*Math.sin(this.wob))*dt;
      this.y += this.vy*dt;
      this.z += rand(-2,3)*dt;

      const swirlK = smoothstep(0.45,1.0,swirlAmt);
      if (swirlK>0){
        const ang = omega*dt*0.55*swirlK;
        const cs=Math.cos(ang), sn=Math.sin(ang);
        const x=this.x,y=this.y;
        this.x=x*cs - y*sn;
        this.y=x*sn + y*cs;

        const pull = pullAmt*dt*0.55*swirlK;
        this.x*=(1-pull); this.y*=(1-pull);
      }

      if (this.age>this.life || this.y>H*0.95) this.reset(false);
    }
    draw(cx,cy,fogAmt){
      const pr=project3D(this.x,this.y,this.z,cx,cy);
      const a=clamp(0.12*(1-0.35*fogAmt),0,0.22);
      const s=this.size*(0.65+pr.s);

      ctx.save();
      ctx.translate(pr.x,pr.y);
      ctx.rotate(this.spin);
      ctx.beginPath();
      ctx.fillStyle=rgba(this.c,a);
      ctx.ellipse(0,0,s*1.4,s*0.9,0,0,TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle=rgba(palette.white,a*0.35);
      ctx.ellipse(s*0.25,-s*0.10,s*0.55,s*0.35,0,0,TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  class Pollen{
    constructor(){ this.active=false; this.reset(0,0,0); }
    reset(x,y,z){
      this.active=true;
      this.x=x; this.y=y; this.z=z;
      const a=rand(0,TAU);
      const up=rand(0.2,1.0);
      const sp=rand(28,110);
      this.vx=Math.cos(a)*sp*(0.5+up);
      this.vy=Math.sin(a)*sp*(0.5+up);
      this.vz=rand(20,130);
      this.life=rand(0.9,2.2);
      this.age=0;
      this.r=rand(0.8,2.1);
      this.c=pick([palette.white,palette.leaf,palette.accent1]);
      this.tw=rand(0,TAU);
      this.twSpd=rand(2.0,4.6);
    }
    update(dt){
      if(!this.active) return;
      this.age+=dt; this.tw+=dt*this.twSpd;
      this.x+=this.vx*dt; this.y+=this.vy*dt; this.z+=this.vz*dt;
      this.vz-=60*dt;
      if (this.age>this.life) this.active=false;
    }
    draw(cx,cy,fogAmt){
      if(!this.active) return;
      const pr=project3D(this.x,this.y,this.z,cx,cy);
      const t=clamp(1-this.age/this.life,0,1);
      const tw=0.65+0.35*Math.sin(this.tw);
      const a=0.22*t*tw*(1-0.35*fogAmt);
      const rr=this.r*(0.65+pr.s);

      const g=ctx.createRadialGradient(pr.x,pr.y,0,pr.x,pr.y,rr*5.0);
      g.addColorStop(0, rgba(this.c,a*1.8));
      g.addColorStop(0.65, rgba(palette.white,a*0.35));
      g.addColorStop(1, rgba(palette.white,0));
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(pr.x,pr.y,rr*5.0,0,TAU);
      ctx.fill();
    }
  }

  // ---------- Core ----------
  const core = { r:0, energy:0, pulse:0 };

  function drawCore(cx, cy, size, energy, phaseGlow){
    const r = size;
    const glow = clamp(energy*0.9 + phaseGlow, 0, 1);

    ctx.beginPath();
    ctx.fillStyle = rgba(palette.white, 0.20 + 0.28*glow);
    ctx.arc(cx, cy, r*0.35, 0, TAU);
    ctx.fill();

    const g1 = ctx.createRadialGradient(cx, cy, r*0.10, cx, cy, r*1.25);
    g1.addColorStop(0, rgba(palette.white, 0.16 + 0.30*glow));
    g1.addColorStop(0.6, rgba(palette.leaf, 0.08 + 0.18*glow));
    g1.addColorStop(1, rgba(palette.accent2, 0));
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(cx, cy, r*1.25, 0, TAU);
    ctx.fill();

    const g2 = ctx.createRadialGradient(cx, cy, r*0.35, cx, cy, r*3.2);
    g2.addColorStop(0, rgba(palette.leaf, 0.06 + 0.14*glow));
    g2.addColorStop(0.7, rgba(palette.accent1, 0.03 + 0.10*glow));
    g2.addColorStop(1, rgba(palette.white, 0));
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, r*3.2, 0, TAU);
    ctx.fill();
  }

  // ---------- Stamens (nhị vàng) ----------
  function drawStamens(cx, cy, baseR, bloomT, glowFade){
    const t = easeOutCubic(bloomT);
    const count = 34;
    const len = baseR*0.55*(0.35+0.65*t);
    const spread = baseR*0.42*(0.25+0.75*t);

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR*1.25);
    halo.addColorStop(0, rgba(palette.stamen, 0.11*glowFade));
    halo.addColorStop(0.6, rgba(palette.stamen2, 0.06*glowFade));
    halo.addColorStop(1, rgba(palette.white, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR*1.25, 0, TAU);
    ctx.fill();

    for (let i=0;i<count;i++){
      const a = (i/count)*TAU + 0.25*Math.sin(i*0.7);
      const r0 = spread*(0.18 + 0.82*Math.random());
      const x0 = cx + Math.cos(a)*r0;
      const y0 = cy + Math.sin(a)*r0;
      const x1 = cx + Math.cos(a)*(r0+len);
      const y1 = cy + Math.sin(a)*(r0+len);

      ctx.beginPath();
      ctx.strokeStyle = rgba(palette.stamen2, 0.10*glowFade*(0.25+0.75*t));
      ctx.lineWidth = 1.0;
      ctx.moveTo(x0,y0);
      ctx.lineTo(x1,y1);
      ctx.stroke();

      const dotR = 1.2 + 1.8*Math.random();
      const g = ctx.createRadialGradient(x1,y1,0,x1,y1,dotR*5);
      g.addColorStop(0, rgba(palette.stamen, 0.24*glowFade));
      g.addColorStop(0.55, rgba(palette.stamen2, 0.13*glowFade));
      g.addColorStop(1, rgba(palette.white, 0));
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(x1,y1,dotR*5,0,TAU);
      ctx.fill();
    }
  }

  // ---------- Petals ----------
  class Petal3D {
    constructor(layerIdx, petalIdx, totalPetals){
      this.layerIdx=layerIdx;
      this.petalIdx=petalIdx;
      this.totalPetals=totalPetals;

      this.baseAng = (petalIdx/totalPetals)*TAU + rand(-0.03,0.03);
      this.baseR = lerp(28,160,layerIdx/3)*rand(0.92,1.08);
      this.baseZ = lerp(-45,120,layerIdx/3)+rand(-18,18);

      this.len = lerp(78,182,layerIdx/3)*rand(0.86,1.10);
      this.wid = lerp(30,96,layerIdx/3)*rand(0.82,1.22);

      this.open=0;
      this.wob=rand(0,TAU);
      this.wobSpd=rand(0.7,1.9);
      this.jitter=rand(0.7,2.2);

      this.cMain = (Math.random()<0.58)?palette.white:palette.leaf;
      this.cAccent = (Math.random()<0.22)?pick([palette.accent1,palette.accent2]):this.cMain;

      this.waveSeed=rand(0,1);
    }

    update(dt, openT, swirlResidue){
      const layerDelay = this.layerIdx * 0.16;
      const around = this.petalIdx / this.totalPetals;
      const wave = 0.26*around + 0.10*this.waveSeed;

      const burst1 = smoothstep(0.10,0.32,openT);
      const burst2 = smoothstep(0.36,0.64,openT);
      const burst3 = smoothstep(0.68,0.98,openT);
      const burstMix = clamp(0.55*burst1 + 0.30*burst2 + 0.15*burst3, 0, 1);

      const t = clamp((openT - layerDelay - wave) / (1 - layerDelay), 0, 1);
      this.open = easeInOutCubic(t) * (0.62 + 0.38*burstMix);

      this.wob += dt * this.wobSpd * (0.7 + 0.6*swirlResidue);
    }

    draw(cx, cy, bloomScale, glowFade, swirlResidue, pollenEmit){
      const ang = this.baseAng + swirlResidue*0.28*Math.sin(this.wob*0.9);
      const open = this.open;

      const r = this.baseR*bloomScale*(0.16+0.84*open);
      const x0 = Math.cos(ang)*r;
      const y0 = Math.sin(ang)*r;
      const z0 = this.baseZ*bloomScale + (1-open)*55;

      const tipR = r + this.len*bloomScale*(0.20+0.80*open);
      const xTip = Math.cos(ang)*tipR;
      const yTip = Math.sin(ang)*tipR;
      const zTip = z0 + (55+150*open)*bloomScale;

      const sideAng = ang + Math.PI/2;
      const wx = Math.cos(sideAng)*this.wid*bloomScale*(0.34+0.66*open);
      const wy = Math.sin(sideAng)*this.wid*bloomScale*(0.34+0.66*open);

      const xMid = lerp(x0,xTip,0.56);
      const yMid = lerp(y0,yTip,0.56);
      const zMid = lerp(z0,zTip,0.56) + (65+70*Math.sin(this.wob))*open*bloomScale;

      const P0 = project3D(x0,y0,z0,cx,cy);
      const P1 = project3D(xMid+wx,yMid+wy,zMid,cx,cy);
      const P2 = project3D(xTip,yTip,zTip,cx,cy);
      const P3 = project3D(xMid-wx,yMid-wy,zMid,cx,cy);

      const depthNorm = clamp((P0.depth-200)/900,0,1);
      const aBase = (0.11+0.30*open)*(0.75+0.25*(1-depthNorm));
      const a = aBase*glowFade;

      const gx=(P0.x+P2.x)*0.5;
      const gy=(P0.y+P2.y)*0.5;
      const gr=Math.max(12,Math.hypot(P2.x-P0.x,P2.y-P0.y))*0.55;

      const grad=ctx.createRadialGradient(gx,gy,0,gx,gy,gr);
      grad.addColorStop(0, rgba(this.cMain, clamp(0.16+0.30*open,0,0.58)*a*2.0));
      grad.addColorStop(0.55, rgba(this.cAccent, clamp(0.08+0.20*open,0,0.36)*a*1.7));
      grad.addColorStop(1, rgba(palette.white, 0));

      ctx.beginPath();
      ctx.moveTo(P0.x,P0.y);
      ctx.quadraticCurveTo(P1.x,P1.y,P2.x,P2.y);
      ctx.quadraticCurveTo(P3.x,P3.y,P0.x,P0.y);
      ctx.closePath();

      ctx.fillStyle=grad;
      ctx.fill();

      const rim=0.18*a*(0.6+0.4*Math.sin(this.wob*1.6));
      ctx.strokeStyle=rgba(palette.white,rim);
      ctx.lineWidth=Math.max(0.6,1.35*(P0.s+0.25));
      ctx.stroke();

      if (open>0.34){
        const halo=ctx.createRadialGradient(gx,gy,0,gx,gy,gr*1.95);
        halo.addColorStop(0, rgba(palette.leaf, 0.06*a*3.1));
        halo.addColorStop(0.55, rgba(palette.accent2, 0.03*a*3.0));
        halo.addColorStop(1, rgba(palette.white, 0));
        ctx.fillStyle=halo;
        ctx.beginPath();
        ctx.arc(gx,gy,gr*1.95,0,TAU);
        ctx.fill();
      }

      if (open>0.18 && Math.random()<0.14){
        const ex=lerp(P1.x,P2.x,Math.random());
        const ey=lerp(P1.y,P2.y,Math.random());
        const rr=rand(0.6,1.8)*(0.7+P0.s);
        ctx.beginPath();
        ctx.fillStyle=rgba(palette.leaf, 0.10*a*5.3);
        ctx.arc(ex+rand(-this.jitter,this.jitter), ey+rand(-this.jitter,this.jitter), rr, 0, TAU);
        ctx.fill();
      }

      if (pollenEmit && open>0.6 && Math.random()<0.018){
        pollenEmit(xTip,yTip,zTip);
      }
    }
  }

  // ---------- Build bloom ----------
  let petals = [];
  function buildBloom(){
    petals = [];
    const layers=[{count:10},{count:16},{count:22},{count:28}];
    layers.forEach((L,li)=>{
      for (let i=0;i<L.count;i++) petals.push(new Petal3D(li,i,L.count));
    });
    petals.sort((a,b)=>a.baseZ-b.baseZ);
  }

  // ---------- State ----------
  let stars=[], mist=[], dust=[], flakes=[], pollen=[];
  let t=0;
  let paused=false;

  function spawnPollen(x,y,z){
    for (let i=0;i<pollen.length;i++){
      if (!pollen[i].active){
        pollen[i].reset(x,y,z);
        return;
      }
    }
  }

  // ---------- UI actions ----------
  btnBack?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.assign("./trungtam.html");
  });

  btnPause?.addEventListener("click", () => {
    paused = !paused;
    btnPause.textContent = paused ? "▶ chạy" : "⏸ dừng";
  });

  btnAuto?.addEventListener("click", () => {
    orbit.auto = !orbit.auto;
    btnAuto.textContent = orbit.auto ? "🌀xoay tự động: ON" : "🌀xoay tự động: OFF";
  });

  btnMute?.addEventListener("click", () => {
    music.muted = !music.muted;
    if (bgm) bgm.muted = music.muted;
    updateMuteBtn();
  });

  window.addEventListener("keydown", (e)=>{
    if (e.code==="Space"){
      paused=!paused;
      btnPause.textContent = paused ? "▶ chạy" : "⏸ dừng";
    }
    if (e.key.toLowerCase()==="m"){
      music.muted=!music.muted;
      if (bgm) bgm.muted = music.muted;
      updateMuteBtn();
    }
  });

  // ---------- Start overlay unlock ----------
  function unlockStart(){
    // (THÊM) bấm là vào toàn màn hình
    goFullscreen(document.documentElement); // hoặc đổi thành goFullscreen(canvas)

    document.body.classList.remove("locked");
    startOverlay?.classList.add("hide");
    playMusic();
    // cho overlay biến hẳn sau khi fade
    setTimeout(() => { startOverlay?.remove(); }, 420);
  }
  btnStart?.addEventListener("click", unlockStart);
  startOverlay?.addEventListener("click", (e) => {
    // bấm nền cũng start (trừ khi click đúng nút thì đã xử lý)
    if (e.target === startOverlay) unlockStart();
  });

  // ---------- Init ----------
  function init(){
    resize();
    stars = Array.from({ length: Math.min(1200, Math.max(560, (W*H)/1500)) }, () => new Star());
    mist  = Array.from({ length: Math.min(22, Math.max(12, (W*H)/82000)) }, () => new MistPuff());
    dust  = Array.from({ length: Math.min(520, Math.max(260, (W*H)/4500)) }, () => new MagicDust());
    flakes= Array.from({ length: Math.min(180, Math.max(80,  (W*H)/16000)) }, () => new LeafFlake());
    pollen= Array.from({ length: 260 }, () => new Pollen());
    buildBloom();
    updateMuteBtn();
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function frame(now){
    const dt = Math.min(0.033, (now-last)/1000);
    last = now;

    if (!paused) t += dt;
    if (t > totalDur) t = totalDur;

    const ph = getPhase(t);
    const cx = W*0.5, cy = H*0.5;

    let swirlAmt=0, pullAmt=0, omega=0, fogAmt=0, bloomT=0, after=0;

    if (ph.idx===0){
      swirlAmt = 0.05*ph.localT;
      pullAmt = 0.0;
      omega = 0.22;
      fogAmt = 0.25*ph.localT;
    } else if (ph.idx===1){
      const e = easeInOutCubic(ph.localT);
      swirlAmt = lerp(0.10, 0.86, e);
      pullAmt  = lerp(0.0,  0.30, e);
      omega    = lerp(0.35, 4.8,  e);
      fogAmt   = lerp(0.25, 0.58, e);
    } else if (ph.idx===2){
      const e = smoothstep(0,1,ph.localT);
      swirlAmt = lerp(0.86, 1.0,  e);
      pullAmt  = lerp(0.30, 1.55, e);
      omega    = lerp(4.8,  18.5, e);
      fogAmt   = lerp(0.58, 0.70, e);
      whoosh(0.30 + 0.70*e);
    } else if (ph.idx===3){
      const e = easeInOutCubic(ph.localT);
      swirlAmt = lerp(0.96, 0.52, e);
      pullAmt  = lerp(0.95, 0.10, e);
      omega    = lerp(11.0, 2.4,  e);
      fogAmt   = lerp(0.70, 0.80, e);
    } else if (ph.idx===4){
      const e = easeInOutCubic(ph.localT);
      swirlAmt = lerp(0.42, 0.06, e);
      pullAmt  = lerp(0.10, 0.0,  e);
      omega    = lerp(1.5,  0.28, e);
      fogAmt   = lerp(0.80, 0.92, e);
      bloomT   = e;
      if (Math.random()<0.10) sparkle(0.25 + 0.55*e);
    } else {
      const e = easeInOutCubic(ph.localT);
      swirlAmt = lerp(0.06, 0.0, e);
      pullAmt  = 0.0;
      omega    = 0.08;
      fogAmt   = lerp(0.92, 0.65, e);
      bloomT   = 1;
      after    = e;
    }

    // Auto rotate 360°
    if (orbit.auto && !orbit.dragging && !paused){
      orbit.yaw = (orbit.yaw + (TAU/orbit.ROT_PERIOD)*dt) % TAU;
    }

    // clear
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0,0,W,H);

    if (!paused) cam.spin += dt*lerp(0.02,0.14,swirlAmt);

    // mist back
    const fogFlow = lerp(0.32, 1.0, swirlAmt);
    for (const m of mist) m.update(dt, fogFlow);
    for (const m of mist) m.draw(fogAmt*0.50);

    // stars
    for (const s of stars) s.update(dt, swirlAmt, pullAmt, omega);
    for (const s of stars) s.draw(cx, cy, swirlAmt, fogAmt);

    // particles
    for (const d of dust) d.update(dt, swirlAmt, pullAmt, omega);
    for (const f of flakes) f.update(dt, swirlAmt, pullAmt, omega);
    for (const f of flakes) f.draw(cx, cy, fogAmt);
    for (const d of dust) d.draw(cx, cy, fogAmt);

    drawVignette();

    // core dynamics
    let coreGrow = 0;
    if (ph.idx<=1) coreGrow = 0;
    else if (ph.idx===2) coreGrow = smoothstep(0.12,1.0,ph.localT)*0.78;
    else if (ph.idx===3) coreGrow = lerp(0.78,1.0,easeInOutCubic(ph.localT));
    else coreGrow = 1;

    const targetR = lerp(0, Math.min(W,H)*0.092, coreGrow);
    core.r = lerp(core.r, targetR, 0.06 + dt*2.6);
    core.energy = lerp(core.energy, clamp(swirlAmt*1.1 + pullAmt*0.35, 0, 1), 0.08 + dt*1.8);
    core.pulse += dt * (2.0 + 9.0*core.energy);

    let glowFade = 1;
    if (ph.idx===5) glowFade = lerp(1, 0.33, after);

    if (ph.idx>=2){
      const pulse = 1 + 0.08*Math.sin(core.pulse);
      const phaseGlow = (ph.idx===2)?0.35 : (ph.idx===3?0.55:0.25);
      drawCore(cx, cy, core.r*pulse, core.energy, phaseGlow*glowFade);
    }

    // bloom
    if (ph.idx>=4){
      const bloomScale = lerp(0.52, 1.0, bloomT);
      const swirlResidue = lerp(0.62, 0.04, bloomT);

      const order = petals
        .map(p => {
          const ang = p.baseAng;
          const r = p.baseR*bloomScale*(0.2+0.8*p.open);
          const x0 = Math.cos(ang)*r;
          const y0 = Math.sin(ang)*r;
          const z0 = p.baseZ*bloomScale + (1-p.open)*40;
          const pr = project3D(x0,y0,z0,cx,cy);
          return { p, d: pr.depth };
        })
        .sort((a,b)=>b.d-a.d);

      for (const o of order){
        o.p.update(dt, bloomT, swirlResidue);
        o.p.draw(cx, cy, bloomScale, glowFade, lerp(0.32,0.05,bloomT), spawnPollen);
      }

      // nhị vàng
      drawStamens(cx, cy, core.r*1.15, bloomT, glowFade);

      // heart glow
      const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, core.r*1.25);
      heart.addColorStop(0, rgba(palette.white, 0.12*glowFade));
      heart.addColorStop(0.6, rgba(palette.leaf, 0.08*glowFade));
      heart.addColorStop(1, rgba(palette.accent2, 0));
      ctx.fillStyle = heart;
      ctx.beginPath();
      ctx.arc(cx, cy, core.r*1.25, 0, TAU);
      ctx.fill();
    }

    // pollen
    for (const p of pollen) p.update(dt);
    for (const p of pollen) p.draw(cx, cy, fogAmt);

    // mist foreground
    for (const m of mist) m.draw(fogAmt);

    // afterglow
    if (ph.idx===5){
      const a = 0.06*(1-after);
      if (a>0.0001){
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0,0,W,H);
      }
    }

    requestAnimationFrame(frame);
  }

  // Boot
  init();
  requestAnimationFrame(frame);
})();
