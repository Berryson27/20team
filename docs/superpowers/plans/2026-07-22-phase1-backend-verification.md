# Phase 1 — 백엔드 기반 + 검증 엔진 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 20team(Vite/React SPA)에 HanQ의 Firebase Functions 백엔드를 이식하고, 검증 엔진을 HanQ S0~S6 + 20team의 Safe Browsing(S5) + S3 규칙 합집합으로 통합해 `POST /api/verify`로 노출하고, 클라이언트를 그 API 호출로 전환한다.

**Architecture:** `functions/`(Node22, Functions v2, TS)를 신규 추가한다. 검증은 서버가 single source of truth. HanQ `functions/src/*`를 이식하되 `verify/heuristics.ts`에 20team `url-analysis.ts`의 규칙을 합집합으로 병합하고, 새 `verify/safebrowsing.ts` 스테이지를 추가한다. 클라 `src/lib/verification.ts`는 `POST /api/verify` 호출로 교체한다.

**Tech Stack:** Firebase Functions v2, firebase-admin, TypeScript 5.6, Node 22, Firebase Emulator Suite, Node built-in test runner(`node --test --experimental-strip-types`), Vite/React 19(클라).

**참조 소스(포팅 원본, 읽기 전용):** `/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/functions/src/**` 및 `.../HanQ/firestore.rules`, `.../HanQ/firestore.indexes.json`. 이하 "HanQ소스".

**설계 스펙:** `docs/superpowers/specs/2026-07-22-hanq-backend-integration-design.md` (§3 검증 엔진, §5 Firebase, §6 API 계약).

## Global Constraints

- Node 런타임: **Node 22** (`functions/package.json` `"engines": {"node": "22"}`).
- Functions 리전: **us-central1** (HanQ와 동일 유지).
- 배포 타깃: Firebase 프로젝트 **`hanq-dev-17267`**. 함수 codebase 이름 **`hanq`**.
- 시크릿은 코드/깃 금지 — Secret Manager `defineSecret`: `GEMINI_API_KEY`, `HANQ_SIGNING_SECRET`. 로컬 개발은 에뮬레이터 + `functions/.secret.local`(gitignore).
- 클라이언트에서 `VITE_GEMINI_API_KEY` 및 Gemini/Safe Browsing 직접 호출 코드 **제거**(서버로 이동).
- 검증 판정 임계: `score>=70 danger / >=40 warn / else safe`. 결합 캡 `raw = min(S2,25)+min(S3,40)+min(S4,45)`, clamp(0,100). Safe Browsing 매치 시 `score = max(score,90)`(trust cap 무시).
- API 계약은 HanQ `verify`와 **하위 호환** 유지(같은 프로젝트의 HanQ 프론트가 계속 동작해야 함).
- 커밋 메시지에 AI 공동저자 표기 금지. `--no-verify` 금지. main 직접 push 금지(현재 브랜치 `feature/hanq-backend-integration`).

---

### Task 1: functions 워크스페이스 스캐폴드 + 에뮬레이터 기동

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore`, `functions/src/index.ts`(임시 stub)
- Modify: `firebase.json`(functions codebase + /api rewrites + firestore + emulators 추가), `.firebaserc`(default → hanq-dev-17267)
- Create: `firestore.rules`, `firestore.indexes.json` (HanQ소스에서 복사)

**Interfaces:**
- Produces: 에뮬레이터에서 `GET http://127.0.0.1:5001/hanq-dev-17267/us-central1/verify` 또는 hosting rewrite `http://127.0.0.1:5000/api/verify`가 200 반환.

- [ ] **Step 1: functions/package.json 생성**

```json
{
  "name": "functions",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions,firestore,hosting,auth",
    "test": "node --test --experimental-strip-types src"
  },
  "engines": { "node": "22" },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^6.1.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.25",
    "@types/qrcode": "^1.5.5",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.3"
  },
  "private": true
}
```

- [ ] **Step 2: functions/tsconfig.json 생성** (HanQ소스 `functions/tsconfig.json` 내용을 그대로 복사. 없으면 아래 사용)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "moduleResolution": "node",
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: functions/.gitignore 생성**

```
lib/
node_modules/
.secret.local
*.local
```

- [ ] **Step 4: 임시 stub index.ts 생성** (`functions/src/index.ts`)

