/* ---------- render ---------- */
// Every sprite lives in one runtime atlas page (see packAtlas): consecutive draws share a texture and batch.
function dI(img, x, y, w, h) {
  if (img.at) ctx.drawImage(img.at, img.sx, img.sy, img.width, img.height, x, y, w === undefined ? img.width : w, h === undefined ? img.height : h);
  else if (w === undefined) ctx.drawImage(img, x, y); else ctx.drawImage(img, x, y, w, h);
}
const camX = () => P.x + (G.cox || 0), camY = () => P.y + (G.coy || 0);
function toScreen(x, y) { return [W / 2 + (x - camX()) * ZOOM + G.shx, H / 2 + (y - camY()) * ZOOM + G.shy]; }
function inView(x, y, m) { return Math.abs(x - camX()) < VW + m && Math.abs(y - camY()) < VH + m; }
const easeOut3 = k => 1 - Math.pow(1 - k, 3);
function enemyPose(e, pose) {
  const pz = pose === undefined ? e.pose : pose, ps = pz ? SPR[e.spr + '_' + pz] : null, base = ps || SPR[e.spr], k = e.type === 'gseun' ? 0.8 : 1;
  const w = SW(base) * e.scale * k, h = SH(base) * e.scale * k;
  let x = e.rx ?? e.x, y = (e.ry ?? e.y) + e.r * 0.75, sx = (e.fs ?? e.fx) < 0 ? -1 : 1, sy = 1, rot = 0;
  const vx = e.mvx || 0, sp = Math.hypot(vx, e.mvy || 0);
  if (e.type === 'gseun') {   // a slow hover that breathes and leans into the drift
    y += Math.sin(G.t * 1.6 + e.bob) * 4 - 4;
    rot = clamp(vx / 140, -1, 1) * 0.1 + Math.sin(G.t * 1.1 + e.bob) * 0.025;
    const br = Math.sin(G.t * 2.2 + e.bob); sy *= 1 + br * 0.025; sx *= 1 - br * 0.015;
    const A = e.act;
    if (A && A.k === 'lunge' && A.t >= 0.6 && !A.land) { sx *= 1.22; sy *= 0.86; rot = 0; }        // stretched along the throw
    else if (A && A.k === 'lunge' && A.t < 0.6) { const q = A.t / 0.6; sy *= 1 - 0.1 * q; sx *= 1 + 0.06 * q; }   // coils before it
  } else if (e.type === 'gumiho' || e.type === 'clone') {   // gallop: leap, pitch, squash on landing; breathe when still
    const run = e.act ? 0 : clamp((sp - 30) / 80, 0, 1), ph = (e.wk || 0) * 0.11 + e.bob, s1 = Math.sin(ph), face = sx;   // ≈2 strides/s at orbit speed
    y -= Math.max(0, s1) * 10 * run;
    rot = -Math.cos(ph) * 0.07 * run * face;
    const land = Math.max(0, -s1); sy *= 1 - 0.11 * land * run + Math.max(0, s1) * 0.04 * run; sx *= 1 + 0.09 * land * run + Math.max(0, s1) * 0.06 * run;
    const br = Math.sin(G.t * 2 + e.bob) * (1 - run); sy *= 1 + br * 0.02;
  } else if (FLOAT.has(e.type)) { y += Math.sin(G.t * 3 + e.bob) * 3 - 3; rot = Math.sin(G.t * 1.7 + e.bob) * 0.05; }
  else {
    const ph = (e.wk || 0) * (e.big ? 0.11 : 0.19) + e.bob, amp = e.big ? 0.45 : 1, c2 = Math.cos(2 * ph);
    y -= Math.abs(Math.sin(ph)) * 2.4 * amp;                     // two hops per stride
    sy = 1 - c2 * 0.05 * amp; sx *= 1 + c2 * 0.035 * amp;        // squash on contact, stretch at apex
    rot = Math.sin(ph) * 0.06 * amp + clamp(vx / 90, -1, 1) * 0.05;   // waddle + lean into the move
  }
  if (e.turnT > 0) { const q = e.turnT / 0.13; y -= Math.sin(q * Math.PI) * 3; sx *= 1 - 0.08 * q; sy *= 1 + 0.07 * q; }   // hop-turn
  if (e.type === 'egg' && e.st === 'wind') x += rnd(-1.5, 1.5);
  if (pz !== undefined && pz !== null && pose === undefined) {
    const pu = Math.max(0, 1 - (e.poseT || 0) / 0.14); sx *= 1 + 0.1 * pu; sy *= 1 - 0.1 * pu;   // each new pose lands with a squash
    if (pz === 'p1' && !REDUCED) x += Math.sin(G.t * 55) * 1.3;                          // wind-up shiver
  }
  if (e.atk === 'wind') { const q = 1 - e.atkT / 0.4; sy *= 1 - 0.14 * q; sx *= 1 + 0.1 * q; x += Math.sin(G.t * 60) * 1.2; }   // crouch, club up
  else if (e.atk === 'lunge') { sx *= 1.14; sy *= 0.9; y -= 6; rot = (e.lvx < 0 ? -1 : 1) * 0.18; }
  if (e.sk) {
    if (e.sk.k === 'roll' && e.sk.t > 0.25) { rot = e.sk.t * 16 * (e.fx < 0 ? -1 : 1); y -= 4; }
    else if (e.sk.k === 'burst') { const q = Math.min(1, e.sk.t / 0.5); sx *= 1 + 0.35 * q + Math.sin(G.t * 40) * 0.06 * q; sy *= 1 + 0.35 * q; }
  }
  if (e.stun > 0) rot = Math.sin(G.t * 30) * 0.12;
  return { base, w, h, x, y, sx, sy, rot };
}
// Bosses are drawn in strips so the drawing itself moves: 그슨대's robe ripples in rows (strongest at the hem, trailing
// against the drift); 구미호's tails ripple in columns from the root out to the tips. Pose changes cross-fade.
function drawDeform(e, img, p) {
  if (!img || !img.at) { drawPose(img, p); return; }
  const s = WM[0], c = Math.cos(p.rot), n = Math.sin(p.rot);
  ctx.setTransform(s * c * p.sx, s * n * p.sx, -s * n * p.sy, s * c * p.sy, s * p.x + WM[1], s * p.y + WM[2]);
  const at = img.at, ax = img.sx, ay = img.sy, Ws = img.width, Hs = img.height, kx = p.w / Ws, ky = p.h / Hs, t = G.t, b = e.bob || 0;
  const sp = Math.hypot(e.mvx || 0, e.mvy || 0);
  if (e.type === 'gseun') {
    const drag = -clamp((e.mvx || 0) / 90, -1, 1) * 8 * e.scale, A1 = 3.4 * e.scale, A2 = 1.5 * e.scale, N = 26;
    for (let j = 0; j < N; j++) {
      const y0 = Math.floor(Hs * j / N), y1 = Math.floor(Hs * (j + 1) / N), v = (y0 + y1) / 2 / Hs, wv = Math.pow(clamp((v - 0.28) / 0.72, 0, 1), 1.25);
      const dx = wv * (A1 * Math.sin(t * 2.6 - v * 6 + b) + A2 * Math.sin(t * 4.3 + v * 10 + b * 2) + drag);
      ctx.drawImage(at, ax, ay + y0, Ws, y1 - y0 + 1, -p.w / 2 + dx / p.sx, -p.h + y0 * ky, p.w, (y1 - y0 + 1) * ky);
    }
    return;
  }
  // 구미호: tails are on the image's left (the fox faces right); the 'howl' pose fans them on both sides
  const run = clamp((sp - 30) / 80, 0, 1), both = e.pose === 'p3', N = 30, A = (2.2 + 2.6 * run) * (e.type === 'clone' ? 0.9 : 1), f = 3.2 + 5.5 * run;
  for (let j = 0; j < N; j++) {
    const x0 = Math.floor(Ws * j / N), x1 = Math.floor(Ws * (j + 1) / N), u = (x0 + x1) / 2 / Ws;
    const root = both ? Math.abs(u - 0.5) * 2 : 1 - u, wv = Math.pow(clamp((root - 0.42) / 0.58, 0, 1), 1.4);
    const dy = wv * (A * Math.sin(t * f - root * 5.5 + b) + A * 0.4 * Math.sin(t * f * 1.7 + root * 9 + b));
    ctx.drawImage(at, ax + x0, ay, x1 - x0 + 1, Hs, -p.w / 2 + x0 * kx, -p.h + dy / p.sy, (x1 - x0 + 1) * kx, p.h);
  }
}
function drawBoss(e) {
  const a0 = e.alpha || 1, k = e.prevPose !== undefined && (e.poseT ?? 9) < 0.12 ? (e.poseT || 0) / 0.12 : 1;
  if (k < 1) {   // the outgoing pose fades as the new one comes in
    const pp = enemyPose(e, e.prevPose); ctx.globalAlpha = a0 * (1 - k); drawDeform(e, pp.base, pp);
  }
  const p = enemyPose(e); ctx.globalAlpha = a0 * (0.35 + 0.65 * k); drawDeform(e, p.base, p);
  const fl = SPRF[e.pose ? e.spr + '_' + e.pose : e.spr] || SPRF[e.spr];
  if (e.flash > 0 && fl) { ctx.globalAlpha = 0.6 * a0; drawDeform(e, fl.at ? fl : fl, { ...p, base: fl }); }
  ctx.globalAlpha = 1;
}
// 8 views: E, SE, S, SW, W, NW, N, NE. West-side views mirror the east ones; S and N keep the side she last faced.
const OCT = [['', 1], ['_se', 1], ['_s', 0], ['_se', -1], ['', -1], ['_ne', -1], ['_n', 0], ['_ne', 1]];
function playerView() {
  const o = OCT[P.d || 0], who = P.spr === 'danbi' ? 'danbi' : 'yeoni', name = who + o[0], fr = SPR[name];
  return { name, frames: fr && fr[0] ? fr : SPR[P.spr], flip: o[1] || P.side || 1, ax: fr && ART.meta.ax ? ART.meta.ax[name] || 0 : 0 };
}
// Cut-out walk rig: each view keeps ONE drawing (META.rig picks it and finds the skirt hem and the gap between
// the feet). The feet below the hem are two pieces that step (stance slides back, swing lifts and comes forward),
// the skirt swings as strips under the waist, and the body dips on each contact. Nothing swaps between drawings,
// so there is no flicker, at any frame rate.
const RIGMODE = { '': 'side', '_se': 'dfront', '_s': 'front', '_ne': 'dback', '_n': 'back' };
const STEP_K = 1.25;   // walk phase (rad) per walk unit (P.walk += px / 15): ≈ 4 steps/s at base speed
function footPhase(u) {   // unit stride profile: stance slides front→back linearly, swing comes back→front with a lift
  if (u < 0.5) return [1 - 4 * u, 0];
  const k = (u - 0.5) * 2, e = k * k * (3 - 2 * k);
  return [-1 + 2 * e, Math.sin(Math.PI * k)];
}
function walkPose() {
  const v = playerView(), sp = Math.min(1, P.spd01 || 0), th = (P.walk || 0) * STEP_K, u1 = ((th / TAU) % 1 + 1) % 1;
  const R = ART.ok && ART.meta.rig ? ART.meta.rig[v.name] : null, mode = RIGMODE[v.name.replace(/^(yeoni|danbi)/, '')] || 'side';
  const bob = (1 - Math.cos(4 * Math.PI * u1)) * 0.5 * 1.3 * sp;                       // up while the feet pass, down on contact
  const sway = (mode === 'front' || mode === 'back' ? 0.9 : mode === 'side' ? 0 : 0.5) * Math.sin(TAU * u1) * sp;   // weight over the stance foot
  const base = R ? R.base : 0;
  return (P._pose = { v, a: base, b: base, f: 0, bob, sway, sp, th, u1, R, mode });
}
function lanternOff() {
  const q = P._pose, v = playerView(), L = ART.ok && ART.meta.lampF ? ART.meta.lampF[v.name] : null;
  let lp = ART.ok && ART.meta.lamp ? ART.meta.lamp[v.name] : null;
  if (q && L && L[q.a] && L[q.b]) lp = [L[q.a][0] + (L[q.b][0] - L[q.a][0]) * q.f, L[q.a][1] + (L[q.b][1] - L[q.a][1]) * q.f];   // the light swings with the drawn lantern
  return lp ? [(lp[0] - v.ax) * v.flip + (q ? q.sway : 0), lp[1] + 12 - (q ? q.bob : 0)] : [13 * (P.side || 1), -5];
}
// Cross-dissolve two walk drawings at sprite resolution: (1-f)·A + f·B with 'lighter' is an exact premultiplied mix,
// so the unchanged body stays opaque and only the feet, hem and lantern move between drawings.
const PB = document.createElement('canvas'), PBX = PB.getContext('2d');
function rawDraw(c, img, w, h) { if (img.at) c.drawImage(img.at, img.sx, img.sy, img.width, img.height, 0, 0, w, h); else c.drawImage(img, 0, 0, w, h); }
function blendFrames(a, b, f) {
  const w = a.width, h = a.height;
  if (PB.width !== w || PB.height !== h) { PB.width = w; PB.height = h; } else PBX.clearRect(0, 0, w, h);
  if (f < 0.999) { PBX.globalAlpha = 1 - f; rawDraw(PBX, a, w, h); }
  if (f > 0.001) { PBX.globalCompositeOperation = 'lighter'; PBX.globalAlpha = f; rawDraw(PBX, b, w, h); PBX.globalCompositeOperation = 'source-over'; }
  PBX.globalAlpha = 1; return PB;
}
function drawPlayer() {
  worldT();
  const q = walkPose(), v = q.v, frames = v.frames, A = frames[q.a] || frames[0];
  if (P.iframe > 0 && Math.floor(G.t * 20) % 2) return;
  const pw = SW(A), ph = SH(A), breathe = 1 + Math.sin(G.t * 2.4) * 0.018 * (1 - q.sp), gb = gearPoses(q, ph);
  const lean = clamp((P.vx || 0) / 150, -1.2, 1.2) * 0.05 + gb.rot, tk = 1 - 0.035 * (P.turnK || 0), sx = (2 - tk) * gb.sx, sy = breathe * tk * gb.sy;
  const x0 = -pw / 2 - v.ax, ox = P.x + q.sway + gb.dx, oy = P.y + 12 - q.bob + gb.dy;
  if (gb.list.length) drawGear(gb.list, ox, oy, lean, true);
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(lean); ctx.scale(v.flip * sx, sy);
  if (q.R && A.at) drawRig(A, q, pw, ph, x0, v.flip);
  else dI(A, x0, -ph, pw, ph);
  ctx.restore();
  if (gb.list.length) drawGear(gb.list, ox, oy, lean, false);
}
function drawRig(img, q, pw, ph, x0, flip) {
  const R = q.R, name = q.v.name, body = SPR[name + '_body'], foot = SPR[name + '_foot'];
  if (!body || !foot || !body.at) { dI(img, x0, -ph, pw, ph); return; }
  const Wd = body.width, Hd = body.height, kx = pw / Wd, ky = ph / Hd, wr = pw / R.w, hr = ph / R.h;   // world px per atlas px / per rig px
  const at = body.at, ax = body.sx, ay = body.sy, sp = q.sp, u = q.u1;
  const cut = (sy0, sh, dx) => ctx.drawImage(at, ax, ay + sy0, Wd, sh, x0 + dx, -ph + sy0 * ky, pw, sh * ky);
  // feet: the one foot sprite, twice. Side views: feet cross over (far one darker, drawn first); front/back: mirrored pair.
  const fw = SW(foot), fh = SH(foot), gy = -ph + R.gy * hr, fc = x0 + R.fc * wr;
  const side = q.mode === 'side' || q.mode === 'dfront' || q.mode === 'dback';
  const dep = q.mode === 'front' ? 1 : q.mode === 'back' ? -1 : q.mode === 'dfront' ? 0.45 : q.mode === 'dback' ? -0.45 : 0;
  const stride = side ? clamp(R.sep * wr * 0.5, 3.5, 7) * (q.mode === 'side' ? 1 : 0.75) : 0, gap = side ? 0 : Math.max(3, R.fw * wr * 0.42);
  const plant = q.bob * 0.7;   // the feet stay on the ground while the body dips and rises
  const F = [0, 1].map(i => { const [pos, lift] = footPhase((u + (i ? 0 : 0.5)) % 1); return { i, pos, lift }; });
  if (side) F.sort((a, b) => a.i - b.i);   // piece 0 = far foot
  for (const f of F) {
    const s0 = f.pos * sp, x = side ? fc + s0 * stride : fc + (f.i ? gap : -gap), y = gy + plant - f.lift * 1.7 * sp + s0 * 0.9 * dep;
    const mirror = !side && f.i === 0, far = side && f.i === 0;
    ctx.save(); ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);
    if (far) ctx.filter = 'brightness(0.72)';
    dI(foot, -fw / 2, -fh, fw, fh);
    ctx.restore();
  }
  // body above the waist in one piece; the skirt below it in strips that swing out toward the hem
  const hip = Math.round(Hd * 0.5);
  cut(0, hip + 1, 0);
  const front = q.mode === 'front' || q.mode === 'back';
  const kick = side ? Math.sin(4 * Math.PI * u - 0.5) * 0.7 + Math.sin(TAU * u - 0.7) * 0.3 : Math.sin(TAU * u - 0.7) * 0.9;   // world px at the hem
  const trail = clamp(P.hem || 0, -3, 3) * flip;
  const n = Math.max(8, Math.round((Hd - hip) / 2));
  for (let j = 0; j < n; j++) {
    const y0 = hip + Math.floor((Hd - hip) * j / n), y1 = hip + Math.floor((Hd - hip) * (j + 1) / n), t = ((y0 + y1) / 2 - hip) / (Hd - hip), w = Math.pow(t, 1.7);
    cut(y0, y1 - y0 + 1, (kick * sp * (front ? 1.2 : 1) + trail) * w);
  }
}
/* ---------- held gear ----------
   Weapons that are things (clubs, bell, brush, talisman; a lantern for 단비) are worn on the body and come to the
   hand when they fire. A pose is screen-space relative to the feet: grip point (x, y), axis angle a, foreshortening f,
   and whether it sits behind the body. Swings are authored as ground-plane angles and projected (y × 0.5). */
