# 한큐(HanQ) 백엔드 통합 설계

- 날짜: 2026-07-22
- 대상 저장소: `20team` (GitHub: Berryson27/20team) — 이하 "20team"
- 원본 참조 프로젝트: `/Volumes/ThinkingData SSD 1TB/jegal/AI codegate/HanQ` — 이하 "HanQ"
- 배포 타깃: Firebase 프로젝트 `hanq-b0a27` (20team 기존 프로젝트, Blaze 필요)

## 1. 배경 / 목표

두 저장소는 같은 "한큐" 큐싱(QR 피싱) 방지 앱의 두 갈래 구현이다.

- **20team**: Vite + React 19 순수 클라이언트 SPA. 로컬 URL 위험 엔진(R1~R18) + Gemini(`url_context`) + **Google Safe Browsing**. QR 이미지 디코더(Otsu)가 강력. 위험 지도는 100% 목업. 백엔드 없음.
- **HanQ**: Next.js 프론트 + Firebase Functions 백엔드(라이브 배포). 서버 파이프라인 S0~S6(리다이렉트 추적·SSRF 방어·RDAP 도메인 연령·DOM 구조분석·스크린샷 비전), **HMAC 서명 QR + 위조 탐지**, Firestore geohash 실데이터 위험 지도, 발급자 대시보드, ThinkingEngine 분석. Safe Browsing은 없음.

**목표**: HanQ의 성숙한 백엔드와 기능을 20team에 통째로 도입하되, 20team이 가진 **Google Safe Browsing**과 풍부한 로컬 규칙을 얹어 "좋은 쪽으로" 합친다. 결과적으로 20team이 HanQ 수준(+Safe Browsing)으로 올라간다.

**핵심 원칙**: 검증·집계·서명 등 모든 로직은 서버(functions)가 single source of truth. 클라이언트는 표시 + 진행 애니메이션만 담당. → API 키가 브라우저에 실리지 않음(현재 20team의 보안 약점 해소).

## 2. 목표 아키텍처

```
20team/
├── src/                         # 프론트 (React19 + Vite 유지)
│   ├── lib/
│   │   ├── verification.ts      # 클라 Gemini/SafeBrowsing 제거 → POST /api/verify 호출
│   │   ├── api-client.ts        # (신규) 타입드 API 클라이언트 (Bearer 토큰 지원)
│   │   ├── url-analysis.ts      # (유지) 즉시 낙관적 프리스코어 + 벤치마크용
│   │   └── qr-decoder.ts        # (유지) Otsu 이미지 디코더
│   ├── pages/
│   │   ├── scan-page.tsx        # 서버 검증 + (danger 시) 신고 루프
│   │   ├── result-page.tsx      # 서버 응답(stages/reasons/score) 렌더 (구조 유지)
│   │   ├── risk-map-page.tsx    # 목업 → Leaflet+OSM 실데이터
│   │   ├── r-page.tsx           # (신규) /r/:qrId 서명 QR 랜딩
│   │   ├── issuer-page.tsx      # (신규) 발급자 센터/등록/발급/대시보드
│   │   └── guide/showcase       # 유지
│   ├── components/
│   │   ├── korea-risk-map.tsx   # svg-maps → Leaflet 지도 컴포넌트로 교체
│   │   └── ...                  # risk-gauge 등 유지
│   └── lib/firebase.ts          # (신규) Firebase 클라 init (Auth/Firestore)
├── functions/                   # (신규) HanQ 백엔드 이식 (Node22, TS, Functions v2)
│   └── src/
│       ├── index.ts             # onRequest 엔드포인트 export
│       ├── verify/              # engine, scoring, signature, redirect,
│       │                        #   heuristics, llm, llmClient, dom, vision
│       ├── safebrowsing/        # (신규) Google Safe Browsing 스테이지
│       ├── map/summary.ts       # 지도/랭킹/피드
│       ├── geo/geohash.ts       # geohash-7 + 서울 구 매핑 (프라이버시)
│       ├── reports/index.ts     # 신고 인제스트 → 지도 집계
│       ├── issuers/index.ts     # issuerQr / issuerDashboard
│       ├── track/index.ts       # (선택) TE 퍼널 이벤트 프록시
│       ├── admin_tools/seed.ts  # (선택) 데모 시더 (토큰 게이트)
│       └── shared/              # brands, http(CORS), ratelimit, admin, secrets, te
├── firebase.json                # /api/* → functions 리라이트 추가
├── firestore.rules              # HanQ 규칙 이식
├── firestore.indexes.json
└── scripts/benchmark.ts         # (유지/갱신) 로컬 엔진 정확도 벤치마크
```

