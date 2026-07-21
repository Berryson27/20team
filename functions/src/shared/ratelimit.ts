/**
 * 고정 윈도우 레이트리밋 (Firestore 카운터).
 * 공개 엔드포인트(/verify·/reports)의 남용을 막는다:
 *  - /verify: LLM 대량 호출로 인한 비용 폭탄
 *  - /reports: 가짜 신고 스팸으로 인한 지도 오염
 * 원칙: 방어장치가 서비스를 막으면 안 된다 → Firestore 오류 시 통과(fail-open).
 * ⚠ 키는 IP 기준. 같은 공유망(NAT) 뒤 다수 사용자는 IP를 공유하므로 한도는 넉넉히 잡는다.
 */
import type { Request } from "firebase-functions/v2/https";
import { db } from "./admin";

/** 프록시(Firebase Hosting) 뒤의 실제 클라이언트 IP 추출. */
export function clientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff ?? "";
  const first = raw.split(",")[0]?.trim();
  return first || req.ip || "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * bucket(엔드포인트) + id(보통 IP)를 키로 windowSec 동안 limit 회까지 허용.
 * 초과하면 allowed=false + 다음 윈도우까지 남은 초(retryAfterSec) 반환.
 */
export async function rateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowId = Math.floor(now / (windowSec * 1000));
  const windowEndMs = (windowId + 1) * windowSec * 1000;
  const key = `${bucket}_${id}_${windowId}`.replace(/[^A-Za-z0-9_.-]/g, "_");
  const ref = db.collection("rate_limits").doc(key);
  try {
    const count = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const c = (snap.exists ? ((snap.data()?.count as number) ?? 0) : 0) + 1;
      // expireAt: Firestore TTL 정책(rate_limits.expireAt)으로 자동 삭제 권장.
      tx.set(ref, { count: c, bucket, expireAt: new Date(windowEndMs) }, { merge: true });
      return c;
    });
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSec: Math.ceil((windowEndMs - now) / 1000),
    };
  } catch (e) {
    console.warn("rateLimit failed (fail-open):", (e as Error).message);
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
}
