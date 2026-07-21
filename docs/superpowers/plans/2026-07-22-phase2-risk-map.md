# Phase 2 — 실 위험 지도 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 20team의 목업 위험 지도를 HanQ의 실데이터 지도(Leaflet+OSM + Firestore geohash 집계 + 신고→지도 루프)로 교체하고, 백엔드(geo/reports/map)를 20team 레포로 이식해 자체 소유·배포한다.

**Architecture:** 백엔드 3모듈(geo/geohash, reports, map/summary)을 HanQ에서 이식하고 verify의 geohash 스텁(Phase 1)을 실이식으로 복원. 프론트는 `korea-risk-map.tsx`를 Leaflet+OSM로 교체, `risk-map-page.tsx`를 `/api/map/summary` 실데이터로 렌더, 스캔 danger 시 `/api/reports` 신고 루프 추가.

**Tech Stack:** Firebase Functions v2, Firestore, `leaflet` (신규), React19/Vite/Tailwind.

**참조 소스(이식 원본):** `/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/functions/src/{geo/geohash.ts,reports/index.ts,map/summary.ts}`, `.../HanQ/web/components/screens/MapScreen.tsx` (로직 참조, 프레임워크는 재구현).

**설계 스펙:** `docs/superpowers/specs/2026-07-22-hanq-backend-integration-design.md` §4.1.

**정찰 사실(2026-07-22):** 프로덕션 `/api/map/summary`(HanQ 배포분)가 이미 실데이터 반환 — `{total,thisWeek,blockedToday,regions[],cells[{geohash,lat,lng,count,topPlaceType,lastAt}],byPlaceType,recent[]}`. cells에 디코드된 lat/lng 포함(Leaflet 바로 사용 가능).

## Global Constraints

- 배포 타깃 `hanq-dev-17267`, 함수 codebase `hanq`, 리전 us-central1. 배포는 `--only functions:hanq:<name>` 개별 스코프(다른 함수 삭제 방지).
- verify 계약 하위호환 유지. 시크릿은 Secret Manager(이미 등록). `.env*` 커밋 금지.
- 프로덕션 클라는 `/api/*` 상대경로 호출(호스팅 리라이트가 함수로 연결). dev는 vite 프록시(5055).
- 지도 프라이버시: 원좌표 미저장 원칙 유지(서버가 geohash-7 중심 좌표만 반환). 프론트 배지 "구 단위 히트맵·정확 좌표 미저장".
- 커밋 메시지 AI 공동저자 표기 금지. main 직접 push 금지(브랜치 `feature/hanq-backend-integration`).
- 신규 의존성 `leaflet` + `@types/leaflet`. `@svg-maps/south-korea` 제거.

---

### Task 1: 백엔드 이식 — geo/reports/map + verify geohash 복원

**Files:**
- Create: `functions/src/geo/geohash.ts`, `functions/src/reports/index.ts`, `functions/src/map/summary.ts` (HanQ 이식)
- Modify: `functions/src/index.ts` (reports, mapSummary export 추가), `functions/src/verify/index.ts` (Phase 1 geohash 스텁 → 실 import 복원)

**Interfaces:**
- Produces: `reports` onRequest(`POST /api/reports`), `mapSummary` onRequest(`GET /api/map/summary`), `toRegion(lat,lng)`/`regionName(code)`/`encodeGeohash`/`decodeGeohashCenter` from geo/geohash.

- [ ] **Step 1: geo/reports/map 이식**

```bash
SRC="/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/functions/src"
cp "$SRC/geo/geohash.ts" functions/src/geo/geohash.ts
cp "$SRC/reports/index.ts" functions/src/reports/index.ts
cp "$SRC/map/summary.ts" functions/src/map/summary.ts
```
(디렉토리 없으면 mkdir. import 확장자는 Phase 1 tsconfig 관례에 맞춤 — `../shared/admin` 등 확장자 없는 상대 import는 그대로 두되, `node --test`가 아닌 배포 빌드(tsc)만 필요하므로 `.ts` 확장자 불필요.)

- [ ] **Step 2: verify/index.ts geohash 스텁 복원**

Phase 1에서 `verify/index.ts` 상단의 로컬 스텁(`toRegion`/`regionName` → `{00000,unknown}`)을 제거하고 실 import로 교체:
```ts
import { toRegion, regionName } from "../geo/geohash";
```
(스텁 함수 정의 삭제. 호출부는 동일 시그니처라 변경 불필요. 실제 HanQ geo/geohash.ts의 export 이름을 Read로 확인 후 맞출 것.)

