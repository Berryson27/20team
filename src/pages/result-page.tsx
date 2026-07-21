import { AlertTriangle, ArrowRight, Ban, CreditCard, ExternalLink, Flag, Globe2, RefreshCw, Route } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { RiskGauge } from '@/components/risk-gauge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const evidence = [
  {
    icon: Globe2,
    title: '유사 금융 도메인',
    description: '공식 금융사 주소와 비슷하게 구성된 예시입니다.',
    level: '높음',
  },
  {
    icon: Route,
    title: '다중 리디렉션',
    description: '목적지까지 여러 주소를 거치는 흐름입니다.',
    level: '높음',
  },
  {
    icon: CreditCard,
    title: '결제 정보 요구',
    description: '접속 직후 결제 정보를 요청하는 형태입니다.',
    level: '주의',
  },
]

export function ResultPage() {
  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="RISK REPORT"
        title="진단 결과"
        description="결과는 점수만 보여주지 않고, 판단 근거와 다음 행동까지 이해할 수 있도록 구성했습니다."
        backTo="/scan"
        action={<Badge variant="outline" className="hidden sm:inline-flex">예시 결과</Badge>}
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(330px,0.78fr)_minmax(0,1.22fr)]">
        <Card className="relative overflow-hidden border-[#ffd8d4] bg-white/78 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#fff1f0] to-transparent" />
          <CardContent className="relative flex h-full flex-col items-center p-5 text-center sm:p-7 md:p-8">
            <Badge variant="danger"><AlertTriangle className="size-3.5" /> 고위험 신호 감지</Badge>
            <RiskGauge score={82} />
            <h2 className="text-2xl font-extrabold tracking-[-0.045em] text-[#27364a]">피싱 가능성이 높아요</h2>
            <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">이 QR은 금융사를 사칭하거나 민감한 결제 정보를 요구할 가능성이 있는 화면 예시입니다.</p>

            <div className="mt-4 w-full rounded-2xl border border-danger/15 bg-danger/[0.055] p-3 text-left sm:mt-7 sm:p-4">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger text-white"><Ban className="size-5" /></span>
                <div>
                  <strong className="text-sm text-danger">지금은 링크를 열지 마세요</strong>
                  <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">주소를 다시 확인하고 공식 앱이나 대표번호를 이용하는 것이 안전합니다.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/85 bg-white/74 backdrop-blur-xl">
            <CardHeader className="p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <CardTitle>위험 판단 근거</CardTitle>
                <CardDescription>각 항목을 확장해 세부 정보를 보여줄 수 있는 구조입니다.</CardDescription>
              </div>
              <span className="mt-2 text-xs font-semibold text-muted-foreground sm:mt-0">3개 신호</span>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 sm:space-y-3 sm:px-6 sm:pb-6">
              {evidence.map((item, index) => (
                <div key={item.title} className="group flex items-center gap-3 rounded-2xl border border-border/75 bg-white/72 p-3 sm:p-5">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl sm:size-11 sm:rounded-2xl ${index === 2 ? 'bg-warning/15 text-[#c4770c]' : 'bg-danger/10 text-danger'}`}>
                    <item.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm sm:text-base">{item.title}</strong>
                      <Badge variant={index === 2 ? 'warning' : 'danger'} className="px-2 py-0.5">{item.level}</Badge>
                    </div>
                    <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block sm:text-sm">{item.description}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-white/85 bg-white/74 backdrop-blur-xl">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">권장 조치</h3>
                  <p className="mt-1 text-sm text-muted-foreground">실제 기능 연결 시 신고와 차단 흐름이 이어질 영역입니다.</p>
                </div>
                <ExternalLink className="size-5 text-muted-foreground" />
              </div>
              <Button variant="destructive" size="lg" className="w-full"><Ban /> 접속 차단하기</Button>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button variant="outline"><Flag /> 신고하기</Button>
                <Button asChild variant="outline"><Link to="/scan"><RefreshCw /> 다시 진단</Link></Button>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">현재는 동작하지 않는 디자인용 버튼입니다.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
