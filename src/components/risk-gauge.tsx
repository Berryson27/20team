type RiskGaugeProps = {
  score?: number
}

export function RiskGauge({ score = 82 }: RiskGaugeProps) {
  const circumference = 2 * Math.PI * 58
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative mx-auto grid size-40 place-items-center sm:size-52 md:size-60" aria-label={`위험 점수 ${score}점`}>
      <div className="absolute inset-5 rounded-full bg-[radial-gradient(circle,rgba(255,112,99,0.13),transparent_65%)] blur-md" />
      <svg viewBox="0 0 140 140" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="risk-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb04d" />
            <stop offset="58%" stopColor="#ff7867" />
            <stop offset="100%" stopColor="#ff4e58" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r="58" fill="none" stroke="#f4e9e8" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r="58"
          fill="none"
          stroke="url(#risk-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="relative text-center">
        <strong className="block text-5xl font-black tracking-[-0.08em] text-danger sm:text-6xl md:text-7xl">{score}</strong>
        <span className="mt-1 block text-sm font-bold text-danger">위험</span>
      </div>
    </div>
  )
}
