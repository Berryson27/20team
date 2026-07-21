// 수정 전 verification.ts의 로컬 신호(구 R: http 8 / xn-- 25 / IP 20 / 위험TLD 8, APK 95)만으로
// 동일 데이터셋을 채점한 기준값 측정용. Gemini 신호는 오프라인에서 재현 불가하므로 제외.
// 실행: node --experimental-strip-types scripts/benchmark-old.ts

import { samples } from './benchmark.ts'

const RISKY_TLDS = new Set(['xyz', 'top', 'click', 'zip', 'mov', 'shop'])

function oldLocalScore(rawUrl: string): number {
  if (/\.apk(?:$|[?#])/i.test(rawUrl)) return 95
  const url = new URL(rawUrl)
  const host = url.hostname.toLowerCase()
  const tld = host.split('.').at(-1)
  let score = 0
  if (url.protocol === 'http:') score += 8
  if (host.includes('xn--')) score += 25
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) score += 20
  if (tld && RISKY_TLDS.has(tld)) score += 8
  return Math.min(score, 100)
}

let correct = 0
let phishHit = 0
let benignPass = 0
const phishTotal = samples.filter((sample) => sample.label === 'phish').length
const benignTotal = samples.length - phishTotal

for (const sample of samples) {
  const score = oldLocalScore(sample.url)
  const detected = score >= 40
  const ok = sample.label === 'phish' ? detected : !detected
  if (ok) correct += 1
  if (sample.label === 'phish' && detected) phishHit += 1
  if (sample.label === 'benign' && !detected) benignPass += 1
}

console.log(`[구 로직 기준값] 총 ${samples.length}건 — 정확도 ${(correct / samples.length * 100).toFixed(1)}%`)
console.log(`피싱 탐지율: ${(phishHit / phishTotal * 100).toFixed(1)}% (${phishHit}/${phishTotal})`)
console.log(`정상 통과율: ${(benignPass / benignTotal * 100).toFixed(1)}% (${benignPass}/${benignTotal})`)
