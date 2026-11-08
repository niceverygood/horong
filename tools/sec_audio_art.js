/* ---------- art (generated sprite atlas) ---------- */
const ATLAS = __ATLAS__;
const ART = { ok: false, meta: {}, src: null, d: 0 }; const EMIS = {}, ICON = {}, ICONURL = {}; let FIRE = null, FOX = null, INK = null, groundImg = null, groundImg2 = null;
const SW = s => s.width * (s._s || 1), SH = s => s.height * (s._s || 1);
// Flipbook VFX (Meshy gpt-image-2 sheets, luminance-keyed, drawn additively). Hit sparks are tinted per element.
const FX = {}, FXSRC = {};
const FX_TINT = { fire: '#ff8a3c', gold: '#ffd25a', wood: '#5cff9c', earth: '#ffbf4a', water: '#6aa0ff', red: '#ff4436' };
function buildFx(src) {
  const seq = (n, c) => Array.from({ length: c }, (_, i) => src[n + i]).filter(Boolean);
  for (const k of ['hit', 'fire', 'slash', 'slam', 'soul', 'pillar', 'ink', 'claw', 'geyser']) FXSRC[k] = seq('fx_' + k, 8);
  FXSRC.beam = seq('fx_beam', 4);
  FXSRC.circle = [src.fx_circle]; FXSRC.ring = [src.fx_ring];
  const tint = (c, col, k) => {
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d');
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = k; g.fillStyle = col; g.fillRect(0, 0, o.width, o.height); o._s = c._s; return o;
  };
  for (const k in FX_TINT) FXSRC['hit_' + k] = FXSRC.hit.map(c => tint(c, FX_TINT[k], 0.8));
  FXSRC.circle_v = [tint(src.fx_circle, '#a77cff', 0.8)];
  FXSRC.circle_b = [tint(src.fx_circle, '#7cc4ff', 0.8)];             // 지남철 vacuum
  FXSRC.pillar_j = FXSRC.pillar.map(c => tint(c, '#6dffb0', 0.75));   // 산삼 heal
  FXSRC.fire_p = FXSRC.fire.map(c => tint(c, '#ff5fb4', 0.7));         // 구미호 foxfire
  FXSRC.slash_p = FXSRC.slash.map(c => tint(c, '#ff7ab8', 0.75));      // 구미호 claw swipe
  FXSRC.pillar_o = FXSRC.pillar.map(c => tint(c, '#ff8a3a', 0.75));    // 불가살이 쇳물
}
const FLOAT = new Set(['egg', 'water', 'wisp', 'saja', 'gseun', 'sonkaksi', 'grim', 'crow']);
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
async function loadArt() {
  const [atlas, tile] = await Promise.all([loadImg('assets/sprites-__ATLAS_VER__.png'), loadImg('assets/ground.jpg')]);
  loadImg('assets/ground2.jpg').then(t2 => { groundPat2 = ctx.createPattern(t2, 'repeat'); if (groundPat2 && groundPat2.setTransform && window.DOMMatrix) { groundPat2.setTransform(new DOMMatrix([0.5, 0, 0, 0.5 * 0.62, 0, 0])); groundImg2 = t2; } }, () => {});   // 2탄 floor, not needed to start
  const src = {};
  for (const n in ATLAS.frames) {
    const [x, y, w, h] = ATLAS.frames[n], c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(atlas, x, y, w, h, 0, 0, w, h); c._s = 0.5; src[n] = c;
  }
  ART.src = src; buildFx(src);
  for (const id of [...Object.keys(WEAPONS), ...Object.keys(PASSIVES)]) { ICON[id] = src['i_' + id]; try { ICONURL[id] = ICON[id].toDataURL(); } catch (e) {} }
  groundPat = ctx.createPattern(tile, 'repeat');
  if (groundPat && groundPat.setTransform && window.DOMMatrix) { groundPat.setTransform(new DOMMatrix([0.5, 0, 0, 0.5 * 0.62, 0, 0])); groundImg = tile; }   // 2.5D: the floor is seen at the same tilt as the ellipses (y × 0.62)
  ART.meta = ATLAS.meta; ART.ok = true; ART.d = 0;
  applyArtScale();
}
// Resample every sprite once to the on-screen pixel density so frames draw 1:1 (no per-draw high-quality scaling).
function scaledArt(c, d) {
  const w = Math.max(1, Math.round(c.width * d / 2)), h = Math.max(1, Math.round(c.height * d / 2));
  if (w === c.width && h === c.height) return c;
  const o = document.createElement('canvas'); o.width = w; o.height = h;
  const g = o.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, w, h);
  o._s = (c.width / 2) / w; return o;
}
function applyArtScale() {
  if (!ART.ok) return;
  const d = clamp(Math.min(DPR, RES.art) * ZOOM, 0.6, 2);
  if (Math.abs(d - ART.d) < 0.04) return;
  ART.d = d;
  const A = {};
  for (const n in ART.src) if (!n.startsWith('i_') && !n.startsWith('fx_')) A[n] = scaledArt(ART.src[n], d);
  const dim = c => {   // brightness(0.72) baked in: black at 28% over the opaque pixels only
    if (!c) return c; const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d');
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, o.width, o.height); o._s = c._s; return o;
  };
  for (const who of ['yeoni', 'danbi']) for (const v of ['', '_ese', '_se', '_sse', '_s', '_ene', '_ne', '_nne', '_n']) { SPR[who + v] = [0, 1, 2, 3].map(i => A[who + v + i]); SPR[who + v + '_body'] = A[who + v + '_body']; SPR[who + v + '_foot'] = A[who + v + '_foot']; SPR[who + v + '_footD'] = dim(A[who + v + '_foot']); if (A[who + v + '_arm']) SPR[who + v + '_arm'] = A[who + v + '_arm']; }   // walk rig: feetless body + one foot (and its darker far copy)
  SPR.player = SPR.yeoni;
  for (const k in FXSRC) FX[k] = FXSRC[k].slice();   // effects keep source resolution: they are drawn at many sizes
  for (const k of ['japgwi', 'egg', 'water', 'dokkaebi', 'saja', 'wisp', 'gseun', 'gumiho', 'imugi', 'seg', 'gem1', 'gem2', 'gem3', 'oil', 'coin', 'rice', 'chest', 'jar', 'talisman', 'magnet', 'ginseng', 'gseun_p1', 'gseun_p2', 'gseun_p3', 'gumiho_p0', 'gumiho_p1', 'gumiho_p2', 'gumiho_p3', 'gumiho_r0', 'gumiho_r1', 'gumiho_r2', 'gumiho_r3', 'gumiho_r4', 'gumiho_r5', 'imugi_p0', 'imugi_p1', 'imugi_p2', 'imugi_p3', 'stall', 'jars', 'post', 'cart', 'tree', 'jangseung', 'shrine', 'well', 'bonfire', 'cairn', 'mat', 'peddler', 'skylantern', 'sotdae', 'stonelamp', 'sansin', 'spring', 'pagoda', 'offering', 'herbs', 'lotus', 'tbell', 'sonkaksi', 'grim', 'yagwang', 'crow', 'mangtae', 'totem', 'jangsan', 'jangsan_p1', 'jangsan_p2', 'jangsan_p3', 'dueok', 'dueok_p1', 'dueok_p2', 'dueok_p3', 'bulga', 'bulga_p1', 'bulga_p2', 'bulga_p3']) SPR[k] = A[k];
  for (const k of ['japgwi', 'egg', 'water', 'dokkaebi', 'saja', 'wisp', 'gseun', 'gumiho', 'imugi', 'seg', 'gseun_p1', 'gseun_p2', 'gseun_p3', 'gumiho_p0', 'gumiho_p1', 'gumiho_p2', 'gumiho_p3', 'gumiho_r0', 'gumiho_r1', 'gumiho_r2', 'gumiho_r3', 'gumiho_r4', 'gumiho_r5', 'imugi_p0', 'imugi_p1', 'imugi_p2', 'imugi_p3', 'sonkaksi', 'grim', 'yagwang', 'crow', 'mangtae', 'totem', 'jangsan', 'jangsan_p1', 'jangsan_p2', 'jangsan_p3', 'dueok', 'dueok_p1', 'dueok_p2', 'dueok_p3', 'bulga', 'bulga_p1', 'bulga_p2', 'bulga_p3']) SPRF[k] = whiteOf(SPR[k]);
  const off = (ART.meta && ART.meta.emisOff) || {};
  for (const n in A) if (n.endsWith('_e')) {
    const k = n.slice(0, -2), c = A[n], o = off[k] || [0, 0];
    c._ox = o[0] / 2; c._oy = o[1] / 2; EMIS[k] = c;   // offset of the cropped glow inside the full sprite, world units
  }
  FIRE = [0, 1, 2, 3].map(i => A['fire' + i]); FOX = [0, 1, 2, 3].map(i => A['fox' + i]);
  packAtlas();
}
// Pack every drawable sprite (characters, flash silhouettes, glow layers, effect frames, icons) into 2048² pages.
// Separate canvases cost a texture switch per draw (~0.2ms each in the built-in browser at 500 draws/frame);
// one shared page lets the 2D canvas batch them.
function packAtlas() {
  const items = [], holder = { INK };
  const take = (o, k) => { const v = o[k]; if (v && v.width > 0) items.push([o, k, v.src || v]); };
  const walk = o => { for (const k in o) { const v = o[k]; if (Array.isArray(v)) v.forEach((_, i) => take(v, i)); else take(o, k); } };
  walk(SPR); walk(SPRF); walk(EMIS); walk(GL); walk(ICON); if (FIRE) walk(FIRE); if (FOX) walk(FOX); take(holder, 'INK'); walk(FX);
  const uniq = [...new Set(items.map(it => it[2]))].sort((a, b) => b.height - a.height);
  const S = 2048, PAD = 2, pages = [], place = new Map();
  let pg = null, x = 0, y = 0, sh = 0;
  for (const c of uniq) {
    const w = c.width + PAD, h = c.height + PAD; if (w > S || h > S) continue;
    if (!pg) { pg = { list: [], h: 0 }; pages.push(pg); }
    if (x + w > S) { x = 0; y += sh; sh = 0; }
    if (y + h > S) { pg = { list: [], h: 0 }; pages.push(pg); x = 0; y = 0; sh = 0; }
    pg.list.push([c, x + 1, y + 1]); place.set(c, [pg, x + 1, y + 1]); x += w; sh = Math.max(sh, h); pg.h = Math.max(pg.h, y + h);
  }
  for (const p of pages) { const cv = document.createElement('canvas'); cv.width = S; cv.height = Math.max(4, p.h); const g = cv.getContext('2d'); for (const [c, px, py] of p.list) g.drawImage(c, px, py); p.cv = cv; }
  const reg = new Map();
  for (const [c, [p, px, py]] of place) reg.set(c, { at: p.cv, sx: px, sy: py, width: c.width, height: c.height, _s: c._s, _ox: c._ox, _oy: c._oy, src: c });
  for (const [o, k, c] of items) { const r = reg.get(c); if (r) o[k] = r; }
  INK = holder.INK;
  ART.pages = pages.length;
}
function buildInk() {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 48 + rnd(-14, 14), y = 48 + rnd(-10, 10), r = rnd(18, 30);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(6,8,22,0.55)'); gr.addColorStop(0.8, 'rgba(10,14,40,0.4)'); gr.addColorStop(1, 'rgba(40,60,140,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(8,10,30,0.6)'; g.beginPath(); g.arc(48 + rnd(-40, 40), 48 + rnd(-34, 34), rnd(1.5, 4), 0, TAU); g.fill(); }
  INK = c;
}

/* ---------- audio ---------- */
let AC = null, muted = false, sfxBus = null, bgm = null; const sfxLast = {}, BUF = {};
const SFX_FILE = { hit: 'hit', pick: 'gem', oil: 'oil', jar: 'jar', level: 'levelup', bell: 'bell', swing: 'swing', slam: 'slam', shoot: 'shoot', hurt: 'hurt', chest: 'chest', boss: 'boss', dark: 'dark', win: 'rooster', lose: 'lose', evolve: 'evolve', beam: 'beam', card: 'card', charm: 'charm', bossdie: 'bossdie', magnet: 'magnet', heal: 'heal' };
const SFX_VOL = { hit: 0.3, pick: 0.36, oil: 0.6, jar: 0.8, level: 0.7, bell: 0.4, swing: 0.3, slam: 0.5, shoot: 0.26, hurt: 0.7, chest: 0.8, boss: 0.9, dark: 0.7, win: 0.9, lose: 0.8, evolve: 0.85, beam: 0.65, card: 0.5, charm: 0.6, bossdie: 0.8, magnet: 0.85, heal: 0.6 };
function audioOn() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxBus = AC.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(AC.destination); loadSfx(); }
    catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
}
function loadSfx() {
  for (const [k, f] of Object.entries(SFX_FILE)) {
    fetch(`assets/sfx/${f}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(f)))
      .then(ab => new Promise((res, rej) => AC.decodeAudioData(ab, res, rej))).then(b => { BUF[k] = b; }).catch(() => {});
  }
}
function playBuf(k, rate, vol) {
  const src = AC.createBufferSource(), g = AC.createGain();
  src.buffer = BUF[k]; src.playbackRate.value = rate; g.gain.value = vol * (SFX_VOL[k] ?? 0.6);
  src.connect(g); g.connect(sfxBus); src.start();
}
function music(on) {
  try {
    if (!bgm) { bgm = new Audio('assets/bgm.mp3'); bgm.loop = true; bgm.volume = 0.3; bgm.preload = 'auto'; }
    bgm.muted = muted;
    if (on) { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); } else bgm.pause();
  } catch (e) {}
}
function musicVolume(v) { if (bgm) bgm.volume = v; }
function tone(freq, dur, type, vol, slide = 0, delay = 0) {
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.03);
}
function sfx(n, v = 0) {
  if (!AC || muted) return;
  const lim = { hit: 0.05, pick: 0.055, shoot: 0.09, bell: 0.1, swing: 0.1, slam: 0.12, oil: 0.08, bossdie: 0.2, card: 0.05, hurt: 0.12 }[n] || 0;
  const now = AC.currentTime; if (lim && sfxLast[n] && now - sfxLast[n] < lim) return; sfxLast[n] = now;
  if (BUF[n]) {
    let rate = 1;
    if (n === 'pick') rate = 1 + Math.min(v, 24) * 0.035;
    else if (n === 'hit' || n === 'swing' || n === 'shoot' || n === 'slam') rate = rnd(0.92, 1.08);
    try { playBuf(n, rate, 1); } catch (e) {}
    return;
  }
  const alias = { jar: 'oil', evolve: 'chest', bossdie: 'slam', charm: 'hurt', card: 'pick', beam: 'slam' };
  if (alias[n]) n = alias[n];
  try {
    switch (n) {
      case 'hit': tone(190 + Math.random() * 60, 0.05, 'square', 0.025, -110); break;
      case 'pick': tone(760 + Math.min(v, 24) * 28, 0.06, 'sine', 0.035, 380); break;
      case 'oil': tone(320, 0.16, 'sine', 0.06, 280); break;
      case 'shoot': tone(620, 0.07, 'triangle', 0.03, -260); break;
      case 'bell': tone(1320, 0.45, 'sine', 0.035); tone(1980, 0.3, 'sine', 0.02); break;
      case 'swing': tone(260, 0.1, 'triangle', 0.04, -140); break;
      case 'slam': tone(110, 0.25, 'sine', 0.09, -60); break;
      case 'hurt': tone(140, 0.16, 'sawtooth', 0.05, -80); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, 0, i * 0.07)); break;
      case 'chest': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, 0, i * 0.08)); break;
      case 'boss': tone(98, 1.6, 'sine', 0.12); tone(147, 1.4, 'sine', 0.06); break;
      case 'dark': tone(70, 1.2, 'sawtooth', 0.04, -20); break;
      case 'win': [523, 659, 784, 659, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.05, 0, i * 0.2)); break;
    }
  } catch (e) {}
}