```ts
import { onRequest } from "firebase-functions/v2/https";

export const verify = onRequest({ region: "us-central1", cors: true }, (_req, res) => {
  res.json({ ok: true, stub: true });
});
```

- [ ] **Step 5: firestore.rules / firestore.indexes.json 복사**

Run:
```bash
cp "/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/firestore.rules" firestore.rules
cp "/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/firestore.indexes.json" firestore.indexes.json
```

- [ ] **Step 6: firebase.json 갱신** — 기존 hosting 블록은 유지(20team은 `public: "dist"`, SPA `**`→`/index.html` rewrite). functions/firestore/emulators 추가하고, `/api/*` rewrite를 SPA catch-all **앞에** 배치(순서 중요).

```json
{
  "functions": {
    "source": "functions",
    "codebase": "hanq",
    "ignore": ["node_modules", ".git", "*.local", "**/.*"],
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/verify", "function": "verify" },
      { "source": "/api/reports", "function": "reports" },
      { "source": "/api/map/summary", "function": "mapSummary" },
      { "source": "/api/issuers/qr", "function": "issuerQr" },
      { "source": "/api/issuers/me/dashboard", "function": "issuerDashboard" },
      { "source": "/api/track", "function": "track" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true },
    "singleProjectMode": true
  }
}
```

주의: reports/mapSummary/issuerQr/issuerDashboard/track 함수는 아직 없으므로 이 rewrite들은 후속 태스크/단계에서 함수가 생기면 유효해진다. 배포 전까지는 에뮬레이터에서 verify만 확인.

- [ ] **Step 7: .firebaserc 갱신**

```json
{
  "projects": {
    "default": "hanq-dev-17267",
    "legacy": "hanq-b0a27"
  }
}
```

- [ ] **Step 8: 의존성 설치 + 빌드 + 에뮬레이터 스모크**

Run:
```bash
cd functions && npm install && npm run build && cd ..
firebase emulators:start --only functions,firestore,hosting --project hanq-dev-17267
```
별도 셸에서:
```bash
curl -s http://127.0.0.1:5001/hanq-dev-17267/us-central1/verify | grep stub
```
Expected: `{"ok":true,"stub":true}` (stub 문자열 포함). 확인 후 에뮬레이터 종료.

- [ ] **Step 9: 커밋**

```bash
git add functions/package.json functions/tsconfig.json functions/.gitignore functions/src/index.ts firebase.json .firebaserc firestore.rules firestore.indexes.json
git commit -m "feat: scaffold functions workspace and firebase config for backend integration"
```

---

### Task 2: shared/ 유틸 이식

**Files:**
- Create: `functions/src/shared/{admin,http,ratelimit,secrets,te,types,brands}.ts` (HanQ소스에서 이식)

**Interfaces:**
- Produces: `db`(admin firestore), `withCors(handler)`, `checkRateLimit(...)`, `defineSecret` 래퍼(`GEMINI_API_KEY`,`HANQ_SIGNING_SECRET`), `config` 객체, `BRANDS`/`GLOBAL_TRUSTED`/`OFFICIAL_DOMAINS`/`RISKY_TLDS`, 공용 타입(`VerifyRequest`,`VerifyResponse`,`ThreatType`,`PageAnalysis` 등).

- [ ] **Step 1: shared 파일 이식**

각 파일을 HanQ소스에서 20team `functions/src/shared/`로 복사한다. 복사 후 import 경로/프로젝트 하드코딩만 점검(프로젝트ID는 하드코딩되지 않았는지 확인, admin.initializeApp은 인자 없이).

Run:
```bash
SRC="/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/functions/src/shared"
for f in admin.ts http.ts ratelimit.ts secrets.ts te.ts types.ts brands.ts; do
  cp "$SRC/$f" "functions/src/shared/$f"
done
```

- [ ] **Step 2: 각 파일 정독 + 하드코딩 제거**

`functions/src/shared/*.ts`를 Read로 열어 (a) 프로젝트ID/도메인 하드코딩, (b) HanQ 전용 상수(`HANQ_PUBLIC_BASE` 등 env 참조는 유지) 확인. `config`(admin.ts 또는 secrets.ts)에서 `shotBase`, TE URL 등은 env 기반이므로 유지.

- [ ] **Step 3: 빌드 확인**

