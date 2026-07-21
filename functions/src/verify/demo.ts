/**
 * 데모 시나리오 캐시 (기획서 §10, 검증엔진 §6-4·§10).
 * 라이브 2분 데모의 결정론 보장 — 실물 스캔 실패/네트워크 이슈와 무관하게 동일 결과.
 * 프로토타입 v2 의 정품/주의/위조 화면과 1:1 일치.
 */
import type { VerifyResponse } from "../shared/types";

type Cached = Omit<VerifyResponse, "verifyId">;

export const DEMO_RESULTS: Record<"safe" | "warn" | "danger", Cached> = {
  safe: {
    verdict: "safe", score: 0, confidence: "high",
    signature: { status: "valid", issuerName: "순자네 식당", issuedAt: "2026-07-22" },
    stages: [
      { key: "signature", status: "done", detail: "한큐 발급 서명(HMAC) 일치 · 순자네 식당 · 위·변조 불가" },
      { key: "redirect", status: "done", detail: "order.soonja.kr (직접) · 리다이렉트 없음" },
      { key: "heuristics", status: "done", detail: "도메인 등록 4년 · 위험 TLD 아님 · IP 직결 아님" },
      { key: "llm", status: "done", detail: "브랜드 사칭 없음 · 결제·입력 폼 없음 · 압박 문구 없음" },
    ],
    reasons: ["순자네 식당 정품 서명 확인", "한큐가 발급한 서명 QR입니다", "결제 정보를 요구하는 패턴 없음"],
    threatType: null, finalUrlHash: "sha256:demo-safe", issuer: { name: "순자네 식당" }, fallback: false,
  },
  warn: {
    verdict: "warn", score: 54, confidence: "medium",
    signature: { status: "absent" },
    stages: [
      { key: "signature", status: "done", detail: "서명 없음 — 일반 링크로 계속 검사" },
      { key: "redirect", status: "done", detail: "bit.ly → 2회 경유 → shop-new.store", flags: ["redirect_2hop", "shortener_chain"] },
      { key: "heuristics", status: "done", detail: "등록 3일차 신생 도메인", flags: ["domain_lt_7d"] },
      { key: "llm", status: "done", detail: "위험 콘텐츠 신호 없음(약한 신뢰)" },
    ],
    reasons: ["3일 전 등록된 신생 도메인", "단축URL 2회 경유 — 최종 목적지 은닉", "결제 정보 요구는 확인되지 않음"],
    threatType: null, finalUrlHash: "sha256:demo-warn", issuer: null, fallback: false,
  },
  danger: {
    verdict: "danger", score: 91, confidence: "high",
    signature: { status: "absent" },
    stages: [
      { key: "signature", status: "done", detail: "서명 없음 — 일반 링크로 계속 검사" },
      { key: "redirect", status: "done", detail: "bit.ly → 2회 경유 → toss-pay.xyz", flags: ["redirect_2hop", "host_mismatch"] },
      { key: "heuristics", status: "done", detail: "등록 2일차 · 토스 사칭 · 위험 TLD .xyz", flags: ["domain_lt_7d", "brand_lookalike", "risky_tld"] },
      { key: "llm", status: "done", detail: "토스 로그인 사칭 · 카드번호 입력 폼 · '10분 내 결제' 압박", flags: ["credential_form", "brand_impersonation", "urgency"] },
    ],
    reasons: ["토스 공식 도메인이 아닌 toss-pay.xyz", "카드번호 입력 폼 발견", "'10분 내 결제' 압박 문구"],
    threatType: "card_theft", finalUrlHash: "sha256:demo-danger", issuer: null, fallback: false,
  },
};
