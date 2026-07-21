import { useEffect, useState } from 'react'
import { Info, Loader2, LocateFixed, MapPin, TriangleAlert } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { KoreaRiskMap } from '@/components/korea-risk-map'
import { PageHeading } from '@/components/page-heading'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getMapSummary, type MapSummaryResponse, type RegionLevel } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const PLACE_LABELS: Record<string, string> = {
  delivery: '배달', kickboard: '킥보드', flyer: '전단', charger: '충전기', table: '테이블', poster: '포스터', other: '기타',
}
const CATEGORY_LABELS: Record<string, string> = {
  fake_payment: '결제 사칭', fake_delivery: '택배 사칭', fake_gov: '기관 사칭', malware: '악성앱', other: '기타',
}
const LEVEL_STYLE: Record<RegionLevel, { bg: string; count: string }> = {
  high: { bg: 'bg-danger/10', count: 'text-danger' },
  mid: { bg: 'bg-warning/15', count: 'text-[#c4770c]' },
  low: { bg: 'bg-secondary/70', count: 'text-foreground' },
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
  const [activeType, setActiveType] = useState<string | null>(null)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  function locateMe() {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false) },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }

  useEffect(() => {
    let alive = true
    getMapSummary()
      .then((d) => { if (alive) { setData(d); setState('ready') } })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [])

  const allCells = data?.cells ?? []
  const cells = activeType ? allCells.filter((c) => c.topPlaceType === activeType) : allCells
  const regions = (data?.regions ?? []).slice(0, 9)
  const recent = (activeType ? (data?.recent ?? []).filter((r) => r.placeType === activeType) : (data?.recent ?? [])).slice(0, 8)
  const placeTypes = Object.entries(data?.byPlaceType ?? {}).sort((a, b) => b[1] - a[1])

  const stat = (label: string, value: number | undefined, accent?: string) => (
    <div className="rounded-2xl bg-secondary/60 p-3.5 text-center">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-black tracking-[-0.04em] tabular-nums sm:text-2xl', accent)}>{value ?? '–'}</p>
    </div>
  )

  return (
    <AppShell hideMobileHeader>
      <div className="mx-auto max-w-xl">
        <PageHeading
          eyebrow="QUISHING MAP"
          title="큐싱 위험지도"
          description="지역별 신고를 실시간 집계로 보여줍니다. 정확 좌표는 저장하지 않고 구 단위로만 표시합니다."
          backTo="/scan"
          action={<Badge variant="outline" className="hidden bg-white sm:inline-flex"><Info className="size-3.5" /> 실시간 집계</Badge>}
        />

        {/* 통계 3 타일 */}
        <Card className="border-white/85 bg-white/72 p-3 backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-2.5">
            {stat('총 신고', data?.total)}
            {stat('이번 주', data?.thisWeek, 'text-danger')}
            {stat('오늘 차단', data?.blockedToday, 'text-danger')}
          </div>
        </Card>

        {/* 필터 칩 (인터랙티브) */}
        {placeTypes.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {placeTypes.map(([type, count]) => {
              const active = activeType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(active ? null : type)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition',
                    active ? 'border-transparent bg-[#1b1f27] text-white' : 'border-white/85 bg-white/70 text-muted-foreground hover:bg-white',
                  )}
                >
                  <MapPin className={cn('size-3.5', active ? 'text-white' : 'text-primary')} />
                  {placeLabel(type)}
                  <span className={cn('tabular-nums', active ? 'text-white/85' : 'text-primary')}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* 지도 */}
        <Card className="relative mt-3 h-[300px] overflow-hidden border-white/85 bg-white/60 backdrop-blur-xl sm:h-[380px]">
          {state === 'loading' && <div className="absolute inset-0 z-10 grid place-items-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>}
          <div className="absolute inset-0">
            {state === 'error'
              ? <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">지도 데이터를 불러오지 못했습니다.</div>
              : state === 'ready' ? <KoreaRiskMap cells={cells} userLocation={userLoc} /> : null}
          </div>
          {state === 'ready' && (
            <button
              type="button"
              onClick={locateMe}
              className="absolute bottom-3 right-3 z-[500] inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white/90 px-3 py-2 text-xs font-semibold text-primary shadow-md backdrop-blur transition hover:bg-white"
              aria-label="내 위치 보기"
            >
              {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
              내 위치
            </button>
          )}
        </Card>

        {/* 지역 랭킹 — 3열 컴팩트 그리드 */}
        {regions.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">지역 랭킹</h2>
            <div className="grid grid-cols-3 gap-2">
              {regions.map((region) => {
                const s = LEVEL_STYLE[region.level] ?? LEVEL_STYLE.low
                return (
                  <div key={region.regionCode} className={cn('rounded-2xl p-2.5 text-center', s.bg)}>
                    <p className="truncate text-xs font-semibold text-foreground">{region.name}</p>
                    <p className={cn('mt-0.5 text-base font-black tabular-nums', s.count)}>{region.count}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 최근 신고 */}
        {recent.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">최근 신고 (익명)</h2>
            <Card className="divide-y divide-black/5 overflow-hidden border-white/85 bg-white/80 py-0 backdrop-blur-xl">
              {recent.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3">
                  <TriangleAlert className="size-4 shrink-0 text-danger" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    <b>{r.regionName ?? '어딘가'}</b>
                    <span className="text-muted-foreground"> · {categoryLabel(r.category)}{r.placeType ? ` · ${placeLabel(r.placeType)}` : ''}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">{timeAgo(r.at)}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  )
}
