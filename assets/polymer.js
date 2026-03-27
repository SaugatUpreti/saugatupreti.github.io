/**
 * Background animation — three layers:
 *   1. CFD velocity field  — sparse Couette-flow arrow grid (static, very faint)
 *   2. One wind turbine    — tiny accent in corner
 *   3. vWF polymer chains  — 30-bead Rouse model, blood-red, reduced Brownian noise
 *
 * Physics (overdamped Langevin / Rouse model):
 *   dr_i/dt = (1/ζ) F_spring  +  γ̇ y_i x̂  +  ξ(t)
 *   ξ ~ N(0, √(2kT·Δt/ζ))  via Box-Muller
 *
 * No external libraries. No API keys.
 */
(function () {
  const canvas = document.getElementById('polymer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildCFDField(); // rebuild arrows on resize
  }
  window.addEventListener('resize', resize);

  /* ─── Box-Muller: Gaussian random number ─── */
  let _spare = null, _hasSpare = false;
  function gauss() {
    if (_hasSpare) { _hasSpare = false; return _spare; }
    let u; do { u = Math.random(); } while (u === 0);
    const mag = Math.sqrt(-2 * Math.log(u));
    const ang = 2 * Math.PI * Math.random();
    _spare = mag * Math.sin(ang); _hasSpare = true;
    return mag * Math.cos(ang);
  }

  /* ═══════════════════════════════════════════════
     LAYER 1 — CFD velocity field
     Couette flow: v_x = γ̇(y − H/2), v_y = 0
     Shown as a sparse grid of velocity arrows —
     immediately recognisable from CFD post-processing.
  ═══════════════════════════════════════════════ */
  let cfdArrows = [];
  function buildCFDField() {
    cfdArrows = [];
    const gx = 82, gy = 66, maxLen = 20;
    for (let x = gx * 0.5; x < W; x += gx) {
      for (let y = gy * 0.5; y < H; y += gy) {
        const norm = (y / H) - 0.5;          // −0.5 … +0.5
        const len  = norm * maxLen * 2;       // arrow length (signed)
        if (Math.abs(len) < 1.2) continue;   // skip near-zero (centre line)
        cfdArrows.push({ x, y, len, alpha: 0.025 + Math.abs(norm) * 0.028 });
      }
    }
  }

  function drawCFDField() {
    ctx.save();
    ctx.strokeStyle = '#1460a0';
    ctx.fillStyle   = '#1460a0';
    ctx.lineCap = 'round';
    for (const a of cfdArrows) {
      ctx.globalAlpha = a.alpha;
      const x1 = a.x - a.len * 0.38;
      const x2 = a.x + a.len * 0.62;
      const dir = a.len > 0 ? 1 : -1;
      ctx.lineWidth = 0.65;
      ctx.beginPath(); ctx.moveTo(x1, a.y); ctx.lineTo(x2, a.y); ctx.stroke();
      /* arrowhead */
      ctx.lineWidth = 0;
      ctx.beginPath();
      ctx.moveTo(x2, a.y);
      ctx.lineTo(x2 - dir * 5.5, a.y - 2.5);
      ctx.lineTo(x2 - dir * 5.5, a.y + 2.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════════════
     LAYER 2 — Single wind turbine (far right, subtle)
  ═══════════════════════════════════════════════ */
  class WindTurbine {
    constructor(x, y, h, alpha) {
      this.x = x; this.y = y; this.h = h; this.alpha = alpha;
      this.rot   = Math.random() * Math.PI * 2;
      this.omega = 0.004 + Math.random() * 0.004;
    }
    update() { this.rot += this.omega; }
    draw() {
      const h = this.h;
      ctx.save(); ctx.globalAlpha = this.alpha;
      ctx.strokeStyle = '#1a3a5c'; ctx.fillStyle = '#1a3a5c'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, h * 0.022);
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y - h); ctx.stroke();
      ctx.translate(this.x, this.y - h);
      const bl = h * 0.44; ctx.lineWidth = Math.max(1, h * 0.016);
      for (let b = 0; b < 3; b++) {
        const ang = this.rot + b * (Math.PI * 2 / 3);
        ctx.save(); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(h*0.04, -bl*0.28, h*0.025, -bl*0.72, 0, -bl);
        ctx.stroke(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, Math.max(2, h*0.03), 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  /* ═══════════════════════════════════════════════
     LAYER 3 — vWF Polymer chains (Rouse model)
     Blood-red: vWF is a haemostatic protein.
     Reduced kT → smoother, less noisy trajectories.
  ═══════════════════════════════════════════════ */
  const N_BEADS   = 30;
  const b0        = 10;
  const K_SPRING  = 0.85;
  const ZETA      = 1.0;
  const KBT       = 0.22;   // ↓ reduced from 0.65 — quieter Brownian noise
  const GAMMA_DOT = 0.00055;
  const DT        = 0.38;
  const NOISE_AMP = Math.sqrt(2 * KBT * DT / ZETA);

  class VWFChain {
    constructor(init) {
      this.x = new Float32Array(N_BEADS);
      this.y = new Float32Array(N_BEADS);
      this._place(init);
    }
    _place(init) {
      const cx = init ? Math.random() * W : -Math.random() * 80 - 60;
      const cy = H * 0.08 + Math.random() * H * 0.84;
      this.x[0] = cx; this.y[0] = cy;
      for (let i = 1; i < N_BEADS; i++) {
        const a = Math.random() * Math.PI * 2;
        this.x[i] = this.x[i-1] + Math.cos(a) * b0;
        this.y[i] = this.y[i-1] + Math.sin(a) * b0;
      }
      let mx = 0, my = 0;
      for (let i = 0; i < N_BEADS; i++) { mx += this.x[i]; my += this.y[i]; }
      mx /= N_BEADS; my /= N_BEADS;
      for (let i = 0; i < N_BEADS; i++) { this.x[i] += cx - mx; this.y[i] += cy - my; }

      this.drift  = 0.07 + Math.random() * 0.12;
      /* blood-red palette — vWF is a haemostatic protein */
      const hue   = 348 + Math.random() * 18;   // 348–366 → deep red / crimson
      const sat   = 68 + Math.random() * 12;
      const lig   = 36 + Math.random() * 10;
      const alpha = 0.12 + Math.random() * 0.14;
      this.stroke = `hsla(${hue % 360},${sat}%,${lig}%,${alpha})`;
      this.fill   = `hsla(${hue % 360},${sat}%,${lig - 6}%,${alpha + 0.08})`;
      this.lw     = 1.2 + Math.random() * 0.8;
    }
    update() {
      const fx = new Float32Array(N_BEADS);
      const fy = new Float32Array(N_BEADS);
      for (let i = 0; i < N_BEADS - 1; i++) {
        const dx = this.x[i+1] - this.x[i], dy = this.y[i+1] - this.y[i];
        const r  = Math.sqrt(dx*dx + dy*dy) || 1e-8;
        const m  = K_SPRING * (r - b0) / r;
        const fx_ = m * dx, fy_ = m * dy;
        fx[i] += fx_; fy[i] += fy_; fx[i+1] -= fx_; fy[i+1] -= fy_;
      }
      for (let i = 0; i < N_BEADS; i++) {
        this.x[i] += (fx[i]/ZETA + GAMMA_DOT*this.y[i] + this.drift)*DT + gauss()*NOISE_AMP;
        this.y[i] += (fy[i]/ZETA)*DT + gauss()*NOISE_AMP;
        /* soft vertical wall */
        const mg = 55;
        if (this.y[i] < mg)      this.y[i] += 0.4 * (mg - this.y[i]);
        if (this.y[i] > H - mg)  this.y[i] -= 0.4 * (this.y[i] - (H-mg));
      }
      let cmx = 0;
      for (let i = 0; i < N_BEADS; i++) cmx += this.x[i];
      if (cmx / N_BEADS > W + 180) this._place(false);
    }
    draw() {
      ctx.save();
      ctx.strokeStyle = this.stroke; ctx.lineWidth = this.lw;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(this.x[0], this.y[0]);
      for (let i = 1; i < N_BEADS - 1; i++) {
        const mx = (this.x[i] + this.x[i+1]) * 0.5;
        const my = (this.y[i] + this.y[i+1]) * 0.5;
        ctx.quadraticCurveTo(this.x[i], this.y[i], mx, my);
      }
      ctx.lineTo(this.x[N_BEADS-1], this.y[N_BEADS-1]); ctx.stroke();
      ctx.fillStyle = this.fill;
      for (let i = 0; i < N_BEADS; i++) {
        ctx.beginPath(); ctx.arc(this.x[i], this.y[i], 2.0, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ── Boot ── */
  resize(); // also calls buildCFDField()

  const turbine = new WindTurbine(W * 0.93, H * 0.88, 130, 0.028);
  const chains  = Array.from({ length: 13 }, () => new VWFChain(true));

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawCFDField();           // layer 1: static velocity arrows
    turbine.update(); turbine.draw(); // layer 2
    for (const c of chains) { c.update(); c.draw(); } // layer 3
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