배포: `firebase deploy` → functions는 `us-central1`, Hosting은 `dist`. 프로덕션에서 `/api/*` 리라이트로 프론트와 백엔드가 한 오리진 공유.

## 3. 검증 엔진 통합 — 최우선

HanQ의 **S0~S6 서버 파이프라인을 뼈대**로 삼고, 20team의 강점을 층으로 얹는다. 어떤 스테이지가 실패해도 판정은 나온다(총 예산 `TOTAL_BUDGET_MS = 30000`).

| 단계 | 채택 | 비고 |
|---|---|---|
| S0 분류 | HanQ | executable(apk/intent/market/itms) → danger 95; 비URL 텍스트 → safe 0; scheme 없는 도메인 정규화 |
| S1 서명 QR/위조 | HanQ HMAC | valid → safe 0(발급자명); invalid → danger 100(forgery); absent → 계속 |
| S2 리다이렉트 | HanQ | manual redirect, MAX_HOPS=3, SSRF 가드(사설 IP), 단축 URL 체인, HTTPS→HTTP 다운그레이드, 캡차 감지, iPhone Safari UA 위장. cap 25 |
| S3 휴리스틱 | **두 엔진 합집합** | 아래 3.1 참조. cap 40 |
| S4 AI 페이지 판독 | HanQ | 텍스트(Gemini) + DOM 구조(`dom.ts`) + 스크린샷 비전(`vision.ts`, thum.io). cap 45. trusted/구조상 danger(≥70)/판독불가/예산<6s면 스킵 |
| **S5 Safe Browsing (신규)** | **20team** | Google Safe Browsing v4 threatMatches. 매치 시 블록리스트 70점 신호 + `score = max(score, 90)`. trust cap 무시(R20) |
| S6 결합/판정 | HanQ + S5 | `raw = min(S2,25)+min(S3,40)+min(S4,45)` → clamp(0,100); trusted면 ≤15 캡; 강한 콘텐츠 룰(비trusted+브랜드사칭+자격증명폼 → ≥78); band: ≥70 danger / ≥40 warn / else safe. Safe Browsing 매치는 캡을 뚫고 ≥90 |

### 3.1 S3 휴리스틱 합집합 (누락 없이 상위집합)

HanQ `heuristics.ts` 기존 체크: 공식 도메인 화이트리스트(trusted, score 0), IP 리터럴(+20), risky TLD(+10), IDN/punycode `xn--`(+25), 브랜드 임퍼소네이션(레벤슈타인 거리 1 → +30, 거리 2 → +20), RDAP 도메인 연령(<7d +25 / <30d +18 / <90d +8).

**20team `url-analysis.ts`에서 이식할 규칙** (HanQ에 없거나 약한 것):

