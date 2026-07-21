import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

/** 환경변수 접근 — 프로젝트별 값은 전부 여기로만 (하드코딩 금지) */
export const config = {
  llmProvider: process.env.LLM_PROVIDER ?? "gemini",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-pro-latest",
  signingSecret: process.env.HANQ_SIGNING_SECRET ?? "dev-insecure-secret",
  demoMode: (process.env.HANQ_DEMO_MODE ?? "false") === "true",
  /** 정품 QR 페이로드의 베이스 URL(호스팅 도메인). 배포 후 실제 URL로. */
  publicBase: process.env.HANQ_PUBLIC_BASE ?? "https://hanq.app",
  /** ThinkingEngine 수신기(공개 HTTPS) + app_id. 없으면 TE 전송 no-op. */
  teUrl: (process.env.TE_URL ?? "").replace(/\/+$/, ""),
  teAppId: process.env.TE_APP_ID ?? "",
  /** AI 시각 판독(스크린샷 → Gemini 비전). 실패 시 텍스트/코드로 폴백. */
  vision: (process.env.HANQ_VISION ?? "true") === "true",
  shotBase: process.env.HANQ_SHOT_BASE ?? "https://image.thum.io/get/wait/4/png/width/800/",
};
