// ============================================================
// tech-lab — 11 visual demos for "Low Code, No Code & Generative AI"
// (Technology with Impact, IE BCSAI). Topics map to the syllabus:
//   adoption & trends · network effects · no-code builders · automation
//   (Zapier/Make) · RPA ROI · LLM tokenizer · attention · diffusion image
//   generation · chatbots · no-code databases · tech-for-impact triage.
//
// Every demo follows the same pattern as the rest of the *-lab series:
//   1. read control state through helpers that always return finite values
//   2. compute into a local buffer
//   3. render in a single idempotent `draw()` that fits + clears the canvas
//
// `draw` resets the canvas transform and clears before drawing, so resizes
// and rapid input can never compound state. Animated demos use rAF with
// explicit play/pause/reset and cancelAnimationFrame teardown.
// ============================================================

// ---------- helpers ------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function n(id, fallback) {
  const el = document.getElementById(id);
  const v = el ? +el.value : NaN;
  return Number.isFinite(v) ? v : fallback;
}
const $ = id => document.getElementById(id);
const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };

// ---------- palette ------------------------------------------------------
const ACCENT = '#4338CA';
const ACCENT_S = 'rgba(67,56,202,0.16)';
const RULE  = '#E5E5EA';
const RULE_H = '#CDCDD4';
const INK   = '#15151A';
const INK_S = '#4B4B55';
const MUTED = '#8A8A92';
const GOOD  = '#16A34A';
const WARN  = '#F59E0B';
const BAD   = '#DC2626';

