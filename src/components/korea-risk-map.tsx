import southKorea from '@svg-maps/south-korea'

type MarkerLevel = 'safe' | 'warning' | 'danger'

const markers: Array<{ x: number; y: number; count: number; level: MarkerLevel }> = [
  { x: 285, y: 65, count: 3, level: 'safe' },
  { x: 335, y: 42, count: 7, level: 'warning' },
  { x: 388, y: 115, count: 8, level: 'safe' },
  { x: 145, y: 124, count: 15, level: 'warning' },
  { x: 255, y: 198, count: 21, level: 'danger' },
  { x: 104, y: 258, count: 5, level: 'safe' },
  { x: 400, y: 252, count: 9, level: 'safe' },
  { x: 166, y: 355, count: 4, level: 'safe' },
  { x: 350, y: 412, count: 16, level: 'danger' },
  { x: 94, y: 494, count: 2, level: 'safe' },
]

const markerColor: Record<MarkerLevel, string> = {
  danger: '#f45f50',
  warning: '#f19a2a',
  safe: '#4f9c80',
}

export function KoreaRiskMap() {
  return (
    <svg
      viewBox={southKorea.viewBox}
      className="h-full w-full"
      role="img"
      aria-label="대한민국 지역별 큐싱 위험 현황 예시 지도"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="risk-halo" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id="marker-shadow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#4b5b55" floodOpacity="0.18" />
        </filter>
      </defs>

      <g>
        {southKorea.locations
          .filter((location) => location.id !== 'jeju')
          .map((location) => (
            <path
              key={location.id}
              d={location.path}
              fill="#f8fbff"
              stroke="#d8e6ee"
              strokeWidth="1.3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </g>

      {markers.map((marker) => {
        const color = markerColor[marker.level]
        const radius = marker.count >= 20 ? 27 : marker.count >= 15 ? 23 : 19

        return (
          <g key={`${marker.x}-${marker.y}`} filter="url(#marker-shadow)">
            {marker.level === 'danger' && (
              <circle cx={marker.x} cy={marker.y} r={radius + 18} fill={color} opacity="0.16" filter="url(#risk-halo)" />
            )}
            <circle cx={marker.x} cy={marker.y} r={radius + 6} fill="white" opacity="0.92" />
            <circle cx={marker.x} cy={marker.y} r={radius} fill={color} />
            <text
              x={marker.x}
              y={marker.y + 5}
              textAnchor="middle"
              fill="white"
              fontSize={marker.count >= 10 ? 17 : 16}
              fontWeight="800"
              fontFamily="Pretendard, sans-serif"
            >
              {marker.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
