/* UI behaviors — nav, scroll-spy, command palette, tweaks, reading mode */
(function() {
  'use strict';

  // ── Scroll-spy + nav state ────────────────────────────
  const nav = document.getElementById('nav');
  const sections = [...document.querySelectorAll('main .section, main .hero')];
  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const toTop = document.getElementById('toTop');

  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    toTop.classList.toggle('show', y > 600);

    // spy
    let current = sections[0]?.id;
    for (const s of sections) {
      const rect = s.getBoundingClientRect();
      if (rect.top <= 120) current = s.id;
    }
    navLinks.forEach(a => {
      const is = a.dataset.section === current;
      a.classList.toggle('active', is);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ── Reveal on scroll ──────────────────────────────────
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.revealable').forEach(el => io.observe(el));

  // ── Command palette ───────────────────────────────────
  const cmd = document.getElementById('cmd');
  const cmdInput = document.getElementById('cmdInput');
  const cmdList = document.getElementById('cmdList');

  const commands = [
    { group: 'Navigate', icon: '→', label: 'Home',         hint: 'G H', action: () => jumpTo('hero') },
    { group: 'Navigate', icon: '→', label: 'Research',     hint: 'G R', action: () => jumpTo('research') },
    { group: 'Navigate', icon: '→', label: 'Publications', hint: 'G P', action: () => jumpTo('publications') },
    { group: 'Navigate', icon: '→', label: 'Projects',     hint: 'G J', action: () => jumpTo('projects') },
    { group: 'Navigate', icon: '→', label: 'Awards',       hint: 'G A', action: () => jumpTo('awards') },
    { group: 'Navigate', icon: '→', label: 'Teaching',     hint: 'G T', action: () => jumpTo('teaching') },
    { group: 'Navigate', icon: '→', label: 'CV',           hint: 'G V', action: () => jumpTo('cv') },
    { group: 'Navigate', icon: '→', label: 'Contact',      hint: 'G C', action: () => jumpTo('contact') },
    { group: 'Actions',  icon: '✎', label: 'Toggle reading mode', hint: 'R', action: toggleReading },
    { group: 'Actions',  icon: '◉', label: 'Open Tweaks',         hint: 'T', action: toggleTweaks },
    { group: 'Actions',  icon: '↯', label: 'Cycle polymer intensity', action: cycleIntensity },
    { group: 'Links',    icon: '↗', label: 'Email Saugat',        action: () => location.href = 'mailto:Upretisaugat1@gmail.com' },
    { group: 'Links',    icon: '↗', label: 'Google Scholar',      action: () => open('https://scholar.google.com/citations?user=b01hEVcAAAAJ&hl=en') },
    { group: 'Links',    icon: '↗', label: 'GitHub',              action: () => open('https://github.com/SaugatUpreti') },
    { group: 'Links',    icon: '↗', label: 'LinkedIn',            action: () => open('https://www.linkedin.com/in/saugat-upreti/') },
    { group: 'Links',    icon: '↗', label: 'ResearchGate',        action: () => open('https://www.researchgate.net/profile/Saugat-Upreti') },
    { group: 'Links',    icon: '↗', label: 'Download CV',         action: () => open('assets/cv/saugat-upreti-cv.pdf') },
  ];

  let activeIdx = 0;
  let filtered = commands.slice();

  function renderCmd() {
    cmdList.innerHTML = '';
    let lastGroup = null;
    filtered.forEach((c, i) => {
      if (c.group !== lastGroup) {
        const label = document.createElement('div');
        label.className = 'cmd-section-label';
        label.textContent = c.group;
        cmdList.appendChild(label);
        lastGroup = c.group;
      }
      const el = document.createElement('div');
      el.className = 'cmd-item' + (i === activeIdx ? ' active' : '');
      el.innerHTML = `<span class="icon">${c.icon}</span><span class="label">${c.label}</span><span class="hint">${c.hint || ''}</span>`;
      el.addEventListener('click', () => { c.action(); closeCmd(); });
      el.addEventListener('mousemove', () => {
        if (activeIdx !== i) { activeIdx = i; updateActive(); }
      });
      cmdList.appendChild(el);
    });
  }
  function updateActive() {
    [...cmdList.querySelectorAll('.cmd-item')].forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
    });
  }
  function filterCmd(q) {
    q = q.trim().toLowerCase();
    filtered = !q ? commands.slice() : commands.filter(c =>
      c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
    activeIdx = 0;
    renderCmd();
  }
  function openCmd() {
    cmd.classList.add('open');
    cmdInput.value = '';
    filterCmd('');
    setTimeout(() => cmdInput.focus(), 50);
  }
  function closeCmd() { cmd.classList.remove('open'); }
  cmdInput.addEventListener('input', (e) => filterCmd(e.target.value));
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { activeIdx = Math.min(filtered.length - 1, activeIdx + 1); updateActive(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { activeIdx = Math.max(0, activeIdx - 1); updateActive(); e.preventDefault(); }
    else if (e.key === 'Enter') { filtered[activeIdx]?.action(); closeCmd(); }
    else if (e.key === 'Escape') { closeCmd(); }
  });
  cmd.addEventListener('click', (e) => { if (e.target === cmd) closeCmd(); });

  // Keyboard shortcuts
  let gPressed = false, gTimer = null;
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    // ⌘K
    if (mod && key === 'k') { e.preventDefault(); openCmd(); return; }
    if (cmd.classList.contains('open')) return;
    // typing in inputs?
    if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;

    if (key === '/') { e.preventDefault(); openCmd(); }
    else if (key === 'r') toggleReading();
    else if (key === 't') toggleTweaks();
    else if (key === 'g') { gPressed = true; clearTimeout(gTimer); gTimer = setTimeout(() => gPressed = false, 800); }
    else if (gPressed) {
      const map = { h:'hero', r:'research', p:'publications', j:'projects', a:'awards', t:'teaching', v:'cv', c:'contact' };
      if (map[key]) { jumpTo(map[key]); gPressed = false; }
    }
  });

  function jumpTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 68;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  // ── Reading mode ──────────────────────────────────────
  function toggleReading() {
    document.body.classList.toggle('reading');
    const on = document.body.classList.contains('reading');
    localStorage.setItem('reading', on ? '1' : '0');
    const btn = document.getElementById('readingToggle');
    if (btn) btn.setAttribute('aria-pressed', on);
  }
  if (localStorage.getItem('reading') === '1') document.body.classList.add('reading');
  document.getElementById('readingToggle')?.addEventListener('click', toggleReading);
  document.getElementById('cmdBtn')?.addEventListener('click', openCmd);

  // ── Tweaks panel ──────────────────────────────────────
  const tweaks = document.getElementById('tweaks');
  const tweaksBtn = document.getElementById('tweaksBtn');
  const tweaksClose = document.getElementById('tweaksClose');

  function toggleTweaks() { tweaks.classList.toggle('open'); }
  tweaksBtn?.addEventListener('click', toggleTweaks);
  tweaksClose?.addEventListener('click', toggleTweaks);

  // Tweak handlers
  document.querySelectorAll('.seg[data-seg]').forEach(seg => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      seg.querySelectorAll('button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const key = seg.dataset.seg;
      const val = btn.dataset.val;
      document.documentElement.setAttribute('data-' + key, val);
      localStorage.setItem('tweak-' + key, val);
    });
  });
  // restore
  ['pair', 'accent', 'intensity'].forEach(k => {
    const v = localStorage.getItem('tweak-' + k);
    if (v) {
      document.documentElement.setAttribute('data-' + k, v);
      const seg = document.querySelector(`.seg[data-seg="${k}"]`);
      if (seg) {
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === v));
      }
    }
  });

  function cycleIntensity() {
    const order = ['off', 'subtle', 'medium', 'strong'];
    const cur = document.documentElement.getAttribute('data-intensity') || 'medium';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    document.documentElement.setAttribute('data-intensity', next);
    localStorage.setItem('tweak-intensity', next);
    const seg = document.querySelector('.seg[data-seg="intensity"]');
    if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === next));
  }

  // ── Tweaks: Edit-mode host protocol ──────────────────
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === '__activate_edit_mode') tweaks.classList.add('open');
    else if (d.type === '__deactivate_edit_mode') tweaks.classList.remove('open');
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}

  // ── Smooth scroll on any [data-jump] ──────────────────
  document.querySelectorAll('[data-jump]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); jumpTo(el.dataset.jump); });
  });

  // ── Project row: clicking opens link if data-href present
  document.querySelectorAll('.project-row[data-href]').forEach(row => {
    row.addEventListener('click', () => {
      const href = row.dataset.href;
      if (href.startsWith('http')) window.open(href, '_blank', 'noopener');
      else location.href = href;
    });
  });

})();
