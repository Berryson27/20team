import { analyzeUrlLocally, type LocalAnalysis } from './url-analysis'
import { postVerify, type ServerStageKey, type ServerVerifyStage, type VerifyResponse } from './api-client'

export type Verdict = 'safe' | 'warn' | 'danger'

export type VerificationStage = {
  id: string
  label: string
  status: 'safe' | 'warning' | 'danger' | 'neutral'
  detail: string
}

export type VerificationSignal = {
  stage: string
  id: string
  points: number
  title: string
  detail: string
  level: 'warning' | 'danger'
}

export type VerificationResult = {
  verdict: Verdict
  score: number
  trusted?: boolean
  confidence: 'high' | 'medium' | 'low'
  threatType: 'card_theft' | 'account_transfer' | 'apk_install' | 'credential' | 'forgery' | null
  fallback: boolean
  checkedAt: string
  model: string
  finalHost: string | null
  reasons: string[]
  stages: VerificationStage[]
  signals: VerificationSignal[]
  chain?: string[]
}

export type VerifyProgress = { step: 'domain' | 'ai' | 'judge'; detail?: string }

export type HistoryEntry = {
  host: string
  score: number
  verdict: Verdict
  checkedAt: string
  result: VerificationResult
}

const RESULT_KEY = 'hanq:last-verification'
const HISTORY_KEY = 'hanq:history'
const HISTORY_LIMIT = 5
const MODEL = 'gemini-3.1-flash-lite'

// 서버 단계 키 → 사람이 읽는 라벨. 상세 결과 화면(부가 근거)이 그대로 렌더한다.
const STAGE_LABELS: Record<ServerStageKey, string> = {
  signature: '발급 서명 확인',
  redirect: '최종 목적지 추적',
  heuristics: '주소 위험 신호 검사',
  llm: 'AI 페이지 내용 판독',
}

// 위험을 직접 가리키는 서버 플래그 — 상세 단계 점 색을 위험(빨강)으로 표시한다.
const DANGER_FLAGS = new Set(['signature_invalid', 'ssrf', 'blocked_ssrf'])

// 서버 단계 상태(진행 상태: done/skipped/error)를 클라이언트 표시 색으로 옮긴다.
// 판정·점수는 서버가 권위이며, 이 색은 상세 결과의 보조 표시일 뿐이다.
function mapStageStatus(stage: ServerVerifyStage): VerificationStage['status'] {
  if ((stage.flags ?? []).some((flag) => DANGER_FLAGS.has(flag))) return 'danger'
  if (stage.status === 'error') return 'warning'
  if (stage.status === 'skipped') return 'neutral'
  return 'safe'
}

export function readHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    return stored ? JSON.parse(stored) as HistoryEntry[] : []
  } catch {
    return []
  }
}

function saveHistory(result: VerificationResult) {
  try {
    const entry: HistoryEntry = {
      host: result.finalHost ?? '주소 없는 링크',
      score: result.score,
      verdict: result.verdict,
      checkedAt: result.checkedAt,
      result,
    }
    const rest = readHistory().filter((item) => item.checkedAt !== entry.checkedAt)
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...rest].slice(0, HISTORY_LIMIT)))
  } catch {
    // 저장 공간 문제 등은 조용히 무시한다 — 이력은 부가 기능이다.
  }
}

// 서버 VerifyResponse(권위: verdict/score/confidence/threatType/reasons/stages)를
// 클라이언트 VerificationResult 로 옮긴다. 서버가 주지 않는 상세 근거(finalHost·signals·chain)는
// 로컬 프리스코어(analyzeUrlLocally)에서 채우고, 없으면 조용히 비운다.
function mapVerifyResponse(response: VerifyResponse, local: LocalAnalysis | null): VerificationResult {
  const stages: VerificationStage[] = response.stages.map((stage) => ({
    id: stage.key === 'llm' ? 'ai' : stage.key,
    label: STAGE_LABELS[stage.key] ?? stage.key,
    status: mapStageStatus(stage),
    detail: stage.detail,
  }))

  // AI 판독이 실제로 돌았을 때만 gemini 모델로 표기한다 (결과 화면의 'AI 분석 요약' 노출 조건).
  const llmStage = response.stages.find((stage) => stage.key === 'llm')
  const model = llmStage?.status === 'done' ? MODEL : '주소 기반 검사'

  const reasons = response.reasons.filter((reason) => reason.trim().length > 0)

  return {
    verdict: response.verdict,
    score: response.score,
    trusted: local?.trusted,
    confidence: response.confidence,
    threatType: response.threatType,
    fallback: response.fallback,
    checkedAt: new Date().toISOString(),
    model,
    finalHost: local?.host ?? null,
    reasons: reasons.length ? reasons : ['현재 확인된 뚜렷한 위험 신호가 없습니다.'],
    stages,
    signals: local ? local.signals.slice() : [],
    chain: local ? [local.host] : undefined,
  }
}