const GEAR = {   // icon px: grip and tip; len as a share of body height
  club: { g: [19.5, 55.5], t: [43.6, 2.3], len: 0.76, col: '160,255,200' },
  yukmo: { g: [25.5, 55], t: [55.7, 2.4], len: 0.74, col: '255,214,120' },
  bell: { g: [43.5, 1], t: [19, 62.4], len: 0.36, col: '255,226,150' },
  ink: { g: [46, 6], t: [21.5, 61.2], len: 0.5, col: '140,160,255' },
  talisman: { g: [26.1, 59.2], t: [43.4, 3.1], len: 0.3, col: '255,190,90' },
  hollong: { g: [32.9, 1.9], t: [30.6, 61.2], len: 0.38, col: '255,180,90' },
};
const easeIO = k => k * k * (3 - 2 * k), easeOut2 = k => 1 - (1 - k) * (1 - k);
function gpose(phi, ph, lift = 0, reach = 5) {   // a swing pose: hand on a small shoulder circle, item along the ground angle phi
  const x = Math.cos(phi), y = Math.sin(phi) * 0.5 - lift;
  return { x: Math.cos(phi) * reach, y: -0.45 * ph + Math.sin(phi) * reach * 0.5 - lift * 22, a: Math.atan2(y, x), f: Math.max(0.35, Math.hypot(x, y)), back: Math.sin(phi) < -0.2 };
}
function lpose(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), a: a.a + angDiff(b.a, a.a) * k, f: lerp(a.f, b.f, k), back: k < 0.5 ? a.back : b.back }; }
function aimPose(hx, hy, tx, ty, L) { const dx = tx - hx, dy = ty - hy; return { x: hx, y: hy, a: Math.atan2(dy, dx), f: clamp(Math.hypot(dx, dy) / L, 0.35, 1), back: false }; }
function gearPoses(q, ph) {
  const out = { list: [], dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
  if (!P.weapons || !P.weapons.length || !ART.ok) return out;
  const s = P.side || 1, north = P.d >= 5 && P.d <= 7, fa0 = Math.atan2(P.face.y, P.face.x), danbi = P.spr === 'danbi';
  const swing = Math.sin(q.th || 0) * q.sp;   // hip items swing with the stride
  for (const w of P.weapons) {
    const S = GEAR[w.id]; if (!S || (w.id === 'hollong' && !danbi)) continue;
    const img = ICON[w.id]; if (!img) continue;
    const L = S.len * ph, wind = w.wuAt > (w.at ?? -9) && G.t - w.wuAt < GEAR_WU[w.id] + 0.35, wk = wind ? clamp((G.t - w.wuAt) / GEAR_WU[w.id], 0, 1) : 0, h = w.at === undefined ? 9 : G.t - w.at;   // a wind-up with nothing to throw at lowers again
    let pose, alpha = 1, smear = null;
    if (w.id === 'club') {
      const rest = { x: -s * 6, y: -0.36 * ph, a: -Math.PI / 2 - s * 0.62, f: 1, back: !north };
      const d = w.dir || 1, fa = wind ? fa0 : (w.fa ?? fa0);
      if (wind) { pose = lpose(rest, gpose(fa - d * 1.9, ph, 0.35), easeOut2(wk)); out.dx -= Math.cos(fa) * 2 * wk; out.sy *= 1 - 0.03 * wk; out.sx *= 1 + 0.02 * wk; }
      else if (h < 0.09) { const k = easeOut2(h / 0.09); pose = gpose(fa - d * 1.5 + d * 3 * k, ph, 0.35 * (1 - k)); smear = { a0: fa - d * 1.5, a1: fa - d * 1.5 + d * 3 * k, al: 1 }; }
      else if (h < 0.24) { const k = easeOut2((h - 0.09) / 0.15); pose = gpose(fa + d * (1.5 + 0.4 * k), ph); smear = { a0: fa - d * 1.5, a1: fa + d * 1.5, al: 1 - k }; }
      else if (h < 0.5) pose = lpose(gpose(fa + d * 1.9, ph), rest, easeIO((h - 0.24) / 0.26));
      else pose = rest;
      if (!wind && h < 0.3) { const e = h < 0.06 ? h / 0.06 : 1 - (h - 0.06) / 0.24; out.dx += Math.cos(fa) * 3 * e; out.dy += Math.sin(fa) * 1.5 * e; out.rot += Math.cos(fa) * 0.08 * e; out.sy *= 1 + 0.03 * e; }
    } else if (w.id === 'yukmo') {
      const rest = { x: s * 4, y: -0.34 * ph, a: -Math.PI / 2 + s * 0.5, f: 1, back: !north };
      const d = s, fa = fa0, p0 = fa - d * Math.PI / 2;
      const plant = () => aimPose(Math.cos(fa) * 8, -0.42 * ph + Math.sin(fa) * 4, Math.cos(fa) * 30, Math.sin(fa) * 15, L);
      if (wind) {
        const t = wk * GEAR_WU.yukmo;
        if (t < 0.08) pose = lpose(rest, gpose(p0, ph, 0.1, 7), easeOut2(t / 0.08));
        else { const u = (t - 0.08) / 0.22, ph2 = p0 + d * 2.5 * Math.PI * u * u; pose = gpose(ph2, ph, 0.08, 7); smear = { a0: ph2 - d * Math.min(1.8, u * 4), a1: ph2, al: 0.9, r: 1 }; out.dy -= Math.sin(Math.PI * u) * 6; }
      } else if (h < 0.07) pose = lpose(gpose(fa, ph, 0.08, 7), plant(), easeOut2(h / 0.07));
      else if (h < 0.28) pose = plant();
      else if (h < 0.6) pose = lpose(plant(), rest, easeIO((h - 0.28) / 0.32));
      else pose = rest;
      if (!wind && h < 0.2) { const e = 1 - h / 0.2; out.sy *= 1 - 0.12 * e; out.sx *= 1 + 0.08 * e; out.dy += 1.5 * e; }
    } else if (w.id === 'bell') {
      const act = h < 0.4 ? 1 - h / 0.4 : 0;
      if (danbi) { if (act > 0) { out.rot += Math.sin(h * 40) * 0.035 * act; out.dy -= Math.sin(Math.min(1, h / 0.12) * Math.PI) * 2.5; } continue; }   // her staff already has the bells
      const rest = { x: -s * 9, y: -0.4 * ph, a: Math.PI / 2 + swing * 0.3, f: 1, back: false };
      const up = { x: Math.cos(fa0) * 12, y: -1.02 * ph, a: Math.PI / 2, f: 1, back: Math.sin(fa0) < -0.3 };   // held up over the head
      if (wind) pose = lpose(rest, up, easeOut2(wk));
      else if (h < 0.4) { pose = { ...up, a: Math.PI / 2 + Math.sin(h * 45) * 0.55 * act }; out.rot += Math.sin(h * 40) * 0.03 * act; }
      else if (h < 0.65) pose = lpose(up, rest, easeIO((h - 0.4) / 0.25));
      else pose = rest;
    } else if (w.id === 'ink') {
      const rest = { x: -s * 7, y: -0.42 * ph, a: Math.PI / 2 + s * 0.45, f: 1, back: false };
      const m = clamp((P.spd01 || 0) * 1.4, 0, 1), cx = Math.cos(fa0), cy = Math.sin(fa0), wob = Math.sin(Math.PI * (P.walk || 0)) * 3;
      const drag = aimPose(-cx * 6, -0.4 * ph - cy * 2, -cx * 18 + wob * cy, 5 - cy * 9 - wob * cx * 0.5, L);
      drag.back = cy > 0.3; if (h < 0.15) drag.f *= 1 - 0.18 * Math.sin(Math.PI * h / 0.15);   // dab as each puddle drops
      pose = lpose(rest, drag, easeIO(m));
    } else if (w.id === 'talisman') {
      const rest = { x: -s * 5, y: -0.5 * ph, a: -Math.PI / 2 - s * 0.35 + Math.sin(G.t * 3) * 0.05, f: 1, back: !north };   // tucked in the back of the sash
      const ta = w.ta ?? fa0, up = { x: Math.cos(fa0) * 13 + s * 3, y: -0.6 * ph, a: -Math.PI / 2 + s * 0.45, f: 1, back: false };
      if (wind) pose = lpose(rest, up, easeOut2(wk));
      else if (h < 0.3) { pose = rest; alpha = 0; }   // it left the hand: that's the projectile
      else if (h < 0.48) { pose = rest; alpha = (h - 0.3) / 0.18; }   // a fresh one is drawn from the belt
      else pose = rest;
      if (!wind && h < 0.22) { const e = 1 - h / 0.22; out.rot += Math.cos(ta) * 0.07 * e; out.dx += Math.cos(ta) * 2 * e; }
    } else {   // 단비's lantern
      pose = { x: -s * 9, y: -0.44 * ph, a: Math.PI / 2 + swing * 0.35, f: 1, back: false };
    }
    out.list.push({ img, S, L, pose, alpha, smear, evo: w.evo });
  }
  return out;
}
function drawGear(list, ox, oy, lean, back) {
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(lean);
  for (const it of list) {
    const p = it.pose, S = it.S, img = it.img;
    if (!back && it.smear) {   // motion smear: an additive wedge from the swing start to the club, brightest at the leading edge
      const sm = it.smear, n = 12, r0 = it.L * 0.25, r1 = it.L * 1.08, cx = p.x - Math.cos(sm.a1) * 0, cy = p.y;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, b0 = sm.a0 + (sm.a1 - sm.a0) * t0, b1 = sm.a0 + (sm.a1 - sm.a0) * t1;
        ctx.fillStyle = `rgba(${S.col},${0.6 * sm.al * Math.pow(t1, 1.4)})`; ctx.beginPath();
        ctx.moveTo(cx + Math.cos(b0) * r0, cy + Math.sin(b0) * r0 * 0.5); ctx.lineTo(cx + Math.cos(b0) * r1, cy + Math.sin(b0) * r1 * 0.5);
        ctx.lineTo(cx + Math.cos(b1) * r1, cy + Math.sin(b1) * r1 * 0.5); ctx.lineTo(cx + Math.cos(b1) * r0, cy + Math.sin(b1) * r0 * 0.5); ctx.fill();
      }
      ctx.strokeStyle = `rgba(255,252,236,${0.85 * sm.al})`; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(sm.a1) * r0, cy + Math.sin(sm.a1) * r0 * 0.5); ctx.lineTo(cx + Math.cos(sm.a1) * r1, cy + Math.sin(sm.a1) * r1 * 0.5); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (p.back !== back || it.alpha <= 0) continue;
    const gx = S.g[0], gy = S.g[1], il = Math.hypot(S.t[0] - gx, S.t[1] - gy), ia = Math.atan2(S.t[1] - gy, S.t[0] - gx), k = it.L / il;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(k * p.f, k); ctx.rotate(-ia);
    ctx.globalAlpha = it.alpha; dI(img, -gx, -gy, img.width, img.height);
    if (it.evo) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + Math.sin(G.t * 6) * 0.1; dI(GL.amber, S.t[0] - 24, S.t[1] - 24, 48, 48); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.restore();
}
function drawProp(p) {
  worldT();
  const sp = SPR[p.t], w = SW(sp), h = SH(sp), age = G.t - (p.hitAt ?? -9);
  let al = 1, ox = 0;
  if (P._k < p._k && Math.abs(P.x - p.x) < w / 2 + 8 && P.y + 12 > p.y - h && P.y - 30 < p.y) al = 0.42;   // keep the player visible behind tall props
  if (age < 0.2) ox = Math.sin(age * 90) * 2.4 * (1 - age / 0.2);
  if (p.poi && (p.used || (p.t === 'well' && G.t < p.readyAt))) al *= 0.72;   // spent landmarks look spent
  ctx.globalAlpha = al; dI(sp, p.x - w / 2 + ox, p.y - h, w, h);
  if (p.t === 'bonfire' && FX.fire && FX.fire.length) {   // a live flame over the drawn one
    const fr = FX.fire, i = Math.floor((G.t * 14 + p.x) % fr.length), img = fr[i], fw = 78 + Math.sin(G.t * 9 + p.y) * 4, fh = fw * SH(img) / SW(img);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85; dI(img, p.x - fw / 2, p.y - h * 0.42 - fh * 0.7, fw, fh); ctx.globalCompositeOperation = 'source-over';
  }
  if (age < 0.12) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * (1 - age / 0.12); dI(sp, p.x - w / 2 + ox, p.y - h, w, h); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
}
function drawEnemy(e) {
  if (e.type === 'gseun' || e.type === 'gumiho' || e.type === 'clone') { drawBoss(e); return; }
  const p = enemyPose(e);
  ctx.globalAlpha = e.alpha || 1; drawPose(p.base, p);
  const fl = SPRF[e.pose ? e.spr + '_' + e.pose : e.spr] || SPRF[e.spr];
  if (e.flash > 0 && fl) { ctx.globalAlpha = 0.6 * (e.alpha || 1); drawPose(fl, p); }
  ctx.globalAlpha = 1;
}
const WM = [1, 0, 0];   // world transform: scale, offsetX, offsetY (device px)
function worldT() { ctx.setTransform(WM[0], 0, 0, WM[0], WM[1], WM[2]); }
function drawPose(img, p) {
  const s = WM[0], c = Math.cos(p.rot), n = Math.sin(p.rot);
  ctx.setTransform(s * c * p.sx, s * n * p.sx, -s * n * p.sy, s * c * p.sy, s * p.x + WM[1], s * p.y + WM[2]);
  dI(img, -p.w / 2, -p.h, p.w, p.h);
}
function drawEmis(em, p) {
  const k = p.w / SW(p.base), s = WM[0], c = Math.cos(p.rot), n = Math.sin(p.rot);
  ctx.setTransform(s * c * p.sx, s * n * p.sx, -s * n * p.sy, s * c * p.sy, s * p.x + WM[1], s * p.y + WM[2]);
  dI(em, -p.w / 2 + (em._ox || 0) * k, -p.h + (em._oy || 0) * k, SW(em) * k, SH(em) * k);
}
function drawImugi(e, emissive) {
  const segImg = SPR.seg, sw = SW(segImg), sh = SH(segImg);
  if (!emissive) for (let i = e.segs.length - 1; i >= 0; i--) {
    const s = e.segs[i]; if (s.dead) continue;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang || 0); dI(s.flash > 0 && SPRF.seg ? SPRF.seg : segImg, -sw / 2, -sh / 2, sw, sh); ctx.restore();
  }
  const pk = e.pose ? 'imugi_' + e.pose : 'imugi';
  if (emissive && e.pose) return;   // posed head: the mouth glow in the glow pass carries it
  const img = emissive ? EMIS.imugi : (e.flash > 0 && SPRF[pk] ? SPRF[pk] : SPR[pk] || SPR.imugi); if (!img) return;
  const w = SW(emissive ? SPR.imugi : img), h = SH(emissive ? SPR.imugi : img);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang);
  if (emissive) dI(img, -w / 2 + (img._ox || 0), -h / 2 + (img._oy || 0), SW(img), SH(img));
  else dI(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0d16'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  if (!P) return;
  { const sh = G.shake > 0 && !REDUCED ? G.shake : 0, tt = performance.now() / 1000;   // 9~15Hz layered sines instead of white noise
    G.shx = sh * (Math.sin(tt * 57) * 0.65 + Math.sin(tt * 91 + 1.7) * 0.35); G.shy = sh * (Math.sin(tt * 63 + 0.6) * 0.65 + Math.sin(tt * 83 + 2.9) * 0.35); }
  const s = DPR * ZOOM;
  WM[0] = s; WM[1] = DPR * (W / 2 + G.shx) - camX() * s; WM[2] = DPR * (H / 2 + G.shy) - camY() * s;
  worldT();
  ctx.imageSmoothingEnabled = ART.ok; ctx.imageSmoothingQuality = 'low';
  const LRd = lightR() * 1.12 + 30;
  ctx.fillStyle = groundPat; ctx.fillRect(camX() - VW - 4, camY() - VH - 4, VW * 2 + 8, VH * 2 + 8);
  // props: collect visible ones (drawn y-sorted below), remember lamps for the glow pass
  G.lamps = []; const DL = G.dl || (G.dl = []); DL.length = 0;
  for (let cx = Math.floor((P.x - VW - 140) / CH); cx <= Math.floor((P.x + VW + 140) / CH); cx++)
    for (let cy = Math.floor((P.y - VH - 60) / CH); cy <= Math.floor((P.y + VH + 240) / CH); cy++)
      for (const p of chunkProps(cx, cy)) {
        if (p.broken) continue; const sp = SPR[p.t]; if (!sp) continue;
        const w = SW(sp), h = SH(sp);
        if (!inView(p.x, p.y - h / 2, w / 2 + h / 2 + 20)) continue;
        DL.push(p); if (p.t === 'jars' || p.t === 'post') G.lamps.push(p);
      }
  // ink puddles: the splash plays once, then its last frame is the puddle
  for (const p of puddles) {
    const a = Math.min(1, p.life / p.max * 2), fr = FX.ink;
    if (fr && fr.length) {
      const img = fr[Math.min(fr.length - 1, Math.floor((p.max - p.life) / 0.05))], w = p.r * 2.9, h = w * SH(img) / SW(img);
      ctx.globalAlpha = 0.95 * a; dI(img, p.x - w / 2, p.y - h * 0.6, w, h); ctx.globalAlpha = 1;
    } else if (INK) { ctx.globalAlpha = 0.9 * a; dI(INK, p.x - p.r * 1.25, p.y - p.r * 0.85, p.r * 2.5, p.r * 1.7); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = `rgba(8,10,26,${0.75 * a})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.62, 0, 0, TAU); ctx.fill(); }
  }
  // 그슨대: shadow pools spread under the coming hands; cracks stay on the ground after they strike
  for (const z of zones) {
    if (!z.pool) continue;
    const q = clamp(z.t / z.warn, 0, 1), fade = z.fired ? Math.max(0, 1 - (z.t - z.warn) / 0.22) : 1, R = z.r * (0.35 + 0.8 * easeOut3(q));
    ctx.globalAlpha = 0.7 * q * fade; dI(GL.shadow, z.x - R, z.y - R * 0.55, R * 2, R * 1.1);
  }
  for (const h of hazards) {   // 물귀신 water pools: slow you while you stand in them
    const a = Math.min(1, h.t / 0.3, (h.life - h.t) / 0.6), w = Math.sin(G.t * 3 + h.x) * 2;
    ctx.globalAlpha = 0.42 * a; ctx.fillStyle = '#2a5a7a'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r + w, (h.r + w) * 0.62, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = '#8fd0f0'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const f of effects) {
    if (f.k !== 'crack') continue;
    const a = 1 - Math.max(0, f.t - f.dur * 0.55) / (f.dur * 0.45);
    ctx.strokeStyle = `rgba(16,8,28,${0.85 * a})`; ctx.lineCap = 'round';
    for (const L of f.lines) { ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < L.length; i++) { ctx.lineWidth = 3.2 - i * 0.6; ctx.lineTo(L[i][0], L[i][1]); } ctx.stroke(); }
    ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;
  // oil jars and drops
  for (const j of jars) { const sp = SPR.jar, w = SW(sp), h = SH(sp); dI(sp, j.x - w / 2, j.y - h + 8, w, h); }
  for (const d of drops) {
    if (!inView(d.x, d.y, 30)) continue;
    const sp = d.k === 'gem' ? SPR[d.spr] : SPR[d.k]; if (!sp) continue;
    if (d.k === 'oil' && d.life < 5 && Math.floor(d.life * 6) % 2) continue;
    const w = SW(sp), h = SH(sp), item = d.k === 'magnet' || d.k === 'ginseng';
    let bob = d.k === 'chest' ? 0 : Math.sin(G.t * (item ? 3 : 5) + d.x) * (item ? 2.5 : 1.5);
    if (d.born !== undefined) { const q = clamp((G.t - d.born) / 0.45, 0, 1); bob -= Math.sin(q * Math.PI) * 22 * (1 - q * 0.3); }   // tossed out of the kill
    if (d.vac > 0 && d.vac < 0.1) bob -= (0.1 - d.vac) * 60;   // lifts as the shockwave reaches it
    dI(sp, d.x - w / 2, d.y - h / 2 + bob, w, h);
  }
  // enemies: shadows (lit ones only), then bodies; deep-dark small enemies are left to the glow pass (eyes only)
  ctx.globalAlpha = 0.45;
  for (const e of enemies) {
    if (e.dead || !e.inLight || e.parent || e.type === 'dark' || e.type === 'imugi' || !inView(e.x, e.y, 90)) continue;
    const r = e.r * e.scale, ex = e.rx ?? e.x, ey = e.ry ?? e.y; dI(GL.shadow, ex - r * 1.3, ey + r * 0.45, r * 2.6, r * 0.9);
  }
  ctx.globalAlpha = 0.55; { const bob = P._pose ? P._pose.bob : 0, shw = 30 - bob * 1.5; dI(GL.shadow, P.x - shw / 2, P.y + 7, shw, 10); }
  ctx.globalAlpha = 1;
  // y-sorted: props, enemies and the player overlap by where their feet are
  for (const e of enemies) {
    if (e.dead || e.parent || e.type === 'dark' || e.type === 'imugi' || !inView(e.x, e.y, 120)) continue;
    if (!e.big && !e.inLight && ART.ok && Math.abs(e.x - P.x) + Math.abs(e.y - P.y) > LRd * 1.25) continue;
    e._k = (e.ry ?? e.y) + e.r * 0.75; DL.push(e);
  }
  P._k = P.y + 12; DL.push(P);
  DL.sort((a, b) => a._k - b._k);
  for (const o of DL) { if (o === P) drawPlayer(); else if (o.prop) drawProp(o); else drawEnemy(o); }
  for (const e of enemies) {
    if (e.dead || !inView(e.x, e.y, 160)) continue;
    if (e.type === 'dark') { worldT(); drawDark(e); } else if (e.type === 'imugi') { worldT(); drawImugi(e, false); }
  }
  worldT();
  // slam dust (alpha-blended) and debris chips
  for (const p of parts) {
    if (p.k === 'dust') { const a = p.life / p.max, z = p.size * (1.7 - a * 0.7); ctx.globalAlpha = a * 0.4; dI(GL.dust, p.x - z / 2, p.y - z / 2, z, z); }
    else if (p.k === 'shade') { const a = p.life / p.max, z = p.size * (1.9 - a * 0.9); ctx.globalAlpha = a * 0.32; dI(GL.shadow, p.x - z / 2, p.y - z * 0.45, z, z * 0.9); }
    else if (p.k === 'chip') { ctx.globalAlpha = Math.min(1, p.life / p.max * 2.5); ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  // talisman bodies
  if (SPR.talisman) {
    const tw = SW(SPR.talisman), th = SH(SPR.talisman);
    for (const p of projs) { if (p.frag || p.wave) continue; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2); dI(SPR.talisman, -tw / 2, -th / 2, tw, th); ctx.restore(); }
  }

  // darkness
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cx = W / 2 + G.shx - (G.cox || 0) * ZOOM, cy = H / 2 + G.shy - (G.coy || 0) * ZOOM, R = lightR() * ZOOM;
  const flick = 1 + Math.sin(G.t * 9) * 0.012 + Math.sin(G.t * 23) * 0.008;
  const gr = ctx.createRadialGradient(cx, cy, Math.max(1, R * 0.5 * flick), cx, cy, R * 1.08 * flick);
  gr.addColorStop(0, 'rgba(6,7,14,0)'); gr.addColorStop(0.7, 'rgba(6,7,14,0.3)'); gr.addColorStop(1, 'rgba(5,6,12,0.9)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  wg.addColorStop(0, 'rgba(242,169,59,0.16)'); wg.addColorStop(0.6, 'rgba(242,140,40,0.07)'); wg.addColorStop(1, 'rgba(242,169,59,0)');
  ctx.fillStyle = wg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  const [ldx, ldy] = lanternOff();
  const lx = cx + ldx * ZOOM, ly = cy + ldy * ZOOM, gsz = (40 + Math.sin(G.t * 11) * 3) * ZOOM;
  ctx.globalAlpha = 0.95; dI(GL.amber, lx - gsz / 2, ly - gsz / 2, gsz, gsz); ctx.globalAlpha = 1;
  if (G.state !== 'title') drawGlows();
  ctx.globalCompositeOperation = 'source-over';
  if (G.state === 'title') { drawVignette(); return; }
  { // bosses stay readable outside the lantern light: their wind-ups and strikes are the thing you dodge
    worldT(); let any = false;
    for (const e of enemies) {
      if (e.dead || e.inLight || e.parent || !(e.boss || e.elite || e.type === 'clone') || !inView(e.x, e.y, 160)) continue;
      any = true;
      if (e.type === 'imugi') { ctx.globalAlpha = 0.85; drawImugi(e, false); ctx.globalAlpha = 1; continue; }
      const a = e.alpha; e.alpha = (a || 1) * 0.85; drawEnemy(e); e.alpha = a;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); void any;
  }
  { worldT(); let any2 = false;   // thrown rocks and boomerang clubs must read in the dark
    for (const p of eprojs) {
      if (p.k === 'rock') { any2 = true; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillStyle = '#6a6056'; ctx.strokeStyle = '#1a1612'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-1, -6); ctx.lineTo(6, -2); ctx.lineTo(5, 4); ctx.lineTo(-3, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
      else if (p.k === 'club' && ICON.club) { any2 = true; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); dI(ICON.club, -15, -15, 30, 30); ctx.restore(); }
    }
    if (any2) ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  if (G.sky && G.sky.length && SPR.skylantern) {   // 풍등 float above the dark: they are lights
    worldT(); const sp = SPR.skylantern, w = SW(sp), h = SH(sp);
    for (const l of G.sky) { if (!inView(l.x, l.y, 60)) continue; const a = Math.min(1, l.t / 1.5, (l.life - l.t) / 2); ctx.globalAlpha = 0.95 * a; dI(sp, l.x - w / 2 + Math.sin(G.t * 0.9 + l.ph) * 3, l.y - 40 - h / 2 + Math.sin(G.t * 1.5 + l.ph) * 4, w, h); }
    ctx.globalAlpha = 1; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  if (PG.on) { pgDrawWorld(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  if (P.light <= GREED) {
    const pulse = 0.5 + Math.sin(G.t * 3) * 0.15;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) / 2);
    vg.addColorStop(0, 'rgba(40,70,190,0)'); vg.addColorStop(1, `rgba(40,70,190,${0.32 * pulse})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (P.charmT > 0) { ctx.fillStyle = `rgba(255,110,180,${0.12 + Math.sin(G.t * 20) * 0.04})`; ctx.fillRect(0, 0, W, H); }
  const lowHp = P.hp / P.maxHp < 0.3, hurt = (G.hurtT || 0) / 0.35;
  if (hurt > 0 || lowHp) {
    const a = Math.max(hurt * 0.4, lowHp ? 0.16 + Math.sin(G.t * 6) * 0.08 : 0);
    const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
    rg.addColorStop(0, 'rgba(200,40,30,0)'); rg.addColorStop(1, `rgba(200,40,30,${a})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  if (G.warnT > 0 && !REDUCED) {
    const a = Math.abs(Math.sin(G.warnT / 1.6 * Math.PI * 2)) * 0.42 * Math.min(1, G.warnT * 2);
    const wg2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.hypot(W, H) / 2);
    wg2.addColorStop(0, 'rgba(190,20,40,0)'); wg2.addColorStop(1, `rgba(190,20,40,${a})`); ctx.fillStyle = wg2; ctx.fillRect(0, 0, W, H);
  }
  if (G.flash) {
    const k = G.flash.t / G.flash.dur; ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${G.flash.col},${G.flash.a * (1 - k) * (1 - k)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  }
  // damage text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    const [sx, sy] = toScreen(t.x, t.y); ctx.globalAlpha = 1 - Math.max(0, t.t - 0.35) / 0.35;
    const big = t.v.length > 2 || t.col !== '#efe6d2', pop = t.t < 0.09 ? 1.5 - t.t / 0.09 * 0.5 : 1;   // pop in, then settle
    ctx.font = `700 ${Math.round((big ? 13 : 11.5) * Math.max(0.85, ZOOM) * pop)}px ${FB}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,7,12,0.85)';
    ctx.strokeText(t.v, sx, sy); ctx.fillStyle = t.col; ctx.fillText(t.v, sx, sy);
  }
  ctx.globalAlpha = 1;
  drawHUD();
}
function drawDark(e) {
  const a = e.fade;
  const g = ctx.createRadialGradient(e.x, e.y - e.r * 0.3, e.r * 0.15, e.x, e.y - e.r * 0.3, e.r * 1.25);
  g.addColorStop(0, `rgba(0,0,0,${0.95 * a})`); g.addColorStop(0.7, `rgba(2,2,6,${0.8 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 0.3, e.r * 1.25, 0, TAU); ctx.fill();
}
function drawGlows() {
  worldT();
  ctx.globalCompositeOperation = 'lighter';
  // edge of the lantern light = pickup range
  const LR = lightR();
  ctx.strokeStyle = `rgba(242,169,59,${0.14 + Math.sin(G.t * 2) * 0.04})`; ctx.lineWidth = 2;
  ctx.setLineDash([16, 12]); ctx.lineDashOffset = -G.t * 18; ctx.beginPath(); ctx.arc(P.x, P.y, LR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // danger zones: tinted floor that fills toward the strike, rim flickers in the last quarter
  for (const z of zones) {
    const k = Math.min(1, z.t / z.warn), fired = z.fired, fa = fired ? Math.max(0, 1 - (z.t - z.warn) / 0.22) : Math.min(1, z.t / 0.08), late = !fired && k > 0.75 ? 0.5 + 0.5 * Math.sin(G.t * 42) : 0, c = z.col;
    ctx.globalAlpha = fa;
    if (z.sh === 'c') {
      ctx.fillStyle = `rgba(${c},${fired ? 0.55 : 0.12})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      if (!fired) { ctx.fillStyle = `rgba(${c},0.3)`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = `rgba(${c},${0.55 + 0.45 * late})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
    } else {
      ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.a);
      ctx.fillStyle = `rgba(${c},0.12)`; ctx.fillRect(0, -z.w / 2, z.len, z.w);
      if (!fired) { ctx.fillStyle = `rgba(${c},0.28)`; ctx.fillRect(0, -z.w / 2, z.len * k, z.w); }
      ctx.strokeStyle = `rgba(${c},${0.5 + 0.45 * late})`; ctx.lineWidth = 2; ctx.strokeRect(0, -z.w / 2, z.len, z.w);
      ctx.fillStyle = `rgba(${c},0.5)`; for (let i = 1; i < z.len / 70; i++) { const x = i * 70; ctx.beginPath(); ctx.moveTo(x + 10, 0); ctx.lineTo(x - 6, -z.w * 0.28); ctx.lineTo(x - 6, z.w * 0.28); ctx.closePath(); ctx.fill(); }   // direction chevrons
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  // dash afterimages
  for (const g of G.ghosts || []) {   // afterimages; 그슨대 is too dark to read additively, so it leaves a violet-lit silhouette
    const a = 1 - g.t / 0.3;
    if (g.fl) { ctx.globalAlpha = 0.24 * a; drawPose(g.fl, g.p); worldT(); const z = g.p.h * 0.95; ctx.globalAlpha = 0.4 * a; dI(GL.violet, g.p.x - z / 2, g.p.y - g.p.h * 0.55 - z / 2, z, z); }
    else { ctx.globalAlpha = 0.42 * a; drawPose(g.p.base, g.p); worldT(); }
  }
  ctx.globalAlpha = 1;
  // wind-up tells: a glow gathers on the body before a boss or a 도깨비 commits
  for (const e of enemies) {
    if (e.dead || !inView(e.x, e.y, 120)) continue;
    if (e.pose === 'p1' && (e.type === 'gseun' || e.type === 'gumiho' || e.type === 'clone')) {
      const q = Math.min(1, (e.poseT || 0) / 0.5), gl = e.type === 'gseun' ? GL.violet : GL.pink, sz = (70 + 60 * q) * (e.scale || 1);
      ctx.globalAlpha = 0.35 + 0.35 * q; dI(gl, e.x - sz / 2, e.y - sz * 0.75, sz, sz);
    } else if (e.type === 'imugi' && e.pose === 'p2') {
      const mx = e.x + Math.cos(e.ang) * 34, my = e.y + Math.sin(e.ang) * 34, sz = 60 + Math.sin(G.t * 30) * 8;
      ctx.globalAlpha = 0.9; dI(GL.blue, mx - sz / 2, my - sz / 2, sz, sz); dI(GL.white, mx - 10, my - 10, 20, 20);
    } else if (e.atk === 'wind') { ctx.globalAlpha = 0.8; dI(e.type === 'saja' ? GL.sun : GL.red, e.x - 14, e.y - 44, 28, 28); }
  }
  ctx.globalAlpha = 1;
  // landmarks: bonfire light pool + its safe ring, shrine aura and prayer ring, well sparkle, ward ring, gamble glint, peddler lamp
  for (const p of poiList) {
    if (p.broken || !inView(p.x, p.y - 60, 160)) continue;
    const f = 0.5 + Math.sin(G.t * 7 + p.x) * 0.1;
    if (p.t === 'bonfire') {
      const z = 260 + Math.sin(G.t * 11 + p.y) * 10; ctx.globalAlpha = 0.34 * f + 0.1; dI(GL.amber, p.x - z / 2, p.y - 40 - z / 2, z, z);
      ctx.globalAlpha = 0.9; dI(GL.fire || GL.amber, p.x - 40, p.y - 80, 80, 80);
      ctx.globalAlpha = 0.22; ctx.strokeStyle = 'rgba(255,170,80,1)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.ellipse(p.x, p.y, 130, 130 * 0.62, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    } else if (p.t === 'shrine' && !p.used) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(G.t * 2.4); dI(GL.sun, p.x - 50, p.y - 120, 100, 100);
      ctx.globalAlpha = 0.3; ctx.strokeStyle = 'rgba(255,214,120,1)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y - 6, 64, 64 * 0.6, 0, 0, TAU); ctx.stroke();
      if (p.pray > 0) { const k = Math.min(1, p.pray / 2); ctx.globalAlpha = 0.95; ctx.strokeStyle = 'rgba(255,230,150,1)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y - 6, 64, 64 * 0.6, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
    } else if (p.t === 'well' && G.t >= p.readyAt) {
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(G.t * 3 + p.x); dI(GL.blue || GL.white, p.x - 26, p.y - 58, 52, 40);
    } else if (p.t === 'sotdae') {
      ctx.globalAlpha = 0.18 + 0.06 * Math.sin(G.t * 2); ctx.strokeStyle = 'rgba(150,190,255,1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 120, 120 * 0.62, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + G.t * 0.4; ctx.moveTo(p.x + Math.cos(a) * 112, p.y + Math.sin(a) * 112 * 0.62); ctx.lineTo(p.x + Math.cos(a) * 126, p.y + Math.sin(a) * 126 * 0.62); } ctx.stroke();
      ctx.globalAlpha = 0.5 * f; dI(GL.blue || GL.white, p.x - 22, p.y - 92, 44, 44);
    } else if (p.t === 'mat' && !p.used) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.t * 5 + p.x); dI(GL.sun, p.x - 30, p.y - 40, 60, 44);
    } else if (p.t === 'peddler') {
      ctx.globalAlpha = 0.5 * f + 0.2; dI(GL.amber, p.x - 30, p.y - 110, 60, 60);
    }
  }
  for (const l of G.sky || []) { const a = Math.min(1, l.t / 1.5, (l.life - l.t) / 2), z = 90 + Math.sin(G.t * 4 + l.ph) * 8; ctx.globalAlpha = 0.6 * a; dI(GL.amber, l.x - z / 2, l.y - 40 - z / 2 + Math.sin(G.t * 1.5 + l.ph) * 4, z, z); }
  ctx.globalAlpha = 1;
  // market lanterns
  for (const p of G.lamps || []) {
    const m = ART.meta[p.t === 'jars' ? 'jarsLamp' : 'postLamp']; if (!m) continue;
    const x = p.x + m[0], y = p.y + m[1], f = 0.5 + Math.sin(G.t * 7 + p.x) * 0.08;
    ctx.globalAlpha = f; dI(GL.amber, x - 22, y - 22, 44, 44);
    ctx.globalAlpha = 0.16; dI(GL.amber, x - 70, p.y - 34, 140, 60);
  }
  // oil jars and chests beyond the light
  for (const j of jars) { ctx.globalAlpha = 0.55 + Math.sin(G.t * 3) * 0.15; dI(GL.amber, j.x - 26, j.y - 44, 52, 52); }
  let gemGlows = 0; const LR2 = LR * LR;
  for (const d of drops) {
    if (d.k === 'chest') { ctx.globalAlpha = 0.5; dI(GL.red, d.x - 24, d.y - 24, 48, 48); }
    else if (d.k === 'magnet' || d.k === 'ginseng') {   // rare pickups beacon through the dark: a soft glow and a thin light shaft
      const gl = d.k === 'magnet' ? GL.blue : GL.jade, p = 0.5 + Math.sin(G.t * 4 + d.x) * 0.2;
      ctx.globalAlpha = p; dI(gl, d.x - 30, d.y - 34, 60, 60);
      ctx.globalAlpha = p * 0.35; dI(gl, d.x - 7, d.y - 150, 14, 150);
    }
    else if (d.k === 'gem' && gemGlows < 120 && (d.x - P.x) ** 2 + (d.y - P.y) ** 2 > LR2 && inView(d.x, d.y, 20)) {
      gemGlows++; ctx.globalAlpha = 0.35; const gl = d.spr === 'gem1' ? GL.jade : d.spr === 'gem2' ? GL.blue : GL.pink; dI(gl, d.x - 10, d.y - 10, 20, 20);
    }
  }
  if (G.vac) {   // vacuum streaks: one path per colour, a wide soft pass and a hot thin pass
    const lines = (gem, w, a) => {
      ctx.beginPath(); let any = false;
      for (const d of drops) { if (!(d.vac <= 0) || !d.vt || (d.k === 'gem') !== gem) continue; if (!inView(d.x, d.y, 60)) continue; const sp = Math.hypot(d.vx, d.vy) || 1, L = Math.min(52, sp * 0.035) / sp; ctx.moveTo(d.x - d.vx * L, d.y - d.vy * L - 4); ctx.lineTo(d.x, d.y - 4); any = true; }
      if (any) { ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); }
    };
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffb84a'; lines(false, 7, 0.35); ctx.strokeStyle = '#fff1c4'; lines(false, 2.5, 0.9);
    ctx.strokeStyle = '#4fe0a8'; lines(true, 7, 0.3); ctx.strokeStyle = '#d8fff0'; lines(true, 2.5, 0.85);
    const k = Math.max(0, 1 - G.vac.t / 1.6); ctx.globalAlpha = 0.55 * k; dI(GL.blue, P.x - 60, P.y - 74, 120, 120);   // the player holds the pull
    ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;
  // what glows in the dark: eyes, flames, pale ghosts
  for (const e of enemies) {
    if (e.dead || e.inLight || e.parent || e.type === 'dark' || !inView(e.x, e.y, 60)) continue;
    if (e.type === 'imugi') { if (EMIS.imugi) { worldT(); drawImugi(e, true); } continue; }
    if (ART.ok) {
      if (ED[e.type].ghost) { ctx.globalAlpha = 0.14; drawPose(SPR[e.spr], enemyPose(e)); ctx.globalAlpha = 1; continue; }
      if (e.pose) { ctx.globalAlpha = 0.22; const q = enemyPose(e); drawPose(q.base, q); ctx.globalAlpha = 1; continue; }   // action pose: faint silhouette, no baked eye glow
      const em = EMIS[e.spr]; if (!em) continue;
      if (Math.sin(G.t * 0.7 + e.bob * 3) > 0.97) continue;
      ctx.globalAlpha = 0.95; drawEmis(em, enemyPose(e)); ctx.globalAlpha = 1;
    } else {
      dI(GL.eyeW, e.x - 11, e.y - 13, 12, 12); dI(GL.eyeW, e.x - 1, e.y - 13, 12, 12);
    }
  }
  worldT();
  // 달걀귀신 돌진 예고
  for (const e of enemies) if (e.type === 'egg' && e.st === 'wind' && !e.dead) { ctx.globalAlpha = 0.75; dI(GL.gold, e.x - 22, e.y - 34, 44, 44); }
  ctx.globalAlpha = 1;
  for (const e of enemies) if (e.type === 'dark' && !e.dead) {
    ctx.globalAlpha = e.fade; const ey = e.y - e.r * 0.45, gs = 10 + e.r * 0.25;
    dI(GL.eyeR, e.x - e.r * 0.28 - gs / 2, ey - gs / 2, gs, gs); dI(GL.eyeR, e.x + e.r * 0.28 - gs / 2, ey - gs / 2, gs, gs);
    ctx.globalAlpha = 1;
  }
  // 포위진: the closing wall is drawn as a violet seal on the ground
  if (G.ringFx) {
    let sr = 0, n = 0, R = G.ringFx;
    for (const e of enemies) if (e.ai === 'ring' && !e.dead) { sr += Math.hypot(e.x - R.cx, e.y - R.cy); if (++n >= 24) break; }
    if (!n) G.ringFx = null;
    else {
      const rr = sr / n, pulse = 0.5 + Math.sin(G.t * 6) * 0.2, spin = REDUCED ? 0 : G.t * 0.5, sig = FX.circle_v && FX.circle_v[0];
      if (sig) { const z = (rr + 50) * 2; ctx.globalAlpha = 0.34 + pulse * 0.2; ctx.save(); ctx.translate(R.cx, R.cy); ctx.rotate(spin * 0.6); dI(sig, -z / 2, -z / 2, z, z); ctx.restore(); ctx.globalAlpha = 1; }
      else {
      ctx.strokeStyle = `rgba(170,110,255,${0.32 * pulse + 0.12})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(R.cx, R.cy, Math.max(1, rr - 22), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(R.cx, R.cy, rr + 40, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(220,180,255,${0.5 * pulse})`; ctx.beginPath();
      for (let i = 0; i < 36; i++) { const a = spin + i * TAU / 36, r0 = rr - 16, r1 = rr + 34; ctx.moveTo(R.cx + Math.cos(a) * r0, R.cy + Math.sin(a) * r0); ctx.lineTo(R.cx + Math.cos(a + 0.05) * r1, R.cy + Math.sin(a + 0.05) * r1); }
      ctx.stroke(); }
    }
  }
  for (const e of enemies) if (e.type === 'wisp' && e.shotCd !== undefined && e.shotCd < 0.5 && !e.dead && inView(e.x, e.y, 30)) {
    const c = 1 - e.shotCd / 0.5, z = 14 + c * 30; ctx.globalAlpha = 0.45 + c * 0.5; dI(GL.fire, e.x - z / 2, e.y - 10 - z / 2, z, z);
  }
  ctx.globalAlpha = 1;
  // hollong sparks: animated flames
  for (const w of P.weapons) if (w.id === 'hollong' && w.pts) {
    const fr = w.evo ? FOX : FIRE, gl = w.evo ? GL.blue : GL.red;
    w.pts.forEach(([x, y], i) => {
      ctx.globalAlpha = 0.55; dI(gl, x - 15, y - 15, 30, 30); ctx.globalAlpha = 1;
      if (fr) { const f = fr[(Math.floor(G.t * 14) + i) % 4], fw = SW(f) * 0.85, fh = SH(f) * 0.85; dI(f, x - fw / 2, y - fh * 0.72, fw, fh); }
      else { ctx.fillStyle = w.evo ? '#e8f6ff' : '#ffe2a0'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill(); }
    });
  }
  // talisman ribbons (two passes: wide ember glow, thin hot core)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [[7, 'rgba(255,110,50,0.32)'], [2.2, 'rgba(255,236,190,0.85)']]) {
    ctx.lineWidth = pass[0]; ctx.strokeStyle = pass[1]; ctx.beginPath();
    for (const p of projs) { const t = p.tr; if (!t || t.length < 4) continue; ctx.moveTo(t[0], t[1]); for (let i = 2; i < t.length; i += 2) ctx.lineTo(t[i], t[i + 1]); }
    ctx.stroke();
  }
  for (const p of projs) if (p.wave) {   // 도깨비 불꽃 wave: a green crescent riding its glow
    const a = Math.min(1, p.life / 0.2); ctx.globalAlpha = 0.8 * a; dI(GL.jade || GL.white, p.x - 30, p.y - 30, 60, 60);
    const fr = FX.slash; if (fr && fr.length) { const img = fr[2] || fr[0], z = 70; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.globalAlpha = a; dI(img, -z / 2, -z / 2, z, z); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  for (const p of projs) { if (p.wave) continue; ctx.globalAlpha = p.frag ? 0.9 : 0.7; const z = p.evo ? 30 : 24; dI(p.evo ? GL.fire : GL.red, p.x - z / 2, p.y - z / 2, z, z); if (p.frag && FIRE) { const f = FIRE[Math.floor(G.t * 16) % 4]; dI(f, p.x - 6, p.y - 10, 12, 17); } }
  ctx.globalAlpha = 1;
  for (const p of eprojs) {
    if (p.k === 'fire') {
      ctx.globalAlpha = 0.9; dI(GL.fire, p.x - 22, p.y - 22, 44, 44); ctx.globalAlpha = 1;
      if (FIRE) { const f = FIRE[Math.floor(G.t * 18) % 4], fw = SW(f) * 0.7, fh = SH(f) * 0.7; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(-p.vx, p.vy)); dI(f, -fw / 2, -fh * 0.25, fw, fh); ctx.restore(); }
      dI(GL.white, p.x - 6, p.y - 6, 12, 12); continue;
    }
    if (p.k === 'fox') {
      ctx.globalAlpha = 0.9; dI(GL.pink, p.x - 22, p.y - 22, 44, 44); ctx.globalAlpha = 1;
      if (FOX && FOX[0]) { const f = FOX[Math.floor(G.t * 18) % 4], fw = SW(f) * 0.75, fh = SH(f) * 0.75; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(-p.vx, p.vy)); dI(f, -fw / 2, -fh * 0.25, fw, fh); ctx.restore(); }
      dI(GL.white, p.x - 6, p.y - 6, 12, 12); continue;
    }
    if (p.k === 'water') { ctx.globalAlpha = 0.85; dI(GL.blue, p.x - 20, p.y - 20, 40, 40); ctx.globalAlpha = 1; dI(GL.white, p.x - 6, p.y - 6, 12, 12); continue; }
    if (p.k === 'rock' || p.k === 'club') { ctx.globalAlpha = 0.35; dI(p.k === 'club' ? GL.red : GL.amber, p.x - 14, p.y - 14, 28, 28); ctx.globalAlpha = 1; continue; }   // bodies drawn above the dark
    if (p.k === 'tal') {
      ctx.globalAlpha = 0.7; dI(GL.sun, p.x - 18, p.y - 18, 36, 36); ctx.globalAlpha = 1;
      const t = SPR.talisman; if (t) { const tw = SW(t) * 0.7, th = SH(t) * 0.7; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(G.t * 14); dI(t, -tw / 2, -th / 2, tw, th); ctx.restore(); }
      continue;
    }
    dI(GL.pink, p.x - 16, p.y - 16, 32, 32); ctx.fillStyle = '#ffd2ea'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
  }
  if (P.pullT > 0 && P.pullE && !P.pullE.dead) {   // 물귀신's wet line while it drags you
    const e = P.pullE; ctx.strokeStyle = 'rgba(140,210,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y - 12);
    for (let i = 1; i <= 8; i++) { const k = i / 8; ctx.lineTo(lerp(e.x, P.x, k) + Math.sin(G.t * 30 + k * 9) * 4, lerp(e.y - 12, P.y - 10, k)); } ctx.stroke();
  }
  for (const e of enemies) if (e.rageT > G.t && !e.dead && inView(e.x, e.y, 20)) { ctx.globalAlpha = 0.7; dI(GL.red, e.x - 10, e.y - 22, 20, 20); }
  ctx.globalAlpha = 1;
  // particles: sparks as velocity streaks batched by colour and fade bucket, embers/souls as glow sprites
  const SB = {};
  for (const p of parts) {
    const a = Math.max(0, p.life / p.max);
    if (p.k === 'spark') { const key = p.col + (a > 0.66 ? '|0' : a > 0.33 ? '|1' : '|2'); (SB[key] = SB[key] || []).push(p); continue; }
    if (p.k === 'dust' || p.k === 'chip' || p.k === 'shade') continue;
    if (p.k === 'ember' || p.k === 'soul') {
      const img = GL[p.gl] || GL.amber, soulK = p.k === 'soul';
      const z = soulK ? p.size * (0.55 + 0.45 * Math.min(1, (1 - a) * 4)) : p.size * (0.35 + 0.65 * a);
      const ox = soulK ? Math.sin(G.t * 6 + p.ph) * 4 : 0;
      ctx.globalAlpha = soulK ? a * 0.75 : a * 0.9; dI(img, p.x + ox - z / 2, p.y - z / 2, z, z);
      if (soulK) { const c = z * 0.32; ctx.globalAlpha = a; dI(GL.white, p.x + ox - c / 2, p.y - c / 2 + z * 0.08, c, c); }
      continue;
    }
    ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.col; const z = p.size || 3; ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
  }
  for (const key in SB) {
    const [col, b] = key.split('|'), list = SB[key], al = b === '0' ? 1 : b === '1' ? 0.62 : 0.3;
    ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
    for (const p of list) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); }
    ctx.stroke();
    if (b === '0') { ctx.strokeStyle = '#fffbea'; ctx.lineWidth = 0.9; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  // effects
  for (const f of effects) {
    if (f.delay > 0) continue; const k = f.t / f.dur;
    if (f.k === 'fb') {   // flipbook: frame by normalised time, full brightness from frame 1, the sheet itself carries the decay
      const fr = FX[f.a]; if (!fr || !fr.length) continue;
      const img = fr[Math.min(fr.length - 1, Math.floor(k * fr.length))], iw = SW(img), ih = SH(img), sc = f.s / Math.max(iw, ih), w = iw * sc, h = ih * sc;
      const x = f.follow ? P.x + (f.ox || 0) : f.x, y = f.follow ? P.y + (f.oy || 0) : f.y, oy = f.anchor === 'b' ? -h : -h / 2;
      ctx.globalAlpha = f.al ?? 1;
      if (f.rot || f.fy) { ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot || 0); if (f.fy) ctx.scale(1, -1); dI(img, -w / 2, oy, w, h); ctx.restore(); }
      else dI(img, x - w / 2, y + oy, w, h);
      ctx.globalAlpha = 1; continue;
    }
    if (f.k === 'sigil') {   // magic circle on the ground: snaps open, turns, fades
      const img = FX[f.a || 'circle'] && FX[f.a || 'circle'][0]; if (!img) continue;
      const x = f.follow ? P.x : f.x, y = f.follow ? P.y + 10 : f.y, r0 = f.r0 ?? f.r * 0.6, r = r0 + (f.r - r0) * easeOut3(Math.min(1, k * 3));
      ctx.globalAlpha = (f.al ?? 0.9) * Math.min(1, k * 10) * (k > 0.55 ? (1 - k) / 0.45 : 1);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.55); ctx.rotate((f.rot || 0) + (REDUCED ? 0 : f.t * (f.spin ?? 1.2))); dI(img, -r, -r, r * 2, r * 2); ctx.restore();
      ctx.globalAlpha = 1; continue;
    }
    if (f.k === 'ring' && FX.ring && FX.ring[0]) {   // bell: generated sound-wave ring, sharp edge at the hit radius
      const r = f.r || 16, fa = 1 - k, z = r * 2.06;
      ctx.globalAlpha = Math.min(1, fa * 1.6) * (f.evo ? 1 : 0.9); dI(FX.ring[0], P.x - z / 2, P.y - z / 2, z, z);
      if (k < 0.25) { ctx.globalAlpha = (0.25 - k) * 3; const c = 50; dI(GL.gold, P.x - c / 2, P.y - 12 - c / 2, c, c); }
      ctx.globalAlpha = 1; continue;
    }
    if (f.k === 'ring') {
      const r = f.r || 16, fa = 1 - k, c = f.evo ? '255,214,120' : '240,226,180';
      ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, TAU);
      ctx.strokeStyle = `rgba(${c},${0.12 * fa})`; ctx.lineWidth = 22; ctx.stroke();       // wake
      ctx.strokeStyle = `rgba(${c},${0.35 * fa})`; ctx.lineWidth = 7; ctx.stroke();        // body
      ctx.strokeStyle = `rgba(255,250,232,${0.95 * fa})`; ctx.lineWidth = 2.2; ctx.stroke();   // hot edge
      if (f.evo) {   // rotating glyph ticks on the evolved bell
        ctx.strokeStyle = `rgba(255,230,160,${0.8 * fa})`; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + G.t * 1.5; ctx.moveTo(P.x + Math.cos(a) * (r - 9), P.y + Math.sin(a) * (r - 9)); ctx.lineTo(P.x + Math.cos(a) * (r + 9), P.y + Math.sin(a) * (r + 9)); }
        ctx.stroke();
      }
    } else if (f.k === 'swing') {
      const g = ctx.createRadialGradient(P.x, P.y, f.r * 0.3, P.x, P.y, f.r);
      g.addColorStop(0, 'rgba(79,163,122,0)'); g.addColorStop(0.75, `rgba(120,210,160,${0.35 * (1 - k)})`); g.addColorStop(1, `rgba(200,255,220,${0.6 * (1 - k)})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.arc(P.x, P.y, f.r, f.a - 1.1 + k * 0.4, f.a + 1.1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(230,255,240,${0.9 * (1 - k)})`; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(P.x, P.y, f.r, f.a - 1.1 + k * 0.4, f.a + 1.1); ctx.stroke();
    } else if (f.k === 'slam') {
      const r = f.r * (0.3 + 0.7 * easeOut3(k)), fa = 1 - k;
      ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(1, r), 0, TAU);
      ctx.fillStyle = `rgba(217,173,69,${0.14 * fa})`; ctx.fill();
      ctx.strokeStyle = `rgba(240,200,110,${0.32 * fa})`; ctx.lineWidth = 8 * fa + 1; ctx.stroke();
      ctx.strokeStyle = `rgba(255,246,214,${0.8 * fa})`; ctx.lineWidth = 2.2 * fa + 0.5; ctx.stroke();
    } else if (f.k === 'burst') {
      ctx.fillStyle = f.col; ctx.globalAlpha = 0.5 * (1 - k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.6), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    } else if (f.k === 'hit') {   // core flash: full size on frame 1, then decay
      const fa = (1 - k) * (1 - k), z = (f.big ? 28 : 16) * (1 - k * 0.45); ctx.globalAlpha = fa * 0.85; dI(GL.white, f.x - z / 2, f.y - z / 2, z, z);
      ctx.globalAlpha = 1;
    } else if (f.k === 'flash') {
      const img = GL[f.gl] || GL.white, z = f.r * 2 * (1 - k * 0.35); ctx.globalAlpha = (1 - k) * (1 - k); dI(img, f.x - z / 2, f.y - z / 2, z, z);
      if (k < 0.5) { const c = z * 0.35; dI(GL.white, f.x - c / 2, f.y - c / 2, c, c); }
      ctx.globalAlpha = 1;
    } else if (f.k === 'crack') {   // the cracks glow violet as they open, then go dark
      const a = Math.max(0, 1 - f.t / (f.dur * 0.5)); if (a <= 0) continue;
      ctx.strokeStyle = `rgba(200,140,255,${0.9 * a})`; ctx.lineWidth = 1.4;
      for (const L of f.lines) { const n = Math.min(L.length, 1 + Math.ceil(f.t / 0.03)); ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); ctx.stroke(); }
    } else if (f.k === 'shock') {
      const r = f.r0 + (f.r1 - f.r0) * easeOut3(k); ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.col; ctx.lineWidth = Math.max(0.5, f.w * (1 - k));
      ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, r), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'rays') {
      const a0 = f.rot + (REDUCED ? 0 : G.t * 0.7), L0 = f.r * (0.55 + 0.45 * easeOut3(Math.min(1, k * 2))), al = 0.55 * Math.pow(1 - k, 1.5);
      const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, L0);   // bright at the source, gone at the tips
      rg.addColorStop(0, `rgba(255,255,255,${al})`); rg.addColorStop(0.25, `rgba(${f.col},${al})`); rg.addColorStop(1, `rgba(${f.col},0)`);
      ctx.fillStyle = rg; ctx.beginPath();
      for (let i = 0; i < f.n; i++) { const a = a0 + i * TAU / f.n, L = L0 * (i % 2 ? 0.68 : 1), wd = i % 2 ? 0.05 : 0.075; ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a - wd) * L, f.y + Math.sin(a - wd) * L); ctx.lineTo(f.x + Math.cos(a + wd) * L, f.y + Math.sin(a + wd) * L); ctx.closePath(); }
      ctx.fill();
    } else if (f.k === 'pillar') {
      const wd = 54 * (1 - k * 0.7), top = P.y - 320, gr2 = ctx.createLinearGradient(0, top, 0, P.y + 10);
      gr2.addColorStop(0, `rgba(${f.col},0)`); gr2.addColorStop(0.75, `rgba(${f.col},${0.45 * (1 - k)})`); gr2.addColorStop(1, `rgba(255,255,255,${0.7 * (1 - k)})`);
      ctx.fillStyle = gr2; ctx.fillRect(P.x - wd / 2, top, wd, P.y + 10 - top);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.fillRect(P.x - wd * 0.12, top + 80, wd * 0.24, P.y - 70 - top);
    } else if (f.k === 'crack') {   // ground cracks: grow in 0.08s, then fade
      const rnd2 = j => { const x = Math.sin(f.seed + j * 12.9898) * 43758.5453; return x - Math.floor(x); }, grow = Math.min(1, k * 7);
      ctx.strokeStyle = `rgba(255,196,110,${0.85 * (1 - k) * (1 - k)})`; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = 0; i < f.n; i++) {
        let a = i * TAU / f.n + rnd2(i) * 0.5, x = f.x, y = f.y; ctx.moveTo(x, y);
        for (let sg = 1; sg <= 3; sg++) { a += (rnd2(i * 7 + sg) - 0.5) * 0.7; const L = f.r * grow * (0.22 + rnd2(i * 3 + sg) * 0.14); x += Math.cos(a) * L; y += Math.sin(a) * L * 0.62; ctx.lineTo(x, y); }
      }
      ctx.stroke();
    } else if (f.k === 'puff') {
      ctx.strokeStyle = `rgba(170,200,255,${0.4 * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * f.r, 0, TAU); ctx.stroke();
    } else if (f.k === 'lightburst') {
      ctx.strokeStyle = `rgba(242,169,59,${0.9 * (1 - k)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(P.x, P.y, 30 + k * 260, 0, TAU); ctx.stroke();
    } else if (f.k === 'ohaeng') {
      EL.forEach((el, i) => { ctx.strokeStyle = EL_COLOR[el]; ctx.globalAlpha = 0.8 * (1 - k); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(1, 40 + k * (Math.hypot(VW, VH) + 80) - i * 26), 0, TAU); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
  }
  // imugi water beam
  if (G.beam) {
    const b = G.beam, L = 950;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    if (b.t < b.warn) {
      const k = b.t / b.warn, lock = b.t > b.warn - 0.25, pulse = lock ? 0.5 + 0.5 * Math.sin(G.t * 40) : 0;
      ctx.fillStyle = `rgba(${AQUA},0.1)`; ctx.fillRect(0, -24, L, 48); ctx.fillStyle = `rgba(${AQUA},0.26)`; ctx.fillRect(0, -24, L * k, 48);
      ctx.strokeStyle = `rgba(${AQUA},${0.45 + 0.45 * pulse})`; ctx.lineWidth = 2; ctx.strokeRect(0, -24, L, 48);
      ctx.globalAlpha = 0.6 + 0.4 * k; const g = 26 + 46 * k; dI(GL.blue, -g / 2, -g / 2, g, g); dI(GL.white, -g / 5, -g / 5, g / 2.5, g / 2.5); ctx.globalAlpha = 1;
    } else {
      const q = (b.t - b.warn) / b.act, wid = 84 * (q < 0.12 ? q / 0.12 : q > 0.82 ? (1 - q) / 0.18 : 1), fr = FX.beam && FX.beam.length ? FX.beam[Math.floor(G.t * 22) % FX.beam.length] : null;
      if (fr) { dI(fr, -30, -wid / 2, L + 40, wid); ctx.globalAlpha = 0.7; dI(fr, -30, -wid / 4, L + 40, wid / 2); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = 'rgba(180,225,255,0.85)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke(); }
      dI(GL.white, -36, -36, 72, 72);
    }
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function drawVignette(a = 0.5) {
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function bar(x, y, w, h, frac, col, bg = 'rgba(239,230,210,0.12)') {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
function txt(s, x, y, size, col, align = 'left', font = FB, weight = 400) {
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function drawHUD() {
  const st = SAFE.t, sl = SAFE.l, sr = SAFE.r, sb = SAFE.b, narrow = W < 900;
  ctx.imageSmoothingEnabled = true;
  // xp
  const xw = W - sl - sr - 24, x0 = sl + 12;
  ctx.fillStyle = 'rgba(6,7,12,0.6)'; ctx.fillRect(x0 - 1, st + 5, xw + 2, 7);
  bar(x0, st + 6, xw, 5, P.xp / P.xpNext, '#58b39c');
  // timer
  if (PG.on) { txt('놀이터', W / 2, st + 40, 22, '#f2a93b', 'center', FD, 700); txt(PG.scale === 1 ? 'WASD · 방향키로 걷기 · 0 정지 · . 한 프레임' : PG.scale ? `시간 ${PG.scale}×` : '시간 정지', W / 2, st + 57, 11.5, '#a39a86', 'center'); }
  else { txt(mmss(Math.min(G.t, RUN_LEN)), W / 2, st + 40, 24, '#efe6d2', 'center', FD, 700);
    txt(`첫닭까지 ${mmss(RUN_LEN - G.t)}`, W / 2, st + 57, 11.5, '#a39a86', 'center'); }
  // boss
  let by = st + 72;
  for (const b of G.bosses.slice(0, 1)) {
    const bw = Math.min(380, W - sl - sr - 40), bx = W / 2 - bw / 2;
    txt(ED[b.type].name, bx, by - 3, 12, '#efe6d2', 'left', FD, 700);
    txt(`${ED[b.type].el} 원소${b.leaveT > 0 ? ` · ${Math.ceil(b.leaveT)}초 뒤 물러감` : ''}`, bx + bw, by - 3, 11, b.leaveT > 0 && b.leaveT < 20 ? '#ff6b5a' : EL_COLOR[ED[b.type].el], 'right');
    bar(bx, by + 2, bw, 6, b.hp / b.maxHp, '#c8463a'); by += 22;
  }
  // left block: lantern icon + bars
  const lx0 = sl + 12; let ly = narrow ? Math.max(st + 86, by + 8) : st + 26;
  const ic = ICON.hollong, iconW = ic ? 30 : 0, lx = lx0 + iconW + (ic ? 6 : 0);
  if (ic) { ctx.globalAlpha = 0.95; dI(ic, lx0, ly - 4, 30, 30); ctx.globalAlpha = 1; }
  txt(`Lv ${P.level}`, lx, ly + 2, 13, '#58b39c', 'left', FD, 700);
  ly += 10;
  bar(lx, ly, 150, 9, P.hp / P.maxHp, '#c8463a');
  txt(`체력 ${Math.ceil(P.hp)}/${P.maxHp}`, lx + 156, ly + 9, 11.5, '#efe6d2');
  ly += 15;
  const greed = P.light <= GREED, warm = P.light >= WARM;
  bar(lx, ly, 150, 9, P.light / 100, greed ? '#6f8cff' : '#f2a93b');
  ctx.fillStyle = 'rgba(239,230,210,0.55)'; ctx.fillRect(lx + 150 * GREED / 100, ly - 2, 1, 13); ctx.fillRect(lx + 150 * WARM / 100, ly - 2, 1, 13);
  txt(`빛 ${Math.ceil(P.light)}`, lx + 156, ly + 9, 11.5, greed ? '#9fb2ff' : '#f2a93b');
  ly += 13;
  const zone = P.light <= 0 ? ['빛이 꺼졌다 · 어둑시니 추적 중', '#ff6b5a'] : greed ? ['탐욕 · 경험치·엽전 ×2, 회복 없음', '#9fb2ff'] : warm ? ['온기 · 초당 체력 +0.4', '#f2c27a'] : ['보통 · 60 이상 회복, 30 이하 탐욕', '#a39a86'];
  txt(zone[0], lx0, ly + 11, 11.5, zone[1]);
  if (P.charmT > 0) txt('매혹 · 방향 반전', lx0, ly + 26, 11.5, '#ff8ac0');
  { const bl = typeof BLESS !== 'undefined' ? BLESS.filter(([k]) => blessLeft(k) > 0).map(([k, n]) => `${n} ${Math.ceil(blessLeft(k))}초`) : [];
    if (P.inFire) bl.unshift('화톳불 곁 · 빛이 줄지 않음');
    if (bl.length) txt(bl.join(' · '), lx0, ly + (P.charmT > 0 ? 41 : 26), 11.5, '#ffd27a'); }
  drawPentagon(lx0 + 28, ly + (P.charmT > 0 ? 66 : 56));
  // right block
  const rx = W - sr - 12;
  if (SPR.coin && ART.ok) dI(SPR.coin, rx - 78, st + 58, 15, 15);
  txt(`엽전 ${P.coins}`, rx, st + 70, 13, '#d9ad45', 'right', FD, 700);
  txt(`처치 ${P.kills.toLocaleString('ko-KR')}`, rx, st + 87, 11.5, '#a39a86', 'right');
  // slots
  const sy = H - sb - 14 - 30 - 6 - 40;
  P.weapons.forEach((w, i) => { const D = WEAPONS[w.id]; slot(lx0 + i * 44, sy, 40, ICON[w.id], D.glyph, w.evo ? '#f2a93b' : EL_COLOR[D.el], w.evo ? '진' : `${w.lv}`, w.evo); });
  P.passives.forEach((p, i) => slot(lx0 + i * 34, sy + 46, 30, ICON[p.id], PASSIVES[p.id].glyph, 'rgba(239,230,210,0.3)', `${p.lv}`, false));
  // indicators
  let nj = null, nd = 1e9; for (const j of jars) { const d = Math.hypot(j.x - P.x, j.y - P.y); if (d < nd) { nd = d; nj = j; } }
  if (nj) edgeArrow(nj.x, nj.y, '#f2a93b', `기름 ${Math.round(nd / M)}m`);
  for (const d of drops) if (d.k === 'chest') { edgeArrow(d.x, d.y, '#e0607e', '보물상자'); break; }
  for (const d of drops) if (d.k === 'magnet' && Math.hypot(d.x - P.x, d.y - P.y) < 1400) { edgeArrow(d.x, d.y, '#9fd0ff', '지남철'); break; }
  for (const d of drops) if (d.k === 'ginseng' && Math.hypot(d.x - P.x, d.y - P.y) < 1400) { edgeArrow(d.x, d.y, '#7fe0a0', '산삼'); break; }
  for (const b of G.bosses) edgeArrow(b.x, b.y, '#c8463a', ED[b.type].name);
  { const LM = [['shrine', '#ffd27a', '서낭당', p => !p.used], ['well', '#9fe0ff', '우물', p => G.t >= p.readyAt], ['peddler', '#f2a93b', '보부상', () => true], ['mat', '#ffd27a', '노름판', p => !p.used]];
    for (const [t, col, name, ok] of LM) { let best = null, bd = 900; for (const p of poiList) if (p.t === t && ok(p)) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < bd) { bd = d; best = p; } } if (best) edgeArrow(best.x, best.y - 30, col, name); } }
  // joystick
  if (joy) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, 44 / (d || 1));
    ctx.strokeStyle = 'rgba(239,230,210,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(242,169,59,0.45)'; ctx.beginPath(); ctx.arc(joy.ox + dx * m, joy.oy + dy * m, 18, 0, TAU); ctx.fill();
  }
  // banner
  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t / 0.3, (b.dur - b.t) / 0.5);
    ctx.globalAlpha = clamp(a, 0, 1);
    const yb = H * 0.3;
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, 'rgba(6,7,12,0)'); bg.addColorStop(0.5, 'rgba(6,7,12,0.7)'); bg.addColorStop(1, 'rgba(6,7,12,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, yb - 34, W, b.sub ? 62 : 46);
    txt(b.title, W / 2, yb, narrow ? 21 : 26, '#efe6d2', 'center', FD, 700);
    if (b.sub) txt(b.sub, W / 2, yb + 21, 12.5, '#f2a93b', 'center');
    ctx.globalAlpha = 1;
  }
}
function slot(x, y, s, icon, glyph, col, lv, evo) {
  ctx.fillStyle = 'rgba(11,13,22,0.82)'; ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = col; ctx.lineWidth = evo ? 2 : 1.25; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (icon) dI(icon, x + 3, y + 2, s - 6, s - 6);
  else txt(glyph, x + s / 2, y + s * 0.62, s * 0.42, '#efe6d2', 'center', FD, 700);
  ctx.fillStyle = 'rgba(6,7,12,0.8)'; ctx.fillRect(x + s - 13, y + s - 12, 12, 11);
  txt(lv, x + s - 3, y + s - 3, 10, evo ? '#f2a93b' : '#efe6d2', 'right', FB, 700);
}
function drawPentagon(cx, cy) {
  const R = 22, pts = EL.map((e, i) => { const a = -Math.PI / 2 + i * TAU / 5; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = pts[i], b = pts[(i + 1) % 5], lit = P.elements.has(EL[i]) && P.elements.has(EL[(i + 1) % 5]);
    ctx.strokeStyle = lit ? (P.ohaeng ? EL_COLOR[EL[i]] : '#f2a93b') : 'rgba(239,230,210,0.14)';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  EL.forEach((e, i) => {
    const [x, y] = pts[i], on = P.elements.has(e);
    ctx.fillStyle = on ? EL_COLOR[e] : 'rgba(11,13,22,0.9)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = on ? 'rgba(6,7,12,0.6)' : 'rgba(239,230,210,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    txt(e, x, y + 3.5, 9.5, on ? '#140c08' : '#a39a86', 'center', FB, 700);
  });
  if (P.ohaeng) txt(`쓸어 버리기 ${Math.ceil(G.ohaengT)}초`, cx + 32, cy + 4, 11, '#efe6d2');
  else txt(P.links.length ? `기운 ${P.links.length}줄 이어짐` : '무기의 기운', cx + 32, cy - 2, 11, P.links.length ? '#f2a93b' : '#a39a86');
  if (!P.ohaeng) txt('눌러서 설명', cx + 32, cy + 12, 10.5, '#7d7564');
  G.pentaHit = [cx, cy];   // tap target for the 오행 guide
}
function edgeArrow(wx, wy, col, label) {
  const [sx, sy] = toScreen(wx, wy);
  if (sx > 20 && sx < W - 20 && sy > 20 && sy < H - 20) return;
  const a = Math.atan2(sy - H / 2, sx - W / 2), mx = W / 2 - 34, my = H / 2 - 54;
  const c = Math.cos(a), s = Math.sin(a), k = Math.min(mx / Math.max(Math.abs(c), 1e-4), my / Math.max(Math.abs(s), 1e-4));
  const px = W / 2 + c * k, py = H / 2 + s * k;
  ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
  txt(label, clamp(px - c * 18, 44, W - 44), clamp(py - s * 18 + 4, 16, H - 8), 11, col, 'center', FB, 700);
}

