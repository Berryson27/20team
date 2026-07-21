import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ChevronRight, Clock3, Images, LoaderCircle, LockKeyhole, ShieldCheck, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { QrArt } from '@/components/qr-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QrScanner from 'qr-scanner'

import { cn } from '@/lib/utils'
import { decodeQrImage } from '@/lib/qr-decoder'
import { readHistory, verifyPayload } from '@/lib/verification'

type CameraState = 'starting' | 'active' | 'paused' | 'unavailable'

const verdictDot = { safe: 'bg-primary', warn: 'bg-warning', danger: 'bg-danger' }
const verdictLabel = { safe: '낮음', warn: '주의', danger: '위험' }

function formatCheckedAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}.${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const progressSteps = [
  { label: 'QR 주소 추출', detail: '사진 속 QR을 읽고 있어요.' },
  { label: '최종 목적지 확인', detail: '실제로 연결되는 주소를 따라가요.' },
  { label: '주소 위험 신호 검사', detail: '위장 주소와 이상한 연결을 찾아요.' },
  { label: '페이지 내용 분석', detail: '입력 폼과 유도 문구를 확인해요.' },
  { label: 'AI 최종 판독', detail: '발견한 신호를 종합하고 있어요.' },
]

function isHttpUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol)
  } catch {
    return false
  }
}

