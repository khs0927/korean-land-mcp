# 클라우드 작업 마무리 — 2026-11-05

브랜치: `claude/cloud-work-completion-upgrade-beuecn` (기준: `main` 25fbf76)

## Integrated / Skipped
| 출처 | 판단 |
|---|---|
| `grokbot/upstream-sync` | 건너뜀 — 유일한 커밋 e6cc4f9(`.github/workflows/upstream-sync.yml`)가 khs0927/korean-land-mcp#4로 이미 `main`에 동일 내용 병합됨. 브랜치가 #5·#6 이전 시점이라 병합하면 `get_parcel_boundary` 등이 지워짐 |
| `claude/happy-brahmagupta-rqzg2t` | 건너뜀 — khs0927/korean-land-mcp#3으로 이미 병합, 새 커밋 없음 |
| 열린 PR | 없음 |

## Upgrades
- `npm audit`: high 2(body-parser, follow-redirects) + moderate 5(fast-uri, qs, ip-address, esbuild, @vitest/mocker) + zod high 1 → **0건**.
  - 이 환경의 npm 10.9에서 `npm update`/`audit fix`가 arborist 오류(`edgesOut`)로 실패해 `npx npm@11 audit fix`로 lock 갱신. lockfileVersion 3 유지, npm 10 `npm ci`로 재설치 확인.
- zod 3.25 → **4.6.7** (MCP SDK 1.32.2가 `^3.25 || ^4` 지원, 기본 빌더만 사용 — 타입 검사·테스트 통과).
- 하한 상향: `@modelcontextprotocol/sdk ^1.32.2`, `axios ^1.21.0`, `express ^4.22.3`, `vitest ^4.1.12`. express 5·TypeScript 7·@types/node 26 등 메이저는 보류.
- CI: Node 20/22/24 매트릭스, `actions/checkout@v5`·`setup-node@v5`, 동시 실행 취소, 오프라인 실행 시험, `npm audit --omit=dev --audit-level=high` 게이트.
- Dockerfile 수정: 기존 이미지는 `npm ci --only=production` 후 `tsc`를 불러 빌드가 실패하는 구조였음 → 멀티 스테이지(node:22-alpine), 런타임은 prod 의존성만, `MCP_TRANSPORT=http`, `PORT=8080`(fly.toml과 일치), `USER node`. `.dockerignore` 추가.
- `dist/`는 `.gitignore`에 있는데 `dist/server.*`만 추적되어 오래된 상태(get_parcel_boundary 없음, 추적 안 된 파일 import)였음 → 추적 해제. 설치는 `npm run setup`(빌드 포함) 그대로.

## Features
- `VWORLD_BASE_URL` 환경변수: V-World 주소 재정의(중계 서버·오프라인 픽스처). http(s)만 허용, 지연 읽기. 테스트 3개.
- `scripts/offline-smoke.mjs` / `npm run smoke:offline`: 로컬 픽스처 V-World 서버 + `dist/server.js` stdio 실행 시험.

## OSS added
- 없음.

## Verification
| 명령 | 결과 |
|---|---|
| `npm ci && npx tsc --noEmit` | OK |
| `npm test` | **44 passed** (6 files) |
| `npm audit` | 0 vulnerabilities |
| `npm run smoke:offline` | 6/6 PASS (아래) |
| `docker build` + `docker run -e PORT=18080` + `curl POST /mcp` | initialize OK, tools/list 9개 (이 환경은 프록시 CA를 넣은 임시 빌드 컨텍스트로 빌드; Dockerfile 내용은 동일) |

### Real run (stdio, 키·네트워크 없음)
```
PASS initialize -> korean-land-mcp 2.0.0 (protocol 2025-06-18)
PASS tools/list -> 9: analyze_parcel, discover_tools, get_district_plan, get_land_attributes, get_other_law_designations, get_parcel_boundary, get_urban_facility, get_zoning, resolve_parcel
PASS get_parcel_boundary(4513011200100360000) -> 36대, 5 vertices, ~100.28 m²
PASS get_zoning -> 용도지역 ["일반상업지역"], 용도지구 ["방화지구"]
PASS analyze_parcel -> pnu 4513011200100360000, next_steps 1
PASS fixture V-World served 85 requests (no live calls)
offline smoke OK
```

## Remaining (사용자 필요)
- 실제 V-World 호출(`tests/live/smoke-fixtures.ts`): `VWORLD_API_KEY`·`VWORLD_DOMAIN` 필요, 한국 IP 필요.
- fly.io 배포 확인: 새 Dockerfile은 HTTP 모드로 뜸 — 배포 전 `fly deploy` 1회 확인 권장.
- korean-site-core 공통 PNU 계약 테스트(`tests/site-core-contract.test.ts`)는 픽스처 사본 기준 — 원본 저장소(비공개) 변경 시 동기화 필요.

## Local Windows run (2026-11-05)
Windows 10, Node 22.16, 한국 IP. 키는 로컬 `.env` 값을 프로세스 환경변수로만 사용.

