import { ArrowRight, Bell, CheckCircle2, Clock3, LockKeyhole, ScanLine, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { QrArt } from '@/components/qr-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const process = [
  { step: '01', title: 'QR 확인', description: '촬영·이미지·URL 중 편한 방법으로 확인해요.' },
  { step: '02', title: '위험 신호 분석', description: '도메인과 연결 경로, 결제 유도를 살펴봐요.' },
  { step: '03', title: '대응 방법 안내', description: '판단 근거와 지금 해야 할 일을 정리해요.' },
]

export function HomePage() {
  return (
    <AppShell>
      <section className="grid items-center gap-5 sm:gap-8 lg:min-h-[620px] lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
        <div className="max-w-2xl">
          <Badge className="mb-5 hidden bg-white/75 shadow-sm backdrop-blur sm:inline-flex">
            <Sparkles className="size-3.5" />
            금융사기 위험 신호를 한눈에
          </Badge>
          <h1 className="text-[2.2rem] font-black leading-[1.08] tracking-[-0.065em] text-[#112944] sm:text-6xl lg:text-[4.4rem]">
            QR, 찍기 전에
            <span className="mt-1 block bg-gradient-to-r from-[#0fa6b5] via-[#6f8fe8] to-[#9b7be8] bg-clip-text text-transparent">
              먼저 확인하세요
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
            낯선 QR이 연결하는 주소와 결제 경로를 살펴보고, 의심 신호와 대응 방법을 이해하기 쉽게 보여드려요.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:gap-3">
            <Button asChild className="h-12 px-3 sm:h-14 sm:min-w-48 sm:px-7 sm:text-base">
              <Link to="/scan">
                <ScanLine className="size-5" />
                QR 진단 시작
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 px-3 sm:h-14 sm:min-w-40 sm:px-7 sm:text-base">
              <Link to="/map">
                위험지도 보기
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="mt-7 hidden flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground sm:flex">
            <span className="flex items-center gap-2"><LockKeyhole className="size-4 text-primary" /> 촬영 이미지 미저장</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> 판단 근거 함께 제공</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[590px]">
          <div className="absolute -inset-5 rounded-[48px] bg-gradient-to-br from-[#bff8ff]/55 via-white/20 to-[#ded5ff]/60 blur-2xl" />
          <Card className="relative overflow-hidden border-white/85 bg-white/72 p-2.5 backdrop-blur-xl sm:p-5">
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#eefcff] via-[#f7f8ff] to-[#eeeaff] p-4 sm:rounded-[26px] sm:p-8">
              <div className="absolute -right-16 -top-20 size-64 rounded-full border border-white/80 bg-white/35" />
              <div className="absolute -bottom-20 -left-12 size-56 rounded-full bg-[#b9f6f3]/40 blur-2xl" />

              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-[0.12em] text-primary">QUICK SCAN</p>
                  <h2 className="mt-1 text-base font-extrabold tracking-[-0.04em] text-[#18314e] sm:mt-2 sm:text-xl">안전한 연결인지 확인해 볼까요?</h2>
                </div>
                <span className="grid size-11 place-items-center rounded-2xl bg-white/80 text-primary shadow-sm"><ShieldCheck /></span>
              </div>

              <div className="relative mx-auto my-4 grid aspect-square w-[min(55%,190px)] place-items-center rounded-[30px] border border-white bg-white/68 shadow-[0_24px_70px_rgba(69,100,150,0.12)] sm:my-8 sm:w-[min(68%,260px)] sm:rounded-[36px]">
                <div className="absolute inset-5 rounded-[28px] border border-dashed border-primary/20" />
                <div className="absolute left-6 top-6 size-9 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary" />
                <div className="absolute right-6 top-6 size-9 rounded-tr-xl border-r-[3px] border-t-[3px] border-primary" />
                <div className="absolute bottom-6 left-6 size-9 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
                <div className="absolute bottom-6 right-6 size-9 rounded-br-xl border-b-[3px] border-r-[3px] border-primary" />
                <QrArt className="size-24 drop-shadow-sm sm:size-36" />
                <div className="absolute inset-x-9 top-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_14px_2px_rgba(15,166,181,0.45)]" />
              </div>

              <Button asChild className="relative h-12 w-full sm:h-14 sm:text-base">
                <Link to="/scan"><ScanLine /> QR 진단하기</Link>
              </Button>
            </div>

            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/90 bg-white/72 p-3 sm:mt-3 sm:p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger"><Bell className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">최근 위험 알림</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">결제 사칭 QR 신고가 증가하고 있어요.</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex"><Clock3 className="size-3" /> 예시 데이터</span>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-14 border-t border-white/80 pt-10 lg:mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">HOW IT WORKS</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">세 단계로 빠르게 확인해요</h2>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">현재는 화면 디자인용 예시입니다.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {process.map((item) => (
            <Card key={item.step} className="border-white/80 bg-white/62 backdrop-blur">
              <CardContent className="p-5 sm:p-6">
                <span className="text-xs font-black tracking-[0.14em] text-primary/70">{item.step}</span>
                <h3 className="mt-3 font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  )
}
