# 밸런스 확인 요약: python3 tools/balance_report.py <폴더> [<비교할 폴더>...]
# 실력·인물별 1탄 통과 / 승리 / 2탄 사망 수, 1탄에서 쓰러진 시각, 2탄 최저 체력(중앙값), 쓰러진 원인.
import json, glob, sys, os, collections
def load(d, p, c):
    f = os.path.join(d, f'{p}-{c}.jsonl')
    return [json.loads(l) for l in open(f) if l.strip().startswith('{')] if os.path.exists(f) else []
dirs = sys.argv[1:] or ['balance-out']
for p in ['novice', 'average', 'aggressive']:
    for c in ['yeoni', 'danbi']:
        for d in dirs:
            rs = load(d, p, c); n = len(rs)
            if not n: continue
            c1 = sum(r['stages'][0]['end'] == 'clear' for r in rs); w = sum(bool(r['win']) for r in rs)
            d1 = sorted(round(r['stages'][0]['t']) for r in rs if r['stages'][0]['end'] == 'over')
            s2 = [r['stages'][1] for r in rs if len(r['stages']) > 1]; d2 = sum(s['end'] == 'over' for s in s2)
            mh = sorted(s['minHp'] for s in s2)
            print(f"{p:10s} {c:6s} {os.path.basename(d):14s} 1탄 {c1:2d}/{n}  승 {w:2d}/{n}  2탄 사망 {d2}  1탄 쓰러진 시각 {d1}  2탄 최저 체력 {mh[len(mh) // 2] if mh else '-'}")
    print()
for d in dirs:
    causes = collections.Counter()
    for p in ['novice', 'average', 'aggressive']:
        for c in ['yeoni', 'danbi']:
            for r in load(d, p, c):
                for i, s in enumerate(r['stages']):
                    if s['end'] == 'over' and not r['win']: causes[f"{i + 1}탄 {(s['cause'] or '?').split(' (')[0]}"] += 1
    print(os.path.basename(d), '쓰러진 원인:', ', '.join(f'{k} {v}' for k, v in causes.most_common(10)))