| id | points | 조건 |
|---|---|---|
| userinfo | 45 | `@` 유저인포/패스워드 트릭 |
| encoded-host | 25 | 호스트에 `%xx` 인코딩 |
| brand-subdomain | 50 | 공식 도메인을 서브도메인으로 임베딩 (naver.com.evil.xyz) |
| fake-cctld | 45 | 하이픈 위조 `go-kr`/`co-kr`/`gov-kr` |
| qr-interstitial | 25 | QR 인터스티셜 서비스 (me-qr.com, qrco.de, linktr.ee…) |
| free-host | 22 | 프리 호스팅/DDNS (netlify.app, vercel.app, github.io, blogspot.com…) |
| host-keyword | 20~30 | 호스트 내 유인 키워드 (login/verify/secure/prize…), 20 + 10·(hits−1) cap 30 |
| odd-port | 15 | 비표준 포트(80/443 외) |
| deep-subdomain | 15 | 서브도메인 라벨 ≥3 |
| long-host | 10 | 호스트 > 45자 |
| long-sld | 15 | SLD(하이픈 제거) ≥20자 |
| many-hyphens | 12 | SLD 하이픈 ≥3 |
| shortener | 15 | URL 단축기 (bit.ly, tinyurl…) — S2와 중복 방지 조율 |
| apk-path | 60 | `.apk` 다운로드 경로 |
| path-keyword | 10 | login/account 경로 패턴 |
| combo-bump (R18) | → 40 | host-keyword/free-host/shortener/qr-interstitial/long-sld 중 하나 + 신호≥2 + score∈[25,40) → 40으로 강제 |

- 트러스트 도메인/서픽스: 20team의 ~120개 화이트리스트 + `go.kr/ac.kr/mil.kr` 서픽스 트러스트를 HanQ `GLOBAL_TRUSTED`/`OFFICIAL_DOMAINS`와 병합.
- 브랜드 토큰/affix: 20team `BRANDS`(naver,kakao,toss,coupang,google,apple,samsung,KB,shinhan,woori,hana,nonghyup,ibk,hometax,police,gov24,epost,upbit,bithumb,paypal,netflix,instagram,telegram) + `BRAND_AFFIXES`를 HanQ 11개 브랜드와 병합.
- 레벤슈타인/edit-distance는 하나로 통일(bounded, max=2).
- 점수 캡은 HanQ의 S3 cap 40을 유지하되, 이식 규칙의 큰 점수(userinfo 45, brand-subdomain 50, apk 60)는 캡 전 raw에 반영 후 최종 combineScore에서 clamp — 정확한 캡 정책은 구현 시 결정하고 벤치마크로 검증.

### 3.2 프롬프트 인젝션 하드닝 (유지)

HanQ의 `llmClient.ts`: 페이지 텍스트를 데이터로만 취급(spotlighting + data-marking `<page_content marker="…">`), 강제 JSON 스키마, temperature 0. `impersonates_brand`는 페이지가 브랜드를 모방하고 **최종 도메인이 그 브랜드 공식 도메인이 아닐 때만** 세팅(진짜 google.com 로그인 → null). deprecated 모델명은 `-latest` 별칭으로 자동 매핑.

### 3.3 클라이언트 검증 흐름

- `src/lib/verification.ts` → `POST /api/verify { payload }` 호출로 교체. 응답은 기존 `VerificationResult` 타입에 맞춰 매핑(가능하면 서버 계약을 20team 타입에 맞게 정렬).
- 클라의 Gemini 직접 호출 / Safe Browsing 직접 호출 코드 제거(서버로 이동).
- `url-analysis.ts` 로컬 엔진은 **즉시 낙관적 프리스코어**(서버 응답 대기 중 임시 표시)와 오프라인 폴백 + 벤치마크 용도로만 유지. 서버가 최종 권위.
- 진행 표시는 서버 stages(payload→redirect→domain→ai→judge)에 맞춰 이벤트 기반.

## 4. 기능 이식 (20team 스타일로 재구현)

HanQ 프론트는 Next.js + 인라인 스타일이므로 **코드를 그대로 복사하지 않고 로직만 20team의 React19/Vite/Tailwind + 기존 컴포넌트 스타일로 재구현**한다.

### 4.1 실 위험 지도

