import { ArrowUpRight, CalendarDays, Info, MapPin, Package, ShieldAlert, ShoppingBag, TrendingUp } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { KoreaRiskMap } from '@/components/korea-risk-map'
import { PageHeading } from '@/components/page-heading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const filters = [
  { label: '최근 7일', icon: CalendarDays, active: true },
  { label: '결제 사칭', icon: ShoppingBag, active: false },
  { label: '택배 사칭', icon: Package, active: false },
]

const regions = [
  { name: '서울 강남구 역삼동', category: '결제 사칭', count: '25건', status: '위험 높음', danger: true },
  { name: '부산 해운대구 우동', category: '택배 사칭', count: '12건', status: '주의', danger: false },
  { name: '대전 서구 둔산동', category: '기관 사칭', count: '8건', status: '주의', danger: false },
]

export function RiskMapPage() {
  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="QUISHING MAP"
        title="큐싱 위험지도"
        description="지역별 신고와 위험 유형을 탐색하는 화면입니다. 현재 수치는 레이아웃 확인을 위한 예시 데이터입니다."
        backTo="/"
        action={<Badge variant="outline" className="hidden bg-white sm:inline-flex"><Info className="size-3.5" /> 예시 데이터</Badge>}
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:mb-5">
        {filters.map((filter) => (
          <Button
            key={filter.label}
            type="button"
            variant={filter.active ? 'default' : 'outline'}
            className="h-10 shrink-0 rounded-xl px-4 sm:h-11"
          >
            <filter.icon className="size-4" />
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <Card className="relative min-h-[500px] overflow-hidden border-white/85 bg-gradient-to-br from-[#eefcff] via-[#f7f8ff] to-[#eeeaff] backdrop-blur-xl sm:min-h-[620px] md:min-h-[670px]">
          <div className="absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_center,rgba(15,166,181,0.1)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-[#f1fbff] via-[#f3f9ff]/90 to-transparent p-5 pb-12 sm:p-7 sm:pb-16">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-primary">대한민국 위험 현황</p>
              <p className="mt-1 text-sm text-muted-foreground">최근 7일 · 화면 예시</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/80 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="mr-3 inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#3f9875]" /> 안전</span>
              <span className="mr-3 inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#f4a532]" /> 주의</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#ff675c]" /> 위험</span>
            </div>
          </div>
          <div className="absolute inset-5 top-20 sm:inset-10 sm:top-24">
            <KoreaRiskMap />
          </div>
          <div className="absolute bottom-5 left-5 rounded-2xl border border-white/90 bg-white/75 px-4 py-3 text-[11px] text-muted-foreground shadow-sm backdrop-blur sm:bottom-7 sm:left-7">
            <a href="https://github.com/VictorCazanave/svg-maps/tree/master/packages/south-korea" target="_blank" rel="noreferrer" className="underline decoration-primary/40 underline-offset-2">지도 데이터 CC BY 4.0</a>
            <span className="mx-1.5">·</span>수치는 예시입니다
          </div>
        </Card>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-white/85 bg-white/72 shadow-sm backdrop-blur-xl">
              <CardContent className="p-4 sm:p-5">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldAlert className="size-5" /></span>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">전체 신고</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.05em]">128<span className="ml-1 text-sm font-semibold">건</span></p>
              </CardContent>
            </Card>
            <Card className="border-white/85 bg-white/72 shadow-sm backdrop-blur-xl">
              <CardContent className="p-4 sm:p-5">
                <span className="grid size-10 place-items-center rounded-2xl bg-danger/10 text-danger"><TrendingUp className="size-5" /></span>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">고위험</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-danger">24<span className="ml-1 text-sm font-semibold">건</span></p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/85 bg-white/72 backdrop-blur-xl">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold tracking-[-0.03em]">최근 위험 지역</h2>
                  <p className="mt-1 text-xs text-muted-foreground">09:30 기준 · 예시 목록</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-xs text-primary">전체보기</Button>
              </div>
              <div className="space-y-2.5">
                {regions.map((region) => (
                  <div key={region.name} className="flex items-center gap-3 rounded-2xl bg-secondary/65 p-3.5">
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', region.danger ? 'bg-danger/10 text-danger' : 'bg-warning/15 text-[#c4770c]')}>
                      <MapPin className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{region.name}</strong>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{region.category} · {region.count}</span>
                    </div>
                    <Badge variant={region.danger ? 'danger' : 'warning'} className="shrink-0 px-2 py-1">{region.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between rounded-3xl border border-white/85 bg-white/60 p-5 text-foreground backdrop-blur-xl">
            <div>
              <p className="text-sm font-bold">내 주변 신고 확인</p>
              <p className="mt-1 text-xs text-muted-foreground">위치 기능을 연결할 수 있는 자리입니다.</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><ArrowUpRight className="size-5" /></span>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
