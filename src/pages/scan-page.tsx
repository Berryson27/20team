import { useEffect, useRef, useState } from 'react'
import { Images, LoaderCircle, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { QrArt } from '@/components/qr-art'
import { Button } from '@/components/ui/button'
import QrScanner from 'qr-scanner'

import { cn } from '@/lib/utils'
import { decodeQrImage } from '@/lib/qr-decoder'
import { verifyPayload } from '@/lib/verification'

type CameraState = 'starting' | 'active' | 'paused' | 'unavailable'

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const hwZoomRef = useRef(false)
  const hwZoomMaxRef = useRef(1)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const busyRef = useRef(false)
  const runRef = useRef<((value: string, startIndex?: number) => Promise<void>) | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('starting')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isReadingQr, setIsReadingQr] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [decodeMessage, setDecodeMessage] = useState(progressSteps[0].detail)
  const [progressDetail, setProgressDetail] = useState('')
  const zoomLevels = [1, 2, 3]
  const [zoom, setZoom] = useState(1)
  const [cssZoom, setCssZoom] = useState(1)
  const [flashSupported, setFlashSupported] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const isBusy = isReadingQr || isLoading

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
    const video = videoRef.current
    if (!video) return
    const stream = video.srcObject
    const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] ?? null : null
    trackRef.current = track
    const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min?: number; max?: number }; torch?: boolean }
    hwZoomRef.current = !!(caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > 1)
    hwZoomMaxRef.current = caps.zoom?.max ?? 1
    setFlashSupported(!!caps.torch)
    setFlashOn(false)
    setZoom(1)
    setCssZoom(1)
  }

  // 하드웨어 줌이 있으면 렌즈 줌을, 없으면(웹캠·에뮬레이터 등) 화면 디지털 줌으로 폴백한다.
  // 버튼(1/2/3×)과 손가락 핀치 양쪽에서 호출된다 — z 는 1~4 로 클램프.
  function applyZoom(z: number) {
    const clamped = Math.max(1, Math.min(4, z))
    setZoom(clamped)
    const track = trackRef.current
    if (hwZoomRef.current && track) {
      track.applyConstraints({ advanced: [{ zoom: Math.min(clamped, hwZoomMaxRef.current) }] } as unknown as MediaTrackConstraints)
        .then(() => setCssZoom(1))
        .catch(() => setCssZoom(clamped))
    } else {
      setCssZoom(clamped)
    }
  }

  // 두 손가락 핀치로 확대/축소.
  function pinchDist(t: React.TouchList) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  }
  function onCamTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) pinchRef.current = { dist: pinchDist(e.touches), zoom }
  }
  function onCamTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      applyZoom(pinchRef.current.zoom * (pinchDist(e.touches) / pinchRef.current.dist))
    }
  }
  function onCamTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null
  }

  async function toggleFlash() {
    const track = trackRef.current
    if (!track) return
    const next = !flashOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setFlashOn(next)
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
    setIsReadingQr(true)
    setProgressIndex(0)
    setDecodeMessage(progressSteps[0].detail)
    setPreviewUrl(URL.createObjectURL(file))
    try {
      const result = await decodeQrImage(file, setDecodeMessage)
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
      <div className="mx-auto flex min-h-[calc(100dvh-10.5rem)] max-w-xl flex-col gap-3 md:min-h-[calc(100dvh-8rem)]">
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

          <div className="px-1">
            <h1 className="text-lg font-extrabold tracking-[-0.03em] sm:text-xl">의심스러운 QR, 열기 전에 확인하세요</h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">QR을 카메라에 비추면 자동으로 인식해 안전한지 먼저 검사해요. 손가락으로 확대·축소할 수 있어요.</p>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => { if (cameraState !== 'active') cameraInputRef.current?.click() }}
            onTouchStart={onCamTouchStart}
            onTouchMove={onCamTouchMove}
            onTouchEnd={onCamTouchEnd}
            className="relative block min-h-60 w-full flex-1 touch-none overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#26364e,#607188_52%,#27384d)] text-left transition-transform active:scale-[0.995] disabled:cursor-wait"
            aria-label={cameraState === 'active' ? '카메라에 QR을 비춰주세요' : '카메라로 QR 촬영하기'}
          >
            <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_30%_20%,#b7dfff_0,transparent_28%),radial-gradient(circle_at_80%_70%,#cfc5ff_0,transparent_24%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,18,34,0.08),rgba(4,18,34,0.36))]" />
            {/* 디지털 줌은 비디오가 아닌 래퍼에 적용한다 — qr-scanner가 비디오에 건 미러 transform을 덮어써 반전되는 것을 막는다. */}
            <div
              className="absolute inset-0 overflow-hidden transition-transform duration-300"
              style={{ transform: cssZoom > 1 ? `scale(${cssZoom})` : undefined, transformOrigin: 'center center' }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                className={`size-full object-cover transition-opacity duration-300 ${cameraState === 'active' ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
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
            <div className={cn('absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-2xl sm:size-52', cameraState === 'active' && !isBusy && 'shadow-[0_0_0_9999px_rgba(4,18,34,0.5)]')}>
              <span className="absolute left-0 top-0 size-8 rounded-tl-xl border-l-2 border-t-2 border-white" />
              <span className="absolute right-0 top-0 size-8 rounded-tr-xl border-r-2 border-t-2 border-white" />
              <span className="absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-2 border-l-2 border-white" />
              <span className="absolute bottom-0 right-0 size-8 rounded-br-xl border-b-2 border-r-2 border-white" />
              {!isBusy && <span className="absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#8f7ff0] to-transparent shadow-[0_0_20px_4px_rgba(143,127,240,0.7)]" />}
            </div>

            {cameraState === 'active' && !isBusy && (
              <div className="absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-black/45 p-1 backdrop-blur" onClick={(e) => e.stopPropagation()}>
                {zoomLevels.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); applyZoom(z) }}
                    className={cn('grid h-7 min-w-9 place-items-center rounded-full px-2 text-xs font-bold transition', Math.round(zoom) === z ? 'bg-primary text-white' : 'text-white/90')}
                  >
                    {z}×
                  </button>
                ))}
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

          <div className="flex gap-2">
            {flashSupported && (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => void toggleFlash()}
                aria-pressed={flashOn}
                className={cn('h-11 shrink-0', flashOn && 'border-primary text-primary')}
              >
                <Zap className="size-4" /> 플래시
              </Button>
            )}
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => galleryInputRef.current?.click()}
              className="h-11 flex-1"
            >
              <Images className="size-4" /> 앨범에서 QR 이미지 선택
            </Button>
          </div>

          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold leading-5 text-danger">{error}</p>}
      </div>
    </AppShell>
  )
}
