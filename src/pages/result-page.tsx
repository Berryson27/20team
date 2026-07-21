import { AlertTriangle, Check, CheckCircle2, ChevronDown, Flag, HelpCircle, Info, RefreshCw, ShieldAlert } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { RiskGauge } from '@/components/risk-gauge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { readLastVerification, type VerificationResult } from '@/lib/verification'

const verdictCopy = {
  safe: {
    badge: '안전해 보여요',
    title: '큰 문제는 발견되지 않았어요',
    action: '주소가 익숙한 곳인지 한 번만 확인하고 이용하세요.',
    icon: CheckCircle2,
    iconClass: 'bg-primary text-white',
    surfaceClass: 'border-primary/20 bg-[linear-gradient(145deg,rgba(237,252,251,0.96),rgba(255,255,255,0.88))]',
  },
  warn: {
    badge: '확인이 필요해요',
    title: '바로 열지 말고 확인하세요',
    action: '공식 앱이나 대표번호에서 같은 내용을 확인하세요.',
    icon: HelpCircle,
    iconClass: 'bg-warning text-white',
    surfaceClass: 'border-warning/25 bg-[linear-gradient(145deg,rgba(255,249,235,0.96),rgba(255,255,255,0.88))]',
  },
  danger: {
    badge: '위험해요',
    title: '이 링크는 열지 마세요',
    action: '개인정보를 입력하거나 앱을 설치하면 안 됩니다.',
    icon: ShieldAlert,
    iconClass: 'bg-danger text-white',
    surfaceClass: 'border-danger/25 bg-[linear-gradient(145deg,rgba(255,241,240,0.97),rgba(255,255,255,0.88))]',
  },
}

export function ResultPage() {
  const location = useLocation()
  const stateResult = (location.state as { result?: VerificationResult } | null)?.result
  const result = stateResult || readLastVerification()
  if (!result) return <Navigate to="/scan" replace />

  const copy = verdictCopy[result.verdict]
  const VerdictIcon = copy.icon
  const badgeVariant = result.verdict === 'danger' ? 'danger' : result.verdict === 'warn' ? 'warning' : 'default'
  const signals = result.signals.length
    ? result.signals.slice().sort((a, b) => b.points - a.points).slice(0, 3)
    : result.reasons.slice(0, 3).map((reason, index) => ({
      id: `reason-${index}`, title: reason, detail: '검사 결과에서 확인한 내용입니다.', points: 0, level: 'warning' as const, stage: 'result',
    }))

  return (
    <AppShell hideMobileHeader>
      <div className="mx-auto max-w-3xl">
        <PageHeading
          eyebrow="QR CHECK RESULT"
          title="진단 결과"
          description={result.finalHost ? `${result.finalHost} 확인 결과` : 'QR 연결 확인 결과'}
          backTo="/scan"
        />

        <div className="space-y-4">
          <Card className={`overflow-hidden backdrop-blur-xl ${copy.surfaceClass}`}>
            <CardContent className="p-5 sm:p-7">
              <div className="flex items-start gap-4 sm:items-center sm:gap-5">
                <span className={`grid size-14 shrink-0 place-items-center rounded-2xl shadow-sm sm:size-16 ${copy.iconClass}`}>
                  <VerdictIcon className="size-7 sm:size-8" />
                </span>
                <div className="min-w-0 flex-1">
                  <Badge variant={badgeVariant} className="mb-2">{copy.badge}</Badge>
                  <h2 className="text-xl font-black tracking-[-0.045em] text-[#27364a] sm:text-2xl">{copy.title}</h2>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{copy.action}</p>
                </div>
                <RiskGauge score={result.score} verdict={result.verdict} compact />
              </div>

              {result.fallback && (
                <div className="mt-4 flex gap-2 rounded-xl bg-white/65 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-warning" />
                  일부 내용을 확인하지 못했어요. 안전하다고 단정하지 말고 주소를 다시 확인하세요.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/85 bg-white/76 backdrop-blur-xl">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><h3 className="font-extrabold tracking-[-0.025em]">이렇게 판단했어요</h3><p className="mt-0.5 text-xs text-muted-foreground">중요한 내용만 보여드려요.</p></div>
                <span className="text-xs font-semibold text-muted-foreground">{signals.length}개</span>
              </div>
              <div className="space-y-2.5">
                {signals.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-2xl bg-secondary/65 p-3.5">
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${item.level === 'danger' ? 'bg-danger/12 text-danger' : 'bg-warning/15 text-[#b96800]'}`}>
                      {item.level === 'danger' ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
                    </span>
                    <div className="min-w-0"><strong className="block text-sm">{item.title}</strong><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button asChild size="lg" className="w-full"><Link to="/scan"><RefreshCw /> 다른 QR 검사하기</Link></Button>
            <Button variant="outline" size="lg" className="w-full"><Flag /> 의심 QR 신고하기</Button>
          </div>

          <details className="group rounded-2xl border border-white/85 bg-white/60 backdrop-blur-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold">
              검사 상세 보기
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/70 px-4 py-4">
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
        </div>
      </div>
    </AppShell>
  )
}
