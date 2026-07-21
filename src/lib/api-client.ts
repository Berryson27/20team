// 백엔드 검증 API 클라이언트 — 브라우저는 더 이상 Gemini·Safe Browsing 키를 갖지 않는다.
// 모든 판정은 서버(POST /api/verify)가 수행하고, 여기서는 계약(shared/types.ts)만 소비한다.

export type ServerVerdict = 'safe' | 'warn' | 'danger'
export type ServerConfidence = 'high' | 'medium' | 'low'
export type ServerThreatType =
  | 'card_theft'
  | 'account_transfer'
  | 'apk_install'
  | 'credential'
  | 'forgery'
  | null
export type ServerStageKey = 'signature' | 'redirect' | 'heuristics' | 'llm' | 'blocklist'
export type ServerStageStatus = 'done' | 'skipped' | 'error'

export interface ServerVerifyStage {
  key: ServerStageKey
  status: ServerStageStatus
  detail: string
  finalUrl_hash?: string
  flags?: string[]
  durationMs?: number
}

export interface ServerSignatureInfo {
  status: 'valid' | 'invalid' | 'absent'
  issuerName?: string
  issuedAt?: string
}

/** 서버 POST /verify 응답 (functions/src/shared/types.ts VerifyResponse 와 동일). */
export interface VerifyResponse {
  verifyId: string
  verdict: ServerVerdict
  score: number
  confidence: ServerConfidence
  signature: ServerSignatureInfo
  stages: ServerVerifyStage[]
  reasons: string[]
  threatType: ServerThreatType
  finalUrlHash: string | null
  issuer?: { name: string } | null
  fallback: boolean
}

/** 검증을 서버에 위임한다. 실패 시 호출부가 폴백·에러 UX를 처리하도록 throw 한다. */
export async function postVerify(payload: string): Promise<VerifyResponse> {
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload }),
  })
  if (!res.ok) throw new Error(`verify failed: ${res.status}`)
  return (await res.json()) as VerifyResponse
}
