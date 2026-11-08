// Test-only bot for balance simulation. Not published.
const H = window.HORONG;
const press = (k, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { key: k }));
let held = [];
function setVec(x, y) {
  const want = [];
  if (x > 0.38) want.push('d'); if (x < -0.38) want.push('a');
  if (y > 0.38) want.push('s'); if (y < -0.38) want.push('w');
  held.filter(k => !want.includes(k)).forEach(k => press(k, false));
  want.filter(k => !held.includes(k)).forEach(k => press(k, true));
  held = want;
}
function release() { held.forEach(k => press(k, false)); held = []; }

// mode: 'smart' (fetch jars when light < jarAt, chests, else orbit), 'stand', 'greedy' (avoid oil, keep greed)
window.__run = (seconds, opt = {}) => {
  const pref = opt.pref || ['hollong', 'bell', 'oiljar', 'mirror', 'talisman', 'redink', 'yukmo', 'gat', 'club', 'shoes', 'rice', 'ink'];
  const jarAt = opt.jarAt ?? 60;
  const m = { lv: [], minute: [], dmgMin: [], hitsMin: [], healMin: [], riceMin: [], hpLost: 0, greedS: 0, darkS: 0, picks: {}, boss: {}, cause: null };
  const seen = {};
  let lastHp = H.P.hp, lastLv = H.P.level, lastMin = -1;
  if (H.G.state === 'paused') H.G.state = 'play';
  for (let i = 0; i < seconds * 60; i++) {
    if (H.G.state === 'levelup') {
      const cards = [...document.querySelectorAll('#cards .card')]; let best = 0, bs = 1e9;
      cards.forEach((c, j) => {
        const o = H.G.opts[j]; let s = o && o.id ? pref.indexOf(o.id) : 500; if (s < 0) s = 300;
        if (o && o.kind === 'w' && o.lv > 0) s -= 0.5; if (s < bs) { bs = s; best = j; }
      });
      const o = H.G.opts[best]; m.picks[o.id || o.kind] = (m.picks[o.id || o.kind] || 0) + 1; cards[best].click();
    }
    if (H.G.state !== 'play') break;
    const P = H.P, t = H.G.t;
    let tx = null, ty = null;
    if (opt.mode !== 'stand') {
      if (P.light < jarAt && H.jars.length) {
        let b = null, bd = 1e9; for (const j of H.jars) { const d = Math.hypot(j.x - P.x, j.y - P.y); if (d < bd) { bd = d; b = j; } }
        tx = b.x; ty = b.y;
      }
      if (tx === null) { const c = H.drops.find(d => d.k === 'chest'); if (c) { tx = c.x; ty = c.y; } }
    }
    if (opt.mode === 'avoid') {
      // human-like: flee nearby enemies (react within ~170px), drift toward goal, else slow orbit
      let vx = 0, vy = 0;
      for (const e of H.enemies) {
        if (e.dead) continue; const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy); const reach = (opt.reach ?? 170) + e.r * (e.scale || 1);
        const boss = opt.engage && (e.elite || (opt.engage === 'all' && e.boss)) && e.type !== 'dark' && P.hp > P.maxHp * 0.45;
        if (boss) {
          // human-like: close in on elites/bosses to get the chest, keep a short standoff
          const D = e.r * (e.scale || 1) * 0.8 + P.r + 34;
          if (d > D + 20 && d < 700) { vx -= dx / d * 1.1; vy -= dy / d * 1.1; } else if (d < D) { const w = (D - d) / D; vx += dx / d * (1 + 3 * w); vy += dy / d * (1 + 3 * w); }
          continue;
        }
        if (d < reach && d > 0.1) { const w = (reach - d) / reach; vx += dx / d * w * w * (e.big ? 3 : 1); vy += dy / d * w * w * (e.big ? 3 : 1); }
      }
      for (const z of (H.zones || [])) {   // read the telegraphs: step out of a filling zone, away from its centre / off the line
        if (z.fired || z.t < 0.15) continue;
        if (z.sh === 'c') { const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1; if (d < z.r + 26) { const w = 2.6 * (1 - d / (z.r + 26)) + 0.8; vx += dx / d * w; vy += dy / d * w; } }
        else { const ux = Math.cos(z.a), uy = Math.sin(z.a), px = P.x - z.x, py = P.y - z.y, al = px * ux + py * uy, side = px * uy - py * ux; if (al > -20 && al < z.len + 20 && Math.abs(side) < z.w / 2 + 26) { const sg = Math.sign(side) || 1; vx += uy * sg * 2.6; vy += -ux * sg * 2.6; } }
      }
      if (opt.dodgeFire !== false) for (const f of (H.eprojs || [])) {   // sidestep incoming fireballs like a player watching them
        if (f.k !== 'fire' && f.k !== 'fox' && f.k !== 'tal') continue; const px = P.x - f.x, py = P.y - f.y, d = Math.hypot(px, py); if (d > 150) continue;
        const sp = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sp, uy = f.vy / sp; if (px * ux + py * uy < 0) continue;
        const side = px * uy - py * ux; vx += uy * Math.sign(side || 1) * 2.2; vy += -ux * Math.sign(side || 1) * 2.2;
      }
      for (const o of (H.obs || [])) {   // props are solid now: veer off them like a player would instead of grinding into a wall
        if (o.broken) continue; const b = o.box, qx = Math.max(b[0], Math.min(P.x, b[2])), qy = Math.max(b[1], Math.min(P.y, b[3]));
        const dx = P.x - qx, dy = P.y - qy, d = Math.hypot(dx, dy); if (d < 36 && d > 0.1) { const w = (36 - d) / 36; vx += dx / d * w * 1.6; vy += dy / d * w * 1.6; }
      }
      if (H.G.beam) { const b = H.G.beam, ux = Math.cos(b.a), uy = Math.sin(b.a), px = P.x - b.x, py = P.y - b.y; const side = px * uy - py * ux; vx += uy * Math.sign(side) * 3; vy += -ux * Math.sign(side) * 3; }
      let gx, gy;
      if (tx !== null) { const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1; gx = dx / d * 0.8; gy = dy / d * 0.8; }
      else { const a = t * 0.35; gx = Math.cos(a) * 0.35; gy = Math.sin(a) * 0.35; }
      vx += gx; vy += gy; const l = Math.hypot(vx, vy) || 1; setVec(vx / l, vy / l);
    }
    else if (tx !== null) { const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1; setVec(dx / d, dy / d); }
    else if (opt.mode === 'stand') { const a = Math.floor(t / 3) * 1.57; if (t % 3 < 0.7) setVec(Math.cos(a), Math.sin(a)); else setVec(0, 0); }
    else { const a = t * (opt.orbit ?? 1.4); setVec(Math.cos(a), Math.sin(a)); }
    if (opt.god) P.iframe = 1;
    (H.upd ? H.upd(1 / 60) : H.step(1 / 60));
    if (P.hp < lastHp) { const k = Math.floor(H.G.t / 60); m.hpLost += lastHp - P.hp; m.dmgMin[k] = (m.dmgMin[k] || 0) + lastHp - P.hp; m.hitsMin[k] = (m.hitsMin[k] || 0) + 1; } else if (P.hp > lastHp) { const k = Math.floor(H.G.t / 60), g = P.hp - lastHp; m.healMin[k] = (m.healMin[k] || 0) + g; if (g >= 5) m.riceMin[k] = (m.riceMin[k] || 0) + 1; } lastHp = P.hp;
    if (P.level > lastLv) { m.lv.push(H.G.t); lastLv = P.level; }
    if (P.light <= 30) m.greedS += 1 / 60; if (P.light <= 0) m.darkS += 1 / 60;
    for (const b of H.G.bosses) if (!seen[b.id]) seen[b.id] = { type: b.type, t0: H.G.t, b };
    for (const id in seen) { const s = seen[id]; if (s.b.dead && !s.done) { s.done = true; m.boss[s.type + '@' + Math.round(s.t0)] = (s.b.silent ? 'left ' : 'kill ') + (H.G.t - s.t0).toFixed(1); } }
    const mn = Math.floor(H.G.t / 60);
    if (mn !== lastMin) { lastMin = mn; m.minute.push([mn, P.level, Math.round(P.hp), Math.round(P.light), H.enemies.length, P.kills].join(' ')); }
  }
  release();
  if (H.G.state === 'play') H.G.state = 'paused';
  for (const id in seen) { const s = seen[id]; if (!s.done) m.boss[s.type + '@' + Math.round(s.t0)] = `alive ${Math.round(s.b.hp)}/${Math.round(s.b.maxHp)}`; }
  const gaps = {}; m.lv.forEach((v, i) => { const k = Math.floor(v / 60); const g = i ? v - m.lv[i - 1] : v; (gaps[k] = gaps[k] || []).push(g); });
  m.lvGap = Object.entries(gaps).map(([k, a]) => `${k}m:${a.length}회/${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}s`).join(' ');
  delete m.lv;
  m.hpLost = Math.round(m.hpLost); m.greedS = Math.round(m.greedS); m.darkS = Math.round(m.darkS);
  m.end = { state: H.G.state, t: +H.G.t.toFixed(1), lv: H.P.level, hp: Math.round(H.P.hp), kills: H.P.kills, coins: H.P.coins,
    weapons: H.P.weapons.map(w => w.id + w.lv + (w.evo ? '*' : '')).join(','), passives: H.P.passives.map(p => p.id + p.lv).join(','), cause: H.P.lastHit || null };
  m.minute = m.minute.join(' | ');
  m.dmgMin = Array.from({ length: Math.ceil(H.G.t / 60) }, (_, i) => `${i}m:${Math.round(m.dmgMin[i] || 0)}/${m.hitsMin[i] || 0}`).join(' '); delete m.hitsMin;
  m.healMin = Array.from({ length: Math.ceil(H.G.t / 60) }, (_, i) => `${i}m:${Math.round(m.healMin[i] || 0)}/${m.riceMin[i] || 0}`).join(' '); delete m.riceMin;
  return m;
};
window.__newRun = (char = 'yeoni') => {
  const sel = [...document.querySelectorAll('.char')].find(b => b.textContent.includes(char === 'danbi' ? '단비' : '연이'));
  if (sel) sel.click();
  document.querySelector('#btn-start').click();
};
// n runs per config → win rate, damage taken per phase (0-3 / 3-6 / 6-7 / 7-10 min), boss results
window.__batch = (n, cfgs) => {
  const out = {};
  for (const [name, ch, o] of cfgs) {
    const rs = [];
    for (let i = 0; i < n; i++) {
      if (H.G.state !== 'title') { H.G.state = 'over'; document.querySelector('#btn-over-home').click(); }
      __newRun(ch); const r = __run(600, { mode: 'avoid', jarAt: 60, ...o });
      const dm = r.dmgMin.split(' ').map(s => +s.split(':')[1].split('/')[0]);
      const sum = (a, b) => dm.slice(a, b).reduce((x, y) => x + y, 0);
      rs.push({ win: r.end.t >= 600, t: Math.round(r.end.t), lv: r.end.lv, d03: sum(0, 3), d36: sum(3, 6), d6: sum(6, 7), d710: sum(7, 10), cause: r.end.cause, evo: (r.end.weapons.match(/\*/g) || []).length,
        boss: Object.entries(r.boss).map(([k, v]) => k.split('@')[0][0] + k.split('@')[1] + ':' + v.split(' ')[0][0] + (v.split(' ')[1] || '').split('.')[0]).join(','), late: r.dmgMin.split(' ').slice(6).join(' ') });
    }
    const wins = rs.filter(r => r.win).length, evoR = rs.filter(r => r.evo >= 1);
    out[name] = { wins: `${wins}/${n}`, evoRuns: evoR.length, evoD710: evoR.length ? Math.round(evoR.reduce((a, r) => a + r.d710, 0) / evoR.length) : null,
      runs: rs.map(r => `${r.win ? 'W' : 'L' + r.t} lv${r.lv} e${r.evo} d${r.d03}/${r.d36}/${r.d6}/${r.d710} ${r.boss} ${r.win ? '' : r.cause} | ${r.late}`) };
  }
  return out;
};
