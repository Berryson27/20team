/**
 * /verify 오케스트레이터 — 적층 파이프라인 S0~S5 (검증엔진 §3, §8).
 * 어느 단계가 죽어도 판정은 나온다(적층 원칙). 데모 시나리오는 캐시로 결정론 보장.
 */
import { createHash } from "node:crypto";
import type {
  VerifyRequest, VerifyResponse, VerifyStage, ThreatType, Confidence,
} from "../shared/types";
import { config } from "../shared/admin";
import { classifyPayload, combineScore, band, deriveConfidence } from "./scoring";
import { checkSignature } from "./signature";
import { followRedirects, redirectDetail } from "./redirect";
import { runHeuristics } from "./heuristics";
import { analyzeContent } from "./llm";
import { DEMO_RESULTS } from "./demo";

// 총 예산: pro 모델 판독(~12~20초) 수용. 데모 경로는 캐시/서명이라 이 예산을 타지 않는다.
const TOTAL_BUDGET_MS = 30000;

function sha256(s: string): string {
  return "sha256:" + createHash("sha256").update(s).digest("hex");
}
function newId(prefix: string): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

export async function verifyPayload(req: VerifyRequest): Promise<VerifyResponse> {
  // 데모 시나리오(또는 전역 데모 모드) → 캐시 반환(§10 실물 스캔 실패 대비)
  const scenario = req.demoScenario ?? (config.demoMode ? guessScenario(req.payload) : null);
  if (scenario) return { ...DEMO_RESULTS[scenario], verifyId: newId("v") };

  const started = Date.now();
  const timeLeft = () => TOTAL_BUDGET_MS - (Date.now() - started);
  const stages: VerifyStage[] = [];
  let threatType: ThreatType = null;

  const kind = classifyPayload(req.payload);

  // ── S0: 실행형 스킴 → 하드 오버라이드
  if (kind.executable) {
    stages.push({ key: "signature", status: "skipped", detail: "실행형 스킴(앱 설치 유도)" });
    return finalize({
      verdict: "danger", score: 95, confidence: "high",
      signature: { status: "absent" }, stages,
      reasons: ["앱 설치를 직접 유도하는 링크입니다", "URL이 아닌 실행형 스킴(APK)입니다", "원격제어·문자 탈취 위험"],
      threatType: "apk_install", finalUrlHash: sha256(req.payload), issuer: null, fallback: false,
    });
  }
  if (kind.nonUrlText) {
    stages.push({ key: "signature", status: "skipped", detail: "URL이 아닌 텍스트" });
    return finalize({
      verdict: "safe", score: 0, confidence: "medium",
      signature: { status: "absent" }, stages,
      reasons: ["링크가 아닌 일반 텍스트입니다", "결제·송금 대상이 아닙니다", "정보성 표시로 처리했습니다"],
      threatType: null, finalUrlHash: null, issuer: null, fallback: false,
    });
  }

  // ── S1: 서명 검증 (하드 오버라이드)
  let sigStart = Date.now();
  const sig = await checkSignature(req.payload);
  if (sig.status === "valid") {
    stages.push({ key: "signature", status: "done", detail: `정품 서명 일치 · ${sig.issuerName ?? "발급처"}`, durationMs: Date.now() - sigStart });
    return finalize({
      verdict: "safe", score: 0, confidence: "high",
      signature: { status: "valid", issuerName: sig.issuerName, issuedAt: sig.issuedAt }, stages,
      reasons: [`${sig.issuerName ?? "발급처"} 정품 서명 확인`, "한큐가 발급한 서명 QR입니다", "결제 정보를 요구하는 패턴 없음"],
      threatType: null, finalUrlHash: sha256(req.payload),
      issuer: sig.issuerName ? { name: sig.issuerName } : null, fallback: false,
    });
  }
  if (sig.status === "invalid") {
    stages.push({ key: "signature", status: "done", detail: `정품 서명 불일치 — 위조${sig.issuerName ? ` (${sig.issuerName} 사칭)` : ""}`, flags: ["signature_invalid"], durationMs: Date.now() - sigStart });
    return finalize({
      verdict: "danger", score: 100, confidence: "high",
      signature: { status: "invalid", issuerName: sig.issuerName }, stages,
      reasons: [`${sig.issuerName ?? "발급처"} 정품 서명 불일치`, "정상 QR 위에 덮어씌운 위조 QR입니다", "이 QR은 당신의 돈에 접근하려 합니다"],
      threatType: "forgery", finalUrlHash: sha256(req.payload),
      issuer: sig.issuerName ? { name: sig.issuerName } : null, fallback: false,
    });
  }
  stages.push({ key: "signature", status: "done", detail: "서명 없음 — 일반 링크로 계속 검사", durationMs: Date.now() - sigStart });

  // ── S2: 리다이렉트 추적 (스킴 없는 페이로드는 https:// 보정된 URL로)
  let redirStart = Date.now();
  const redir = await followRedirects(kind.normalizedUrl ?? req.payload);
  const finalUrlHash = sha256(redir.finalUrl);
  stages.push({
    key: "redirect", status: redir.pageUnreachable ? "error" : "done",
    detail: redirectDetail(redir), finalUrl_hash: finalUrlHash,
    flags: redir.flags, durationMs: Date.now() - redirStart,
  });
  if (redir.blockedSsrf) {
    return finalize({
      verdict: "danger", score: 90, confidence: "high",
      signature: { status: "absent" }, stages,
      reasons: ["내부망 주소로 유도하는 링크입니다", "정상 결제·브랜드는 내부 IP를 쓰지 않습니다", "접근을 차단했습니다"],
      threatType: "credential", finalUrlHash, issuer: null, fallback: false,
    });
  }

  // ── S3: 도메인 휴리스틱
  let heurStart = Date.now();
  const heur = await runHeuristics(redir.finalHost);
  stages.push({
    key: "heuristics", status: "done", detail: heur.detail,
    flags: heur.flags, durationMs: Date.now() - heurStart,
  });

  // ── S4: AI 페이지 판독 (핵심 탐지기 — '내용'으로 zero-hour 피싱을 잡는다).
  // ⚠ "구조 점수가 낮음 = 안전"이 아니다(§0). 한국 브랜드 미사칭·비위험 TLD 라서
  //    구조 점수가 0이어도 실제 피싱일 수 있으므로, 페이지를 읽을 수 있으면 반드시 판독한다.
  //    생략은 (a) 이미 구조 신호만으로 위험 확정(≥70) (b) 페이지를 못 읽음 (c) 시간 초과 뿐.
  const s2s3 = combineScore(redir.score, heur.score, 0);
  const structurallyDanger = s2s3 >= 70;
  const canReadPage = !redir.pageUnreachable && redir.html.trim().length > 0;
  let llm = { ran: false, score: 0, flags: [] as string[], detail: "판독 생략", analysis: null as null | import("./llmClient").PageAnalysis, threatType: null as ThreatType };
  if (heur.trusted) {
    // 공식 등록 도메인에 착지 = 그 브랜드 본인 → 사칭 아님. 판독 생략(오탐 방지).
    llm.detail = "공식 등록 도메인 — 판독 생략";
  } else if (structurallyDanger) {
    llm.detail = "구조 신호만으로 위험 확정 — 판독 생략";
  } else if (!canReadPage) {
    llm.detail = redir.pageUnreachable ? "페이지 접근 불가 — 휴리스틱만" : "페이지 텍스트 없음 — 판독 불가";
  } else if (timeLeft() < 6000) {
    llm.detail = "시간 초과 — 간이 판정";
  } else {
    llm = await analyzeContent(redir.finalHost, redir.finalUrl, redir.html);
  }
  stages.push({
    key: "llm", status: llm.ran ? "done" : "skipped",
    detail: llm.detail, flags: llm.flags,
  });

  // ── S6: 합산 (신뢰 도메인은 캡으로 안전측 고정)
  let score = combineScore(redir.score, heur.score, llm.score);
  if (heur.trusted) score = Math.min(score, 15);
  // 강한 콘텐츠 신호: 브랜드 사칭(비공식 도메인) + 자격증명/결제 폼 = 피싱 확정 → danger
  // (프롬프트상 공식 도메인이면 사칭=null 이므로 정상 사이트 오탐 안전)
  if (!heur.trusted && llm.analysis?.impersonates_brand && llm.analysis?.has_credential_form) {
    score = Math.max(score, 78);
  }
  const fallback = !llm.ran && !structurallyDanger && !heur.trusted;
  const confidence: Confidence = deriveConfidence({
    s3Completed: true, s4Ran: llm.ran, fallback,
    captchaOrWhoisFail: redir.hitCaptcha || (heur.domainAgeDays === null && heur.flags.length === 0),
  });
  const verdict = band(score, confidence);

  // threatType 추론 (SAFE 판정엔 위협유형을 달지 않는다 — 정합성)
  threatType = llm.threatType;
  if (!threatType && verdict !== "safe") {
    if (heur.brandImitated) threatType = "card_theft";
    else if (redir.hostChanged) threatType = "credential";
  }
  if (verdict === "safe") threatType = null;

  const reasons = buildReasons({ redir, heur, llm, verdict });

  return finalize({
    verdict, score, confidence,
    signature: { status: "absent" }, stages, reasons, threatType,
    finalUrlHash, issuer: null, fallback,
  });
}