Run: `cd functions && npm run build && cd ..`
Expected: 타입 에러 0. (에러 시 누락 import 파일 확인 — brands가 verify에서 쓰이지만 이 태스크 범위엔 shared만.)

- [ ] **Step 4: 커밋**

```bash
git add functions/src/shared
git commit -m "feat: port shared functions utils (admin, http, ratelimit, secrets, brands, types)"
```

---

### Task 3: verify 파이프라인 이식(S0~S4, S6)

**Files:**
- Create: `functions/src/verify/{engine,scoring,signature,redirect,heuristics,llm,llmClient,dom,vision,demo,index}.ts` (HanQ소스 이식)

**Interfaces:**
- Consumes: Task 2의 shared 유틸.
- Produces: `verifyPayload(req: VerifyRequest): Promise<VerifyResponse>`(engine.ts), `combineScore`/`band`(scoring.ts), `runHeuristics(finalHost)`(heuristics.ts), `verify` onRequest 핸들러(index.ts).

- [ ] **Step 1: verify 파일 이식**

```bash
SRC="/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ/functions/src/verify"
for f in engine.ts scoring.ts signature.ts redirect.ts heuristics.ts llm.ts llmClient.ts dom.ts vision.ts demo.ts index.ts; do
  cp "$SRC/$f" "functions/src/verify/$f"
done
```

- [ ] **Step 2: index.ts export 정리** — 최상위 `functions/src/index.ts`에서 stub verify를 제거하고 실제 핸들러를 re-export.

`functions/src/index.ts`:
```ts
export { verify } from "./verify/index.js";
// 후속 단계에서 reports, mapSummary, issuerQr, issuerDashboard, track 추가
```
(포팅한 `verify/index.ts`가 `export const verify = onRequest(...)` 형태인지 확인. 아니면 이름 맞춤.)

- [ ] **Step 3: 빌드 확인**

Run: `cd functions && npm run build && cd ..`
Expected: 타입 에러 0. (heuristics가 shared/brands를 참조하는지, llm이 GEMINI_API_KEY secret을 참조하는지 확인.)

- [ ] **Step 4: 에뮬레이터 엔드투엔드 스모크(안전 URL)**

`functions/.secret.local`에 로컬 키 주입(gitignore됨, 채팅에 값 노출 금지 — 사용자에게 직접 입력 요청 or 기존 20team `.env.local`의 `VITE_GEMINI_API_KEY` 값 사용):
```
GEMINI_API_KEY=<사용자 제공>
HANQ_SIGNING_SECRET=<임의 로컬 값>
```
Run: `cd functions && npm run build && cd .. && firebase emulators:start --only functions,firestore --project hanq-dev-17267`
별도 셸:
```bash
curl -s -X POST http://127.0.0.1:5001/hanq-dev-17267/us-central1/verify \
  -H 'content-type: application/json' -d '{"payload":"https://www.naver.com"}' | head -c 400
```
Expected: JSON에 `"verdict":"safe"` 및 `score` 0~15, `trusted` 계열. (키 없으면 S4가 스킵되며 로컬 판정만 — 그래도 safe여야 함.)

- [ ] **Step 5: 커밋**

```bash
git add functions/src/verify functions/src/index.ts
git commit -m "feat: port verify pipeline (engine, scoring, redirect, heuristics, llm, dom, vision, signature)"
```

---

### Task 4: S3 휴리스틱 합집합 — 20team 규칙 병합 (TDD)

**Files:**
- Modify: `functions/src/verify/heuristics.ts` (20team `src/url-analysis.ts` 규칙 추가)
- Reference(읽기): `src/url-analysis.ts` (20team 기존 로컬 엔진 — 규칙 원본)
- Create: `functions/src/verify/heuristics.test.ts`

**Interfaces:**
- Consumes: `runHeuristics(finalHost: string): { score: number; trusted: boolean; signals: {id:string;points:number;...}[] }` (Task 3, 정확한 반환형은 이식된 heuristics.ts에 맞춤).
- Produces: 동일 시그니처, 단 아래 규칙 id들이 추가됨: `userinfo, encoded-host, brand-subdomain, fake-cctld, qr-interstitial, free-host, host-keyword, odd-port, deep-subdomain, long-host, long-sld, many-hyphens, apk-path, path-keyword, combo-bump`.