- [ ] **Step 3: index.ts export 추가**

`functions/src/index.ts`:
```ts
export { verify } from "./verify/index.js";
export { reports } from "./reports/index.js";
export { mapSummary } from "./map/summary.js";
// Phase 3: issuerQr, issuerDashboard, track
```
(이식한 reports/map summary의 실제 export 이름을 Read로 확인 후 맞출 것 — HanQ index.ts 참조.)

- [ ] **Step 4: 빌드 확인**

Run: `cd functions && npm run build`
Expected: tsc 0 errors. (reports/map이 shared/admin·geo/geohash를 참조하는지, 타입 정합 확인.)

- [ ] **Step 5: 커밋**

```bash
git add functions/src/geo functions/src/reports functions/src/map functions/src/index.ts functions/src/verify/index.ts
git commit -m "feat: port geo/reports/map functions and restore verify geohash"
```

---

### Task 2: 프론트 api-client — map summary + report

**Files:**
- Modify: `src/lib/api-client.ts` (getMapSummary, postReport + 타입)

**Interfaces:**
- Consumes: `GET /api/map/summary`, `POST /api/reports`.
- Produces: `getMapSummary(): Promise<MapSummaryResponse>`, `postReport(body): Promise<void>`, `MapSummaryResponse`/`MapCell`/`MapRegion`/`RecentReport` 타입.

- [ ] **Step 1: 타입 + 함수 추가**

`src/lib/api-client.ts`에 추가 (실제 응답 shape는 정찰 확인분 기준):
```ts
export type MapCell = { geohash: string; lat: number; lng: number; count: number; topPlaceType: string; lastAt: string };
export type MapRegion = { regionCode: string; name: string; count: number; level: "high"|"mid"|"low" };
export type RecentReport = { placeType?: string; regionName?: string; at: string };
export type MapSummaryResponse = {
  total: number; thisWeek: number; blockedToday: number;
  regions: MapRegion[]; cells: MapCell[];
  byPlaceType: Record<string, number>; recent: RecentReport[];
};
export async function getMapSummary(): Promise<MapSummaryResponse> {
  const res = await fetch("/api/map/summary");
  if (!res.ok) throw new Error(`map summary failed: ${res.status}`);
  return res.json();
}
export type ReportBody = { payload: string; verdict: string; lat?: number; lng?: number; placeType?: string };
export async function postReport(body: ReportBody): Promise<void> {
  const res = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`report failed: ${res.status}`);
}
```
(실제 `recent[]`/`RecentReport` 필드는 배포된 응답을 Read/curl로 재확인해 정합. `level` 유니온이 다르면 서버값에 맞춤.)

- [ ] **Step 2: 빌드(타입) 확인**

Run: `npm run build`
Expected: tsc + vite build 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/api-client.ts
git commit -m "feat: add map summary and report api client methods"
```

---

### Task 3: Leaflet 지도 컴포넌트 + risk-map 페이지 실데이터

**Files:**
- Modify: `package.json`(+`leaflet`,`@types/leaflet`; −`@svg-maps/south-korea`), `src/components/korea-risk-map.tsx`(Leaflet로 교체), `src/pages/risk-map-page.tsx`(실데이터 렌더)

**Interfaces:**
- Consumes: `getMapSummary()` (Task 2).
- Produces: 실데이터 위험 지도 페이지.

- [ ] **Step 1: 의존성**

Run: `npm install leaflet && npm install -D @types/leaflet && npm uninstall @svg-maps/south-korea`
(Leaflet CSS는 컴포넌트에서 `import "leaflet/dist/leaflet.css"`.)

- [ ] **Step 2: KoreaRiskMap → Leaflet**

`src/components/korea-risk-map.tsx`를 Leaflet 지도로 재구현(HanQ `MapScreen.tsx` 로직 참조): 동적 `import("leaflet")`, OSM 타일(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), 중심 `[37.5405,126.986]` zoom 11. `cells` prop을 원형 마커(`L.circle`, 반경 `300+count*55`m, 색 ≥25 red/≥12 amber/else indigo)로 렌더. cells 없으면 6개 서울 구 정적 폴백(`L.divIcon` 카운트 라벨). 프라이버시 배지 오버레이 "구 단위 히트맵 · 정확 좌표 미저장"(잠금 아이콘). Props: `cells: MapCell[]`, `regions?: MapRegion[]`.

- [ ] **Step 3: risk-map-page 실데이터**

`src/pages/risk-map-page.tsx`: `useEffect`/react-query로 `getMapSummary()` 호출. 로딩/에러 상태 처리. 렌더: 상단 통계 타일(total/thisWeek/blockedToday), `<KoreaRiskMap cells regions>`, 구 랭킹 그리드(regions, level 색), 장소 유형 필터 칩(byPlaceType, 실카운트), 최근 신고 피드(recent, `timeAgo` 상대시각 — HanQ MapScreen의 timeAgo 순수함수 이식). 기존 목업 하드코딩(regions/filters/stat) 제거.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: tsc + vite build 성공(leaflet 타입 포함). `@svg-maps` 참조 잔존 없음.

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json src/components/korea-risk-map.tsx src/pages/risk-map-page.tsx
git commit -m "feat: replace mock risk map with Leaflet+OSM live data"
```

