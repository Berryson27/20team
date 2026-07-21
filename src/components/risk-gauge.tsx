import { useId } from 'react'

type RiskGaugeProps = {
  score?: number
  verdict?: 'safe' | 'warn' | 'danger'
  compact?: boolean
  tone?: 'default' | 'onColor'
}

const colors = {
  safe: { start: '#68d8ca', end: '#0fa6b5', track: '#e3f4f2', text: '#0fa6b5', label: '낮음' },
  warn: { start: '#ffd166', end: '#f4a532', track: '#f8efdc', text: '#c4770c', label: '주의' },
  danger: { start: '#ffb04d', end: '#ff4e58', track: '#f4e9e8', text: '#ff675c', label: '위험' },
}

export function RiskGauge({ score = 82, verdict = 'danger', compact = false, tone = 'default' }: RiskGaugeProps) {
  const gradientId = useId()
  const circumference = 2 * Math.PI * 58
  const offset = circumference - (score / 100) * circumference
  const palette = colors[verdict]
  const color = tone === 'onColor'
    ? { start: '#ffffff', end: '#ffffff', track: 'rgba(255,255,255,0.28)', text: '#ffffff', label: palette.label }
    : palette

  return (
    <div className={`relative grid shrink-0 place-items-center ${compact ? 'size-20 sm:size-24' : 'mx-auto size-40 sm:size-52 md:size-60'}`} aria-label={`위험 점수 ${score}점`}>
      {tone === 'default' && <div className="absolute inset-5 rounded-full opacity-15 blur-md" style={{ background: color.text }} />}
      <svg viewBox="0 0 140 140" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color.start} />
            <stop offset="100%" stopColor={color.end} />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r="58" fill="none" stroke={color.track} strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r="58"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="relative text-center">
        <strong className={`block font-black tracking-[-0.08em] ${compact ? 'text-2xl sm:text-3xl' : 'text-5xl sm:text-6xl md:text-7xl'}`} style={{ color: color.text }}>{score}</strong>
        <span className={`block font-bold ${compact ? 'text-[10px]' : 'mt-1 text-sm'}`} style={{ color: color.text }}>{color.label}</span>
      </div>
    </div>
  )
}
