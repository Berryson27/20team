import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Lock } from 'lucide-react'

import type { MapCell } from '@/lib/api-client'

// cells 없을 때 폴백용 서울 주요 6개 구 중심
const SEOUL_FALLBACK: Array<{ name: string; lat: number; lng: number; count: number }> = [
  { name: '강남구', lat: 37.5172, lng: 127.0473, count: 0 },
  { name: '서초구', lat: 37.4837, lng: 127.0324, count: 0 },
  { name: '송파구', lat: 37.5145, lng: 127.1059, count: 0 },
  { name: '마포구', lat: 37.5638, lng: 126.9084, count: 0 },
  { name: '영등포구', lat: 37.5264, lng: 126.8963, count: 0 },
  { name: '중구', lat: 37.5636, lng: 126.9976, count: 0 },
]

function cellColor(count: number): string {
  if (count >= 25) return '#ff675c'
  if (count >= 12) return '#f4a532'
  return '#5b6bd8'
}

export function KoreaRiskMap({ cells, userLocation }: { cells: MapCell[]; userLocation?: { lat: number; lng: number } | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const userMarkerRef = useRef<L.LayerGroup | null>(null)

  // 지도 1회 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [37.5405, 126.986],
      zoom: 11,
      scrollWheelZoom: false,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // 마커 갱신
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()

    if (cells.length > 0) {
      for (const c of cells) {
        const color = cellColor(c.count)
        L.circle([c.lat, c.lng], {
          radius: Math.min(140 + c.count * 22, 850),
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.28,
        })
          .bindTooltip(`${c.count}건 · ${c.topPlaceType ?? ''}`, { direction: 'top' })
          .addTo(layer)
      }
    } else {
      for (const g of SEOUL_FALLBACK) {
        L.marker([g.lat, g.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:#5b6bd8;color:#fff;font-weight:800;font-size:11px;padding:2px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2)">${g.name}</div>`,
          }),
        }).addTo(layer)
      }
    }
  }, [cells])

  // 내 위치 마커 + 해당 위치로 이동
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null }
    if (!userLocation) return
    const group = L.layerGroup().addTo(map)
    L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1,
    }).bindTooltip('내 위치', { direction: 'top' }).addTo(group)
    L.circle([userLocation.lat, userLocation.lng], {
      radius: 400, color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.1,
    }).addTo(group)
    userMarkerRef.current = group
    map.setView([userLocation.lat, userLocation.lng], 14)
  }, [userLocation])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-2xl [&_.leaflet-container]:rounded-2xl" />
      {/* 색상 범례 (건수 기준) — Leaflet +/- 컨트롤(좌상단)과 겹치지 않게 우상단 배치 */}
      <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col gap-1 rounded-xl border border-white/90 bg-white/90 px-2.5 py-2 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#ff675c]" /> 위험 25건+</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#f4a532]" /> 주의 12~24건</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#5b6bd8]" /> 안전 12건 미만</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
        <Lock className="size-3" /> 구 단위 히트맵 · 정확 좌표 미저장
      </div>
    </div>
  )
}
