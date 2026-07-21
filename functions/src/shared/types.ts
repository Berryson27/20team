/**
 * 한큐 API 계약 — 설계문서 §2 와 1:1 대응.
 * 프론트엔드(web/lib/types.ts)와 동일하게 유지한다. (단일 진실의 원천)
 */

export type Verdict = "safe" | "warn" | "danger";
export type SignatureStatus = "valid" | "invalid" | "absent";
export type ThreatType =
  | "card_theft"
  | "account_transfer"
  | "apk_install"
  | "credential"
  | "forgery"
  | null;
export type Confidence = "high" | "medium" | "low";

/** 검증 단계 키 (S2 진행 화면이 그대로 렌더) */
export type StageKey = "signature" | "redirect" | "heuristics" | "llm";
export type StageStatus = "done" | "skipped" | "error";

export interface VerifyStage {
  key: StageKey;
  status: StageStatus;
  detail: string;
  finalUrl_hash?: string;
  flags?: string[];
  durationMs?: number;
}

export interface SignatureInfo {
  status: SignatureStatus;
  issuerName?: string;
  issuedAt?: string;
}

/** POST /verify 요청 */
export interface VerifyRequest {
  payload: string; // QR 디코드 원문 (문자열 하나)
  clientContext?: {
    channel?: "camera" | "upload" | "demo";
    geo?: { lat: number; lng: number } | null; // 동의 시에만 — 서버에서 즉시 구/격자로 변환 후 폐기
    sessionId?: string; // 익명 세션 ID(퍼널 체이닝용) — 프론트에서 생성
  };
  /** 데모 시나리오 강제 (S9 데모 컨트롤 — 실 LLM 없이 정품/주의/위조 재현) */
  demoScenario?: "safe" | "warn" | "danger";
}

/** POST /verify 응답 */
export interface VerifyResponse {
  verifyId: string;
  verdict: Verdict;
  score: number; // 0~100
  confidence: Confidence;
  signature: SignatureInfo;
  stages: VerifyStage[];
  reasons: string[]; // 정확히 3줄, 사람 말
  threatType: ThreatType;
  finalUrlHash: string | null; // URL 원문 미저장 — 해시만
  issuer?: { name: string } | null; // 서명 검증된 발급자(개인·가게·단체) 이름
  fallback: boolean;
  /** S4(AI 페이지 판독)가 실제로 성공했는지(폴백 모델 포함) — additive, 하위호환. 없으면 S4가 스킵/미실행됐던 구경로. */
  aiAnalyzed?: boolean;
}

/** 발급자 유형 (개인도 가게도 — 누구나 발급) */
export type IssuerType = "personal" | "business" | "org";

/** POST /issuers/qr 요청/응답 */
export interface IssueQrRequest {
  targetUrl: string;
  label: string;
  issuerName?: string;
  issuerType?: IssuerType;
}
export interface IssueQrResponse {
  qrId: string;
  payload: string; // 서명 포함 페이로드
  pngDataUrl: string; // QR PNG (data URL)
  issuedAt: string;
}

/** GET /issuers/me/dashboard */
export interface DashboardResponse {
  issuer: { id: string; name: string; issuerType?: string; qrId?: string } | null;
  today: { scans: number; verified: number; forgeryAttempts: number };
  alerts: ForgeryAlert[];
}
export interface ForgeryAlert {
  id: string;
  type: "forgery_detected";
  at: string;
  regionCode?: string;
  regionName?: string;
  detail: string;
}

/** POST /reports */
export type ReportCategory = "fake_payment" | "apk" | "phishing_page" | "other";
export type PlaceType =
  | "kickboard"
  | "charger"
  | "table"
  | "flyer"
  | "delivery"
  | "other";
export interface ReportRequest {
  verifyId?: string;
  regionCode?: string | null;
  category: ReportCategory;
  placeType?: PlaceType | null;
  geo?: { lat: number; lng: number } | null;
}
export interface ReportResponse {
  reportId: string;
  regionCode: string | null;
  regionName: string | null;
  mapUrl: string;
}

/** GET /map/summary */
export interface MapRegion {
  regionCode: string;
  name: string;
  count: number;
  level: "low" | "mid" | "high";
}
export interface MapCell {
  geohash: string;
  lat: number;
  lng: number;
  count: number;
  topPlaceType: PlaceType | null;
  lastAt: string;
}
export interface MapRecent {
  at: string;
  regionName: string;
  category: ReportCategory;
  placeType: PlaceType | null;
}
export interface MapSummaryResponse {
  total: number;
  thisWeek: number;
  blockedToday: number;
  regions: MapRegion[];
  cells: MapCell[];
  byPlaceType: Record<string, number>;
  recent: MapRecent[];
}

/** 공통 에러 */
export interface ApiError {
  error: {
    code:
      | "INVALID_PAYLOAD"
      | "TIMEOUT_FALLBACK"
      | "RATE_LIMITED"
      | "UNAUTHORIZED"
      | "INTERNAL";
    message: string;
  };
}
