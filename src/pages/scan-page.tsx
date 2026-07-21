import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Circle, FileImage, Link2, LoaderCircle, LockKeyhole, ScanLine, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import QrScanner from 'qr-scanner'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { QrArt } from '@/components/qr-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { verifyPayload } from '@/lib/verification'

const progressSteps = [
  { label: 'QR 주소 추출', detail: '사진 속 QR을 읽고 있어요.' },
  { label: '최종 목적지 확인', detail: '실제로 연결되는 주소를 따라가요.' },
  { label: '주소 위험 신호 검사', detail: '위장 주소와 이상한 연결을 찾아요.' },
  { label: '페이지 내용 분석', detail: '입력 폼과 유도 문구를 확인해요.' },
  { label: 'AI 최종 판독', detail: '발견한 신호를 종합하고 있어요.' },
]

export function ScanPage() {
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [payload, setPayload] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isReadingQr, setIsReadingQr] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const isBusy = isReadingQr || isLoading

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function runVerification(value: string, startIndex = 1) {
    const target = value.trim()
    if (!target || isLoading) return
    setError('')
    setIsLoading(true)
    setProgressIndex(startIndex)
    const timer = window.setInterval(() => setProgressIndex((current) => Math.min(current + 1, progressSteps.length - 1)), 1200)
    try {
      const result = await verifyPayload(target)
      navigate('/result', { state: { result } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '검증을 완료하지 못했습니다.')
    } finally {
      window.clearInterval(timer)
      setIsLoading(false)
    }
  }

  async function handleQrImage(file?: File) {
    if (!file) return
    setError('')
    setIsReadingQr(true)
    setProgressIndex(0)
    setPreviewUrl(URL.createObjectURL(file))
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      setPayload(result.data)
      setIsReadingQr(false)
      await runVerification(result.data, 1)
    } catch {
      setIsReadingQr(false)
      setError('이미지에서 QR 코드를 찾지 못했습니다. 선명한 이미지로 다시 시도해주세요.')
    }
  }

  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="QR CHECK"
        title="QR 진단"
        description="QR을 촬영하면 Gemini가 연결 주소를 열기 전에 먼저 확인합니다."
        backTo="/"
        action={<Badge className="hidden sm:inline-flex"><Zap className="size-3.5" /> Gemini AI 분석</Badge>}
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Card className="overflow-hidden border-white/85 bg-white/72 p-3 backdrop-blur-xl sm:p-5">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => cameraInputRef.current?.click()}
            className="relative block aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#26364e,#607188_52%,#27384d)] text-left transition-transform active:scale-[0.995] disabled:cursor-wait sm:aspect-[16/10]"
            aria-label="카메라로 QR 촬영하기"
          >
            <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_30%_20%,#b7dfff_0,transparent_28%),radial-gradient(circle_at_80%_70%,#cfc5ff_0,transparent_24%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,18,34,0.08),rgba(4,18,34,0.36))]" />
            <div className={`absolute left-1/2 top-1/2 grid size-44 -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-3xl border border-white/35 bg-white/90 shadow-2xl sm:size-56 lg:size-64 ${isBusy ? 'analysis-pulse' : ''}`}>
              {previewUrl
                ? <img src={previewUrl} alt="촬영한 QR" className="size-full object-cover" />
                : <div className="p-5 sm:p-7 lg:p-8"><QrArt /></div>}
              {isBusy && <div className="absolute inset-0 bg-[#10263b]/25 backdrop-saturate-150" />}
              {isBusy && <span className="analysis-scan-line absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#5ef4ee] to-transparent shadow-[0_0_18px_5px_rgba(94,244,238,0.72)]" />}
              {isBusy && <span className="absolute grid size-14 place-items-center rounded-full border border-white/45 bg-[#172b45]/65 text-white backdrop-blur-md"><LoaderCircle className="size-7 animate-spin" /></span>}
            </div>
            <div className="absolute inset-[8%] sm:inset-[10%]">
              <span className="absolute left-0 top-0 size-14 rounded-tl-2xl border-l-4 border-t-4 border-[#5ef4ee]" />
              <span className="absolute right-0 top-0 size-14 rounded-tr-2xl border-r-4 border-t-4 border-[#5ef4ee]" />
              <span className="absolute bottom-0 left-0 size-14 rounded-bl-2xl border-b-4 border-l-4 border-[#5ef4ee]" />
              <span className="absolute bottom-0 right-0 size-14 rounded-br-2xl border-b-4 border-r-4 border-[#5ef4ee]" />
              {!isBusy && <span className="absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#5ef4ee] to-transparent shadow-[0_0_20px_4px_rgba(94,244,238,0.7)]" />}
            </div>
            <div className="absolute inset-x-5 top-5 flex items-center justify-between text-white sm:inset-x-7 sm:top-7">
              <Badge className="bg-black/20 text-white backdrop-blur"><Camera className="size-3.5" /> 안전 진단</Badge>
              <span className="grid size-10 place-items-center rounded-full bg-black/20 backdrop-blur"><ShieldCheck className="size-5" /></span>
            </div>
            <div className="absolute inset-x-4 bottom-5 text-center text-white sm:bottom-7">
              <p key={progressIndex} className={`text-sm font-semibold sm:text-base ${isBusy ? 'analysis-status-pop' : ''}`}>{isBusy ? progressSteps[progressIndex].label : '화면을 눌러 QR을 촬영하세요'}</p>
              <p className="mt-1 text-xs text-white/65">{isBusy ? progressSteps[progressIndex].detail : '모바일에서는 후면 카메라가 바로 열립니다'}</p>
            </div>
          </button>
        </Card>

        <div className="space-y-5">
          <Card className="border-white/85 bg-white/72 backdrop-blur-xl">
            <CardHeader>
              <div className={`mb-2 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary ${isBusy ? 'analysis-pulse' : ''}`}>{isBusy ? <Sparkles /> : <ScanLine />}</div>
              <CardTitle>{isBusy ? '안전 진단 중' : '진단 시작'}</CardTitle>
              <CardDescription>{isBusy ? '페이지를 열지 말고 잠시만 기다려주세요.' : '카메라 촬영 또는 URL 입력 중 선택하세요.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => { void handleQrImage(event.target.files?.[0]); event.currentTarget.value = '' }}
              />
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void handleQrImage(event.target.files?.[0]); event.currentTarget.value = '' }} />

              {isBusy && (
                <div className="space-y-2.5 pb-1">
                  {progressSteps.map((step, index) => {
                    const isComplete = index < progressIndex
                    const isActive = index === progressIndex
                    return (
                      <div key={step.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${isActive ? 'translate-x-1 bg-primary/10' : 'bg-white/45'} ${index > progressIndex ? 'opacity-45' : ''}`}>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${isComplete ? 'bg-primary text-white' : isActive ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}>
                          {isComplete ? <Check className="size-4" /> : isActive ? <LoaderCircle className="size-4 animate-spin" /> : <Circle className="size-3" />}
                        </span>
                        <span><strong className="block text-xs">{step.label}</strong>{isActive && <span className="mt-0.5 block text-[11px] text-muted-foreground">{step.detail}</span>}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                disabled={isBusy}
                onClick={() => cameraInputRef.current?.click()}
                className="group flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-white/70 p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent disabled:opacity-50"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white"><Camera className="size-5" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">카메라로 QR 찍기</strong><span className="mt-0.5 block text-xs text-muted-foreground">누르면 후면 카메라가 바로 열려요.</span></span>
                <Camera className="size-4 text-muted-foreground" />
              </button>

              <button type="button" disabled={isBusy} onClick={() => galleryInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"><FileImage className="size-4" /> 앨범에서 QR 선택</button>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />또는<span className="h-px flex-1 bg-border" /></div>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold"><Link2 className="size-4 text-primary" /> URL 직접 입력</span>
                <input
                  value={payload}
                  disabled={isBusy}
                  onChange={(event) => setPayload(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void runVerification(payload) }}
                  placeholder="https://example.com"
                  className="h-12 w-full rounded-xl border border-border bg-white/80 px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
                />
              </label>
              <Button size="lg" disabled={!payload.trim() || isBusy} onClick={() => void runVerification(payload)} className="w-full">
                {isLoading ? <><LoaderCircle className="animate-spin" /> 검사 중</> : <><ShieldCheck /> 안전 진단하기</>}
              </Button>
              {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold leading-5 text-danger">{error}</p>}
            </CardContent>
          </Card>

          <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-[#edfcfb] to-[#f0efff] p-5">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/75 text-primary"><LockKeyhole className="size-5" /></span>
              <div><h3 className="text-sm font-bold">촬영 이미지는 기기에서만 읽어요</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">원본 이미지는 전송하지 않고, 추출된 주소만 Gemini가 분석합니다.</p></div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
