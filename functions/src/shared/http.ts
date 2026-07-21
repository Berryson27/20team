import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { getAuth } from "firebase-admin/auth";

/** 로컬 개발(next dev :3000 → 에뮬레이터) 대비 CORS. 프로덕션은 동일 오리진(Hosting rewrite). */
export function applyCors(req: Request, res: Response): boolean {
  res.set("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.set("Access-Control-Max-Age", "3600");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true; // 처리 종료
  }
  return false;
}

export function fail(
  res: Response,
  status: number,
  code:
    | "INVALID_PAYLOAD"
    | "TIMEOUT_FALLBACK"
    | "RATE_LIMITED"
    | "UNAUTHORIZED"
    | "INTERNAL",
  message: string
): void {
  res.status(status).json({ error: { code, message } });
}

/** 429 Too Many Requests — Retry-After 헤더 포함(레이트리밋 초과 시). */
export function tooManyRequests(res: Response, retryAfterSec: number): void {
  res.set("Retry-After", String(Math.max(1, retryAfterSec)));
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
  });
}

/** Authorization: Bearer <idToken> 검증 → uid. 실패 시 null. */
export async function requireUid(req: Request): Promise<string | null> {
  const header = req.headers.authorization ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const decoded = await getAuth().verifyIdToken(m[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}
