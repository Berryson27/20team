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
