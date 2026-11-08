# 호롱: 백귀야행 — 웹 체험판

조선 밤 장터를 배경으로 한 서바이버류 게임의 웹 체험판입니다. 호롱불이 꺼지지 않게 기름을 주워 가며 10분 동안 요괴 행렬을 버팁니다. 공격은 자동이고 플레이어는 이동만 합니다.

- 웹 체험판(claude.ai): https://claude.ai/artifact/2zdxPYtZDpU1kbE2hyrwY7
- 기획서: https://claude.ai/artifact/GFGoEUP9CcWNyiWRCeSZ9U

## 로컬에서 실행

`horong-demo/index.html` 은 페이지 조각(본문만)이라 `wrap.sh` 로 완성된 `test.html` 을 만든 뒤 띄웁니다.

```bash
bash wrap.sh
python3 -m http.server 8731 --directory horong-demo
```

브라우저에서 http://localhost:8731/test.html 을 엽니다. 주소 끝에 `#playground` 를 붙이면 바로 놀이터로 들어갑니다.

## 놀이터 (움직임 시험)

첫 화면의 **놀이터 · 움직임 시험** 버튼으로 들어갑니다. 시간이 흐르지 않고 요괴도 저절로 나오지 않습니다.

- 시간: 정지 · 0.1× ~ 2× · 한 프레임씩 넘기기 (키보드 `0` 정지/재개, `.` 한 프레임), 확대
- 등불지기: 연이/단비 전환, 이동 속도, 자동 걷기(원 · 8방향 · 좌우 · 위아래 · 멈췄다 걷기 · 지그재그), 현재 걷기 그림과 섞임 비율 표시
- 무기: 6종 장착/해제, 레벨, 진화형 — 장착한 물건이 몸에 보이고 발동할 때 손에 들고 씁니다
- 요괴: 6종 소환(1·5·20마리), 공격 시키기(도깨비 뛰어들기 · 갓 귀신 부적 · 도깨비불 화염구 · 달걀귀신 돌진), 포위진, 백귀야행
- 보스: 그슨대 · 구미호 · 이무기 소환과 기술 하나씩 발동, 쓰러뜨리기
- 설정: 무적, 요괴 안 죽음, 무기 발동, 보스 자동 공격, 몹 공격, 요괴 멈춤, 예측 위치 보기, 충돌 범위 보기, 환하게

## 폴더 구성

| 경로 | 내용 |
| --- | --- |
| `horong-demo/` | 게임 페이지(`index.html`), 그림 묶음·효과음·배경음(`assets/`), 자동 플레이 봇(`bot.js`) |
| `tools/process.py` | `raw/img` 원본 그림을 잘라 `assets/sprites.png` · `sprites.json` 그림 묶음으로 만듦 |
| `tools/sec_audio_art.js`, `tools/sec_render.js` | 그림·소리 로딩, 렌더링 코드 원본 — `splice.py` 가 `index.html` 에 끼워 넣음 |
| `tools/splice.py` | 위 두 파일과 그림 묶음 좌표를 `index.html` 에 합치고 내용 해시 이름의 그림 묶음 사본을 만듦 |
| `raw/img`, `raw/sfx` | 생성한 원본 그림(OpenAI gpt-image-2)과 효과음(ElevenLabs) |
| `concept-art/` | 키아트 · 인게임 목업 |

## 다시 빌드

```bash
python3 tools/process.py   # 원본 그림을 바꿨을 때
python3 tools/splice.py    # tools/*.js 를 고쳤을 때
bash wrap.sh
```