export async function verifyPayload(payload: string, onProgress?: (event: VerifyProgress) => void): Promise<VerificationResult> {
  const target = payload.trim()

  // 낙관적 로컬 프리스코어 — 서버 응답 전 진행 화면에 참고 신호를 보여주고,
  // 서버가 돌려주지 않는 상세 근거(host/signals)를 확보한다. 최종 판정은 서버가 내린다.
  let local: LocalAnalysis | null = null
  try {
    const parsed = new URL(target)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      local = analyzeUrlLocally(parsed.toString())
    }
  } catch {
    // URL 이 아닌 페이로드(일반 텍스트·앱 스킴 등)는 서버가 분류한다.
  }

  onProgress?.({
    step: 'domain',
    detail: local
      ? local.trusted
        ? '공식 등록 도메인을 확인했어요.'
        : local.signals.length
          ? `주소에서 위험 신호 ${local.signals.length}개를 발견했어요.`
          : '주소에서 뚜렷한 위험 신호가 없어요.'
      : '주소를 서버로 확인하고 있어요.',
  })
  onProgress?.({ step: 'ai' })

  const response = await postVerify(target)
  onProgress?.({ step: 'judge' })

  const result = mapVerifyResponse(response, local)
  console.log('[한큐 검증 결과]', result)
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result))
  } catch {
    // 세션 저장 실패는 조용히 무시한다.
  }
  saveHistory(result)
  return result
}

// 쇼케이스 미리보기용 데모 결과 — 실제 검사 결과가 없을 때만 사용된다.
export function seedDemoVerification() {
  const demo: VerificationResult = {
    verdict: 'danger',
    score: 82,
    trusted: false,
    confidence: 'high',
    threatType: 'credential',
    fallback: false,
    checkedAt: new Date().toISOString(),
    model: MODEL,
    finalHost: 'naver-security.com',
    reasons: ['naver 사칭 의심 주소', '민감정보 입력 요구', '유인 단어가 든 주소'],
    signals: [
      { stage: 'domain', id: 'brand-impersonation', points: 45, title: 'naver 사칭 의심 주소', detail: 'naver 관련 이름을 쓰지만 공식 도메인이 아닙니다.', level: 'danger' },
      { stage: 'content', id: 'sensitive-form', points: 30, title: '민감정보 입력 요구', detail: '로그인·카드·계좌 정보를 요구합니다.', level: 'danger' },
      { stage: 'domain', id: 'host-keyword', points: 20, title: '유인 단어가 든 주소', detail: "주소에 'security' 같은 유인 단어가 들어 있습니다.", level: 'warning' },
    ],
    chain: ['naver-security.com'],
    stages: [
      { id: 'payload', label: 'QR 주소 확인', status: 'safe', detail: '웹주소 형식을 확인했습니다.' },
      { id: 'redirect', label: '최종 목적지 추적', status: 'safe', detail: '표시 주소와 최종 목적지가 같습니다.' },
      { id: 'domain', label: '주소 위험 신호 검사', status: 'warning', detail: '2개의 주소 신호를 찾았습니다.' },
      { id: 'ai', label: 'AI 페이지 내용 판독', status: 'danger', detail: '네이버 로그인 화면을 흉내 내며 계정 정보를 요구하는 페이지입니다. (데모 예시)' },
    ],
  }
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(demo))
  } catch {
    // 저장 실패 시 데모 없이 넘어간다.
  }
}

export function readLastVerification(): VerificationResult | null {
  try {
    const stored = sessionStorage.getItem(RESULT_KEY)
    return stored ? JSON.parse(stored) as VerificationResult : null
  } catch {
    return null
  }
}
