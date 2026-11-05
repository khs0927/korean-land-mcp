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
