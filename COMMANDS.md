# 검증 명령어

이 문서는 한큐 저장소의 설치, 품질 검사, 로컬 실행 명령을 한곳에 정리합니다.

## 요구 환경

- Node.js 22
- npm
- 백엔드 에뮬레이터 실행 시 Firebase CLI

## 설치

| 대상 | 명령 |
| --- | --- |
| 프런트엔드 | `npm install --no-audit --no-fund` |
| Firebase Functions | `npm --prefix functions install --no-audit --no-fund` |

## 품질 검사

| 용도 | 명령 | 최근 검증 |
| --- | --- | --- |
| 전체 제출 검사 | `npm run check` | 2026-07-22 |
| 프런트 빌드 | `npm run build` | 2026-07-22 |
| 린트 | `npm run lint` | 2026-07-22 |
| 백엔드 빌드 | `npm --prefix functions run build` | 2026-07-22 |
| 백엔드 테스트 | `npm test` | 2026-07-22 |
| URL 판별 벤치마크 | `npm run benchmark` | 2026-07-22 |

현재 백엔드 단위 테스트는 26개이며, 내부 벤치마크 데이터셋은 총 205건입니다.

## 로컬 실행

1. `functions/.env.example`을 `functions/.env`로 복사합니다.
2. 필수 시크릿을 입력합니다.
3. `npm --prefix functions run serve`로 Firebase 에뮬레이터를 실행합니다.
4. 별도 터미널에서 `npm run dev`를 실행합니다.

Vite의 `/api/*` 요청은 Firebase Hosting 에뮬레이터로 전달됩니다. 백엔드 없이 프런트만 실행하면 실제 진단 및 위험지도 API는 동작하지 않습니다.

## 환경변수 원칙

- 운영 환경의 `GEMINI_API_KEY`, `HANQ_SIGNING_SECRET`은 Firebase Secret Manager로 주입합니다.
- 로컬 에뮬레이터에서만 `functions/.env`를 사용합니다.
- 브라우저용 `VITE_*` API 키는 사용하지 않습니다.
- 내부 벤치마크 결과는 회귀 확인용이며 실제 환경의 절대 정확도를 의미하지 않습니다.
