(function(){
  "use strict";

  /* =====================================================================
     CONFIG — ubah teks di sini untuk personalisasi
  ===================================================================== */
  const CONFIG = {
    name: "Riri",
    letterLines: [
      "Selamat ulang tahun, Riri.",
      "Ada satu hal yang mungkin belum pernah kamu sadari — setiap orang punya satu hari dalam setahun yang terasa sedikit lebih ajaib dibanding hari-hari lainnya.",
      "Dan hari itu adalah hari ini.",
      "Semoga tahun ini membawa lebih banyak alasan untuk tersenyum, lebih banyak momen untuk disyukuri, dan lebih banyak cahaya di setiap langkahmu.",
      "Makasih ya udah jadi teman yang selalu asik diajak cerita, ngeluh, sampe hal receh sekalipun. Semoga di umur yang baru ini kamu makin sering ketawa lepas, makin jarang overthinking, dan makin yakin sama langkah yang kamu ambil."
    ],
    wishes: [
      "Semoga makin percaya sama proses & usaha kamu sendiri, jangan pernah dengerin omongan orang lain, fokus diri kamu sendiri.",
      "Semoga rezeki dan kesempatan baik terus mendekat.",
      "Semoga kebahagiaan selalu datang dalam bentuk yang tak terduga.",
      "Semoga selalu dikelilingi orang-orang yang tulus sayang.",
      "Semoga hari-harinya tetap seru kayak playlist favorit kamu.",
      "Semoga sehat terus, lahir batin, sekarang sampai nanti."
    ],
    finalMessage: "Riri, semoga setiap hari ke depan dipenuhi alasan untuk tersenyum, semua impian yang selama ini kamu simpan pelan-pelan menjadi nyata, dan setiap langkahmu selalu membawa kebahagiaan.",
    constellationLines: ["Happy", "Birthday"]
  };

  document.getElementById("letter-heading").textContent = "Untuk " + CONFIG.name + ",";

  /* =====================================================================
     UTILITIES
  ===================================================================== */
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const easeOutCubic = t => 1 - Math.pow(1-t, 3);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function show(el){ el.classList.add("active"); }
  function hide(el){ el.classList.remove("active"); }
  function goTo(id){
    document.querySelectorAll(".scene").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  /* =====================================================================
     AUDIO — ambient pad + soft chimes, fully synthesized (no external files)
  ===================================================================== */
  const AudioMgr = (function(){
    let ctx = null, master = null, padGain = null, muted = false, started = false;

    function init(){
      if(started) return;
      started = true;
      try{
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.55;
        master.connect(ctx.destination);
        startPad();
      }catch(e){ /* audio unavailable, fail silently */ }
    }

    function startPad(){
      if(!ctx) return;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      filter.connect(master);

      padGain = ctx.createGain();
      padGain.gain.value = 0.0;
      padGain.connect(filter);
      padGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 3);

      const freqs = [130.81, 164.81, 196.0]; // C3, E3, G3 - soft pad
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.05 + i*0.02;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(padGain);
        osc.start();
        lfo.start();
      });
    }

    function chime(freq = 660, dur = 1.2, delay = 0){
      if(!ctx) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    }

    function chimeSequence(freqs, gap = 0.18, dur = 1.0){
      freqs.forEach((f, i) => chime(f, dur, i*gap));
    }

    function toggleMute(){
      muted = !muted;
      if(master) master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, ctx.currentTime + 0.3);
      return muted;
    }

    return { init, chime, chimeSequence, toggleMute };
  })();

  const muteBtn = document.getElementById("mute-btn");
  muteBtn.addEventListener("click", () => {
    const isMuted = AudioMgr.toggleMute();
    muteBtn.textContent = isMuted ? "🔇" : "🔈";
  });

  /* =====================================================================
     BACKGROUND STARFIELD CANVAS (ambient stars + meteors + warp)
  ===================================================================== */
  const bgCanvas = document.getElementById("bg-canvas");
  const bgCtx = bgCanvas.getContext("2d");
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let stars = [];
  let meteors = [];
  let warp = { active:false, t:0, duration: 2.4 };
  let lastTime = performance.now();

  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    bgCanvas.width = W * DPR; bgCanvas.height = H * DPR;
    bgCanvas.style.width = W+"px"; bgCanvas.style.height = H+"px";
    bgCtx.setTransform(DPR,0,0,DPR,0,0);

    fxCanvas.width = W * DPR; fxCanvas.height = H * DPR;
    fxCanvas.style.width = W+"px"; fxCanvas.style.height = H+"px";
    fxCtx.setTransform(DPR,0,0,DPR,0,0);

    buildStars();
  }

  function buildStars(){
    const count = prefersReducedMotion ? 90 : Math.floor((W*H) / 3600);
    stars = [];
    for(let i=0;i<count;i++){
      stars.push({
        x: rand(0,W), y: rand(0,H),
        r: rand(0.4, 1.6),
        base: rand(0.25, 0.9),
        phase: rand(0, Math.PI*2),
        speed: rand(0.6, 1.6)
      });
    }
  }

  function spawnMeteor(){
    const fromLeft = Math.random() < 0.5;
    const y0 = rand(0, H*0.5);
    meteors.push({
      x: fromLeft ? rand(-50,W*0.3) : rand(W*0.7, W+50),
      y: y0,
      vx: fromLeft ? rand(260,380) : -rand(260,380),
      vy: rand(90,150),
      life: 0, maxLife: rand(0.6,1.0),
      len: rand(70,140)
    });
  }

  let meteorTimer = rand(2,5);

  function drawBackground(dt){
    // sky gradient
    const g = bgCtx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, "#04051a");
    g.addColorStop(0.55, "#070a24");
    g.addColorStop(1, "#0b0e2e");
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0,0,W,H);

    const t = performance.now()/1000;

    if(warp.active){
      warp.t += dt;
      const p = clamp(warp.t / warp.duration, 0, 1);
      const intensity = Math.sin(p*Math.PI); // rises then falls
      const cx = W/2, cy = H/2;
      stars.forEach(s => {
        const dx = s.x - cx, dy = s.y - cy;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const nx = dx/dist, ny = dy/dist;
        const streak = intensity * 90 * (0.4 + s.r);
        bgCtx.strokeStyle = `rgba(255,255,255,${0.15 + intensity*0.45})`;
        bgCtx.lineWidth = s.r * 0.8;
        bgCtx.beginPath();
        bgCtx.moveTo(s.x, s.y);
        bgCtx.lineTo(s.x + nx*streak, s.y + ny*streak);
        bgCtx.stroke();
      });
      if(warp.t >= warp.duration){ warp.active = false; warp.onDone && warp.onDone(); }
    } else {
      stars.forEach(s => {
        const a = s.base + Math.sin(t*s.speed + s.phase)*0.3;
        bgCtx.beginPath();
        bgCtx.fillStyle = `rgba(253,246,227,${clamp(a,0,1)})`;
        bgCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        bgCtx.fill();
      });

      // ambient meteors
      meteorTimer -= dt;
      if(meteorTimer <= 0 && !prefersReducedMotion){
        spawnMeteor();
        meteorTimer = rand(3.5, 7);
      }
      meteors.forEach(m => {
        m.life += dt;
        m.x += m.vx*dt; m.y += m.vy*dt;
        const p = m.life/m.maxLife;
        const alpha = 1-p;
        const ang = Math.atan2(m.vy, m.vx);
        const tx = m.x - Math.cos(ang)*m.len;
        const ty = m.y - Math.sin(ang)*m.len;
        const grad = bgCtx.createLinearGradient(m.x,m.y,tx,ty);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        bgCtx.strokeStyle = grad;
        bgCtx.lineWidth = 1.6;
        bgCtx.beginPath();
        bgCtx.moveTo(m.x, m.y);
        bgCtx.lineTo(tx, ty);
        bgCtx.stroke();
      });
      meteors = meteors.filter(m => m.life < m.maxLife && m.x > -100 && m.x < W+100);
    }
  }

  function startWarp(duration, onDone){
    warp.active = true; warp.t = 0; warp.duration = duration;
    warp.onDone = onDone;
  }

  /* =====================================================================
     FX CANVAS — particle systems (constellation, sparkles, fireworks)
  ===================================================================== */
  const fxCanvas = document.getElementById("fx-canvas");
  const fxCtx = fxCanvas.getContext("2d");

  let sparkles = [];       // gentle falling dust during letter reading
  let conParticles = [];   // constellation formation particles
  let fireworks = [];      // firework burst particles
  let sparkleActive = false;
  let conActive = false;

  function spawnSparkle(){
    sparkles.push({
      x: rand(0,W), y: -10,
      vy: rand(18,34), vx: rand(-6,6),
      r: rand(0.6,1.6),
      life: 0, maxLife: rand(4,7),
      alpha: rand(0.4,0.9)
    });
  }
  let sparkleTimer = 0;

  function textToPoints(lines, maxPoints){
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    octx.fillStyle = "#fff";
    const fontSize = clamp(W*0.11, 46, 130);
    octx.font = `700 ${fontSize}px 'Dancing Script', cursive`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    const lineHeight = fontSize * 1.05;
    const startY = H/2 - ((lines.length-1)*lineHeight)/2;
    lines.forEach((line, i) => {
      octx.fillText(line, W/2, startY + i*lineHeight);
    });
    const data = octx.getImageData(0,0,W,H).data;
    const pts = [];
    const step = Math.max(2, Math.floor(Math.sqrt((W*H)/ (maxPoints*140))));
    for(let y=0; y<H; y+=step){
      for(let x=0; x<W; x+=step){
        const idx = (y*W + x)*4 + 3;
        if(data[idx] > 120){ pts.push({x,y}); }
      }
    }
    // shuffle & trim
    for(let i=pts.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pts[i],pts[j]]=[pts[j],pts[i]]; }
    return pts.slice(0, maxPoints);
  }

  function startConstellation(originRect, lines, onSettled){
    conActive = true;
    const maxPoints = prefersReducedMotion ? 220 : 650;
    const targets = textToPoints(lines, maxPoints);
    conParticles = targets.map(t => {
      const ox = originRect.x + rand(-originRect.w*0.4, originRect.w*0.4);
      const oy = originRect.y + rand(-originRect.h*0.4, originRect.h*0.4);
      return {
        x: ox, y: oy,
        tx: t.x, ty: t.y,
        delay: rand(0, 0.5),
        dur: rand(1.3, 2.0),
        t: 0,
        size: rand(1.1, 2.4),
        twinklePhase: rand(0, Math.PI*2)
      };
    });
    // settle callback once most particles have arrived
    const totalDur = 2.6;
    setTimeout(() => { onSettled && onSettled(); }, totalDur*1000);
  }

  function stopConstellationFadeOut(){
    const fadeStart = performance.now();
    const dur = 900;
    function step(){
      const p = (performance.now()-fadeStart)/dur;
      conParticles.forEach(pt => pt.fadeAlpha = 1-p);
      if(p < 1){ requestAnimationFrame(step); } else { conActive = false; conParticles = []; }
    }
    step();
  }

  function launchFirework(x, y, colorSet){
    const count = prefersReducedMotion ? 18 : 46;
    for(let i=0;i<count;i++){
      const ang = (Math.PI*2/count)*i + rand(-0.1,0.1);
      const speed = rand(90, 220);
      fireworks.push({
        x, y,
        vx: Math.cos(ang)*speed,
        vy: Math.sin(ang)*speed,
        life: 0, maxLife: rand(0.8,1.3),
        color: colorSet[Math.floor(rand(0,colorSet.length))],
        size: rand(1.4,2.6)
      });
    }
  }

  const FIREWORK_COLORS = ["#f4c95d", "#fdf6e3", "#ff9166", "#b8a6d9"];

  function drawFx(dt){
    fxCtx.clearRect(0,0,W,H);

    if(sparkleActive){
      sparkleTimer -= dt;
      if(sparkleTimer <= 0){ spawnSparkle(); sparkleTimer = rand(0.25,0.6); }
      sparkles.forEach(s => {
        s.life += dt;
        s.y += s.vy*dt; s.x += s.vx*dt;
        const p = s.life/s.maxLife;
        const a = s.alpha * (1-p);
        fxCtx.beginPath();
        fxCtx.fillStyle = `rgba(244,201,93,${clamp(a,0,1)})`;
        fxCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        fxCtx.fill();
      });
      sparkles = sparkles.filter(s => s.life < s.maxLife);
    }

    if(conActive && conParticles.length){
      const t = performance.now()/1000;
      conParticles.forEach(pt => {
        pt.t += dt;
        const local = clamp((pt.t - pt.delay)/pt.dur, 0, 1);
        const e = easeOutCubic(local);
        const cx = lerp(pt.x, pt.tx, e);
        const cy = lerp(pt.y, pt.ty, e);
        const twinkle = local >= 1 ? (0.7 + Math.sin(t*2 + pt.twinklePhase)*0.3) : 1;
        const alpha = (pt.fadeAlpha !== undefined ? pt.fadeAlpha : 1) * twinkle;
        fxCtx.beginPath();
        fxCtx.fillStyle = `rgba(253,246,227,${clamp(alpha,0,1)})`;
        fxCtx.shadowColor = "rgba(244,201,93,0.8)";
        fxCtx.shadowBlur = 6;
        fxCtx.arc(cx, cy, pt.size, 0, Math.PI*2);
        fxCtx.fill();
      });
      fxCtx.shadowBlur = 0;
    }

    if(fireworks.length){
      fireworks.forEach(p => {
        p.life += dt;
        p.vy += 90*dt; // gravity
        p.x += p.vx*dt; p.y += p.vy*dt;
        const a = 1 - (p.life/p.maxLife);
        fxCtx.beginPath();
        fxCtx.fillStyle = p.color;
        fxCtx.globalAlpha = clamp(a,0,1);
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        fxCtx.fill();
        fxCtx.globalAlpha = 1;
      });
      fireworks = fireworks.filter(p => p.life < p.maxLife);
    }
  }

  /* =====================================================================
     MAIN RENDER LOOP
  ===================================================================== */
  function frame(now){
    const dt = Math.min((now-lastTime)/1000, 0.05);
    lastTime = now;
    drawBackground(dt);
    drawFx(dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  /* =====================================================================
     TYPEWRITER
  ===================================================================== */
  function typeLines(container, lines, speed, onDone){
    let li = 0;
    function nextLine(){
      if(li >= lines.length){ onDone && onDone(); return; }
      const p = document.createElement("p");
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      p.appendChild(cursor);
      container.appendChild(p);
      const text = lines[li];
      let ci = 0;
      (function typeChar(){
        if(ci < text.length){
          cursor.insertAdjacentText("beforebegin", text[ci]);
          ci++;
          setTimeout(typeChar, speed);
        } else {
          cursor.remove();
          li++;
          setTimeout(nextLine, 480);
        }
      })();
    }
    nextLine();
  }

  /* =====================================================================
     SCENE FLOW
  ===================================================================== */

  // ---- INTRO -> ENVELOPE ----
  document.getElementById("btn-start").addEventListener("click", () => {
    AudioMgr.init();
    goTo("scene-letter");
    startWarp(prefersReducedMotion ? 0.6 : 2.4, () => {
      const env = document.getElementById("envelope");
      env.classList.add("show");
      AudioMgr.chime(880, 1.4);
    });
  });

  // ---- ENVELOPE CLICK -> OPEN -> LETTER CARD ----
  const envelope = document.getElementById("envelope");
  const letterCard = document.getElementById("letter-card");
  const letterBody = document.getElementById("letter-body");
  const letterContinue = document.getElementById("letter-continue");

  envelope.addEventListener("click", () => {
    if(envelope.classList.contains("open")) return;
    envelope.classList.add("open");
    AudioMgr.chimeSequence([660, 880, 1320], 0.12, 1.2);
    setTimeout(() => {
      envelope.classList.add("hide");
      letterCard.classList.add("show");
      sparkleActive = true;
      typeLines(letterBody, CONFIG.letterLines, 28, () => {
        letterContinue.classList.add("show");
      });
    }, 900);
  });

  // ---- LETTER CONTINUE -> DISSOLVE -> CONSTELLATION ----
  document.getElementById("btn-letter-continue").addEventListener("click", () => {
    sparkleActive = false;
    const rect = letterCard.getBoundingClientRect();
    letterCard.classList.add("dissolve");
    AudioMgr.chime(520, 1.6);

    setTimeout(() => {
      goTo("scene-constellation");
      const originRect = { x: rect.left+rect.width/2, y: rect.top+rect.height/2, w: rect.width, h: rect.height };
      startConstellation(originRect, CONFIG.constellationLines, () => {
        document.getElementById("constellation-caption").classList.add("show");
        document.getElementById("btn-constellation-continue").classList.remove("hidden");
        AudioMgr.chimeSequence([523.25, 659.25, 783.99, 1046.5], 0.22, 1.8);
      });
    }, 950);
  });

  // ---- CONSTELLATION -> WISHES ----
  document.getElementById("btn-constellation-continue").addEventListener("click", () => {
    stopConstellationFadeOut();
    goTo("scene-wishes");
    runWishes();
  });

  // ---- WISHES SEQUENCE (auto-advancing meteors) ----
  function runWishes(){
    const wishText = document.getElementById("wish-text");
    const progress = document.getElementById("wish-progress");
    progress.innerHTML = "";
    CONFIG.wishes.forEach(() => {
      const dot = document.createElement("span");
      dot.className = "wish-dot";
      progress.appendChild(dot);
    });
    const dots = progress.querySelectorAll(".wish-dot");

    let i = 0;
    function nextWish(){
      if(i >= CONFIG.wishes.length){
        setTimeout(() => { goTo("scene-island"); }, 1400);
        return;
      }
      dots.forEach(d => d.classList.remove("active"));
      dots[i].classList.add("active");
      wishText.classList.remove("show");
      spawnMeteor();
      AudioMgr.chime(rand(500,800), 1.0);
      setTimeout(() => {
        wishText.textContent = CONFIG.wishes[i];
        wishText.classList.add("show");
      }, 500);
      i++;
      setTimeout(nextWish, 4200);
    }
    nextWish();
  }

  // ---- ISLAND: CANDLE CLICK -> BLOW OUT -> FIREWORKS -> FINAL ----
  const candle = document.getElementById("candle");
  const flame = document.getElementById("flame");
  const smoke = document.getElementById("candle-smoke");
  const islandInstruction = document.getElementById("island-instruction");
  let candleBlown = false;

  candle.addEventListener("click", () => {
    if(candleBlown) return;
    candleBlown = true;
    flame.classList.add("out");
    smoke.classList.add("show");
    islandInstruction.classList.add("done");
    AudioMgr.chime(220, 0.9);

    const rect = candle.getBoundingClientRect();
    const startX = rect.left + rect.width/2;
    const startY = rect.top;

    let bursts = 0;
    const totalBursts = prefersReducedMotion ? 2 : 5;
    const burstInterval = setInterval(() => {
      const bx = startX + rand(-120,120);
      const by = clamp(startY + rand(-140,20), 40, H*0.6);
      launchFirework(bx, by, FIREWORK_COLORS);
      AudioMgr.chime(rand(700,1100), 0.6);
      bursts++;
      if(bursts >= totalBursts){
        clearInterval(burstInterval);
        setTimeout(() => { showFinal(); }, 1600);
      }
    }, 550);
  });

  // ---- FINAL SCENE ----
  function showFinal(){
    goTo("scene-final");
    const nameEl = document.getElementById("final-name");
    const subEl = document.getElementById("final-sub");
    const msgEl = document.getElementById("final-msg");
    const btn = document.getElementById("btn-final-continue");

    nameEl.textContent = CONFIG.name;
    setTimeout(() => nameEl.classList.add("show"), 200);
    setTimeout(() => subEl.classList.add("show"), 900);
    setTimeout(() => {
      msgEl.textContent = CONFIG.finalMessage;
      msgEl.classList.add("show");
      AudioMgr.chimeSequence([392, 523.25, 659.25], 0.25, 1.6);
    }, 1700);
    setTimeout(() => btn.classList.remove("hidden"), 3400);
  }

  document.getElementById("btn-final-continue").addEventListener("click", () => {
    goTo("scene-ending");
    setTimeout(() => {
      document.getElementById("ending-text").classList.add("show");
      AudioMgr.chime(1046.5, 2.2);
    }, 1200);
    setTimeout(() => {
      document.getElementById("blackout").classList.add("on");
    }, 4200);
  });

})();