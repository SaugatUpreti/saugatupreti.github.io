/* vWF polymer simulation — bead-spring under Couette shear */
(function() {
  'use strict';

  // A reusable chain simulator. Nodes (beads) connected by Hookean springs,
  // under a shear flow u_x(y) = gamma_dot * (y - y_mid).
  function makeChain(opts) {
    const o = Object.assign({
      N: 30,             // beads
      L0: 14,            // rest length
      k: 0.6,            // spring stiffness
      kAngle: 0.04,      // bending stiffness
      drag: 0.6,         // viscous drag coefficient
      kT: 0.35,          // thermal energy scale
      gamma: 0,          // shear rate
      W: 800, H: 400,    // canvas dims (logical)
      seed: 1,
    }, opts);

    let rng = mulberry32(o.seed);
    function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

    // Initialize as a tight coil near left third
    const cx = o.W * 0.22, cy = o.H * 0.5;
    const beads = [];
    let a = 0;
    for (let i = 0; i < o.N; i++) {
      // Spiral coil initial
      const r = 4 + i * 0.8;
      a += 0.55;
      beads.push({
        x: cx + r * Math.cos(a),
        y: cy + r * Math.sin(a),
        vx: 0, vy: 0,
      });
    }

    function step(dt) {
      const fx = new Float64Array(o.N), fy = new Float64Array(o.N);

      // Spring forces (FENE-like soft cap)
      for (let i = 0; i < o.N - 1; i++) {
        const dx = beads[i+1].x - beads[i].x;
        const dy = beads[i+1].y - beads[i].y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const stretch = d - o.L0;
        // finite-extensibility multiplier (soft)
        const maxE = o.L0 * 1.6;
        const fene = 1 / Math.max(0.15, 1 - Math.min(0.98, Math.abs(stretch)/maxE)**2);
        const f = o.k * stretch * fene;
        const ux = dx/d, uy = dy/d;
        fx[i]   += f * ux; fy[i]   += f * uy;
        fx[i+1] -= f * ux; fy[i+1] -= f * uy;
      }

      // Bending (angular spring on interior beads)
      for (let i = 1; i < o.N - 1; i++) {
        const ax = beads[i-1].x - beads[i].x;
        const ay = beads[i-1].y - beads[i].y;
        const bx = beads[i+1].x - beads[i].x;
        const by = beads[i+1].y - beads[i].y;
        const fxa = -o.kAngle * (ax + bx);
        const fya = -o.kAngle * (ay + by);
        fx[i] += fxa; fy[i] += fya;
        fx[i-1] -= fxa * 0.5; fy[i-1] -= fya * 0.5;
        fx[i+1] -= fxa * 0.5; fy[i+1] -= fya * 0.5;
      }

      // Soft excluded-volume so beads don't collapse onto each other
      for (let i = 0; i < o.N; i++) {
        for (let j = i + 2; j < Math.min(o.N, i + 8); j++) {
          const dx = beads[j].x - beads[i].x;
          const dy = beads[j].y - beads[i].y;
          const d2 = dx*dx + dy*dy;
          const rmin = o.L0 * 0.85;
          if (d2 < rmin * rmin && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const overlap = rmin - d;
            const f = 0.6 * overlap;
            const ux = dx/d, uy = dy/d;
            fx[i] -= f * ux; fy[i] -= f * uy;
            fx[j] += f * ux; fy[j] += f * uy;
          }
        }
      }

      // Integrate (overdamped Langevin)
      const ymid = o.H * 0.5;
      const noiseAmp = Math.sqrt(2 * o.kT * o.drag / dt);
      for (let i = 0; i < o.N; i++) {
        const b = beads[i];
        // Shear: ambient flow vx = gamma * (y - ymid)
        const flowVx = o.gamma * (b.y - ymid);
        const nx = (rng() - 0.5) * 2;
        const ny = (rng() - 0.5) * 2;
        const vx = (fx[i] + noiseAmp * nx) / o.drag + flowVx;
        const vy = (fy[i] + noiseAmp * ny) / o.drag;
        b.vx = vx; b.vy = vy;
        b.x += vx * dt;
        b.y += vy * dt;
        // Soft walls top/bot
        const pad = 20;
        if (b.y < pad) { b.y = pad; }
        if (b.y > o.H - pad) { b.y = o.H - pad; }
        // Wrap horizontally (treat as periodic box so chain stays visible)
        if (b.x < -50) b.x += o.W + 100;
        if (b.x > o.W + 50) b.x -= o.W + 100;
      }
    }

    function extension() {
      // end-to-end distance normalized by contour length
      const dx = beads[o.N-1].x - beads[0].x;
      const dy = beads[o.N-1].y - beads[0].y;
      const ete = Math.hypot(dx, dy);
      const contour = (o.N - 1) * o.L0;
      return { ete, ratio: Math.min(1, ete / contour) };
    }

    function setShear(g) { o.gamma = g; }
    function setTemp(T) { o.kT = T; }
    function setSize(W, H) { o.W = W; o.H = H; }

    return { beads, step, extension, setShear, setTemp, setSize, opts: o };
  }

  // Draw chain as beads + bonds
  function drawChain(ctx, chain, opts) {
    const { beads, opts: o } = chain;
    const palette = opts.palette || {
      bond: 'rgba(26, 24, 20, 0.6)',
      bead: '#1e3a6e',
      bead2: '#9a5c0a',
      head: '#8a2a1f',
    };
    ctx.clearRect(0, 0, o.W, o.H);

    // bonds
    ctx.lineWidth = opts.thin ? 1.2 : 2.4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.bond;
    ctx.beginPath();
    for (let i = 0; i < beads.length - 1; i++) {
      ctx.moveTo(beads[i].x, beads[i].y);
      ctx.lineTo(beads[i+1].x, beads[i+1].y);
    }
    ctx.stroke();

    // beads
    const r = opts.thin ? 2.4 : 4.2;
    for (let i = 0; i < beads.length; i++) {
      const t = i / (beads.length - 1);
      // interpolate navy -> sienna along chain
      const color = (i === 0 || i === beads.length - 1)
        ? palette.head
        : mixColor(palette.bead, palette.bead2, t);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(beads[i].x, beads[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function mixColor(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(h) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : {r:0,g:0,b:0};
  }

  // ── Attach to DOM hooks ────────────────────────────────
  function initMainSim() {
    const root = document.getElementById('simModule');
    if (!root) return;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const shearInput = root.querySelector('#shearSlider');
    const tempInput  = root.querySelector('#tempSlider');
    const vShear = root.querySelector('#shearValue');
    const vTemp  = root.querySelector('#tempValue');
    const vPhase = root.querySelector('#phaseValue');
    const vExt   = root.querySelector('#extValue');
    const extBar = root.querySelector('#extBar');

    let W = 800, H = 400;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (chain) chain.setSize(W, H);
    }

    const chain = makeChain({ N: 28, L0: 14, k: 0.55, kAngle: 0.05, drag: 0.55, kT: 0.35, W, H, gamma: 0.2 });
    resize();
    window.addEventListener('resize', resize);

    function readControls() {
      const g = parseFloat(shearInput.value);   // 0..2
      const T = parseFloat(tempInput.value);    // 0..1.2
      chain.setShear(g);
      chain.setTemp(T);
      vShear.textContent = g.toFixed(2) + ' s⁻¹';
      vTemp.textContent  = T.toFixed(2) + ' kᵦT';
      let phase;
      if (g < 0.2) phase = 'Coiled';
      else if (g < 0.6) phase = 'Tumbling';
      else if (g < 1.2) phase = 'Stretching';
      else phase = 'Extended';
      vPhase.textContent = phase;
    }
    shearInput.addEventListener('input', readControls);
    tempInput.addEventListener('input', readControls);
    readControls();

    // preset chips
    root.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = btn.dataset.preset;
        if (p === 'rest')       { shearInput.value = 0.05; tempInput.value = 0.25; }
        if (p === 'shear-low')  { shearInput.value = 0.35; tempInput.value = 0.35; }
        if (p === 'shear-crit') { shearInput.value = 0.9;  tempInput.value = 0.4; }
        if (p === 'shear-high') { shearInput.value = 1.7;  tempInput.value = 0.3; }
        readControls();
      });
    });

    let last = performance.now();
    let frame = 0;
    function loop(now) {
      const dt = Math.min(0.08, (now - last) / 1000 * 3);
      last = now;
      // substeps for stability
      const sub = 4;
      for (let i = 0; i < sub; i++) chain.step(dt / sub);
      drawChain(ctx, chain, { palette: {
        bond: 'rgba(26, 24, 20, 0.65)',
        bead: '#1e3a6e',
        bead2: '#9a5c0a',
        head: '#8a2a1f',
      }});
      if ((frame++ & 3) === 0) {
        const e = chain.extension();
        vExt.textContent = e.ratio.toFixed(2);
        extBar.style.width = (e.ratio * 100).toFixed(0) + '%';
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // Hero: a smaller resting chain that subtly drifts
  function initHeroChain() {
    const root = document.getElementById('heroChain');
    if (!root) return;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    let W = 600, H = 600;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (chain) chain.setSize(W, H);
    }
    const chain = makeChain({ N: 22, L0: 18, k: 0.5, kAngle: 0.08, drag: 0.6, kT: 0.2, W, H, gamma: 0.05 });
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.08, (now - last) / 1000 * 2.4);
      last = now;
      const sub = 3;
      for (let i = 0; i < sub; i++) chain.step(dt / sub);
      drawChain(ctx, chain, {
        palette: {
          bond: 'rgba(30, 58, 110, 0.7)',
          bead: '#1e3a6e',
          bead2: '#9a5c0a',
          head: '#8a2a1f',
        }
      });
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // Site background: thin, many chains, very quiet
  function initBgChains() {
    const root = document.getElementById('bgChain');
    if (!root) return;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    let W = window.innerWidth, H = window.innerHeight;
    const chains = [];
    function build() {
      chains.length = 0;
      const count = W < 700 ? 2 : W < 1200 ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const H2 = H;
        const c = makeChain({
          N: 18, L0: 16, k: 0.45, kAngle: 0.06, drag: 0.7, kT: 0.15,
          W, H: H2, gamma: 0.08 + i * 0.05, seed: 7 + i * 13,
        });
        // stagger beads vertically
        const offset = (i + 0.5) / count * H;
        for (let j = 0; j < c.beads.length; j++) c.beads[j].y = offset + (Math.random() - 0.5) * 12;
        chains.push(c);
      }
    }
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.08, (now - last) / 1000 * 1.8);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (const c of chains) {
        c.step(dt);
        drawChain(ctx, c, {
          thin: true,
          palette: {
            bond: 'rgba(30, 58, 110, 0.35)',
            bead: '#1e3a6e',
            bead2: '#9a5c0a',
            head: '#1e3a6e',
          },
        });
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeroChain();
    initMainSim();
    initBgChains();
  });
})();
