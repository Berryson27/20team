import { cn } from '@/lib/utils'

const pixels = [
  [54, 12], [66, 12], [78, 12], [54, 24], [78, 24], [54, 36], [66, 36], [78, 36],
  [12, 54], [24, 54], [36, 54], [60, 54], [84, 54], [96, 54],
  [12, 66], [36, 66], [48, 66], [60, 66], [72, 66], [96, 66],
  [12, 78], [24, 78], [48, 78], [72, 78], [84, 78], [96, 78],
  [54, 90], [66, 90], [78, 90], [90, 90], [54, 102], [78, 102], [102, 102],
]

type QrArtProps = {
  className?: string
  inverted?: boolean
}

export function QrArt({ className, inverted = false }: QrArtProps) {
  const ink = inverted ? '#ffffff' : '#15304d'

  return (
    <svg viewBox="0 0 120 120" className={cn('size-full', className)} role="img" aria-label="QR 코드 예시 그래픽">
      <g fill="none" stroke={ink} strokeWidth="7">
        <rect x="10" y="10" width="32" height="32" rx="3" />
        <rect x="78" y="10" width="32" height="32" rx="3" />
        <rect x="10" y="78" width="32" height="32" rx="3" />
      </g>
      <g fill={ink}>
        <rect x="20" y="20" width="12" height="12" rx="2" />
        <rect x="88" y="20" width="12" height="12" rx="2" />
        <rect x="20" y="88" width="12" height="12" rx="2" />
        {pixels.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="1.5" />
        ))}
      </g>
    </svg>
  )
}
