import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Copy, Globe2, Info, LockKeyhole, PhoneCall, RefreshCw, Route, Share2, TriangleAlert } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { RiskGauge } from '@/components/risk-gauge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { readLastVerification, type VerificationResult } from '@/lib/verification'

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(() => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0))
  useEffect(() => {
    let frame = 0
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(frame)
    }
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

const verdictCopy = {
  safe: {
    badge: '낮음',
    badgeClass: 'text-primary',
    headline: '뚜렷한 위험 신호가 없어요',
    advice: '그래도 개인정보나 결제 정보를 입력하기 전에 주소를 한 번 더 확인하세요.',
    heroClass: 'from-[#079caa] via-[#10afbd] to-[#72e1df]',
  },
  warn: {
    badge: '주의',
    badgeClass: 'text-[#b96800]',
    headline: '의심 신호가 발견됐어요',
    advice: '접속하더라도 로그인·카드·계좌 정보는 절대 입력하지 마세요.',
    heroClass: 'from-[#e89a25] via-[#f4ad37] to-[#ffd166]',
  },
  danger: {
    badge: '위험',
    badgeClass: 'text-danger',
    headline: '접속하지 마세요',
    advice: '피싱 위험이 높은 주소입니다. 링크를 열거나 앱을 설치하지 마세요.',
    heroClass: 'from-[#e94f58] via-[#ff675c] to-[#ff9a72]',
  },
}

const dangerActions = [
  '링크를 열었다면 즉시 화면을 닫고, 아무 정보도 입력하지 마세요.',
  '앱(APK) 설치를 시작했다면 설치를 취소하고 다운로드 파일을 삭제하세요.',
  '이미 정보를 입력했다면 해당 은행·카드사에 바로 지급정지를 요청하세요.',
]

const hotlines = [
  { name: '경찰청 (사이버범죄 신고)', tel: '112' },
  { name: '금융감독원 (지급정지·피해상담)', tel: '1332' },
  { name: 'KISA 인터넷침해대응센터', tel: '118' },
]

export function ResultPage() {
  const location = useLocation()
  const stateResult = (location.state as { result?: VerificationResult } | null)?.result
  const result = stateResult || readLastVerification()
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [warningOpen, setWarningOpen] = useState(() => result?.verdict === 'danger')
  const displayScore = useCountUp(result?.score ?? 0)

  useEffect(() => {
    if (warningOpen) navigator.vibrate?.([120, 60, 120])
  }, [warningOpen])

  if (!result) return <Navigate to="/scan" replace />

  const copy = verdictCopy[result.verdict]
  const officialSafe = Boolean(result.trusted) && result.verdict === 'safe'
  const sortedSignals = result.signals.slice().sort((a, b) => b.points - a.points)
  const domainSignals = sortedSignals.filter((signal) => signal.stage === 'domain')
  const redirectSignal = sortedSignals.find((signal) => signal.stage === 'redirect')
  const redirectStage = result.stages.find((stage) => stage.id === 'redirect')
  const actionSignals = sortedSignals.filter((signal) => ['sensitive-form', 'external-form', 'apk-prompt'].includes(signal.id))
  const actionSignal = actionSignals[0]
  const executableRisk = result.threatType === 'apk_install' && !actionSignal
  const checkedUrl = result.chain?.at(-1) ?? result.finalHost
  const aiSummary = result.model.startsWith('gemini') && !result.fallback
    ? result.stages.find((stage) => stage.id === 'ai')?.detail
    : null

  async function shareResult() {
    if (!result) return
    const text = `[한큐 QR 진단] ${checkedUrl ?? '검사한 주소'} — 위험도 ${copy.badge} (${result.score}/100점)\n주요 신호: ${result.reasons.join(', ')}`
    try {
      if (navigator.share) {
        await navigator.share({ title: '한큐 QR 진단 결과', text })
      } else {
        await navigator.clipboard.writeText(text)
        setShared(true)
        window.setTimeout(() => setShared(false), 1500)
      }
    } catch {
      // 사용자가 공유 시트를 닫은 경우 등은 무시한다.
    }
  }

  async function copyHost() {
    if (!checkedUrl) return
    try {
      await navigator.clipboard.writeText(checkedUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시한다.
    }
  }

  const riskIndicators = [
    {
      id: 'domain',
      title: '주소 신뢰도',
      detail: result.trusted ? '공식 등록 도메인과 일치' : domainSignals[0]?.title || '의심 신호 없음',
      status: (result.trusted ? 'safe' : domainSignals[0]?.level || 'safe') as 'safe' | 'warning' | 'danger',
      icon: Globe2,
    },
    {
      id: 'redirect',
      title: '최종 연결 경로',
      detail: redirectSignal?.title || '주소 변경 없음',
      status: (redirectSignal ? redirectSignal.level : redirectStage?.status === 'warning' ? 'warning' : 'safe') as 'safe' | 'warning' | 'danger',
      icon: Route,
    },
    {
      id: 'action',
      title: '정보·앱 설치 요구',
      detail: actionSignal?.title || (executableRisk ? '앱 실행·설치 주소' : '민감정보 요구 없음'),
      status: (actionSignal?.level || (executableRisk ? (result.verdict === 'danger' ? 'danger' : 'warning') : 'safe')) as 'safe' | 'warning' | 'danger',
      icon: LockKeyhole,
    },
  ]

  const indicatorAppearance = {
    safe: { label: '안전', iconClass: 'bg-primary/10 text-primary', badgeVariant: 'default' as const },
    warning: { label: '주의', iconClass: 'bg-warning/15 text-[#b96800]', badgeVariant: 'warning' as const },
    danger: { label: '위험', iconClass: 'bg-danger/10 text-danger', badgeVariant: 'danger' as const },
  }

  return (
    <AppShell hideMobileHeader>
      <div className="mx-auto max-w-3xl">
        <div className="relative mb-4 flex h-10 items-center justify-center md:hidden">
          <Link to="/scan" className="absolute left-0 grid size-10 place-items-center rounded-full text-foreground" aria-label="뒤로 가기">
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-extrabold tracking-[-0.04em]">진단 결과</h1>
        </div>
        <div className="hidden md:block">
          <PageHeading
            eyebrow="QR CHECK RESULT"
            title="진단 결과"
            description={result.finalHost ? `${result.finalHost} 확인 결과` : 'QR 연결 확인 결과'}
            backTo="/scan"
          />
        </div>

        <div>
          <section className={`relative overflow-hidden rounded-[32px] bg-gradient-to-br px-6 pb-20 pt-7 text-center text-white shadow-[0_24px_70px_rgba(15,166,181,0.2)] sm:px-10 sm:pb-24 sm:pt-9 ${copy.heroClass}`}>
            <div className="absolute -right-20 -top-20 size-72 rounded-full bg-white/25 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 size-64 rounded-full bg-[#173d78]/12 blur-3xl" />
            <div className="relative">
              <p className="text-base font-bold tracking-[-0.02em] text-white/90 sm:text-lg">피싱 위험 점수</p>
              <div className="mt-3">
                <RiskGauge score={displayScore} verdict={result.verdict} tone="onColor" />
              </div>
              <p className="mt-3 text-lg font-extrabold tracking-[-0.02em] sm:text-xl">{copy.headline}</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-white/85 sm:text-sm">
                {officialSafe ? '공식 등록 도메인과 일치해요. 남은 점수는 연결 방식 같은 참고 신호의 합계예요.' : copy.advice}
              </p>
            </div>
          </section>

          <Card className="relative z-10 mx-3 -mt-14 border-white/90 bg-white/92 backdrop-blur-xl sm:mx-7 sm:-mt-16">
            <CardContent className="p-4 sm:p-6">
              {checkedUrl && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-secondary/65 px-3 py-2.5 sm:mb-4">
                  <Globe2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">검사한 주소</p>
                    <p className="truncate text-sm font-bold" title={checkedUrl}>
                      {result.chain && result.chain.length > 1 ? `${result.chain[0]} → ${checkedUrl}` : checkedUrl}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyHost()}
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-muted-foreground shadow-sm transition hover:text-foreground"
                    aria-label="주소 복사"
                  >
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  </button>
                </div>
              )}

              <div className="mb-3 sm:mb-4">
                <h2 className="text-lg font-extrabold tracking-[-0.035em] sm:text-xl">왜 이렇게 판단했나요?</h2>
              </div>
              <div className="space-y-2">
                {riskIndicators.map((indicator) => {
                  const appearance = indicatorAppearance[indicator.status]
                  return (
                    <div key={indicator.id} className="flex items-center gap-3 rounded-2xl bg-secondary/65 p-3 sm:p-4">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${appearance.iconClass}`}>
                        <indicator.icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm">{indicator.title}</strong>
                          <Badge variant={appearance.badgeVariant} className="shrink-0">{appearance.label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{indicator.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {aiSummary && (
                <div className="mt-3 rounded-xl bg-primary/6 px-3 py-2.5">
                  <p className="text-[10px] font-bold tracking-[0.08em] text-primary">AI 분석 요약</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{aiSummary}</p>
                </div>
              )}

              {result.fallback && (
                <div className="mt-3 flex gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-warning" />
                  일부 내용을 확인하지 못했어요. 안전하다고 단정하지 말고 주소를 다시 확인하세요.
                </div>
              )}
            </CardContent>
          </Card>

          {result.verdict !== 'safe' && (
            <Card className="mx-3 mt-3 border-danger/25 bg-white/85 backdrop-blur-xl sm:mx-7">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-danger" />
                  <h2 className="text-sm font-extrabold tracking-[-0.02em]">지금 이렇게 하세요</h2>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {dangerActions.map((action, index) => (
                    <li key={action} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                      <span className="font-black text-danger">{index + 1}.</span>
                      {action}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
                  {hotlines.map((hotline) => (
                    <a
                      key={hotline.tel}
                      href={`tel:${hotline.tel}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-secondary/65 px-3 py-2.5 transition hover:bg-secondary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] text-muted-foreground">{hotline.name}</span>
                        <strong className="text-sm">{hotline.tel}</strong>
                      </span>
                      <PhoneCall className="size-4 shrink-0 text-primary" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <details className="group mx-3 mt-3 overflow-hidden rounded-2xl border border-primary bg-white/70 backdrop-blur-xl sm:mx-7">
            <summary className="flex h-12 cursor-pointer list-none items-center justify-center gap-2 px-5 text-sm font-bold text-primary sm:h-14">
              상세 결과 보기
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-primary/15 bg-white/75 px-4 py-4">
              <p className="mb-4 text-xs leading-5 text-muted-foreground">위험 점수는 피싱 확률이 아니라 발견된 신호를 합산한 값입니다.</p>
              <div className="space-y-3">
                {result.stages.map((stage) => (
                  <div key={stage.id} className="flex gap-3 text-sm">
                    <span className={`mt-1 size-2.5 shrink-0 rounded-full ${stage.status === 'danger' ? 'bg-danger' : stage.status === 'warning' ? 'bg-warning' : stage.status === 'safe' ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    <div><strong>{stage.label}</strong><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{stage.detail}</p></div>
                  </div>
                ))}
              </div>

              {sortedSignals.length > 0 && (
                <>
                  <p className="mb-2 mt-5 text-xs font-bold tracking-[0.08em] text-muted-foreground">발견된 위험 신호 {sortedSignals.length}건</p>
                  <div className="space-y-2">
                    {sortedSignals.map((signal) => (
                      <div key={signal.id} className="flex items-start justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                        <div className="min-w-0">
                          <strong className={`text-xs ${signal.level === 'danger' ? 'text-danger' : 'text-[#b96800]'}`}>{signal.title}</strong>
                          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{signal.detail}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-muted-foreground">+{signal.points}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </details>

          <div className="mx-3 mt-2.5 grid grid-cols-[1fr_auto] gap-2 sm:mx-7">
            <Button asChild size="lg" className="h-12 sm:h-14"><Link to="/scan"><RefreshCw /> 다른 QR 검사하기</Link></Button>
            <Button variant="outline" size="lg" className="h-12 px-4 sm:h-14 sm:px-6" onClick={() => void shareResult()} aria-label="진단 결과 공유">
              {shared ? <Check className="text-primary" /> : <Share2 />} {shared ? '복사됨' : '공유'}
            </Button>
          </div>
        </div>
      </div>

      {warningOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="피싱 위험 경고"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#e0404c] via-[#e94f58] to-[#a8262f] px-8 text-center text-white"
        >
          <TriangleAlert className="size-24 animate-pulse" strokeWidth={1.6} />
          <h2 className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">접속하지 마세요</h2>
          <p className="max-w-sm text-sm leading-6 text-white/85">
            피싱 위험이 높은 QR입니다.<br />링크를 열거나 앱을 설치하지 마세요.
          </p>
          <button
            type="button"
            onClick={() => setWarningOpen(false)}
            className="mt-4 h-12 rounded-full bg-white px-8 text-base font-extrabold text-danger shadow-lg transition active:scale-95"
          >
            판정 근거 확인하기
          </button>
        </div>
      )}
    </AppShell>
  )
}
