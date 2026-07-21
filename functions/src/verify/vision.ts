/**
 * AI 시각 판독 (멀티모달) — 페이지 스크린샷을 Gemini 비전으로 분석.
 * 텍스트·코드는 깨끗한데 화면만 브랜드 클론인 피싱을 잡는다(설계 §5-6 screenshot 로드맵 편입).
 * 스크린샷 캡처는 외부 키리스 서비스(thum.io) — 실패하면 null 반환(텍스트/코드로 폴백, 무해).
 */
import { config } from "../shared/admin";
import { getLlmClient, type PageAnalysis } from "./llmClient";

export async function analyzeScreenshot(
  finalHost: string,
  finalUrl: string
): Promise<PageAnalysis | null> {
  if (!config.vision) return null;
  const client = getLlmClient();
  if (!client.available) return null;

  // 1) 스크린샷 캡처
  const shotUrl = config.shotBase + finalUrl;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 13000);
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(shotUrl, { signal: ctrl.signal });
    if (!res.ok) return null;
    bytes = await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (bytes.byteLength < 3000) return null; // 로딩 플레이스홀더/캡처 실패

  // 2) 비전 판독
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    return await client.analyzeImage(finalHost, b64, "image/png");
  } catch {
    return null;
  }
}
