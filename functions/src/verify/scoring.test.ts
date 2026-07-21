import { test } from "node:test";
import assert from "node:assert/strict";
import { isDecisivePhishing, shouldWarnUnverified } from "./scoring.ts";

// ── isDecisivePhishing: "모호하지 않은" 콘텐츠·구조 증거만 danger ─────────────

test("브랜드 로그인 사칭 + 자격증명 폼 → 결정적 피싱", () => {
  assert.equal(
    isDecisivePhishing({ impersonates_brand: "naver", has_credential_form: true }, []),
    true,
  );
});

test("자격증명 폼이 외부 도메인으로 전송 → 결정적 피싱(브랜드 사칭 없어도)", () => {
  assert.equal(isDecisivePhishing(null, ["form_cross_domain"]), true);
});

test("폼이 raw IP 로 전송 → 결정적 피싱", () => {
  assert.equal(isDecisivePhishing(null, ["form_to_ip"]), true);
});

test("APK 설치 유도 단독은 danger 아님(공식 스토어 안내 모호) — 사용자 피드백 반영", () => {
  // apk_prompt=true 여도 결정적 아님. scoreContent 가점(+30)으로만 반영된다.
  assert.equal(
    isDecisivePhishing({ impersonates_brand: null, has_credential_form: false }, ["apk_prompt"]),
    false,
  );
});

test("브랜드 사칭만(자격증명 폼 없음)은 결정적 아님", () => {
  assert.equal(
    isDecisivePhishing({ impersonates_brand: "kakao", has_credential_form: false }, []),
    false,
  );
});

test("분석 없음 + 신호 없음 → 결정적 아님", () => {
  assert.equal(isDecisivePhishing(null, []), false);
});

// ── shouldWarnUnverified: 페이지 못 읽은 비신뢰 도메인 + 위험 단서 → warn ─────

const BASE = {
  trusted: false,
  llmRan: false,
  structurallyDanger: false,
  score: 12,
  heurScore: 0,
  domainAgeDays: 400 as number | null,
  hitCaptcha: false,
  pageUnreachable: false,
  hasPath: false,
};

test("접속불가(pageUnreachable) 비신뢰 도메인 → 주의 상향", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, pageUnreachable: true }), true);
});

test("신생 도메인(<90d) + AI 미판독 → 주의 상향", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, domainAgeDays: 5 }), true);
});

test("도메인 연령 미상(RDAP 실패, null) → 주의 상향", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, domainAgeDays: null }), true);
});

test("랜덤 경로 존재(/l/xxxx 류) → 주의 상향", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, hasPath: true }), true);
});

test("캡차벽(클로킹 정황) → 주의 상향", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, hitCaptcha: true }), true);
});

test("신뢰 도메인은 상향 안 함", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, trusted: true, pageUnreachable: true }), false);
});

test("AI 판독이 실제로 돌았으면(llmRan) 상향 안 함 — 오탐 방지", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, llmRan: true, pageUnreachable: true }), false);
});

test("이미 40점 이상이면 상향 로직 발동 안 함(중복 방지)", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, score: 40, pageUnreachable: true }), false);
});

test("확립된 도메인(오래됨) + 위험단서 전무 → 상향 안 함(정상 접속불가 사이트 오탐 방지)", () => {
  // 오래된 도메인, 경로 없음, 캡차 없음, 접속가능, 구조신호 없음 → 위험 단서 0
  assert.equal(
    shouldWarnUnverified({ ...BASE, domainAgeDays: 400, hasPath: false }),
    false,
  );
});

test("구조 신호(heurScore>0) 존재 → 주의 상향", () => {
  assert.equal(shouldWarnUnverified({ ...BASE, heurScore: 10 }), true);
});

test("구조상 이미 위험확정(structurallyDanger)이면 warn 로직 스킵(별도 danger 경로)", () => {
  assert.equal(
    shouldWarnUnverified({ ...BASE, structurallyDanger: true, pageUnreachable: true }),
    false,
  );
});
