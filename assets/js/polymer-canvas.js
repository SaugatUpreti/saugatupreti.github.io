/**
 * vWF Polymer Chain — Bead-Spring (FENE) under Couette Shear
 * Background: blue coiled chains + red stretched chains
 */
(function () {
  'use strict';

  var canvas = document.getElementById('polymerCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Tweakable parameters — read from window.POLYMER_TWEAKS (set by tweaks UI)
  function T() { return window.POLYMER_TWEAKS || {}; }
  var N_BEADS   = 25;
  var L0        = 14;
  var L_MAX     = 25;
  var K_SPRING  = 3.5;
  var DRAG      = 0.5;
  var KBT       = 1.0;
  var DT        = 0.015;
  var EV_R      = 9;
  var EV_K      = 1.0;

  var cW = 0, cH = 0;
  var chains = [];
  var chainGdot = [];  // per-chain shear rate
  var rafId;

  function makeChain() {
    var beads = [];
    // Spread across full height — chains away from center WILL stretch
    var x = Math.random() * cW;
    var y = cH * 0.1 + Math.random() * cH * 0.8;
    for (var i = 0; i < N_BEADS; i++) {
      var a = Math.random() * 6.283;
      x += Math.cos(a) * L0 * 0.35;
      y += Math.sin(a) * L0 * 0.35;
      beads.push({ x: x, y: y });
    }
    return beads;
  }

  function init() {
    cW = window.innerWidth;
    cH = window.innerHeight;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = cW * dpr;
    canvas.height = cH * dpr;
    canvas.style.width = cW + 'px';
    canvas.style.height = cH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildChains();
  }

  function rebuildChains() {
    var t = T();
    var count     = (t.count != null) ? t.count : 10;
    var redRatio  = (t.redRatio != null) ? t.redRatio : 0.3;
    var shearBase = (t.shearBase != null) ? t.shearBase : 0.012;
    chains = [];
    chainGdot = [];
    chainAge = [];
    for (var c = 0; c < count; c++) {
      chains.push(makeChain());
      var isRed = (c / count) < redRatio;
      var g = isRed
        ? shearBase * (1.4 + Math.random() * 0.6)
        : shearBase * (0.3 + Math.random() * 0.5);
      chainGdot.push(g);
      chainAge.push(0);
    }
  }
  var chainAge = [];
  window.__polymerRebuild = rebuildChains;

  function fene(r) {
    var s = r - L0;
    if (r <= L0) return K_SPRING * s;
    var smax = L_MAX - L0;
    var ratio = (s * s) / (smax * smax);
    // Clamp ratio hard — prevents 1/(1-ratio) → ∞ → NaN cascade
    if (ratio >= 0.92) ratio = 0.92;
    var f = K_SPRING * s / (1 - ratio);
    // Also cap the absolute force magnitude for safety
    if (f > 400) f = 400;
    if (f < -400) f = -400;
    return f;
  }

  function step() {
    var tw = T();
    var shearMul = (tw.shearMul != null) ? tw.shearMul : 1;
    var noise = Math.sqrt(2 * KBT * DRAG / DT);

    for (var c = 0; c < chains.length; c++) {
      var ch = chains[c];
      var gdot = chainGdot[c] * shearMul;

      for (var i = 0; i < N_BEADS; i++) {
        var b = ch[i];
        var fx = 0, fy = 0;

        // FENE springs
        if (i > 0) {
          var dx = ch[i-1].x - b.x, dy = ch[i-1].y - b.y;
          var r = Math.sqrt(dx*dx + dy*dy) || 0.01;
          var f = fene(r);
          fx += f * dx / r;  fy += f * dy / r;
        }
        if (i < N_BEADS - 1) {
          var dx2 = ch[i+1].x - b.x, dy2 = ch[i+1].y - b.y;
          var r2 = Math.sqrt(dx2*dx2 + dy2*dy2) || 0.01;
          var f2 = fene(r2);
          fx += f2 * dx2 / r2;  fy += f2 * dy2 / r2;
        }

        // Excluded volume
        for (var di = -4; di <= 4; di++) {
          if (di >= -1 && di <= 1) continue;
          var j = i + di;
          if (j < 0 || j >= N_BEADS) continue;
          var edx = b.x - ch[j].x, edy = b.y - ch[j].y;
          var er2 = edx*edx + edy*edy;
          if (er2 < EV_R * EV_R && er2 > 0.5) {
            var er = Math.sqrt(er2);
            fx += EV_K * (EV_R - er) * edx / er;
            fy += EV_K * (EV_R - er) * edy / er;
          }
        }

        // Brownian
        fx += noise * (Math.random() - 0.5) * 2;
        fy += noise * (Math.random() - 0.5) * 2;

        // Couette shear: v_x = gdot * (y - cH/2)
        // Use ABSOLUTE y distance from center so chains away from middle
        // feel strong shear regardless of direction
        var yOffset = b.y - cH * 0.5;
        fx += DRAG * gdot * yOffset;

        // Clamp step size to prevent explosive displacements
        var vx = fx / DRAG, vy = fy / DRAG;
        var maxV = 40;
        if (vx > maxV) vx = maxV; else if (vx < -maxV) vx = -maxV;
        if (vy > maxV) vy = maxV; else if (vy < -maxV) vy = -maxV;

        b.x += vx * DT;
        b.y += vy * DT;

        // NaN guard — if anything went wrong, respawn this bead near its neighbor
        if (!isFinite(b.x) || !isFinite(b.y)) {
          var anchor = (i > 0) ? ch[i-1] : (i < N_BEADS - 1 ? ch[i+1] : null);
          b.x = anchor && isFinite(anchor.x) ? anchor.x + (Math.random()-0.5)*L0 : cW * 0.5;
          b.y = anchor && isFinite(anchor.y) ? anchor.y + (Math.random()-0.5)*L0 : cH * 0.5;
        }

        // Vertical boundary only (soft reflect)
        if (b.y < 10) b.y = 20 - b.y;
        if (b.y > cH - 10) b.y = 2 * (cH - 10) - b.y;
      }
    }

    // Whole-chain horizontal wrap — translate the entire chain together
    // so bonds never stretch across the viewport.
    for (var c2 = 0; c2 < chains.length; c2++) {
      var ch2 = chains[c2];
      // Use first bead as reference; if it's offscreen, shift all beads
      if (ch2[0].x < -cW * 0.5) {
        for (var k = 0; k < N_BEADS; k++) ch2[k].x += cW + cW * 0.5;
      } else if (ch2[0].x > cW * 1.5) {
        for (var k2 = 0; k2 < N_BEADS; k2++) ch2[k2].x -= cW + cW * 0.5;
      }
    }
  }

  function draw() {
    var t = T();
    var opacityMul = (t.opacity != null) ? t.opacity : 1;
    var fadeAlpha = (t.fade != null) ? t.fade : 0.85;
    ctx.fillStyle = 'rgba(255,255,255,' + fadeAlpha + ')';
    ctx.fillRect(0, 0, cW, cH);

    var contour = (N_BEADS - 1) * L0;

    for (var c = 0; c < chains.length; c++) {
      var ch = chains[c];

      // R_ee
      var ex = ch[N_BEADS-1].x - ch[0].x;
      var ey = ch[N_BEADS-1].y - ch[0].y;
      var ree = Math.sqrt(ex*ex + ey*ey);
      var ext = Math.min(ree / contour, 1);

      // Color: blue (ext~0) → red (ext~1). `t` here is local (shadows T())
      var t = Math.min(ext * 2.0, 1.0);
      var hue = 220 * (1 - t);           // 220 → 0
      var sat = 60 + t * 25;             // 60 → 85
      var lum = 50;
      var alpha = (0.3 + t * 0.4) * opacityMul;

      // Glow
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'hsla(' + hue + ',' + sat + '%,' + lum + '%,' + (alpha * 0.15) + ')';
      drawPath(ch);
      ctx.stroke();

      // Backbone
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'hsla(' + hue + ',' + sat + '%,' + lum + '%,' + alpha + ')';
      drawPath(ch);
      ctx.stroke();

      // 3D-rendered beads with radial gradient + specular highlight
      for (var i = 0; i < N_BEADS; i++) {
        var br = 5;
        var ba = Math.min(1, alpha * 1.2);
        var bx = ch[i].x, by = ch[i].y;

        // Soft shadow under bead (depth cue)
        ctx.fillStyle = 'rgba(0,0,0,' + (ba * 0.18) + ')';
        ctx.beginPath();
        ctx.arc(bx + 1.2, by + 1.8, br * 0.95, 0, 6.283);
        ctx.fill();

        // Base sphere — radial gradient (dark edge → bright core offset top-left)
        var grad = ctx.createRadialGradient(bx - br*0.4, by - br*0.45, br*0.1, bx, by, br);
        var light = 'hsla(' + hue + ',' + Math.min(95, sat + 25) + '%,' + (lum + 35) + '%,' + ba + ')';
        var mid   = 'hsla(' + hue + ',' + (sat + 10) + '%,' + (lum + 5) + '%,' + ba + ')';
        var dark  = 'hsla(' + hue + ',' + (sat + 15) + '%,' + Math.max(12, lum - 25) + '%,' + ba + ')';
        grad.addColorStop(0,   light);
        grad.addColorStop(0.45, mid);
        grad.addColorStop(1,   dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, 6.283);
        ctx.fill();

        // Rim shading (subtle dark ring)
        ctx.strokeStyle = 'hsla(' + hue + ',' + sat + '%,' + Math.max(8, lum - 35) + '%,' + (ba * 0.55) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, br - 0.3, 0, 6.283);
        ctx.stroke();

        // Specular highlight — small white glint top-left
        var spec = ctx.createRadialGradient(bx - br*0.45, by - br*0.5, 0, bx - br*0.45, by - br*0.5, br*0.55);
        spec.addColorStop(0, 'rgba(255,255,255,' + (ba * 0.95) + ')');
        spec.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = spec;
        ctx.beginPath();
        ctx.arc(bx - br*0.35, by - br*0.4, br*0.55, 0, 6.283);
        ctx.fill();
      }

      // R_ee dashed line
      if (t > 0.2) {
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'hsla(' + hue + ',' + sat + '%,' + lum + '%,' + (alpha * 0.25) + ')';
        ctx.beginPath();
        ctx.moveTo(ch[0].x, ch[0].y);
        ctx.lineTo(ch[N_BEADS-1].x, ch[N_BEADS-1].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawPath(ch) {
    ctx.beginPath();
    ctx.moveTo(ch[0].x, ch[0].y);
    for (var i = 1; i < N_BEADS; i++) {
      if (Math.abs(ch[i].x - ch[i-1].x) > L_MAX * 2 || Math.abs(ch[i].y - ch[i-1].y) > L_MAX * 2) {
        ctx.moveTo(ch[i].x, ch[i].y);
        continue;
      }
      if (i < N_BEADS - 1) {
        var mx = (ch[i].x + ch[i+1].x) * 0.5;
        var my = (ch[i].y + ch[i+1].y) * 0.5;
        ctx.quadraticCurveTo(ch[i].x, ch[i].y, mx, my);
      } else {
        ctx.lineTo(ch[i].x, ch[i].y);
      }
    }
  }

  function loop() {
    for (var s = 0; s < 8; s++) step();
    // Respawn chains that have been fully stretched too long — prevents
    // the "linear extrusion" pathology at high shear
    var contour = (N_BEADS - 1) * L0;
    for (var c = 0; c < chains.length; c++) {
      var ch = chains[c];
      var ex = ch[N_BEADS-1].x - ch[0].x;
      var ey = ch[N_BEADS-1].y - ch[0].y;
      var ree = Math.sqrt(ex*ex + ey*ey);
      if (ree > contour * 0.88) {
        chainAge[c] = (chainAge[c] || 0) + 1;
        if (chainAge[c] > 180) {
          chains[c] = makeChain();
          chainAge[c] = 0;
        }
      } else {
        chainAge[c] = 0;
      }
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelAnimationFrame(rafId);
    else rafId = requestAnimationFrame(loop);
  });

  init();
  window.addEventListener('resize', init);
  rafId = requestAnimationFrame(loop);
})();
