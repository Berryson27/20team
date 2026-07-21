import { ArrowLeft, ChevronDown, Globe2, Info, LockKeyhole, RefreshCw, Route } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { readLastVerification, type VerificationResult } from '@/lib/verification'

const verdictCopy = {
  safe: {
    badge: '낮음',
    heroClass: 'from-[#079caa] via-[#10afbd] to-[#72e1df]',
  },
  warn: {
    badge: '주의',
    heroClass: 'from-[#e89a25] via-[#f4ad37] to-[#ffd166]',
  },
  danger: {
    badge: '위험',
    heroClass: 'from-[#e94f58] via-[#ff675c] to-[#ff9a72]',
  },
}

export function ResultPage() {
  const location = useLocation()
  const stateResult = (location.state as { result?: VerificationResult } | null)?.result
  const result = stateResult || readLastVerification()
  if (!result) return <Navigate to="/scan" replace />

  const copy = verdictCopy[result.verdict]
  const sortedSignals = result.signals.slice().sort((a, b) => b.points - a.points)
  const domainSignals = sortedSignals.filter((signal) => signal.stage === 'domain')
  const redirectSignal = sortedSignals.find((signal) => signal.stage === 'redirect')
  const redirectStage = result.stages.find((stage) => stage.id === 'redirect')
  const actionSignals = sortedSignals.filter((signal) => ['sensitive-form', 'external-form', 'apk-prompt'].includes(signal.id))
  const actionSignal = actionSignals[0]
  const executableRisk = result.threatType === 'apk_install' && !actionSignal

  const riskIndicators = [
    {
      id: 'domain',
      title: '주소 신뢰도',
      detail: domainSignals[0]?.title || '의심 신호 없음',
      status: (domainSignals[0]?.level || 'safe') as 'safe' | 'warning' | 'danger',
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
              <div className="mt-2 flex items-end justify-center gap-2">
                <strong className="text-[5.75rem] font-black leading-none tracking-[-0.09em] sm:text-[7rem]">{result.score}</strong>
                <span className="pb-2 text-2xl font-semibold text-white/85 sm:pb-3 sm:text-3xl">/ 100</span>
              </div>
              <span className="mt-4 inline-flex min-w-24 items-center justify-center rounded-full bg-white px-6 py-2.5 text-xl font-extrabold text-primary shadow-sm sm:text-2xl">
                {copy.badge}
              </span>
            </div>
          </section>

          <Card className="relative z-10 mx-3 -mt-14 border-white/90 bg-white/92 backdrop-blur-xl sm:mx-7 sm:-mt-16">
            <CardContent className="p-4 sm:p-6">
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

              {result.fallback && (
                <div className="mt-3 flex gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-warning" />
                  일부 내용을 확인하지 못했어요. 안전하다고 단정하지 말고 주소를 다시 확인하세요.
                </div>
              )}
            </CardContent>
          </Card>

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
            </div>
          </details>

          <div className="mx-3 mt-2.5 sm:mx-7">
            <Button asChild size="lg" className="h-12 w-full sm:h-14"><Link to="/scan"><RefreshCw /> 다른 QR 검사하기</Link></Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
