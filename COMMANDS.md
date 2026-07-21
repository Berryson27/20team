# 검증된 명령어 (원문 그대로 사용할 것)

## 금지
- 아래 명령을 임의 변형하지 말 것. 변형이 필요하면 이유를 먼저 밝힌다.

| 용도 | 명령 | 검증일 |
|---|---|---|
| 의존성 설치 | `npm install --no-audit --no-fund` | 2026-07-21 |
| 빌드 | `npm run build` | 2026-07-21 |
| 린트 | `npm run lint` | 2026-07-21 |
| 개발 서버 | `npm run dev` | (스크립트 존재, 미검증) |
| 판별 정확도 벤치마크 | `node --experimental-strip-types scripts/benchmark.ts` | 2026-07-21 |

## 참고
- `.env`의 키 이름은 반드시 `VITE_GEMINI_API_KEY` (Vite는 `VITE_` 접두사만 클라이언트에 노출).
- Safe Browsing 조회는 `VITE_SAFE_BROWSING_API_KEY`가 있으면 그 키를, 없으면 Gemini 키를 재사용한다. 해당 Google 프로젝트에서 Safe Browsing API를 활성화해야 동작하며, 미활성화 시 자동으로 건너뛴다.
- 벤치마크는 `src/lib/url-analysis.ts` 로컬 판별 엔진을 라벨링된 URL 199건으로 채점한다.