---

### Task 4: 신고 루프 (스캔 danger → 지도)

**Files:**
- Modify: `src/pages/result-page.tsx` 또는 `src/pages/scan-page.tsx` (danger 결과에 "이 위치 신고" 액션 → `postReport`)

**Interfaces:**
- Consumes: `postReport()` (Task 2), `navigator.geolocation`(선택).

- [ ] **Step 1: 신고 UI + 호출**

danger(또는 warn/danger) 결과 화면에 "위험 위치 신고" 버튼 추가. 클릭 시: 장소 유형 선택(간단 칩: payment/delivery/public/etc.) + `navigator.geolocation.getCurrentPosition`(권한 거부 시 위치 없이 전송) → `postReport({payload, verdict, lat, lng, placeType})`. 성공 시 "지도에 반영됐어요" 토스트/배너. 좌표는 서버가 geohash로 집계(원좌표 미저장) — UI에 프라이버시 문구.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/result-page.tsx src/pages/scan-page.tsx
git commit -m "feat: add danger-result report loop feeding the risk map"
```

---

### Task 5: 배포 + 라이브 검증

**Files:** (없음 — 배포/검증)

- [ ] **Step 1: 함수 배포(개별 스코프)**

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
firebase deploy --only functions:hanq:verify,functions:hanq:reports,functions:hanq:mapSummary --project hanq-dev-17267 --force
```
Expected: 3함수 Successful update. (verify는 geohash 복원 반영, reports/mapSummary는 우리 소유 코드로 갱신.)

- [ ] **Step 2: 프론트 빌드 + 호스팅 배포**

```bash
npm run build
firebase deploy --only hosting --project hanq-dev-17267
```

- [ ] **Step 3: 라이브 스모크**

```bash
curl -s https://hanq-dev-17267.web.app/api/map/summary | python3 -c "import sys,json;d=json.load(sys.stdin);print('cells',len(d['cells']),'regions',len(d['regions']))"
curl -s -o /dev/null -w "%{http_code}\n" https://hanq-dev-17267.web.app/map
```
Expected: map/summary 데이터 반환, `/map` 200. 브라우저에서 `https://hanq-dev-17267.web.app/map` 지도에 마커 렌더 확인(사용자).

- [ ] **Step 4: 원장/문서 기록** (배포 결과 ledger 기록)

---

## Self-Review

- §4.1 지도(Leaflet+OSM, cells 마커, 폴백, 통계/랭킹/칩/피드/프라이버시 배지) → Task 3. ✅
- 신고→지도 루프 → Task 4. ✅
- geo/geohash·reports·map/summary 이식 + verify 스텁 복원 → Task 1. ✅
- api 계약(map/summary, reports) → Task 2. ✅
- 배포 → Task 5. ✅
- Placeholder 없음. 이식 파일 실제 export 이름은 Task 1에서 Read로 확정.
- 미해결: 배포된 `recent[]`/`level` 실제 필드는 Task 2에서 curl/Read로 재확인해 타입 정합(정찰 shape 기준).

## 다음 (Phase 3~4, 범위 밖)

- Phase 3: 서명 QR/위조탐지 + 발급자(Firebase Auth) + `/r/:qrId`.
- Phase 4: UX 이식(줌·플래시·위협별 액션·방어리포트·데모트리거·tnums).
