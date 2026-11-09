// 밸런스 확인: 자동 플레이 봇(horong-demo/bot.js)으로 1탄 → 2탄을 무적 없이 끝까지 돌림. 판마다 새 브라우저 컨텍스트
// (주막 강화 없음, 처음 하는 사람 기준). 한 판에 한 줄씩 JSON 을 출력함 — tools/balance_report.py 로 요약.
// 실행: 로컬 서버(README '로컬에서 실행')를 띄운 뒤  node tools/balance.js <초보|보통|공격형 → novice|average|aggressive> <yeoni|danbi> <seed,seed,...>
// PAGE=test.html 이 기본. 봇 실력: reach = 요괴를 알아채고 피하기 시작하는 거리, zones = 바닥 위험 표시 읽기,
// dodgeFire = 날아오는 투사체 피하기, pick = 레벨업 카드 고르는 법, engage = 정예·보스에 다가가 싸우기.
const { chromium } = require('playwright');
const path = require('path');
const PROFILES = {
  novice:  { mode: 'avoid', reach: 95,  jarAt: 35, dodgeFire: false, zones: false, pick: 'random' },   // 늦게 알아채고, 예고를 안 읽고, 카드는 아무거나
  average: { mode: 'avoid', reach: 130, jarAt: 50 },   // 예고·투사체는 피하지만 보스는 피해 다님
  aggressive: { mode: 'avoid', reach: 170, jarAt: 60, engage: 'all' },   // 잘 피하지만 보물상자를 노리고 보스에 붙음
};
const [prof, ch, seedsArg] = process.argv.slice(2), opt = PROFILES[prof], seeds = seedsArg.split(',').map(Number);
(async () => {
  const b = await chromium.launch();
  for (const seed of seeds) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:' + (process.env.PORT || 8731) + '/' + (process.env.PAGE || 'test.html'));
    await p.waitForFunction(() => !document.querySelector('#btn-start').disabled, null, { timeout: 30000 });
    await p.addScriptTag({ path: path.join(__dirname, '..', 'horong-demo', 'bot.js') });
    await p.evaluate(() => { window.requestAnimationFrame = () => 0; }); await p.waitForTimeout(50);
    const r = await p.evaluate(([seed, ch, opt]) => {
      Math.random = (() => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
      const H = window.HORONG; window.__newRun(ch); document.querySelector('#btn-mute').click();
      const SRC = {}, u0 = H.upd; H.upd = dt => { const h0 = H.P.hp, l0 = H.P.lastHit; u0(dt); const d = h0 - H.P.hp; if (d > 0.5) { const w = (H.G.stage || 1) + '탄 ' + (H.G.t < 180 ? '0-3m' : H.G.t < 330 ? '3-5.5m' : H.G.t < 480 ? '5.5-8m' : '8m+'), k = (H.P.lastHit || '?').replace(' (어둠 속 +25%)', ''); const o = SRC[w] || (SRC[w] = {}); o[k] = (o[k] || 0) + d; } };
      const out = { seed, ch }, stages = [];
      for (let st = 1; st <= 2; st++) {
        const S = { dmg: [], heal: [], boss: {}, greedS: 0, minute: [], minHp: 1 }; let last = null, guard = 0; const B = new Map();
        while (guard++ < 400) {
          const m = window.__run(5, opt); last = m;
          m.dmgMin.split(' ').forEach(x => { const [k, v] = x.split(':'); if (!v) return; const i = +k.replace('m', ''); S.dmg[i] = (S.dmg[i] || 0) + +v.split('/')[0]; });
          S.greedS += m.greedS; S.minHp = Math.min(S.minHp, H.P.hp / H.P.maxHp);
          { const mn = Math.floor(H.G.t / 60); S.lvMin = S.lvMin || []; S.lvMin[mn] = H.P.level; S.killMin = S.killMin || []; S.killMin[mn] = H.P.kills; S.lightMin = S.lightMin || []; S.lightMin[mn] = Math.round(H.P.light); S.enMin = S.enMin || []; S.enMin[mn] = H.enemies.length; }
          for (const b of H.G.bosses) if (!B.has(b)) B.set(b, { type: b.type, t0: H.G.t });
          for (const [b, o] of B) if (b.dead && !o.end) { o.end = (b.silent ? 'left' : 'kill') + '@' + Math.round(H.G.t - o.t0) + 's'; }
          if (/over|clear|ending/.test(H.G.state)) break;
          if (H.G.t > 900) break;
        }
        S.end = H.G.state; S.t = +H.G.t.toFixed(1); S.lv = H.P.level; S.hp = Math.round(H.P.hp); S.maxHp = H.P.maxHp; S.cause = H.G.state === 'over' ? H.P.lastHit : null;
        S.kills = H.P.kills; S.build = H.P.weapons.map(w => w.id + w.lv + (w.evo ? '*' : '')).join(',') + ' / ' + H.P.passives.map(q => q.id + q.lv).join(',');
        S.dmg = Array.from({ length: Math.ceil(H.G.t / 60) }, (_, i) => Math.round(S.dmg[i] || 0));
        S.boss = [...B.values()].map(o => o.type + Math.round(o.t0) + ':' + (o.end || ('alive' + Math.round(100 * ([...B.keys()].find(k => B.get(k) === o).hp / [...B.keys()].find(k => B.get(k) === o).maxHp)) + '%'))).join(' '); S.minHp = +S.minHp.toFixed(2);
        stages.push(S);
        if (H.G.state !== 'clear') break;
        for (let i = 0; i < 800 && !(H.G.state === 'play' && H.G.stage === 2); i++) { H.tick(16); if (H.G.state === 'levelup') document.querySelector('#cards .card')?.click(); }
      }
      out.src = SRC;       out.stages = stages; out.win = stages.length === 2 && (stages[1].end === 'ending' || (stages[1].end === 'over' && H.G.win));
      return out;
    }, [seed, ch, opt]);
    r.prof = prof; r.errs = errs.slice(0, 2);
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
