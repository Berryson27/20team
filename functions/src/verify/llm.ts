/**
 * S4 AI 페이지 판독 스코어링 (검증엔진 §4-S4, 범주 상한 45 — 차별점 핵심).
 */
import type { ThreatType } from "../shared/types";
import { getLlmClient, type PageAnalysis } from "./llmClient";
import { extractStructure, structureSummary, type PageStructure } from "./dom";
import { analyzeScreenshot } from "./vision";

/** 텍스트 판독 + 시각 판독 결과 병합 (둘 중 하나라도 신호를 잡으면 반영) */
function mergeAnalyses(a: PageAnalysis | null, b: PageAnalysis | null): PageAnalysis | null {
  if (!a && !b) return null;
  return {
    impersonates_brand: a?.impersonates_brand ?? b?.impersonates_brand ?? null,
    has_credential_form: !!(a?.has_credential_form || b?.has_credential_form),
    urgency_language: !!(a?.urgency_language || b?.urgency_language),
    apk_prompt: !!(a?.apk_prompt || b?.apk_prompt),
    threat_type: a?.threat_type ?? b?.threat_type ?? null,
    reasoning: a?.reasoning || b?.reasoning || "",
  };
}

export interface LlmStageResult {
  ran: boolean;
  score: number; // cap 45
  flags: string[];
  detail: string;
  analysis: PageAnalysis | null;
  threatType: ThreatType;
}

/** HTML → 순수 텍스트(스크립트/스타일 제거, 공백 정리) */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreContent(a: PageAnalysis): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];
  if (a.has_credential_form) { score += 30; flags.push("credential_form"); }
  if (a.impersonates_brand) { score += 25; flags.push("brand_impersonation"); }
  if (a.urgency_language) { score += 15; flags.push("urgency"); }
  if (a.apk_prompt) { score += 30; flags.push("apk_prompt"); }
  return { score: Math.min(score, 45), flags };
}

const SKIP: LlmStageResult = {
  ran: false, score: 0, flags: [], detail: "판독 생략",
  analysis: null, threatType: null,
};

/** 코드 구조 신호 채점 (폼이 외부 도메인/IP로 전송 = 강한 자격증명 탈취 증거) */
function structuralScore(s: PageStructure): { score: number; flags: string[]; bits: string[] } {
  let score = 0;
  const flags: string[] = [];
  const bits: string[] = [];
  for (const f of s.forms) {
    if ((f.hasPassword || f.hasCardField) && f.crossDomain) {
      score += 20; flags.push("form_cross_domain");
      bits.push(`입력 폼이 외부 도메인(${f.actionHost})으로 전송`);
    }
    if (f.toIp) { score += 20; flags.push("form_to_ip"); bits.push(`폼이 IP(${f.actionHost})로 직접 전송`); }
  }
  return { score: Math.min(score, 30), flags, bits };
}

/**
 * 최종 페이지를 LLM(텍스트) + 코드 구조(폼 전송대상·입력필드·외부 리소스)로 분석.
 * "AI가 코드도 본다": 폼이 외부 도메인으로 POST 하면 겉이 멀쩡해도 잡는다.
 * 텍스트도 빈약하고 코드 신호도 없으면 스킵(적층 폴백).
 */
export async function analyzeContent(
  finalHost: string,
  finalUrl: string,
  html: string
): Promise<LlmStageResult> {
  const structure = extractStructure(html, finalUrl);
  const struct = structuralScore(structure);
  const text = htmlToText(html);
  if (text.length < 40 && structure.forms.length === 0) {
    return { ...SKIP, detail: "페이지 텍스트·폼 없음 — 판독 불가(휴리스틱만)" };
  }

  const client = getLlmClient();
  // 텍스트 판독 + 시각(스크린샷) 판독을 병렬로 (지연 최소화)
  let textAnalysis: PageAnalysis | null = null;
  let visionAnalysis: PageAnalysis | null = null;
  if (client.available) {
    [textAnalysis, visionAnalysis] = await Promise.all([
      client.analyzePage(finalHost, text, structureSummary(structure)).catch(() => null),
      analyzeScreenshot(finalHost, finalUrl),
    ]);
  }
  const analysis = mergeAnalyses(textAnalysis, visionAnalysis);

  const content = analysis ? scoreContent(analysis) : { score: 0, flags: [] as string[] };
  const score = Math.min(content.score + struct.score, 45); // S4 축 상한 45
  const flags = [...content.flags, ...struct.flags];

  const bits: string[] = [];
  if (analysis?.impersonates_brand) bits.push(`${analysis.impersonates_brand} 로그인 사칭`);
  if (analysis?.has_credential_form) bits.push("카드/계좌 입력 폼");
  if (analysis?.urgency_language) bits.push("긴급성 압박 문구");
  if (analysis?.apk_prompt) bits.push("앱 설치 유도");
  if (visionAnalysis && (visionAnalysis.impersonates_brand || visionAnalysis.has_credential_form)) bits.push("AI 화면(시각) 판독 확인");
  bits.push(...struct.bits);

  const threatType: ThreatType =
    analysis?.threat_type ??
    (struct.flags.length ? "credential" : null);

  const detail = bits.length
    ? bits.join(" · ")
    : analysis
      ? "브랜드 사칭 없음 · 결제·입력 폼 없음 · 압박 문구 없음 (코드·텍스트 판독)"
      : "코드 구조 특이사항 없음";

  return { ran: true, score, flags, detail, analysis, threatType };
}
