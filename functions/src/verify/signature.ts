import { createHmac, timingSafeEqual } from "node:crypto";
import { config, db } from "../shared/admin";
import type { SignatureStatus } from "../shared/types";

/**
 * S1 서명 검증 (검증엔진 §4-S1, 하드 오버라이드 최우선).
 * 스킴: sig = HMAC-SHA256(secret, qrId + "\n" + targetUrl + "\n" + issuedAt)
 * 우리 발급 포맷:  https://<base>/r/<qrId>?sig=<hex>
 *  - valid   : 우리 발급 QR, HMAC 일치 → safe 즉단
 *  - invalid : 우리 포맷인데 서명 불일치(바꿔치기 위조) → danger 즉단
 *  - absent  : 우리 QR 아님(일반 URL) → S2~ 계속
 */

export function sign(qrId: string, targetUrl: string, issuedAt: string): string {
  return createHmac("sha256", config.signingSecret)
    .update(`${qrId}\n${targetUrl}\n${issuedAt}`)
    .digest("hex");
}

export function buildPayload(base: string, qrId: string, sig: string): string {
  return `${base.replace(/\/+$/, "")}/r/${qrId}?sig=${sig}`;
}

interface ParsedOurQr {
  qrId: string;
  sig: string;
}

/** 페이로드가 우리 포맷(/r/<id>?sig=)인지 파싱. 아니면 null(absent). */
function parseOurQr(payload: string): ParsedOurQr | null {
  let u: URL;
  try {
    u = new URL(payload);
  } catch {
    return null;
  }
  const m = u.pathname.match(/^\/r\/([A-Za-z0-9_-]{4,40})\/?$/);
  const sig = u.searchParams.get("sig");
  if (!m || !sig) return null;
  return { qrId: m[1], sig };
}

export interface SignatureResult {
  status: SignatureStatus;
  issuerName?: string;
  issuedAt?: string;
  qrId?: string;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export async function checkSignature(payload: string): Promise<SignatureResult> {
  const parsed = parseOurQr(payload);
  if (!parsed) return { status: "absent" };

  // 우리 포맷 → 발급 기록 조회 후 HMAC 재계산
  const snap = await db.collection("qr_codes").doc(parsed.qrId).get();
  if (!snap.exists) {
    // 우리 포맷인데 발급 기록 없음 = 위조(존재하지 않는 발급번호 사칭)
    return { status: "invalid", qrId: parsed.qrId };
  }
  const data = snap.data() as {
    targetUrl: string;
    issuedAt: string;
    issuerName?: string;
  };
  const expected = sign(parsed.qrId, data.targetUrl, data.issuedAt);
  if (safeEqualHex(expected, parsed.sig)) {
    return {
      status: "valid",
      issuerName: data.issuerName,
      issuedAt: data.issuedAt,
      qrId: parsed.qrId,
    };
  }
  return { status: "invalid", qrId: parsed.qrId, issuerName: data.issuerName };
}