function fitCanvas(cv) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = cv.getBoundingClientRect();
  const cssW = Math.max(80, rect.width);
  const cssH = Math.max(80, parseInt(cv.getAttribute('height'), 10) || 280);
  cv.width  = Math.floor(cssW * dpr);
  cv.height = Math.floor(cssH * dpr);
  cv.style.height = cssH + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '12px Inter, sans-serif';
  ctx.textBaseline = 'alphabetic';
  return { ctx, w: cssW, h: cssH };
}
// pointer position in CSS pixels relative to canvas
function ptr(cv, ev) {
  const r = cv.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

// ============================================================
// 1. ADOPTION S-CURVE — Bass diffusion model
//    A(t+1) = A(t) + (p + q*A/M)*(M - A)
// ============================================================
(function sCurve() {
  const cv = $('cv-scurve'); if (!cv) return;
  const STEPS = 60; // periods (e.g. quarters)

  function simulate() {
    const p = n('sc-p', 0.03), q = n('sc-q', 0.38), M = n('sc-m', 100);
    const A = [0];
    let cum = 0;
    const inc = [];
    for (let t = 0; t < STEPS; t++) {
      const di = (p + q * cum / M) * (M - cum);
      cum = clamp(cum + di, 0, M);
      inc.push(di < 0 ? 0 : di);
      A.push(cum);
    }
    return { p, q, M, A, inc };
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const { p, q, M, A, inc } = simulate();
    setText('sc-pv', p.toFixed(3));
    setText('sc-qv', q.toFixed(2));
    setText('sc-mv', M);

    const padL = 40, padR = 16, padT = 16, padB = 30;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const x = t => padL + plotW * t / STEPS;
    const y = v => padT + plotH * (1 - v / M);

    // axes
    ctx.strokeStyle = RULE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'right';
    ctx.fillText('100%', padL - 5, padT + 4);
    ctx.fillText('50%', padL - 5, y(M / 2) + 3);
    ctx.fillText('0', padL - 5, padT + plotH + 3);
    ctx.textAlign = 'center';
    ctx.fillText('time →', padL + plotW / 2, h - 6);

    // incremental adoption bars (new adopters per period)
    const maxInc = Math.max(...inc, 1e-9);
    const bw = plotW / STEPS;
    inc.forEach((di, t) => {
      const bh = (plotH * 0.55) * di / maxInc;
      ctx.fillStyle = ACCENT_S;
      ctx.fillRect(x(t) + bw * 0.1, padT + plotH - bh, bw * 0.8, bh);
    });

    // cumulative S-curve
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
    ctx.beginPath();
    A.forEach((v, t) => { const px = x(t), py = y(v); t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
    ctx.stroke();

    // Rogers adopter bands by cumulative % thresholds (2.5/16/50/84)
    const bands = [
      { to: 0.025, c: '#7C3AED', label: 'innov.' },
      { to: 0.16,  c: ACCENT,    label: 'early' },
      { to: 0.50,  c: GOOD,      label: 'early maj.' },
      { to: 0.84,  c: WARN,      label: 'late maj.' },
      { to: 1.0,   c: MUTED,     label: 'laggards' },
    ];
    // find time index where each cumulative threshold is crossed
    let prevT = 0;
    ctx.textAlign = 'center';
    bands.forEach(b => {
      let ti = A.findIndex(v => v >= b.to * M);
      if (ti < 0) ti = STEPS;
      const x0 = x(prevT), x1 = x(ti);
      ctx.fillStyle = b.c; ctx.globalAlpha = 0.07;
      ctx.fillRect(x0, padT, x1 - x0, plotH);
      ctx.globalAlpha = 1;
      if (x1 - x0 > 26) { ctx.fillStyle = b.c; ctx.font = '9px Inter, sans-serif'; ctx.fillText(b.label, (x0 + x1) / 2, padT + 10); }
      prevT = ti;
    });

    // readouts
    let peakT = 0, peakV = -1;
    inc.forEach((v, t) => { if (v > peakV) { peakV = v; peakT = t; } });
    const halfT = A.findIndex(v => v >= M / 2);
    setText('sc-peak', `period ${peakT + 1}`);
    setText('sc-half', halfT < 0 ? '> ' + STEPS : `period ${halfT}`);
    setText('sc-tot', `${Math.round(A[A.length - 1])} / ${M}`);
    ctx.textAlign = 'left';
  }
  ['sc-p', 'sc-q', 'sc-m'].forEach(id => $(id).addEventListener('input', draw));
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 2. NETWORK EFFECTS — Metcalfe / Sarnoff / Reed
// ============================================================
(function network() {
  const cv = $('cv-network'); if (!cv) return;
  function value(law, k) {
    switch (law) {
      case 'metcalfe': return k * (k - 1) / 2;
      case 'sarnoff':  return k;
      case 'reed':     return Math.pow(2, k) - k - 1;
    }
    return 0;
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const N = n('nw-n', 8);
    const law = $('nw-law').value;
    setText('nw-nv', N);

    // draw the network graph (left ~58%)
    const gx = w * 0.30, gy = h * 0.5, R = Math.min(w * 0.22, h * 0.36);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / N;
      pts.push({ x: gx + R * Math.cos(ang), y: gy + R * Math.sin(ang) });
    }
    // for metcalfe/reed draw all pairwise edges; sarnoff draws a hub
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(67,56,202,0.22)';
    if (law === 'sarnoff') {
      for (let i = 1; i < N; i++) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); }
    } else {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
    }
    pts.forEach(pp => {
      ctx.beginPath(); ctx.arc(pp.x, pp.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // value vs n bar chart (right side)
    const bx = w * 0.62, bw = w * 0.34, by = h - 36, bt = 30;
    const maxV = value(law, N) || 1;
    ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = '10px Inter, sans-serif';
    ctx.fillText('value as users grow', bx + bw / 2, bt - 14);
    const step = Math.max(1, Math.ceil(N / 8));
    for (let k = 1, slot = 0; k <= N; k += step, slot++) {
      const slots = Math.ceil(N / step);
      const cw = bw / slots;
      const v = value(law, k);
      const bh = (by - bt) * (maxV ? v / maxV : 0);
      const x = bx + slot * cw;
      ctx.fillStyle = k === N ? ACCENT : ACCENT_S;
      ctx.fillRect(x + cw * 0.12, by - bh, cw * 0.76, bh);
      ctx.fillStyle = MUTED; ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(k, x + cw / 2, by + 12);
    }
    ctx.textAlign = 'left';

    const v = value(law, N);
    const fmt = x => x >= 1e6 ? x.toExponential(2) : (Number.isInteger(x) ? x.toString() : x.toFixed(1));
    setText('nw-val', fmt(v));
    setText('nw-per', N ? fmt(v / N) : '—');
    setText('nw-marg', fmt(value(law, N + 1) - v));
  }
  $('nw-n').addEventListener('input', draw);
  $('nw-law').addEventListener('change', draw);
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 3. NO-CODE BUILDER — drop blocks, estimate code saved
// ============================================================
(function noCode() {
  const cv = $('cv-nocode'); if (!cv) return;
  const SPEC = {
    input:  { name: 'Input field', loc: 25,  c: ACCENT },
    button: { name: 'Button',      loc: 18,  c: '#7C3AED' },
    list:   { name: 'Data list',   loc: 60,  c: GOOD },
    auth:   { name: 'User auth',   loc: 220, c: WARN },
    db:     { name: 'Database',    loc: 140, c: BAD },
    api:    { name: 'API call',    loc: 80,  c: INK_S },
  };
  let blocks = []; // {type, x, y}

  function layout(w) {
    // grid placement
    return blocks.map((b, i) => {
      const cols = 3, cw = (w - 40) / cols;
      const col = i % cols, rowI = Math.floor(i / cols);
      return { ...b, gx: 20 + col * cw, gy: 44 + rowI * 70, bw: cw - 14, bh: 54 };
    });
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = MUTED; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('app canvas', 20, 22);

    const placed = layout(w);
    placed.forEach(b => {
      const s = SPEC[b.type];
      ctx.fillStyle = '#fff'; ctx.strokeStyle = s.c; ctx.lineWidth = 1.8;
      roundRect(ctx, b.gx, b.gy, b.bw, b.bh, 6); ctx.fill(); ctx.stroke();
      // colour tab
      ctx.fillStyle = s.c; roundRect(ctx, b.gx, b.gy, 6, b.bh, 3); ctx.fill();
      ctx.fillStyle = INK; ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(s.name, b.gx + 14, b.gy + 22);
      ctx.fillStyle = MUTED; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`~${s.loc} loc`, b.gx + 14, b.gy + 40);
    });
    if (blocks.length === 0) {
      ctx.fillStyle = MUTED; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('pick a block and press "drop block" to assemble your app', w / 2, h / 2);
      ctx.textAlign = 'left';
    }

    const loc = blocks.reduce((s, b) => s + SPEC[b.type].loc, 0);
    setText('nc-count', blocks.length);
    setText('nc-loc', `${loc} loc`);
    let status = 'empty', col = MUTED;
    if (blocks.length > 0) {
      const types = new Set(blocks.map(b => b.type));
      if (types.has('db') && types.has('list')) { status = 'data app — ready'; col = GOOD; }
      else if (types.has('input') || types.has('button')) { status = 'UI scaffold'; col = ACCENT; }
      else { status = 'draft'; col = WARN; }
    }
    setText('nc-status', status); $('nc-status').style.color = col;
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  $('nc-add').addEventListener('click', () => {
    if (blocks.length < 12) blocks.push({ type: $('nc-block').value });
    draw();
  });
  $('nc-clear').addEventListener('click', () => { blocks = []; draw(); });
  cv.addEventListener('click', ev => {
    const { w } = fitCanvas(cv);
    const p = ptr(cv, ev);
    const placed = layout(w);
    const hit = placed.findIndex(b => p.x >= b.gx && p.x <= b.gx + b.bw && p.y >= b.gy && p.y <= b.gy + b.bh);
    if (hit >= 0) { blocks.splice(hit, 1); draw(); }
  });
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 4. AUTOMATION WORKFLOW — Zapier/Make trigger→action chain
// ============================================================
(function flow() {
  const cv = $('cv-flow'); if (!cv) return;
  const SPEC = {
    trigger: { name: 'Trigger', icon: '⚡', c: ACCENT },
    filter:  { name: 'Filter',  icon: '⛃', c: WARN },
    action:  { name: 'Action',  icon: '▸', c: GOOD },
    notify:  { name: 'Notify',  icon: '✉', c: '#7C3AED' },
  };
  let steps = [{ type: 'trigger' }, { type: 'action' }];

  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const ev = n('fl-evt', 40), mins = n('fl-min', 3);
    setText('fl-ev', ev); setText('fl-mn', mins);

    const cy = h * 0.4;
    const k = steps.length;
    const cw = Math.min(120, (w - 30) / Math.max(1, k));
    const bw = cw - 18, bh = 56;
    const totalW = cw * k;
    const x0 = (w - totalW) / 2 + 9;
    ctx.textAlign = 'center';
    steps.forEach((st, i) => {
      const s = SPEC[st.type];
      const x = x0 + cw * i, y = cy - bh / 2;
      // connector
      if (i > 0) {
        ctx.strokeStyle = RULE_H; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 18 + 4, cy); ctx.lineTo(x + 9, cy); ctx.stroke();
        // arrowhead
        ctx.fillStyle = RULE_H;
        ctx.beginPath(); ctx.moveTo(x + 9, cy); ctx.lineTo(x + 2, cy - 4); ctx.lineTo(x + 2, cy + 4); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = s.c; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.rect(x + 9, y, bw, bh); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s.c; ctx.font = '18px Inter, sans-serif';
      ctx.fillText(s.icon, x + 9 + bw / 2, y + 26);
      ctx.fillStyle = INK; ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText(s.name, x + 9 + bw / 2, y + 44);
    });

    // valid pipeline starts with a trigger and has >=1 action
    const valid = steps.length >= 2 && steps[0].type === 'trigger'
      && steps.some(s => s.type === 'action' || s.type === 'notify');
    setText('fl-valid', valid ? 'yes' : 'no — needs trigger + action');
    $('fl-valid').style.color = valid ? GOOD : BAD;

    // time saved: each automated event saves `mins`; passes through filters
    const eventsPerMonth = ev * 30;
    const hoursSaved = valid ? eventsPerMonth * mins / 60 : 0;
    setText('fl-saved', `${hoursSaved.toFixed(1)} h`);

    ctx.fillStyle = MUTED; ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`${ev} events/day × ${mins} min ⇒ ${(eventsPerMonth * mins / 60).toFixed(0)} h/month of manual work`, w / 2, h - 14);
    ctx.textAlign = 'left';
  }
  $('fl-add').addEventListener('click', () => { if (steps.length < 6) steps.push({ type: $('fl-step').value }); draw(); });
  $('fl-clear').addEventListener('click', () => { steps = []; draw(); });
  ['fl-evt', 'fl-min'].forEach(id => $(id).addEventListener('input', draw));
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 5. RPA ROI — payback period of a bot
// ============================================================
(function rpa() {
  const cv = $('cv-rpa'); if (!cv) return;
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const vol = n('rp-v', 500), mins = n('rp-t', 6), cost = n('rp-c', 25), build = n('rp-b', 4000);
    setText('rp-vv', vol); setText('rp-tv', mins); setText('rp-cv', cost); setText('rp-bv', build);

    const monthlySave = vol * mins / 60 * cost;       // € saved per month
    const payback = monthlySave > 0 ? build / monthlySave : Infinity; // months
    setText('rp-save', `€${monthlySave.toFixed(0)}`);
    setText('rp-pay', payback === Infinity ? '—' : `${payback.toFixed(1)} mo`);
    let verd = 'skip', col = BAD;
    if (payback <= 3) { verd = 'automate now'; col = GOOD; }
    else if (payback <= 9) { verd = 'good candidate'; col = ACCENT; }
    else if (payback <= 18) { verd = 'marginal'; col = WARN; }
    setText('rp-verd', verd); $('rp-verd').style.color = col;

    // chart: cumulative cost human vs bot over 24 months
    const padL = 44, padR = 14, padT = 18, padB = 28;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const MONTHS = 24;
    const humanAt = m => monthlySave * m;          // cumulative cost avoided ~ human cost
    const botAt   = m => build;                     // one-off build (ignoring upkeep for clarity)
    const maxY = Math.max(humanAt(MONTHS), build * 1.2, 1);
    const X = m => padL + plotW * m / MONTHS;
    const Y = v => padT + plotH * (1 - v / maxY);

    ctx.strokeStyle = RULE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'right';
    ctx.fillText('€' + Math.round(maxY), padL - 4, padT + 6);
    ctx.fillText('0', padL - 4, padT + plotH + 3);
    ctx.textAlign = 'center'; ctx.fillText('months →', padL + plotW / 2, h - 6);

    // human cumulative cost line (what you'd keep paying)
    ctx.strokeStyle = BAD; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let m = 0; m <= MONTHS; m++) { const px = X(m), py = Y(humanAt(m)); m === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.stroke();
    // bot flat build cost
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(build)); ctx.lineTo(X(MONTHS), Y(build)); ctx.stroke();

    // breakeven marker
    if (payback !== Infinity && payback <= MONTHS) {
      const bx = X(payback);
      ctx.strokeStyle = GOOD; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, padT); ctx.lineTo(bx, padT + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = GOOD; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('breakeven', bx, padT + 10);
    }
    // legend
    ctx.textAlign = 'left'; ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = BAD; ctx.fillText('— manual labour cost', padL + 6, padT + 12);
    ctx.fillStyle = ACCENT; ctx.fillText('— bot build cost', padL + 6, padT + 26);
  }
  ['rp-v', 'rp-t', 'rp-c', 'rp-b'].forEach(id => $(id).addEventListener('input', draw));
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 6. TOKENIZER — simplified sub-word splitter
// ============================================================
(function tokenizer() {
  const cv = $('cv-token'); if (!cv) return;
  // a small "vocabulary" of common whole words + frequent suffixes/prefixes
  const WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'to', 'of', 'and', 'in',
    'on', 'for', 'it', 'you', 'we', 'i', 'ai', 'data', 'code', 'no', 'low', 'app',
    'web', 'tool', 'tools', 'model', 'models', 'learn', 'generative', 'let']);
  const SUFFIX = ['ization', 'ization', 'tive', 'ative', 'ing', 'tion', 'ness', 'able',
    'ably', 'ment', 'ily', 'ely', 'ly', 'ed', 'es', 's', 'er', 'al'];

  // split one word into pseudo-tokens
  function splitWord(word) {
    const lower = word.toLowerCase();
    if (WORDS.has(lower) || lower.length <= 4) return [word];
    const toks = [];
    let rest = word;
    // peel known suffixes
    let guard = 0;
    while (rest.length > 4 && guard++ < 4) {
      const lr = rest.toLowerCase();
      const suf = SUFFIX.find(s => lr.endsWith(s) && rest.length - s.length >= 3);
      if (!suf) break;
      toks.unshift(rest.slice(rest.length - suf.length));
      rest = rest.slice(0, rest.length - suf.length);
    }
    // chunk the remaining stem into ~4-char pieces
    while (rest.length > 5) { toks.unshift(rest.slice(0, 4)); rest = rest.slice(4); }
    toks.unshift(rest);
    return toks;
  }
  function tokenize(text) {
    // split on whitespace but keep punctuation as its own token
    const raw = text.match(/\s+|[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) || [];
    const toks = [];
    raw.forEach(chunk => {
      if (/^\s+$/.test(chunk)) { if (toks.length) toks[toks.length - 1].space = true; return; }
      if (/^[A-Za-z0-9]+$/.test(chunk)) splitWord(chunk).forEach((t, i) => toks.push({ t, lead: i === 0 }));
      else toks.push({ t: chunk, lead: true });
    });
    return toks;
  }
  const COLORS = ['rgba(67,56,202,0.14)', 'rgba(22,163,74,0.14)', 'rgba(245,158,11,0.16)', 'rgba(124,58,237,0.14)'];
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const text = $('tk-in').value;
    const toks = tokenize(text);

    ctx.font = '600 16px JetBrains Mono, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let x = 18, y = 48; const lineH = 40, padX = 7, padY = 9;
    let id = 100;
    toks.forEach((tk, i) => {
      const label = tk.t;
      const tw = ctx.measureText(label).width + padX * 2;
      if (x + tw > w - 16) { x = 18; y += lineH; }
      if (y > h - 36) return;
      // chip
      ctx.fillStyle = COLORS[i % COLORS.length];
      const chipH = 26;
      ctx.beginPath(); ctx.rect(x, y - 18, tw, chipH); ctx.fill();
      ctx.strokeStyle = RULE_H; ctx.lineWidth = 1; ctx.strokeRect(x, y - 18, tw, chipH);
      ctx.fillStyle = INK; ctx.font = '600 16px JetBrains Mono, monospace';
      ctx.fillText(label, x + padX, y);
      // token id underneath
      ctx.fillStyle = MUTED; ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('#' + (id++), x + padX, y + 18);
      x += tw + (tk.space ? 12 : 4);
    });

    const chars = text.length;
    setText('tk-chars', chars);
    setText('tk-toks', toks.length);
    setText('tk-ratio', toks.length ? (chars / toks.length).toFixed(2) : '—');
    setText('tk-cost', '$' + (toks.length / 1e6 * 3).toFixed(6));
  }
  $('tk-in').addEventListener('input', draw);
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 7. ATTENTION & NEXT-TOKEN PREDICTION — toy softmax
// ============================================================
(function attention() {
  const cv = $('cv-attn'); if (!cv) return;
  // for each context, hand-set attention weights over context words and a
  // candidate distribution for the next token.
  const MODELS = {
    'the cat sat on the': {
      tokens: ['the', 'cat', 'sat', 'on', 'the'],
      attn:   [0.05, 0.30, 0.20, 0.15, 0.30],
      next:   [['mat', 3.1], ['floor', 2.4], ['roof', 1.6], ['table', 1.2], ['sofa', 1.0]],
    },
    'machine learning models need': {
      tokens: ['machine', 'learning', 'models', 'need'],
      attn:   [0.18, 0.30, 0.32, 0.20],
      next:   [['data', 3.4], ['training', 2.2], ['compute', 1.8], ['tuning', 1.1], ['labels', 0.9]],
    },
    'no code tools let you': {
      tokens: ['no', 'code', 'tools', 'let', 'you'],
      attn:   [0.22, 0.28, 0.26, 0.10, 0.14],
      next:   [['build', 3.2], ['create', 2.5], ['ship', 1.7], ['automate', 1.4], ['design', 1.0]],
    },
  };
  function softmax(logits, temp) {
    const t = Math.max(0.05, temp);
    const m = Math.max(...logits);
    const ex = logits.map(l => Math.exp((l - m) / t));
    const s = ex.reduce((a, b) => a + b, 0);
    return ex.map(e => e / s);
  }
  let lastPick = 0;
  function compute() {
    const M = MODELS[$('at-ctx').value];
    const temp = n('at-t', 0.7);
    const probs = softmax(M.next.map(c => c[1]), temp);
    return { M, temp, probs };
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const { M, temp, probs } = compute();
    setText('at-tv', temp.toFixed(1));

    // top: context tokens with attention shading
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cw = Math.min(96, (w - 30) / (M.tokens.length + 1));
    const x0 = 18, ty = 40;
    M.tokens.forEach((tok, i) => {
      const x = x0 + cw * i;
      const a = M.attn[i];
      ctx.fillStyle = `rgba(67,56,202,${0.12 + a * 0.8})`;
      ctx.beginPath(); ctx.rect(x, ty - 20, cw - 8, 30); ctx.fill();
      ctx.strokeStyle = RULE_H; ctx.lineWidth = 1; ctx.strokeRect(x, ty - 20, cw - 8, 30);
      ctx.fillStyle = a > 0.45 ? '#fff' : INK; ctx.font = '600 12px JetBrains Mono, monospace';
      ctx.fillText(tok, x + (cw - 8) / 2, ty);
      ctx.fillStyle = MUTED; ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText((a * 100).toFixed(0) + '%', x + (cw - 8) / 2, ty + 22);
    });
    // [?] query slot
    const qx = x0 + cw * M.tokens.length;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.rect(qx, ty - 20, cw - 8, 30); ctx.stroke();
    ctx.fillStyle = ACCENT; ctx.font = '600 14px JetBrains Mono, monospace';
    ctx.fillText('?', qx + (cw - 8) / 2, ty);

    ctx.fillStyle = MUTED; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('attention over context (darker = stronger) → softmax over candidates:', 18, 74);

    // bottom: candidate probability bars
    const by = h - 26, bt = 90;
    const bw2 = (w - 40) / M.next.length;
    ctx.textAlign = 'center';
    M.next.forEach((c, i) => {
      const x = 20 + bw2 * i;
      const bh = (by - bt) * probs[i];
      ctx.fillStyle = i === lastPick ? ACCENT : ACCENT_S;
      ctx.fillRect(x + bw2 * 0.15, by - bh, bw2 * 0.7, bh);
      ctx.fillStyle = INK; ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.fillText(c[0], x + bw2 / 2, by + 14);
      ctx.fillStyle = MUTED; ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText((probs[i] * 100).toFixed(0) + '%', x + bw2 / 2, by - bh - 4);
    });
    ctx.textAlign = 'left';

    setText('at-next', M.next[lastPick][0]);
    setText('at-conf', (probs[lastPick] * 100).toFixed(1) + '%');
  }
  function sample() {
    const { probs } = compute();
    let r = Math.random(), acc = 0; lastPick = 0;
    for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (r <= acc) { lastPick = i; break; } }
    draw();
  }
  $('at-ctx').addEventListener('change', () => { lastPick = 0; draw(); });
  $('at-t').addEventListener('input', () => {
    // keep greedy pick consistent with temperature change
    const { probs } = compute(); lastPick = probs.indexOf(Math.max(...probs)); draw();
  });
  $('at-sample').addEventListener('click', sample);
  window.addEventListener('resize', draw);
  // default to greedy pick
  (() => { const { probs } = compute(); lastPick = probs.indexOf(Math.max(...probs)); })();
  draw();
})();

// ============================================================
// 8. DIFFUSION — denoise from noise to a target (animated)
// ============================================================
(function diffusion() {
  const cv = $('cv-diffusion'); if (!cv) return;
  const GRID = 28;            // GRID x GRID "latent" pixels
  let target = [];            // target intensity per cell 0..1
  let noise = [];             // current random field 0..1
  let step = 0, raf = null, playing = false;

  function buildTarget() {
    const kind = $('df-target').value;
    target = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const x = (j + 0.5) / GRID - 0.5, y = (i + 0.5) / GRID - 0.5;
      const r = Math.hypot(x, y);
      let v = 0;
      if (kind === 'circle') v = r < 0.32 ? 1 : Math.max(0, 1 - (r - 0.32) * 5);
      else if (kind === 'rings') v = 0.5 + 0.5 * Math.cos(r * 28);
      else v = 1 - (y + 0.5); // gradient sky: bright top
      target.push(clamp(v, 0, 1));
    }
  }
  function reset() {
    cancel();
    buildTarget();
    noise = target.map(() => Math.random());
    step = 0; playing = false;
    setText('df-play', 'play');
    $('df-play').textContent = 'play';
    draw();
  }
  function cancel() { if (raf) cancelAnimationFrame(raf); raf = null; }

  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const total = n('df-s', 30);
    const side = Math.min(w * 0.5, h - 30);
    const cell = side / GRID;
    const ox = w * 0.5 - side - 16, oy = (h - side) / 2;
    const tx = w * 0.5 + 16;

    // current denoised image (left)
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const v = noise[i * GRID + j];
      const g = Math.round(v * 255);
      // tint toward accent for structure
      ctx.fillStyle = `rgb(${Math.round(67 + (255 - 67) * (1 - v) + g * 0)}, ${g}, ${Math.round(202 * v + g * (1 - v) * 0)})`;
      ctx.fillStyle = `rgb(${Math.round(g * 0.55 + 67 * (1 - v))},${Math.round(g * 0.7)},${Math.round(g * 0.5 + 202 * v)})`;
      ctx.fillRect(ox + j * cell, oy + i * cell, cell + 0.5, cell + 0.5);
    }
    ctx.strokeStyle = RULE; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, side, side);
    // target (right, faint)
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const v = target[i * GRID + j];
      const g = Math.round(v * 255);
      ctx.fillStyle = `rgb(${Math.round(g * 0.55)},${Math.round(g * 0.7)},${Math.round(g * 0.5 + 202 * v)})`;
      ctx.fillRect(tx + j * cell, oy + i * cell, cell + 0.5, cell + 0.5);
    }
    ctx.strokeStyle = RULE; ctx.strokeRect(tx, oy, side, side);
    ctx.fillStyle = MUTED; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('generated', ox + side / 2, oy - 6);
    ctx.fillText('prompt target', tx + side / 2, oy - 6);
    ctx.textAlign = 'left';

    const remaining = clamp(1 - step / total, 0, 1);
    setText('df-step', `${step} / ${total}`);
    setText('df-sv', total);
    setText('df-noise', Math.round(remaining * 100) + '%');
  }

  function stepOnce() {
    const total = n('df-s', 30);
    if (step >= total) { stop(); return; }
    step++;
    // move each cell a fraction toward target, with shrinking residual noise
    const alpha = 1 / (total - step + 1);
    const resid = clamp(1 - step / total, 0, 1);
    for (let k = 0; k < noise.length; k++) {
      const guided = noise[k] + (target[k] - noise[k]) * alpha;
      noise[k] = clamp(guided + (Math.random() - 0.5) * resid * 0.6, 0, 1);
    }
    draw();
  }
  function loop() { stepOnce(); if (playing && step < n('df-s', 30)) raf = requestAnimationFrame(loop); else stop(); }
  function stop() { playing = false; cancel(); $('df-play').textContent = 'play'; draw(); }
  function play() {
    if (playing) { stop(); return; }
    if (step >= n('df-s', 30)) reset();
    playing = true; $('df-play').textContent = 'pause';
    raf = requestAnimationFrame(loop);
  }
  $('df-play').addEventListener('click', play);
  $('df-reset').addEventListener('click', reset);
  $('df-s').addEventListener('input', () => { setText('df-sv', n('df-s', 30)); draw(); });
  $('df-target').addEventListener('change', reset);
  window.addEventListener('resize', draw);
  reset();
})();

// ============================================================
// 9. CHATBOT — keyword intent routing
// ============================================================
(function chatbot() {
  const cv = $('cv-bot'); if (!cv) return;
  const INTENTS = [
    { name: 'greeting', kw: ['hi', 'hello', 'hey', 'good morning', 'greetings'], reply: 'Hello! How can I help you today?' },
    { name: 'hours',    kw: ['hours', 'open', 'opening', 'close', 'closing', 'when'], reply: 'We are open Mon–Fri, 9:00–18:00.' },
    { name: 'pricing',  kw: ['price', 'pricing', 'cost', 'how much', 'plan', 'fee'], reply: 'Plans start at €9/month — see /pricing.' },
    { name: 'support',  kw: ['help', 'broken', 'error', 'bug', 'issue', 'problem', 'support'], reply: 'Sorry to hear that — opening a support ticket.' },
    { name: 'goodbye',  kw: ['bye', 'goodbye', 'thanks', 'thank you', 'see you'], reply: 'Thanks for stopping by. Goodbye!' },
  ];
  function score(msg) {
    const m = ' ' + msg.toLowerCase() + ' ';
    return INTENTS.map(it => {
      let s = 0;
      it.kw.forEach(k => { if (m.includes(' ' + k + ' ') || m.includes(k)) s += k.includes(' ') ? 2 : 1; });
      return { ...it, s };
    });
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const msg = $('bt-in').value || '';
    const scored = score(msg);
    const maxS = Math.max(1, ...scored.map(s => s.s));
    const best = scored.reduce((a, b) => (b.s > a.s ? b : a), scored[0]);
    const matched = best.s > 0 ? best : null;

    // bars per intent
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const rowH = (h - 30) / INTENTS.length;
    const bx = 110, bw = w - bx - 70;
    scored.forEach((it, i) => {
      const y = 18 + rowH * (i + 0.5);
      ctx.fillStyle = INK_S; ctx.font = '600 12px JetBrains Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText(it.name, bx - 10, y);
      ctx.fillStyle = RULE; ctx.fillRect(bx, y - 8, bw, 16);
      const frac = it.s / maxS;
      ctx.fillStyle = (matched && it.name === matched.name) ? ACCENT : ACCENT_S;
      ctx.fillRect(bx, y - 8, bw * frac, 16);
      ctx.fillStyle = MUTED; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText(it.s, bx + bw + 8, y);
    });
    ctx.textBaseline = 'alphabetic';

    const total = scored.reduce((a, b) => a + b.s, 0);
    const conf = matched ? matched.s / Math.max(1, total) : 0;
    setText('bt-intent', matched ? matched.name : 'fallback');
    $('bt-intent').style.color = matched ? ACCENT : WARN;
    setText('bt-conf', matched ? (conf * 100).toFixed(0) + '%' : '0%');
    setText('bt-reply', matched ? matched.reply : "Sorry, I didn't understand. Let me connect you to an agent.");
  }
  $('bt-in').addEventListener('input', draw);
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 10. NO-CODE DATABASE — filter rows like an Airtable view
// ============================================================
(function database() {
  const cv = $('cv-db'); if (!cv) return;
  const ROWS = [
    { name: 'Acme Co',   plan: 'pro',   mrr: 120, active: true },
    { name: 'Bloom',     plan: 'free',  mrr: 0,   active: true },
    { name: 'Corva',     plan: 'team',  mrr: 60,  active: false },
    { name: 'Delta Labs',plan: 'pro',   mrr: 110, active: true },
    { name: 'Echo',      plan: 'free',  mrr: 0,   active: false },
    { name: 'Forge',     plan: 'team',  mrr: 70,  active: true },
    { name: 'Glia',      plan: 'pro',   mrr: 150, active: true },
    { name: 'Hive',      plan: 'free',  mrr: 10,  active: true },
  ];
  function matches(r) {
    const field = $('db-field').value, op = $('db-op').value, val = n('db-v', 50);
    let cell;
    if (field === 'plan') cell = r.plan;
    else if (field === 'mrr') cell = r.mrr;
    else cell = r.active ? 1 : 0;
    if (field === 'plan') {
      // map slider value to plan tiers for eq, else compare lexically is odd — keep eq only meaningful
      const tiers = ['free', 'team', 'pro'];
      const target = tiers[clamp(Math.floor(val / 70), 0, 2)];
      if (op === 'eq') return cell === target;
      if (op === 'gt') return tiers.indexOf(cell) > tiers.indexOf(target);
      return tiers.indexOf(cell) < tiers.indexOf(target);
    }
    const num = field === 'active' ? (val >= 100 ? 1 : 0) : val;
    if (op === 'gt') return cell > num;
    if (op === 'lt') return cell < num;
    return cell === num;
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const field = $('db-field').value, op = $('db-op').value, val = n('db-v', 50);
    setText('db-vv', val);

    const cols = ['name', 'plan', 'mrr', 'active'];
    const colW = [w * 0.34, w * 0.2, w * 0.2, w * 0.2];
    const x0 = 14, y0 = 20, rh = Math.min(30, (h - 40) / (ROWS.length + 1));
    // header
    let cx = x0;
    ctx.font = '600 11px JetBrains Mono, monospace'; ctx.textBaseline = 'middle';
    cols.forEach((c, i) => {
      ctx.fillStyle = c === field ? ACCENT : INK_S; ctx.textAlign = 'left';
      ctx.fillText(c, cx + 6, y0 + rh / 2);
      cx += colW[i];
    });
    ctx.strokeStyle = RULE_H; ctx.beginPath(); ctx.moveTo(x0, y0 + rh); ctx.lineTo(x0 + colW.reduce((a, b) => a + b, 0), y0 + rh); ctx.stroke();

    let matched = 0, sum = 0;
    ROWS.forEach((r, ri) => {
      const y = y0 + rh * (ri + 1);
      const hit = matches(r);
      if (hit) { matched++; sum += r.mrr; ctx.fillStyle = ACCENT_S; ctx.fillRect(x0, y, colW.reduce((a, b) => a + b, 0), rh); }
      cx = x0;
      const vals = [r.name, r.plan, '€' + r.mrr, r.active ? 'true' : 'false'];
      vals.forEach((v, i) => {
        ctx.fillStyle = hit ? INK : MUTED; ctx.textAlign = 'left';
        ctx.font = (i === 0 ? '600 ' : '') + '11px JetBrains Mono, monospace';
        ctx.fillText(v, cx + 6, y + rh / 2);
        cx += colW[i];
      });
      ctx.strokeStyle = RULE; ctx.beginPath(); ctx.moveTo(x0, y + rh); ctx.lineTo(x0 + colW.reduce((a, b) => a + b, 0), y + rh); ctx.stroke();
    });
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    setText('db-match', `${matched} / ${ROWS.length}`);
    setText('db-sum', '€' + sum);
    const opSym = op === 'gt' ? '>' : op === 'lt' ? '<' : '=';
    let valLabel = val;
    if (field === 'plan') { const tiers = ['free', 'team', 'pro']; valLabel = tiers[clamp(Math.floor(val / 70), 0, 2)]; }
    if (field === 'active') valLabel = val >= 100 ? 'true' : 'false';
    setText('db-hint', `WHERE ${field} ${opSym} ${valLabel}`);
  }
  ['db-field', 'db-op'].forEach(id => $(id).addEventListener('change', draw));
  $('db-v').addEventListener('input', draw);
  window.addEventListener('resize', draw);
  draw();
})();

// ============================================================
// 11. IMPACT PRIORITISATION MATRIX — impact × feasibility 2×2
// ============================================================
(function impact() {
  const cv = $('cv-sdg'); if (!cv) return;
  const SOLUTIONS = [
    { name: 'AI crop scanner', i: 8, f: 6 },
    { name: 'Relief forms',    i: 6, f: 9 },
    { name: 'MH triage bot',   i: 9, f: 4 },
    { name: 'RPA for NGO',     i: 5, f: 8 },
    { name: 'GenAI tutoring',  i: 8, f: 7 },
  ];
  function sync() {
    const k = +$('sd-sel').value;
    $('sd-i').value = SOLUTIONS[k].i;
    $('sd-f').value = SOLUTIONS[k].f;
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const k = +$('sd-sel').value;
    SOLUTIONS[k].i = n('sd-i', 8);
    SOLUTIONS[k].f = n('sd-f', 6);
    setText('sd-iv', SOLUTIONS[k].i);
    setText('sd-fv', SOLUTIONS[k].f);

    const padL = 44, padR = 16, padT = 16, padB = 36;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const X = f => padL + plotW * (f - 0) / 10;
    const Y = im => padT + plotH * (1 - im / 10);

    // quadrant shading (top-right = do first)
    ctx.fillStyle = 'rgba(22,163,74,0.07)'; ctx.fillRect(X(5), padT, plotW / 2, plotH / 2);
    ctx.fillStyle = 'rgba(245,158,11,0.06)'; ctx.fillRect(padL, padT, plotW / 2, plotH / 2);
    ctx.fillStyle = 'rgba(67,56,202,0.05)'; ctx.fillRect(X(5), Y(5), plotW / 2, plotH / 2);
    ctx.fillStyle = 'rgba(220,38,38,0.05)'; ctx.fillRect(padL, Y(5), plotW / 2, plotH / 2);

    // axes + midlines
    ctx.strokeStyle = RULE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    ctx.strokeStyle = RULE_H; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(5), padT); ctx.lineTo(X(5), padT + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, Y(5)); ctx.lineTo(padL + plotW, Y(5)); ctx.stroke();
    ctx.setLineDash([]);

    // labels
    ctx.fillStyle = MUTED; ctx.font = '10px Inter, sans-serif';
    ctx.save(); ctx.translate(12, padT + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
    ctx.fillText('impact →', 0, 0); ctx.restore();
    ctx.textAlign = 'center'; ctx.fillText('feasibility →', padL + plotW / 2, h - 8);
    ctx.fillStyle = GOOD; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('DO FIRST', padL + plotW - 4, padT + 10);
    ctx.fillStyle = MUTED; ctx.textAlign = 'left';
    ctx.fillText('hard but vital', padL + 4, padT + 10);

    // points
    SOLUTIONS.forEach((s, idx) => {
      const px = X(s.f), py = Y(s.i);
      const cur = idx === k;
      ctx.beginPath(); ctx.arc(px, py, cur ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = cur ? ACCENT : ACCENT_S; ctx.fill();
      ctx.strokeStyle = cur ? ACCENT : RULE_H; ctx.lineWidth = cur ? 2 : 1; ctx.stroke();
      if (cur) { ctx.fillStyle = INK; ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s.name, px, py - 14); }
    });
    ctx.textAlign = 'left';

    const s = SOLUTIONS[k];
    let quad, col;
    if (s.f >= 5 && s.i >= 5) { quad = 'do first'; col = GOOD; }
    else if (s.f < 5 && s.i >= 5) { quad = 'hard but vital'; col = WARN; }
    else if (s.f >= 5 && s.i < 5) { quad = 'quick win'; col = ACCENT; }
    else { quad = 'deprioritise'; col = BAD; }
    setText('sd-quad', quad); $('sd-quad').style.color = col;
    setText('sd-score', (s.i * s.f).toString());
  }
  $('sd-sel').addEventListener('change', () => { sync(); draw(); });
  ['sd-i', 'sd-f'].forEach(id => $(id).addEventListener('input', draw));
  window.addEventListener('resize', draw);
  sync(); draw();
})();
