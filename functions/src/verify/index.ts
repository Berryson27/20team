import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, config } from "../shared/admin";
import { applyCors, fail, tooManyRequests } from "../shared/http";
import { rateLimit, clientIp } from "../shared/ratelimit";
import { GEMINI_API_KEY, HANQ_SIGNING_SECRET } from "../shared/secrets";
import { trackTE } from "../shared/te";
import type { VerifyRequest } from "../shared/types";
import { verifyPayload } from "./engine";
import { toRegion, regionName } from "../geo/geohash";

// IP당 분당 30회 (LLM 비용 폭탄 방어). 공유망 다수 사용자 대비 넉넉히.
const VERIFY_RATE = { limit: 30, windowSec: 60 };

export const verify = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "512MiB",
    secrets: [GEMINI_API_KEY, HANQ_SIGNING_SECRET],
    invoker: "public",
  },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") return fail(res, 405, "INVALID_PAYLOAD", "POST only");

    const body = (req.body ?? {}) as VerifyRequest;
    if (!body.payload || typeof body.payload !== "string") {
      return fail(res, 400, "INVALID_PAYLOAD", "payload(문자열)가 필요합니다");
    }

    // 레이트리밋(IP 기준). 데모(demoScenario)·전역 데모모드는 제외 — 라이브 시연을 막지 않는다.
    if (!body.demoScenario && !config.demoMode) {
      const rl = await rateLimit("verify", clientIp(req), VERIFY_RATE.limit, VERIFY_RATE.windowSec);
      if (!rl.allowed) return tooManyRequests(res, rl.retryAfterSec);
    }

    try {
      const result = await verifyPayload(body);

      // 위치 → 구 단위만 (정확 좌표 즉시 폐기)
      let regionCode: string | null = null;
      const geo = body.clientContext?.geo;
      if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") {
        regionCode = toRegion(geo.lat, geo.lng).code;
      }

      // 스캔 로그 (URL 원문 미저장 — 해시만)
      await db.collection("scan_logs").add({
        verdict: result.verdict,
        score: result.score,
        signatureStatus: result.signature.status,
        threatType: result.threatType,
        flags: result.stages.flatMap((s) => s.flags ?? []),
        finalUrlHash: result.finalUrlHash,
        regionCode,
        fallback: result.fallback,
        at: FieldValue.serverTimestamp(),
      });

      // 이벤트 (택소노미 §3)
      await db.collection("events").add({
        name: "verify_verdict_issued",
        verdict: result.verdict, score: result.score,
        signature_status: result.signature.status,
        threat_type: result.threatType, fallback: result.fallback,
        region_code: regionCode, ts: FieldValue.serverTimestamp(),
      });

      // 라이브 카운터 (S1 "오늘 차단 N건")
      if (result.verdict === "danger") {
        await db.doc("counters/global").set(
          { todayBlocked: FieldValue.increment(1) }, { merge: true }
        );
      }

      // 우리 발급 QR 스캔 → 발급자 카운터 갱신 + 위조 시 실시간 알림(킬러 장면)
      await updateIssuerOnScan(body.payload, result, regionCode);

      // ThinkingEngine 전송 (실 스캔 → TE). 퍼널: verdict + (위험 시) danger_blocked
      const distinctId = body.clientContext?.sessionId;
      await trackTE([
        { event: "verify_verdict_issued", distinctId, regionCode, props: { verdict: result.verdict, score: result.score, signature_status: result.signature.status, threat_type: result.threatType, fallback: result.fallback } },
        ...(result.verdict === "danger" ? [{ event: "danger_blocked", distinctId, regionCode, props: { score: result.score, threat_type: result.threatType } }] : []),
      ]);

      res.json(result);
    } catch (e) {
      console.error("verify error", e);
      fail(res, 500, "INTERNAL", "검증 중 오류가 발생했습니다");
    }
  }
);

import type { VerifyResponse } from "../shared/types";

/**
 * 우리 발급(/r/<qrId>) QR 스캔 시 발급자(개인·가게·단체) 문서 갱신.
 *  - valid   → 스캔·정품확인 카운터 증가
 *  - invalid → 위조 시도 카운터 + 발급자 대시보드에 실시간 위조 알림(킬러 장면)
 */
async function updateIssuerOnScan(
  payload: string,
  result: VerifyResponse,
  regionCode: string | null
): Promise<void> {
  const m = (() => { try { return new URL(payload).pathname.match(/^\/r\/([A-Za-z0-9_-]{4,40})/); } catch { return null; } })();
  if (!m) return; // 우리 발급 포맷 아님
  const qrSnap = await db.collection("qr_codes").doc(m[1]).get();
  if (!qrSnap.exists) return;
  const qr = qrSnap.data() as { issuerId: string; issuerName?: string };
  const issuerRef = db.collection("issuers").doc(qr.issuerId);

  if (result.signature.status === "valid") {
    await issuerRef.set(
      { scanToday: FieldValue.increment(1), verifiedToday: FieldValue.increment(1) },
      { merge: true }
    );
    return;
  }
  if (result.signature.status === "invalid") {
    await issuerRef.collection("alerts").add({
      type: "forgery_detected",
      detail: `'${qr.issuerName ?? "내 QR"}' 사칭 위조 QR이 차단되었습니다`,
      regionCode, regionName: regionCode ? regionName(regionCode) : null,
      at: FieldValue.serverTimestamp(),
    });
    await issuerRef.set(
      { scanToday: FieldValue.increment(1), forgeryToday: FieldValue.increment(1) },
      { merge: true }
    );
  }
}