function guessScenario(payload: string): "safe" | "warn" | "danger" | null {
  const p = payload.toLowerCase();
  if (p.includes("toss-pay") || p.includes("danger")) return "danger";
  if (p.includes("warn")) return "warn";
  return null;
}

/** 점수 기여 상위 신호를 사람 말 3줄로 (§5-2 — 결정론 버전, 판정과 항상 정합) */
function buildReasons(ctx: {
  redir: Awaited<ReturnType<typeof followRedirects>>;
  heur: Awaited<ReturnType<typeof runHeuristics>>;
  llm: { analysis: import("./llmClient").PageAnalysis | null };
  verdict: "safe" | "warn" | "danger";
}): string[] {
  const { redir, heur, llm } = ctx;
  const a = llm.analysis;
  const out: string[] = [];
  // 1) 브랜드 사칭 (LLM 우선 — 도메인 불일치 전제, 그다음 한국 브랜드 휴리스틱)
  if (a?.impersonates_brand) out.push(`${a.impersonates_brand} 로그인 페이지를 사칭 — 공식이 아닌 ${redir.finalHost}`);
  else if (heur.brandImitated) out.push(`${heur.brandImitated} 공식 도메인이 아닌 ${redir.finalHost}`);
  // 2) 콘텐츠 신호
  if (a?.has_credential_form) out.push("카드·계좌 정보 입력 폼 발견");
  if (a?.apk_prompt) out.push("앱(APK) 설치 유도 발견");
  if (a?.urgency_language) out.push("'긴급 결제·미납' 압박 문구 탐지");
  // 3) 구조 신호
  if (heur.domainAgeDays !== null && heur.domainAgeDays < 30) out.push(`등록 ${heur.domainAgeDays}일차 신생 도메인`);
  if (redir.hostChanged) out.push(`단축URL ${redir.hops}회 경유 후 ${redir.finalHost} 도착`);
  if (redir.httpsDowngrade) out.push("전송 중 암호화(HTTPS) 해제 구간 발견");
  // 3줄 미만이면 판정에 맞는 의미있는 문구로 채움(빈 문자열 금지)
  const fillers = ctx.verdict === "safe"
    ? ["위험 신호가 감지되지 않았습니다", "최종 목적지 페이지를 서버가 확인했습니다", "결제 정보 요구 패턴 없음"]
    : ["복수의 위험 신호가 감지되었습니다", "최종 목적지 페이지를 서버가 확인했습니다", "이동 시 주의가 필요합니다"];
  for (const f of fillers) { if (out.length >= 3) break; if (!out.includes(f)) out.push(f); }
  return out.slice(0, 3);
}

function finalize(r: Omit<VerifyResponse, "verifyId">): VerifyResponse {
  // reasons 는 정확히 3줄 보장
  const reasons = [...r.reasons];
  while (reasons.length < 3) reasons.push("");
  return { ...r, reasons: reasons.slice(0, 3), verifyId: newId("v") };
}