주의: HanQ `runHeuristics`는 호스트만 받을 수 있음. userinfo/encoded-host/odd-port/path/apk 등은 **전체 URL**이 필요하므로, 시그니처를 `runHeuristics(finalUrl: string)` 또는 `runHeuristics(finalHost, fullUrl?)`로 확장한다. engine.ts 호출부도 함께 수정.

- [ ] **Step 1: 실패 테스트 작성** (`functions/src/verify/heuristics.test.ts`)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runHeuristics } from "./heuristics.ts";

test("userinfo trick raises score", () => {
  const r = runHeuristics("https://naver.com@evil-login.tk/");
  assert.ok(r.signals.some(s => s.id === "userinfo"));
  assert.ok(r.score >= 45);
});

test("brand embedded as subdomain", () => {
  const r = runHeuristics("https://naver.com.secure-login.xyz/");
  assert.ok(r.signals.some(s => s.id === "brand-subdomain"));
});

test("fake cc-tld go-kr", () => {
  const r = runHeuristics("https://hometax.go-kr.com/");
  assert.ok(r.signals.some(s => s.id === "fake-cctld"));
});

test("qr interstitial", () => {
  const r = runHeuristics("https://me-qr.com/abc123");
  assert.ok(r.signals.some(s => s.id === "qr-interstitial"));
});

test("apk path is high risk", () => {
  const r = runHeuristics("https://random-host.top/app/update.apk");
  assert.ok(r.signals.some(s => s.id === "apk-path"));
  assert.ok(r.score >= 40);
});

