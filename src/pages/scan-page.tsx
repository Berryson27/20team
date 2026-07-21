import { ArrowRight, Camera, FileImage, Link2, LockKeyhole, ScanLine, ShieldCheck, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { QrArt } from '@/components/qr-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const options = [
  {
    icon: FileImage,
    title: '이미지에서 불러오기',
    description: '저장된 QR 이미지를 선택해요.',
  },
  {
    icon: Link2,
    title: 'URL 직접 입력',
    description: '알고 있는 주소를 직접 확인해요.',
  },
]

export function ScanPage() {
  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="QR CHECK"
        title="QR 진단"
        description="촬영 영역과 입력 방법을 먼저 설계했습니다. 실제 카메라·분석 기능은 이후 연결할 수 있습니다."
        backTo="/"
        action={<Badge className="hidden sm:inline-flex"><Zap className="size-3.5" /> 실시간 분석 준비</Badge>}
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="overflow-hidden border-white/85 bg-white/72 p-3 backdrop-blur-xl sm:p-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#26364e,#607188_52%,#27384d)] sm:aspect-[16/10]">
            <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_30%_20%,#b7dfff_0,transparent_28%),radial-gradient(circle_at_80%_70%,#cfc5ff_0,transparent_24%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,18,34,0.08),rgba(4,18,34,0.36))]" />
            <div className="absolute left-1/2 top-1/2 grid size-44 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border border-white/35 bg-white/90 p-5 shadow-2xl sm:size-56 sm:p-7 lg:size-64 lg:p-8">
              <QrArt />
            </div>

            <div className="absolute inset-[8%] sm:inset-[10%]">
              <span className="absolute left-0 top-0 size-14 rounded-tl-2xl border-l-4 border-t-4 border-[#5ef4ee]" />
              <span className="absolute right-0 top-0 size-14 rounded-tr-2xl border-r-4 border-t-4 border-[#5ef4ee]" />
              <span className="absolute bottom-0 left-0 size-14 rounded-bl-2xl border-b-4 border-l-4 border-[#5ef4ee]" />
              <span className="absolute bottom-0 right-0 size-14 rounded-br-2xl border-b-4 border-r-4 border-[#5ef4ee]" />
              <span className="absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#5ef4ee] to-transparent shadow-[0_0_20px_4px_rgba(94,244,238,0.7)]" />
            </div>

            <div className="absolute inset-x-5 top-5 flex items-center justify-between text-white sm:inset-x-7 sm:top-7">
              <Badge className="bg-black/20 text-white backdrop-blur"><Camera className="size-3.5" /> 카메라 화면 예시</Badge>
              <span className="grid size-10 place-items-center rounded-full bg-black/20 backdrop-blur"><Zap className="size-5" /></span>
            </div>
            <div className="absolute inset-x-4 bottom-5 text-center text-white sm:bottom-7">
              <p className="text-sm font-semibold sm:text-base">QR 코드를 프레임 안에 맞춰주세요</p>
              <p className="mt-1 text-xs text-white/65">카메라 연결 전 디자인 미리보기입니다</p>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="border-white/85 bg-white/72 backdrop-blur-xl">
            <CardHeader>
              <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><ScanLine /></div>
              <CardTitle>다른 방법으로 진단</CardTitle>
              <CardDescription>촬영이 어렵다면 이미지나 주소 입력을 이용할 수 있도록 자리를 마련했습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {options.map((option) => (
                <button key={option.title} type="button" className="group flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-white/70 p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-[#51617b]"><option.icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">{option.title}</strong>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-[#edfcfb] to-[#f0efff] p-5">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/75 text-primary"><LockKeyhole className="size-5" /></span>
              <div>
                <h3 className="text-sm font-bold">개인정보 보호를 먼저 고려했어요</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">향후 기능 연결 시에도 촬영 이미지를 최소한으로 처리하는 구조를 전제로 합니다.</p>
              </div>
            </div>
          </div>

          <Button asChild size="lg" className="w-full">
            <Link to="/result"><ShieldCheck /> 결과 화면 미리보기</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">현재 버튼은 디자인 화면 이동만 제공합니다.</p>
        </div>
      </div>
    </AppShell>
  )
}