export function ScanPage() {
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const hwZoomRef = useRef(false)
  const busyRef = useRef(false)
  const runRef = useRef<((value: string, startIndex?: number) => Promise<void>) | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('starting')
  const [payload, setPayload] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isReadingQr, setIsReadingQr] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [decodeMessage, setDecodeMessage] = useState(progressSteps[0].detail)
  const [progressDetail, setProgressDetail] = useState('')
  const [history] = useState(() => readHistory())
  const [showAllHistory, setShowAllHistory] = useState(false)
  const zoomLevels = [1, 2, 3]
  const [zoom, setZoom] = useState(1)
  const [cssZoom, setCssZoom] = useState(1)
  const [flashSupported, setFlashSupported] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const visibleHistory = showAllHistory ? history : history.slice(0, 1)
  const isBusy = isReadingQr || isLoading
  const canVerifyUrl = isHttpUrl(payload)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // 페이지 진입 시 카메라를 바로 켜고 QR을 실시간 인식한다. 권한 거부·카메라 없음이면 촬영 방식으로 폴백.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const scanner = new QrScanner(
      video,
      (result) => {
        if (busyRef.current || !result.data) return
        scanner.stop()
        setCameraState('paused')
        setPayload(result.data)
        void runRef.current?.(result.data, 1)
      },
      { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 6, highlightScanRegion: false },
    )
    scannerRef.current = scanner
    scanner.start()
      .then(() => { setCameraState('active'); void detectCameraControls() })
      .catch(() => setCameraState('unavailable'))
    return () => {
      scannerRef.current = null
      trackRef.current = null
      scanner.destroy()
    }
  }, [])

  // 카메라 시작 후 줌/플래시 지원 여부를 감지한다 (미지원이면 컨트롤을 숨긴다).
  async function detectCameraControls() {
    const scanner = scannerRef.current
    const video = videoRef.current
    if (!scanner || !video) return
    try { setFlashSupported(await scanner.hasFlash()) } catch { setFlashSupported(false) }
    const stream = video.srcObject
    const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] ?? null : null
    trackRef.current = track
    const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min?: number; max?: number } }
    hwZoomRef.current = !!(caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > 1)
    setZoom(1)
    setCssZoom(1)
  }

  // 하드웨어 줌이 있으면 렌즈 줌을, 없으면(웹캠·에뮬레이터 등) 화면 디지털 줌으로 폴백한다.
  function applyZoom(z: number) {
    setZoom(z)
    const track = trackRef.current
    if (hwZoomRef.current && track) {
      track.applyConstraints({ advanced: [{ zoom: z }] } as unknown as MediaTrackConstraints)
        .then(() => setCssZoom(1))
        .catch(() => setCssZoom(z))
    } else {
      setCssZoom(z)
    }
  }

  async function toggleFlash() {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      await scanner.toggleFlash()
      setFlashOn(scanner.isFlashOn())
    } catch { /* 미지원/실패 무시 */ }
  }

  function resumeCamera() {
    const scanner = scannerRef.current
    if (!scanner) return
    setCameraState('starting')
    scanner.start()
      .then(() => { setCameraState('active'); void detectCameraControls() })
      .catch(() => setCameraState('unavailable'))
  }

  async function runVerification(value: string, startIndex = 1) {
    const target = value.trim()
    if (!target || isLoading) return
    busyRef.current = true
    setError('')
    setIsLoading(true)
    setProgressIndex(startIndex)
    setProgressDetail('')
    try {
      // 진행 표시는 타이머 연출이 아니라 실제 검사 단계 이벤트를 따른다.
      const result = await verifyPayload(target, (event) => {
        if (event.step === 'domain') {
          setProgressIndex(2)
          setProgressDetail(event.detail ?? '')
        } else if (event.step === 'ai') {
          setProgressIndex(3)
          setProgressDetail('')
        } else if (event.step === 'judge') {
          setProgressIndex(4)
          setProgressDetail('')
        }
      })
      navigate('/result', { state: { result } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '검증을 완료하지 못했습니다.')
      if (cameraState !== 'unavailable') resumeCamera()
    } finally {
      busyRef.current = false
      setIsLoading(false)
    }
  }
  useEffect(() => {
    runRef.current = runVerification
  })

  async function handleQrImage(file?: File) {
    if (!file) return
    busyRef.current = true
    setError('')
    setPayload('')
    setIsReadingQr(true)
    setProgressIndex(0)
    setDecodeMessage(progressSteps[0].detail)
    setPreviewUrl(URL.createObjectURL(file))
    try {
      const result = await decodeQrImage(file, setDecodeMessage)
      setPayload(result.data)
      setIsReadingQr(false)
      await runVerification(result.data, 1)
    } catch {
      busyRef.current = false
      setIsReadingQr(false)
      setError('이미지에서 QR 코드를 찾지 못했습니다. 선명한 이미지로 다시 시도해주세요.')
    }
  }

  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="QR CHECK"
        title="QR 진단"
        description="카메라에 QR을 비추면 연결 주소를 열기 전에 먼저 확인합니다."
        action={<Badge className="hidden sm:inline-flex"><Zap className="size-3.5" /> Gemini AI 분석</Badge>}
      />

      <Card className="mx-auto flex min-h-[calc(100dvh-13rem)] max-w-3xl overflow-hidden border-white/85 bg-white/72 p-3 backdrop-blur-xl md:min-h-0 md:p-4">
        <CardContent className="flex flex-1 flex-col gap-3 p-0">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => { void handleQrImage(event.target.files?.[0]); event.currentTarget.value = '' }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => { void handleQrImage(event.target.files?.[0]); event.currentTarget.value = '' }}
          />

          <div className="px-1 pt-1">
            <h2 className="text-base font-extrabold tracking-[-0.03em]">의심스러운 QR, 열기 전에 확인하세요</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">카메라에 QR을 비추면 자동으로 인식해 분석하고, 주소는 아래에 직접 입력할 수 있어요.</p>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => { if (cameraState !== 'active') cameraInputRef.current?.click() }}
            className="relative block min-h-60 w-full flex-1 overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#26364e,#607188_52%,#27384d)] text-left transition-transform active:scale-[0.995] disabled:cursor-wait md:h-72 md:flex-none"
            aria-label={cameraState === 'active' ? '카메라에 QR을 비춰주세요' : '카메라로 QR 촬영하기'}
          >
            <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_30%_20%,#b7dfff_0,transparent_28%),radial-gradient(circle_at_80%_70%,#cfc5ff_0,transparent_24%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,18,34,0.08),rgba(4,18,34,0.36))]" />
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ transform: cssZoom > 1 ? `scale(${cssZoom})` : undefined }}
              className={`absolute inset-0 size-full object-cover transition-[transform,opacity] duration-300 ${cameraState === 'active' ? 'opacity-100' : 'opacity-0'}`}
            />
            {(cameraState !== 'active' || isBusy) && (
            <div className={`absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-2xl border border-white/35 bg-white/90 shadow-2xl sm:size-36 ${isBusy ? 'analysis-pulse' : ''}`}>
              {previewUrl
                ? <img src={previewUrl} alt="촬영한 QR" className="size-full object-cover" />
                : <div className="p-4 sm:p-5"><QrArt /></div>}
              {isBusy && <div className="absolute inset-0 bg-[#10263b]/25 backdrop-saturate-150" />}
              {isBusy && <span className="analysis-scan-line absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#5ef4ee] to-transparent shadow-[0_0_18px_5px_rgba(94,244,238,0.72)]" />}
              {isBusy && <span className="absolute grid size-11 place-items-center rounded-full border border-white/45 bg-[#172b45]/65 text-white backdrop-blur-md"><LoaderCircle className="size-5 animate-spin" /></span>}
            </div>
            )}
            <div className="absolute left-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 sm:size-44">
              <span className="absolute left-0 top-0 size-8 rounded-tl-xl border-l-2 border-t-2 border-[#5ef4ee]" />
              <span className="absolute right-0 top-0 size-8 rounded-tr-xl border-r-2 border-t-2 border-[#5ef4ee]" />
              <span className="absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-2 border-l-2 border-[#5ef4ee]" />
              <span className="absolute bottom-0 right-0 size-8 rounded-br-xl border-b-2 border-r-2 border-[#5ef4ee]" />
              {!isBusy && <span className="absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#5ef4ee] to-transparent shadow-[0_0_20px_4px_rgba(94,244,238,0.7)]" />}
            </div>
            <div className="absolute inset-x-4 top-4 flex items-center justify-between text-white">
              <Badge className="bg-black/20 text-white backdrop-blur"><Camera className="size-3.5" /> 안전 진단</Badge>
              <span className="grid size-8 place-items-center rounded-full bg-black/20 backdrop-blur"><ShieldCheck className="size-4" /></span>
            </div>

            {cameraState === 'active' && !isBusy && (flashSupported || zoomLevels.length > 1) && (
              <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {flashSupported && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void toggleFlash() }}
                    aria-label="플래시"
                    aria-pressed={flashOn}
                    className={cn('grid size-9 place-items-center rounded-full backdrop-blur transition', flashOn ? 'bg-white text-[#172b45]' : 'bg-black/35 text-white')}
                  >
                    <Zap className="size-4" />
                  </button>
                )}
                {zoomLevels.length > 1 && (
                  <div className="flex flex-col overflow-hidden rounded-full bg-black/35 backdrop-blur">
                    {zoomLevels.map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); applyZoom(z) }}
                        className={cn('grid size-9 place-items-center text-xs font-bold transition', zoom === z ? 'bg-white text-[#172b45]' : 'text-white')}
                      >
                        {z}×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="absolute inset-x-4 bottom-3 text-center text-white sm:bottom-4">
              <p key={progressIndex} className={`text-xs font-semibold sm:text-sm ${isBusy ? 'analysis-status-pop' : ''}`}>
                {isBusy
                  ? progressSteps[progressIndex].label
                  : cameraState === 'active' ? '카메라에 QR을 비춰주세요'
                    : cameraState === 'starting' ? '카메라 준비 중…'
                      : cameraState === 'paused' ? 'QR 인식 완료'
                        : '눌러서 QR 촬영'}
              </p>
              {isBusy && <p className="mt-0.5 text-[11px] text-white/65">{progressIndex === 0 ? decodeMessage : progressDetail || progressSteps[progressIndex].detail}</p>}
              {!isBusy && cameraState === 'unavailable' && <p className="mt-0.5 text-[11px] text-white/65">카메라를 사용할 수 없어 촬영·앨범 방식으로 동작해요.</p>}
            </div>
          </button>

          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => galleryInputRef.current?.click()}
            className="h-11 w-full"
          >
            <Images className="size-4" /> 앨범에서 QR 이미지 선택
          </Button>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              type="url"
              inputMode="url"
              aria-label="진단할 URL"
              value={payload}
              disabled={isBusy}
              onChange={(event) => setPayload(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && canVerifyUrl) void runVerification(payload) }}
              placeholder="https://example.com"
              className="h-11 min-w-0 rounded-xl border border-border bg-white/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 sm:px-4"
            />
            <Button disabled={!canVerifyUrl || isBusy} onClick={() => void runVerification(payload)} className="h-11 px-3 sm:px-5">
              {isLoading ? <><LoaderCircle className="animate-spin" /> 검사 중</> : <><ShieldCheck /> 안전 진단</>}
            </Button>
          </div>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold leading-5 text-danger">{error}</p>}

          {history.length > 0 && (
            <div className="rounded-2xl bg-secondary/50 p-2.5">
              <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-bold tracking-[0.06em] text-muted-foreground"><Clock3 className="size-3" /> 최근 검사</p>
              <div className="space-y-1">
                {visibleHistory.map((entry) => (
                  <button
                    key={entry.checkedAt}
                    type="button"
                    disabled={isBusy}
                    onClick={() => navigate('/result', { state: { result: entry.result } })}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-white/75 px-3 py-2 text-left transition hover:bg-white disabled:opacity-50"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${verdictDot[entry.verdict]}`} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{entry.host}</span>
                    <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{entry.score}점 · {verdictLabel[entry.verdict]}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/70">{formatCheckedAt(entry.checkedAt)}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                  </button>
                ))}
              </div>
              {history.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllHistory((current) => !current)}
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-bold text-primary transition hover:bg-white/60"
                >
                  {showAllHistory ? '접기' : `이전 검사 ${history.length - 1}건 더 보기`}
                  <ChevronDown className={`size-3.5 transition-transform ${showAllHistory ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-primary/7 px-3.5 py-3 text-muted-foreground">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-primary shadow-sm"><LockKeyhole className="size-4" /></span>
            <p className="text-[11px] leading-4"><strong className="block text-xs text-foreground">촬영 이미지는 기기에서만 읽어요</strong>QR에서 추출한 주소만 안전 진단에 사용합니다.</p>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