| 명령 | 결과 |
|---|---|
| `gh pr checks 8` | test (20/22/24) 모두 pass |
| `npm ci`, `npx tsc --noEmit`, `npm audit` | OK, 취약점 0 |
| `npm test` | 44 passed (6 files) |
| `npm run smoke:offline` | 6/6 PASS |
| `npx tsx tests/live/smoke-fixtures.ts` (갱신 전) | FAILED 3/3. `origin/main`(fce947f)에서도 같은 차이 → 이 PR의 회귀 아님 |
| 같은 명령 `--update` 후 VERIFY 4회 | 1회차 1건 `timeout of 10000ms exceeded`(V-World 응답 지연, 픽스처 2건 pass), 이후 3회 연속 OK 3/3 |
| `docker build` | **미실행**: Docker 데몬 꺼짐(`com.docker.service` STOPPED) |
| Dockerfile 런타임 단계 네이티브 재현(`npm ci --omit=dev` + `dist`, `NODE_ENV=production MCP_TRANSPORT=http`) | initialize 200, notifications/initialized 202, tools/list 9개, 실제 V-World `get_zoning`(연남동 229-1) → PNU 1144012400102290001 |

### 스냅샷 갱신 내용
4월 기준값이 낡아서 `tests/live/__snapshots__/` 3건을 갱신함.
- `layer_error_count: 1 → 0` (3건): 지금은 레이어 오류가 없음. 4월에 어떤 레이어가 실패했는지는 기록이 없어 알 수 없음.
- 갈매리 344-17 `zone: 제1종일반주거지역 → 제2종일반주거지역`: 이 필지는 다중 용도지역이고 라이브 응답에 제1종·제2종·자연녹지·계획관리가 모두 있음. 스냅샷은 `use_zone[0]`만 기록하며, 두 항목의 고시 연도가 2021이라 V-World 반환 순서가 바뀐 것으로 추정(확정 아님). 순서가 또 바뀌면 이 스냅샷은 다시 실패함.

### 남은 일
- Docker 이미지 빌드·컨테이너 HTTP 확인을 이 PC에서 다시 하려면 Docker Desktop 기동이 필요. 클라우드 빌드 결과는 위 Verification 참고.
- **HTTP 모드는 프로세스당 세션 1개만 받음**: `src/server.ts`가 transport 하나를 전역으로 쓰기 때문에 두 번째 클라이언트의 initialize가 `400 Server already initialized`로 거부됨. `GET /mcp`도 404. `main`에도 있는 기존 동작이고 이 PR 범위 밖이라 고치지 않음. 여러 클라이언트가 붙는 fly 배포 전에 세션별 transport로 수정 필요.
- fly 배포 전 확인: `VWORLD_API_KEY`·`VWORLD_DOMAIN` 시크릿 설정, `primary_region = "nrt"`(일본)에서 V-World 호출 가능 여부(국내 IP 필요 조건). `fly deploy`는 실행하지 않음.

## Round 2 (2026-11-07)
코드 변경 없음(문서만). korean-site-core 와의 관계를 기록함 — **포팅하지 않음**.

### korean-site-core 와의 관계
- `khs0927/korean-site-core`(비공개, Python, 태그 `v0.1.0` = 8e634f0)는 PNU 파싱·V-World 2.0 클라이언트·건폐율/용적률 상한표를
  Python 저장소들(site-pipeline-mcp, building-regulation-gateway 시험 브랜치)에서 하나로 모은 라이브러리임.
- 이 저장소는 **TypeScript(Node)** 라서 그 패키지를 그대로 쓸 수 없고, 같은 역할을 자체 구현으로 가짐:
  | 영역 | korean-site-core (Python) | korean-land-mcp (TS) |
  |---|---|---|
  | PNU | `PNU` — 19자리 + 대장구분(11번째 자리) 1/2 검사, `archhub_params()` | `isPnu()` (`src/lib/vworld.ts`) — 19자리만 검사, 대장구분 미검사 |
  | V-World 전송 | `VWorldClient` — NOT_FOUND→빈 결과, 429/`OVER_REQUEST_LIMIT` 백오프, 키 제거 | `getFeatures()` — 레이어별 캐시·서킷브레이커, `VWorldError` |
  | 필지 | `LP_PA_CBND_BUBUN` | 같은 레이어 (`src/lib/parcel.ts`, `resolve.ts`) |
  | 용도지역 | `zoning_at` (main: UQ111~114 4개 레이어, v0.1.0 태그는 UQ111만) | UQ111~114 4개 레이어 (`src/tools/get_zoning.ts`, `analyze_parcel.ts`) |
  | 건폐율·용적률 상한표 | `rules.py` (시행령 84·85조 + 서울·군산) | **없음** — 이 MCP는 공간 사실만 돌려주고 법령·조례 수치는 korean-law MCP 몫 |
- 결론: 의존 관계 없음(서로 import 하지 않음). 두 구현이 같은 V-World 레이어·PNU 형식을 쓰므로, 한쪽의 레이어 변경
  (예: core #2 의 UQ111~114) 은 다른 쪽에도 반영됐는지 수동으로 확인해야 함.
- 포팅을 하지 않은 이유: 언어가 다르고, 공유할 수 있는 건 데이터(`statutory.json`, `ordinances.json`) 뿐인데 이 MCP는 수치표를 쓰지 않음.
  나중에 TS 쪽에서 상한표가 필요해지면 JSON 파일만 버전 고정해 가져오는 방식을 권장(Python 코드 포팅 대신).
- 남는 작은 차이(선택 과제, 이번엔 고치지 않음): `isPnu()` 가 대장구분 자리(1/2)를 검사하지 않음. 잘못된 PNU는 V-World 에서
  `PNU_NOT_FOUND` 로 끝나므로 결과가 틀리지는 않고 호출 1회가 낭비될 뿐.
