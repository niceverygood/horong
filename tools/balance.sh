#!/bin/bash
# 밸런스 확인 일괄 실행: 실력 3단계 × 연이·단비 × N판(씨앗 SEED0..), 4개씩 병렬. 결과는 OUT 폴더의 jsonl.
#   bash tools/balance.sh [N=12] [SEED0=2000]      (먼저 bash wrap.sh 와 로컬 서버)
#   PAGE=test-xyz.html OUT=bal-xyz bash tools/balance.sh  → 고친 시험판끼리 비교
cd "$(dirname "$0")/.."
N=${1:-12}; S0=${2:-2000}; OUT=${OUT:-balance-out}; mkdir -p "$OUT"
for P in novice average aggressive; do for C in yeoni danbi; do
  for w in 0 1 2 3; do
    seeds=$(seq $((S0 + w)) 4 $((S0 + N - 1)) | paste -sd,)
    [ -n "$seeds" ] && node tools/balance.js $P $C $seeds >> "$OUT/$P-$C.jsonl" &
  done; wait
done; done
python3 tools/balance_report.py "$OUT"