- **프론트**: `korea-risk-map.tsx`를 Leaflet + OpenStreetMap 타일 기반으로 교체(중심 `[37.5405,126.986]` zoom 11). `vm.cells`를 원형 마커(반경 `300+count*55`m, 색: ≥25 red / ≥12 amber / else indigo)로 렌더. cells 없으면 6개 서울 구 정적 폴백. 하단: 전체/이번주 통계 타일, 6구 랭킹, 장소 유형 필터 칩, 익명 최근 신고 피드(상대 시각). 프라이버시 배지("구 단위 히트맵 · 정확 좌표 미저장").
- **백엔드**: `map/summary.ts`(`GET /api/map/summary`) → `counters/global`, `map_agg`(top30), `map_cells`(top300), `reports`(latest8) 읽어 `MapSummaryResponse` 반환, `Cache-Control: no-store`.
- **프라이버시 백본**: `geo/geohash.ts` — 원좌표 미저장. 인제스트 시 (a) 서울 구 행정코드+이름(25개 구 중심 최근접) (b) geohash-7(~153m 그리드) 디코드 중심만 핀 좌표로. BASE32 encode/decode + `SEOUL_DISTRICTS`.
- **인제스트**: `reports/index.ts`(`POST /api/reports`) — `reports/*` 기록, `map_agg/<regionCode>`(count/weekCount) 증가, `map_cells/<geohash>`(count + byPlaceType) 증가, `counters/global.totalReports` 증가.
- **신고 루프**: 스캔 결과 danger일 때 사용자가 위치+장소유형으로 신고 → 지도 반영.
- 20team의 svg-maps 목업 위험 지도는 대체(라이브러리 의존성 `@svg-maps/south-korea` 제거, `leaflet` 추가).

### 4.2 서명 QR + 위조 탐지

- **랜딩**: `/r/:qrId` 라우트(신규 `r-page.tsx`) → 전체 URL을 `/api/verify`로 보내 safe(발급자명)/warn/danger(차단) 렌더.
- **서명**: `signature.ts` — `sig = HMAC-SHA256(secret, qrId + "\n" + targetUrl + "\n" + issuedAt)`, 포맷 `https://<base>/r/<qrId>?sig=<hex>`. Firestore `qr_codes/<qrId>` 조회 후 재계산·`timingSafeEqual`. secret = `HANQ_SIGNING_SECRET`.
- **발급자 플로우**(신규 `issuer-page.tsx`): Firebase Auth(이메일+Google) 로그인 → 발급자 등록 → QR 발급(`POST /api/issuers/qr` → `qr_codes` 생성 + QR PNG data URL, `qrcode` lib) → 대시보드(`GET /api/issuers/me/dashboard`, today-stats + 최근 알림 20). 위조 스캔 시 `issuers/<id>/alerts`에 실시간 알림(`onSnapshot`).

### 4.3 QR 스캐너

- 20team의 `qr-scanner` + `qr-decoder.ts`(Otsu) 유지(HanQ html5-qrcode보다 강력).
- HanQ에서 **플래시/줌 토글**만 추가(카메라 capability 지원 시 노출).

### 4.4 선택 항목 (마감 폴리시)

- ThinkingEngine 트래킹(`track/index.ts` + 클라 `track.ts`, `sendBeacon`), 레이트리밋(`shared/ratelimit.ts`, verify 30/min·reports 15/min), 개인 방어 리포트(localStorage 집계), 데모 시더(`admin_tools/seed.ts`, 토큰 게이트), 벤치마크 갱신.

## 5. Firebase 프로젝트 설정 (`hanq-b0a27`)

사용자 콘솔 접근이 필요한 항목(제가 안내만):

1. Blaze(종량제) 플랜 활성화 — Functions 필수.
2. Firestore 생성(가능하면 `asia-northeast3` 서울).
3. Authentication: 이메일/비밀번호 + Google 공급자 활성화.
4. `firebase login` CLI 권한.
5. 시크릿(Secret Manager, `defineSecret`): `GEMINI_API_KEY`, `HANQ_SIGNING_SECRET`. 20team `.env.local`의 기존 Gemini 키 재사용 가능.
6. 웹 클라 Firebase 설정(`NEXT_PUBLIC_*` 대신 20team은 `VITE_FIREBASE_*`)로 Auth/Firestore init.