test("trusted domain stays low", () => {
  const r = runHeuristics("https://www.kakaobank.com/");
  assert.equal(r.trusted, true);
  assert.ok(r.score <= 15);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd functions && node --test --experimental-strip-types src/verify/heuristics.test.ts`
Expected: FAIL — `userinfo`/`brand-subdomain`/`fake-cctld`/`qr-interstitial`/`apk-path` 신호 미존재.

- [ ] **Step 3: 20team 규칙 이식 구현**

`src/url-analysis.ts`(20team)를 Read로 열어 아래 데이터/헬퍼/규칙을 `functions/src/verify/heuristics.ts`로 옮긴다:
- 데이터: `QR_INTERSTITIALS`, `FREE_HOSTS`, `HOST_KEYWORDS`, `PATH_KEYWORD_PATTERN`, `HIGH_RISK_TLDS`/`MED_RISK_TLDS`(HanQ `RISKY_TLDS`와 병합), `BRAND_AFFIXES`, 확장 `TRUSTED_DOMAINS`/`TRUSTED_SUFFIXES`(HanQ `GLOBAL_TRUSTED`와 병합, 중복 제거).
- 헬퍼: `registrableDomain`, `matchBrandToken`(HanQ `detectBrandImitation`과 통합; 하나만 남김).
- 규칙(스펙 §3.1 표): userinfo(+45), encoded-host(+25), brand-subdomain(+50), fake-cctld(+45), qr-interstitial(+25), free-host(+22), host-keyword(20+10·(hits−1) cap30), odd-port(+15), deep-subdomain(+15), long-host(+10), long-sld(+15), many-hyphens(+12), apk-path(+60), path-keyword(+10), combo-bump(조건 충족 시 score→40).
- `runHeuristics` 시그니처를 전체 URL 파싱으로 확장(호스트 파생은 내부에서). 반환 `score`는 HanQ의 cap 40 정책과 조율: raw 합산 후 이 함수 내부에서는 cap 없이 반환하고, 최종 cap은 `combineScore`가 `min(S3,40)` 적용(스펙 §3.6). apk-path 같은 60점은 engine에서 별도 decisive-combo로 승격되도록 신호로 남긴다(HanQ S0 executable와 중복되면 하나로 정리).

주의(중복 제거): HanQ heuristics에 이미 있는 IP리터럴/punycode/risky-TLD/브랜드 레벤슈타인/RDAP는 유지하고, 20team 동일 규칙은 병합(중복 신호 금지). shortener는 S2(redirect)와 겹치므로 heuristics에서는 신호만 남기고 점수 이중가산 방지.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd functions && node --test --experimental-strip-types src/verify/heuristics.test.ts`
Expected: PASS(6/6).

- [ ] **Step 5: engine.ts 호출부 정합성 빌드**

Run: `cd functions && npm run build && cd ..`
Expected: 타입 에러 0(engine.ts가 새 `runHeuristics` 시그니처에 맞게 호출).

- [ ] **Step 6: 커밋**

```bash
git add functions/src/verify/heuristics.ts functions/src/verify/heuristics.test.ts functions/src/verify/engine.ts
git commit -m "feat: merge 20team url-analysis rules into S3 heuristics (union superset)"
```

---

### Task 5: S5 Google Safe Browsing 스테이지 추가 (TDD)

> **⚠️ 2026-07-22 철회(REVERTED)**: 이 태스크로 추가했던 S5 스테이지를 **완전히 제거**했다. Google Safe Browsing API는 비상업용 라이선스 전용이라 상업 서비스인 한큐에서 사용 불가(추가로 `SAFE_BROWSING_API_KEY` 미등록 시 `GEMINI_API_KEY` 폴백은 인증 실패로 항상 dead code였음). 대체 로직은 spec 문서 상단 개정 노트 + memory `no-google-safe-browsing`/`hanq-verdict-tuning` 참조. 아래 내용은 당초 실행 기록으로만 남긴다.

**Files:**
- Create: `functions/src/verify/safebrowsing.ts`, `functions/src/verify/safebrowsing.test.ts`
- Modify: `functions/src/verify/engine.ts` (S3·S4와 병렬로 S5 호출, 매치 시 score floor 90)
- Reference(읽기): 20team `src/lib/verification.ts`의 `checkSafeBrowsing`/`applyBlocklistMatch`/`THREAT_LABELS`

**Interfaces:**
- Produces: `checkSafeBrowsing(url: string): Promise<{ matched: boolean; threatType?: string; label?: string } | null>`. 키 없거나 오류 시 `null`(silent). Secret: `SAFE_BROWSING_API_KEY` 없으면 `GEMINI_API_KEY` 폴백.
- Consumes(engine): 매치 시 `score = max(score, 90)`, 70점 `blocklist` danger 신호 추가, trust cap 무시.

- [ ] **Step 1: 실패 테스트 작성** (`functions/src/verify/safebrowsing.test.ts`) — fetch 모킹.

```ts
import { test, mock } from "node:test";
import assert from "node:assert/strict";

test("returns matched on threat response", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mock.fn(async () =>
    new Response(JSON.stringify({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }), { status: 200 })
  ) as any;
  const { checkSafeBrowsing } = await import("./safebrowsing.ts?1");
  const r = await checkSafeBrowsing("https://evil.example");
  assert.equal(r?.matched, true);
  assert.equal(r?.threatType, "SOCIAL_ENGINEERING");
  globalThis.fetch = origFetch;
});

test("returns null when no key / error", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mock.fn(async () => new Response("nope", { status: 500 })) as any;
  const { checkSafeBrowsing } = await import("./safebrowsing.ts?2");
  const r = await checkSafeBrowsing("https://x.example");
  assert.equal(r, null);
  globalThis.fetch = origFetch;
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd functions && node --test --experimental-strip-types src/verify/safebrowsing.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: safebrowsing.ts 구현** (20team `verification.ts`의 로직 이식, 서버용으로)

```ts
import { defineSecret } from "firebase-functions/params";

const SAFE_BROWSING_API_KEY = defineSecret("SAFE_BROWSING_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const THREAT_LABELS: Record<string, string> = {
  MALWARE: "악성코드",
  SOCIAL_ENGINEERING: "피싱/사회공학",
  UNWANTED_SOFTWARE: "원치 않는 소프트웨어",
  POTENTIALLY_HARMFUL_APPLICATION: "유해 애플리케이션",
};

export async function checkSafeBrowsing(url: string) {
  const key = SAFE_BROWSING_API_KEY.value() || GEMINI_API_KEY.value();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "hanq", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: { threatType: string }[] };
    const first = data.matches?.[0];
    if (!first) return null;
    return { matched: true, threatType: first.threatType, label: THREAT_LABELS[first.threatType] ?? "위협" };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd functions && node --test --experimental-strip-types src/verify/safebrowsing.test.ts`
Expected: PASS(2/2).

- [ ] **Step 5: engine.ts에 S5 통합**

`engine.ts`에서 S3/S4와 함께 `checkSafeBrowsing(finalUrl)`를 병렬 호출(Promise.all/allSettled). S6 결합 후:
```ts
if (sb?.matched) {
  score = Math.max(score, 90);
  signals.push({ stage: "content", id: "blocklist", points: 70, level: "danger",
    title: `Google Safe Browsing 차단 (${sb.label})`, detail: sb.threatType });
  // trust cap 무시: trusted였어도 위 max로 90 확보
}
```
`SAFE_BROWSING_API_KEY` secret을 `verify` 함수의 `secrets` 배열에 추가.

- [ ] **Step 6: 빌드 + 회귀**

Run: `cd functions && npm run build && node --test --experimental-strip-types src/verify && cd ..`
Expected: 전체 테스트 PASS, 빌드 에러 0.

- [ ] **Step 7: 커밋**

```bash
git add functions/src/verify/safebrowsing.ts functions/src/verify/safebrowsing.test.ts functions/src/verify/engine.ts
git commit -m "feat: add S5 Google Safe Browsing stage with blocklist score floor"
```

---

### Task 6: 정확도 회귀 벤치마크 — 통합 엔진 검증

**Files:**
- Create: `functions/src/verify/heuristics.bench.ts` (20team `scripts/benchmark.ts` 샘플을 재사용해 통합 heuristics 정확도 측정)
- Reference(읽기): `scripts/benchmark.ts`(20team, 100+ 샘플 `{url,label}`)

**Interfaces:**
- Consumes: `runHeuristics`(Task 4·5 최종형).
- Produces: 콘솔 리포트(phish recall / benign precision). 게이트: benign 오탐 회귀 없음.

- [ ] **Step 1: 벤치 스크립트 작성** — 20team `scripts/benchmark.ts`의 `samples` 배열을 import 또는 복사해서 `runHeuristics` 기준으로 채점(phish는 score≥40 정답, benign은 <40 정답).

```ts
import { runHeuristics } from "./heuristics.ts";
// samples: 20team scripts/benchmark.ts에서 복사 (url,label:'phish'|'benign')
const samples: { url: string; label: "phish" | "benign" }[] = [ /* 복사 */ ];
let tp=0,fn=0,tn=0,fp=0;
for (const s of samples) {
  const score = runHeuristics(s.url).score;
  const flagged = score >= 40;
  if (s.label==="phish") flagged?tp++:fn++; else flagged?fp++:tn++;
}
console.log({ phishRecall: tp/(tp+fn), benignFalsePositive: fp/(fp+tn), tp,fn,tn,fp });
```

- [ ] **Step 2: 벤치 실행**

Run: `cd functions && node --experimental-strip-types src/verify/heuristics.bench.ts`
Expected: 리포트 출력. `benignFalsePositive`가 20team 기존 로컬 엔진 대비 악화되지 않음(스펙 §9). 악화 시 Task 4의 캡/트러스트 병합 재조정.

- [ ] **Step 3: 커밋**

```bash
git add functions/src/verify/heuristics.bench.ts
git commit -m "test: add integrated heuristics accuracy benchmark"
```

---

### Task 7: 클라이언트 전환 — verification.ts → POST /api/verify

**Files:**
- Create: `src/lib/api-client.ts`
- Modify: `src/lib/verification.ts` (Gemini/Safe Browsing 직접 호출 제거 → `/api/verify` 호출)
- Modify: `src/pages/result-page.tsx` (필드 매핑 조정, 필요 시), `.env.local`(클라 `VITE_GEMINI_API_KEY` 제거 — 사용자 확인), `vite.config.ts`(dev 프록시 `/api` → 에뮬레이터 hosting 5000)
- Reference(읽기): `src/lib/verification.ts`(기존 타입 `VerificationResult`)

**Interfaces:**
- Consumes: `POST /api/verify {payload}` → `VerifyResponse`(서버).
- Produces: `verifyPayload(payload, onProgress?): Promise<VerificationResult>` — 시그니처 유지, 내부만 API 호출로 교체. `api-client.ts`: `postVerify(payload: string): Promise<VerifyResponse>`.

- [ ] **Step 1: vite dev 프록시 추가** (`vite.config.ts` `server.proxy`)

```ts
server: { proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: true } } }
```
(에뮬레이터 hosting 5000이 `/api/*`를 함수로 rewrite.)

- [ ] **Step 2: api-client.ts 작성**

```ts
import type { VerifyResponse } from "./verification-types"; // 또는 verification.ts에서 export
export async function postVerify(payload: string): Promise<VerifyResponse> {
  const res = await fetch("/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error(`verify failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: verification.ts 교체** — `analyzeUrl`(Gemini)·`checkSafeBrowsing` 클라 구현 제거. `verifyPayload` 내부를 `postVerify` 호출로 교체하고 서버 `VerifyResponse`를 기존 `VerificationResult` 형태로 매핑(필드명 정렬: verdict/score/reasons/stages/signals/finalHost/threatType/confidence). 진행 콜백은 응답 도착 전 로컬 `analyzeUrlLocally` 프리스코어로 낙관적 표시 후 서버 결과로 치환(스펙 §3.3). sessionStorage/history 저장 로직은 유지.

- [ ] **Step 4: 클라 시크릿 제거** — `.env.local`에서 `VITE_GEMINI_API_KEY` 제거는 **사용자에게 확인 요청**(hook이 `.env` 쓰기 차단하므로 사용자가 직접 편집). 코드에서 `import.meta.env.VITE_GEMINI_API_KEY` 참조 전부 삭제.

- [ ] **Step 5: 빌드 + 타입체크**

Run: `npm run build`
Expected: `tsc -b` 통과, vite build 성공.

- [ ] **Step 6: 통합 스모크(에뮬레이터 + vite dev)**

터미널A: `firebase emulators:start --only functions,firestore,hosting --project hanq-dev-17267`
터미널B: `npm run dev`
브라우저: `http://localhost:5173/scan` → URL 입력 `https://www.naver.com` → 결과 safe, 그리고 피싱 샘플 `https://me-qr.com/...` 또는 `naver-security.com` → warn/danger 확인. 네트워크 탭에서 `/api/verify` 호출 확인, 응답이 result-page에 정상 렌더.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/api-client.ts src/lib/verification.ts src/pages/result-page.tsx vite.config.ts
git commit -m "feat: route client verification through /api/verify backend"
```

---

## Self-Review

**Spec coverage(§ 대비):**
- §3 검증 엔진(S0~S6) → Task 3 이식, S3 합집합 Task 4, S5 Safe Browsing Task 5, S6 결합은 이식된 scoring/engine + Task 5 floor. ✅
- §3.1 규칙 합집합(표) → Task 4 Step 3에 전 규칙 열거. ✅
- §3.3 클라 흐름 → Task 7. ✅
- §5 Firebase(hanq-dev-17267, secrets, 클라 키 제거) → Task 1(.firebaserc/firebase.json), Task 3 Step 4(secret.local), Task 7 Step 4. ✅
- §6 API 계약(POST /api/verify) → Task 1 rewrite, Task 3 핸들러, Task 7 클라. (reports/map/issuers rewrite는 이번 단계에 함수 미구현 — 2단계 이후. Task 1 주석 명시.) ✅
- 지도/서명QR/발급자/UX PORT → **Phase 2~4 별도 계획**(범위 밖, 의도적). ✅

**Placeholder scan:** 포팅 태스크(2·3)는 "HanQ소스 복사 + 정독"이 실제 액션이며 경로가 정확함(placeholder 아님). 신규 로직(4·5·7)은 구체 코드 포함. ✅

**Type consistency:** `runHeuristics` 시그니처 확장(Task 4)을 engine 호출부(Task 4 Step5)·벤치(Task 6)·S5(Task 5)에서 일관 사용. `VerifyResponse`↔`VerificationResult` 매핑은 Task 7에서 명시. 이식 파일의 실제 반환형은 HanQ소스 정독 시 확정(계획은 시그니처 계약을 고정). ⚠️ 이식 후 실제 타입명이 다르면 Task 3 Step 3에서 맞춤.

**미해결(구현 중 확정):** 이식된 heuristics/engine의 정확한 반환 타입·함수명은 HanQ 실제 코드에 의존 → Task 3에서 읽고 Task 4·5에서 정합. 이는 포트 작업의 본질적 특성으로, 각 태스크에 "정독 후 맞춤" 단계를 명시함.

---

## Phase 2~4 (별도 계획 예정, 이번 범위 밖)

- **Phase 2**: reports/map/geo functions + Leaflet 지도 + 신고 루프.
- **Phase 3**: signature/issuers functions + `/r/:qrId` + 발급자 UI + Firebase Auth.
- **Phase 4**: UX PORT(줌·플래시·위협별 액션·방어리포트·데모트리거·tnums), track/ratelimit/seed 폴리시.
