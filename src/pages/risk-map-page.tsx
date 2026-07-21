import { useEffect, useState } from 'react'
import { Info, Loader2, MapPin, ShieldAlert, TrendingUp } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { KoreaRiskMap } from '@/components/korea-risk-map'
import { PageHeading } from '@/components/page-heading'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getMapSummary, type MapSummaryResponse, type RegionLevel } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const PLACE_LABELS: Record<string, string> = {
  delivery: '배달', kickboard: '킥보드', flyer: '전단', charger: '충전기', table: '테이블', poster: '포스터', other: '기타',
}
const CATEGORY_LABELS: Record<string, string> = {
  fake_payment: '결제 사칭', fake_delivery: '택배 사칭', fake_gov: '기관 사칭', malware: '악성앱', other: '기타',
}
const LEVEL_META: Record<RegionLevel, { label: string; danger: boolean }> = {
  high: { label: '위험 높음', danger: true },
  mid: { label: '주의', danger: false },
  low: { label: '안전', danger: false },
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

const placeLabel = (p?: string) => (p ? PLACE_LABELS[p] ?? p : '')
const categoryLabel = (c?: string) => (c ? CATEGORY_LABELS[c] ?? c : '신고')

export function RiskMapPage() {
  const [data, setData] = useState<MapSummaryResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    getMapSummary()
      .then((d) => { if (alive) { setData(d); setState('ready') } })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [])

  const cells = data?.cells ?? []
  const regions = data?.regions ?? []
  const recent = data?.recent ?? []
  const placeTypes = Object.entries(data?.byPlaceType ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="QUISHING MAP"
        title="큐싱 위험지도"
        description="지역별 신고와 위험 유형을 실시간 집계로 보여줍니다. 정확 좌표는 저장하지 않고 구 단위로만 표시합니다."
        backTo="/scan"
        action={<Badge variant="outline" className="hidden bg-white sm:inline-flex"><Info className="size-3.5" /> 실시간 집계</Badge>}
      />

      {placeTypes.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:mb-5">
          {placeTypes.map(([type, count]) => (
            <span key={type} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/85 bg-white/70 px-4 text-sm font-semibold shadow-sm backdrop-blur">
              <MapPin className="size-4 text-primary" />{placeLabel(type)}
              <b className="text-primary">{count}</b>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <Card className="relative min-h-[500px] overflow-hidden border-white/85 bg-white/60 backdrop-blur-xl sm:min-h-[620px] md:min-h-[670px]">
          {state === 'loading' && (
            <div className="absolute inset-0 z-10 grid place-items-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>
          )}
          <div className="absolute inset-0">
            {state === 'error'
              ? <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">지도 데이터를 불러오지 못했습니다.<br />잠시 후 다시 시도해 주세요.</div>
              : <KoreaRiskMap cells={cells} />}
          </div>
        </Card>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-white/85 bg-white/72 shadow-sm backdrop-blur-xl">
              <CardContent className="p-4">
                <span className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldAlert className="size-4.5" /></span>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">전체 신고</p>
                <p className="mt-1 text-xl font-black tracking-[-0.05em] tabular-nums">{data?.total ?? '–'}</p>
              </CardContent>
            </Card>
            <Card className="border-white/85 bg-white/72 shadow-sm backdrop-blur-xl">
              <CardContent className="p-4">
                <span className="grid size-9 place-items-center rounded-2xl bg-warning/15 text-[#c4770c]"><TrendingUp className="size-4.5" /></span>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">이번 주</p>
                <p className="mt-1 text-xl font-black tracking-[-0.05em] tabular-nums">{data?.thisWeek ?? '–'}</p>
              </CardContent>
            </Card>
            <Card className="border-white/85 bg-white/72 shadow-sm backdrop-blur-xl">
              <CardContent className="p-4">
                <span className="grid size-9 place-items-center rounded-2xl bg-danger/10 text-danger"><ShieldAlert className="size-4.5" /></span>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">오늘 차단</p>
                <p className="mt-1 text-xl font-black tracking-[-0.05em] tabular-nums text-danger">{data?.blockedToday ?? '–'}</p>
              </CardContent>
            </Card>
          </div>

          {regions.length > 0 && (
            <Card className="border-white/85 bg-white/72 backdrop-blur-xl">
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-4 font-extrabold tracking-[-0.03em]">지역 랭킹</h2>
                <div className="space-y-2.5">
                  {regions.map((region) => {
                    const meta = LEVEL_META[region.level] ?? LEVEL_META.low
                    return (
                      <div key={region.regionCode} className="flex items-center gap-3 rounded-2xl bg-secondary/65 p-3.5">
                        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', meta.danger ? 'bg-danger/10 text-danger' : 'bg-warning/15 text-[#c4770c]')}>
                          <MapPin className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">{region.name}</strong>
                          <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">{region.count}건</span>
                        </div>
                        <Badge variant={meta.danger ? 'danger' : 'warning'} className="shrink-0 px-2 py-1">{meta.label}</Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {recent.length > 0 && (
            <Card className="border-white/85 bg-white/72 backdrop-blur-xl">
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-4 font-extrabold tracking-[-0.03em]">최근 신고</h2>
                <div className="space-y-2">
                  {recent.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <span className="size-2 shrink-0 rounded-full bg-danger" />
                      <span className="min-w-0 flex-1 truncate">
                        <b>{r.regionName ?? '어딘가'}</b>
                        <span className="text-muted-foreground"> · {categoryLabel(r.category)}{r.placeType ? ` · ${placeLabel(r.placeType)}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timeAgo(r.at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}
