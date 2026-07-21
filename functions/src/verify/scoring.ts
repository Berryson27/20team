/**
 * S0 분류 + S6 점수 수학 (검증엔진 §4-S0, §6).
 * raw = min(S2,25) + min(S3,40) + min(S4,45); score = clamp(0,100)
 * 임계값 40 / 70.
 */
import type { Verdict, Confidence } from "../shared/types";

export interface PayloadKind {
  executable: boolean; // intent://, market://, .apk 직접
  isUrl: boolean;
  nonUrlText: boolean;
  normalizedUrl: string | null; // 스킴 보정된 검사 대상 URL
}

// 스킴 없는 도메인형(예: electrogas.pt/app/pay.php, www.site.com) — 브라우저는 https:// 붙여 이동한다
const DOMAINISH = /^([a-z0-9¡-￿-]+\.)+[a-z¡-￿]{2,}([/?#].*)?$/i;

export function classifyPayload(payload: string): PayloadKind {
  const p = payload.trim();
  const lower = p.toLowerCase();
  const executable =
    lower.startsWith("intent://") ||
    lower.startsWith("market://") ||
    /\.apk(\?|$)/.test(lower) ||
    lower.startsWith("itms-services://");

  let normalizedUrl: string | null = null;
  // 1) 스킴 있는 http/https
  try { const u = new URL(p); if (u.protocol === "http:" || u.protocol === "https:") normalizedUrl = u.toString(); } catch { /* */ }
  // 2) 스킴 없는 도메인형 → https:// 보정해서 URL로 취급 (QR/링크에 스킴 없어도 피싱 검사)
  if (!normalizedUrl && !executable && !p.includes(" ") && DOMAINISH.test(p)) {
    try { const u = new URL("https://" + p); normalizedUrl = u.toString(); } catch { /* */ }
  }

  const isUrl = !!normalizedUrl;
  const nonUrlText = !isUrl && !executable;
  return { executable, isUrl, nonUrlText, normalizedUrl };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function combineScore(s2: number, s3: number, s4: number): number {
  return clamp(Math.min(s2, 25) + Math.min(s3, 40) + Math.min(s4, 45), 0, 100);
}

/** §6-2 임계값 + §6-3 confidence 보정(경계에서 안전측으로) */
export function band(score: number, confidence: Confidence): Verdict {
  let verdict: Verdict =
    score >= 70 ? "danger" : score >= 40 ? "warn" : "safe";
  // confidence=low 이고 35~45 경계면 warn 으로 올린다(놓치는 것보다 한 번 더 확인)
  if (confidence === "low" && score >= 35 && score < 40) verdict = "warn";
  return verdict;
}

export function deriveConfidence(opts: {
  s3Completed: boolean;
  s4Ran: boolean;
  fallback: boolean;
  captchaOrWhoisFail: boolean;
}): Confidence {
  if (opts.captchaOrWhoisFail) return "low";
  if (opts.s3Completed && opts.s4Ran) return "high";
  if (!opts.s4Ran || opts.fallback) return "medium";
  return "high";
}

/**
 * S4 콘텐츠·구조 강신호 = 피싱 확정(danger 상향 대상). 비신뢰 도메인 전제.
 * "모호하지 않은" 증거만 여기 넣는다 — 오탐 방지가 핵심.
 *  ① 브랜드 로그인/결제 UI 사칭 + 자격증명 폼 (프롬프트상 공식 도메인이면 impersonates_brand=null)
 *  ② 비번/카드 입력 폼이 '다른 외부 도메인' 으로 전송(form_cross_domain)
 *  ③ 폼이 raw IP 로 직접 전송(form_to_ip)
 * ⚠ 단순 apk_prompt("앱 설치하세요")는 제외 — 공식 스토어 안내일 수 있어 모호. 실제 .apk/intent://
 *    직접 타깃은 S0 하드오버라이드가 이미 처리한다. apk_prompt 는 scoreContent 의 가점(+30)으로만 반영.
 */
export function isDecisivePhishing(
  analysis: { impersonates_brand: string | null; has_credential_form: boolean } | null,
  llmFlags: string[],
): boolean {
  const a = analysis;
  return (
    (!!a?.impersonates_brand && !!a?.has_credential_form) ||
    llmFlags.includes("form_cross_domain") ||
    llmFlags.includes("form_to_ip")
  );
}

/**
 * 페이지를 못 읽어(삭제·클로킹·지역차단·리다이렉트 껍데기) AI 판독을 못 한 비신뢰 도메인을
 * '안전'으로 통과시키지 않기 위한 최소 warn(=40) 상향 여부. (§0 "낮은 구조점수 ≠ 안전")
 *
 * 발동 전제: 비신뢰 + AI 미판독(llmRan=false) + 아직 구조상 위험확정 아님 + 현재 점수 < 40.
 * 그 위에 '위험 단서'가 하나라도 있을 때만 올린다(정상이지만 일시 접속불가 사이트의 오탐 최소화):
 *  - 구조 신호 존재(heurScore>0) / 신생·미상 도메인 연령(<90d or null) / 캡차벽 / 접속불가 / 경로 존재
 */
export function shouldWarnUnverified(opts: {
  trusted: boolean;
  llmRan: boolean;
  structurallyDanger: boolean;
  score: number;
  heurScore: number;
  domainAgeDays: number | null;
  hitCaptcha: boolean;
  pageUnreachable: boolean;
  hasPath: boolean;
}): boolean {
  const contentUnverified = !opts.trusted && !opts.llmRan && !opts.structurallyDanger;
  if (!contentUnverified || opts.score >= 40) return false;
  return (
    opts.heurScore > 0 ||
    opts.domainAgeDays === null ||
    opts.domainAgeDays < 90 ||
    opts.hitCaptcha ||
    opts.pageUnreachable ||
    opts.hasPath
  );
}