**보안**: 클라이언트의 `VITE_GEMINI_API_KEY`는 제거(서버로 이동). 시크릿은 코드/깃에 절대 넣지 않음(Secret Manager 경유). `.env*`는 훅으로 커밋 차단됨.

Firestore 컬렉션: `issuers/{id}`(+ `alerts`), `qr_codes/{qrId}`, `scan_logs`(해시만), `reports`, `events`, `rate_limits`(TTL `expireAt`), `map_agg/{regionCode}`, `map_cells/{geohash}`, `counters/{id}`.

`firestore.rules`: issuers/qr_codes 소유자만 읽기; alerts/qr_codes/scan_logs/reports/events/rate_limits 쓰기는 Functions(admin)만; `map_agg`/`map_cells`/`counters`는 public-read·Functions-write; 그 외 deny.

## 6. API 계약

| 메서드 · 경로 | 함수 | 설명 |
|---|---|---|
| `POST /api/verify` | verify | `{payload}` → `VerifyResponse{verdict,score,confidence,threatType,reasons[],stages[],signals[],finalHost,...}` |
| `POST /api/reports` | reports | `{payload,verdict,lat,lng,placeType}` → 지도 집계 반영 |
| `GET /api/map/summary` | mapSummary | `{total,thisWeek,blockedToday,regions[],cells[],byPlaceType,recent[]}` |
| `POST /api/issuers/qr` | issuerQr | (Auth) 서명 QR 발급, PNG data URL 반환 |
| `GET /api/issuers/me/dashboard` | issuerDashboard | (Auth) 발급자 통계 + 최근 알림 |
| `POST /api/track` | track | (선택) 화이트리스트 퍼널 이벤트 → TE |

정확한 요청/응답 타입은 HanQ `functions/src/shared` 및 `web/lib/types.ts`를 20team 타입으로 정렬해 구현 단계에서 확정.

## 7. 구현 순서 (4단계, 각 단계 후 리뷰 체크포인트)

1. **백엔드 기반 + 검증 엔진 통합**: functions 이식, S3 규칙 합집합, S5 Safe Browsing 추가, firebase.json/firestore.rules, 에뮬레이터 검증 → 클라 `verification.ts`를 `/api/verify`로 전환. 벤치마크로 회귀 확인. (핵심)
2. **실 위험 지도**: geo/geohash·map/summary·reports functions + Leaflet 지도·신고 루프.
3. **서명 QR/위조탐지 + 발급자**: signature·issuers functions + `/r/:qrId`·발급자 UI + 실시간 알림 + Firebase Auth.
4. **마감 폴리시**: TE 트래킹·레이트리밋·방어 리포트·데모 시드·벤치마크 갱신.

각 단계는 별도 커밋/리뷰. 1단계 완료 후 사용자 확인.

## 8. 비목표 / YAGNI

- HanQ의 Next.js 프론트 코드를 그대로 이식하지 않음(로직만 20team React로 재구현).
- 20team의 svg-maps 위험 지도 목업은 유지하지 않고 대체.
- Google/Kakao/Naver 지도 SDK는 쓰지 않음(OSM 유지 — 규제·키 이슈).
- 유료 WHOIS API 미사용(RDAP keyless로 도메인 연령).
- 다국어/i18n, 결제, 리워드 실구현 등 로드맵 항목은 범위 밖.

## 9. 리스크 / 미결

- **프레임워크 불일치**: HanQ(Next.js) → 20team(Vite/React19) 재구현 공수. Leaflet·Firebase Auth·qrcode 등 신규 의존성.
- **검증 점수 캡 정책**: S3 이식 규칙과 HanQ cap 40의 상호작용은 벤치마크(100+ 샘플)로 튜닝 필요. 통합 후 정확도 회귀 없는지 확인.
- **Firebase 준비**: Blaze/Firestore/Auth/CLI 권한은 사용자 콘솔 작업 의존. 준비 전까지는 에뮬레이터로 개발.
- **두 저장소 계약 정렬**: 20team `VerificationResult` ↔ HanQ `VerifyResponse` 필드 매핑 시 result-page 렌더 로직 조정 필요.
