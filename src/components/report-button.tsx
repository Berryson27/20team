import { useState } from 'react'
import { Check, MapPinned } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { postReport, type ServerThreatType } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const PLACE_TYPES: Array<{ id: string; label: string }> = [
  { id: 'delivery', label: '배달' },
  { id: 'kickboard', label: '킥보드' },
  { id: 'flyer', label: '전단' },
  { id: 'charger', label: '충전기' },
  { id: 'table', label: '테이블' },
  { id: 'other', label: '기타' },
]

function categoryFor(t: ServerThreatType): string {
  switch (t) {
    case 'card_theft':
    case 'account_transfer':
    case 'credential':
      return 'fake_payment'
    case 'apk_install':
      return 'malware'
    case 'forgery':
      return 'fake_gov'
    default:
      return 'other'
  }
}

function getGeo(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000, maximumAge: 60000 },
    )
  })
}

export function ReportButton({ threatType, verifyId }: { threatType: ServerThreatType; verifyId?: string }) {
  const [place, setPlace] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit() {
    if (!place || state === 'sending') return
    setState('sending')
    try {
      const geo = await getGeo()
      await postReport({ category: categoryFor(threatType), placeType: place, verifyId, geo })
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary">
        <Check className="size-4" /> 신고가 지도에 반영됐어요. 감사합니다!
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-white/70 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <MapPinned className="size-3.5 text-primary" /> 이 위험을 신고해 지도에 알리기
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">장소 유형을 선택하세요. 위치는 구 단위로만 집계되고 정확 좌표는 저장하지 않습니다.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PLACE_TYPES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlace(p.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition',
              place === p.id ? 'border-primary bg-primary text-white' : 'border-white/80 bg-secondary/60 text-muted-foreground hover:bg-secondary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Button
        type="button"
        onClick={submit}
        disabled={!place || state === 'sending'}
        className="mt-3 h-10 w-full rounded-xl"
      >
        {state === 'sending' ? '전송 중…' : state === 'error' ? '실패 — 다시 시도' : '신고하기'}
      </Button>
    </div>
  )
}
