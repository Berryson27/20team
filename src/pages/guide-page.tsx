import { Building2, Link2Off, LockKeyhole, PhoneCall, ShieldCheck } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent } from '@/components/ui/card'

const guides = [
  {
    icon: Link2Off,
    title: '링크를 열지 않기',
    description: '출처가 불분명한 QR은 바로 접속하지 말고 주소를 먼저 확인하세요.',
  },
  {
    icon: LockKeyhole,
    title: '정보를 입력하지 않기',
    description: '비밀번호나 카드번호를 요구한다면 입력을 멈추고 공식 경로를 이용하세요.',
  },
  {
    icon: Building2,
    title: '공식 채널로 확인하기',
    description: '기관의 공식 앱이나 홈페이지, 대표 연락처를 통해 사실 여부를 확인하세요.',
  },
]

export function GuidePage() {
  return (
    <AppShell hideMobileHeader>
      <PageHeading
        eyebrow="SAFETY GUIDE"
        title="큐싱 예방가이드"
        description="진단 전후에 사용자가 바로 실천할 수 있는 안전 수칙을 담는 공간입니다."
        backTo="/"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {guides.map((guide, index) => (
          <Card key={guide.title} className="border-white/85 bg-white/72 backdrop-blur-xl">
            <CardContent className="p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#dffcff] to-[#ece9ff] text-primary"><guide.icon /></span>
                <span className="text-xs font-black tracking-[0.15em] text-primary/50">0{index + 1}</span>
              </div>
              <h2 className="mt-6 text-lg font-extrabold tracking-[-0.035em]">{guide.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden border-white/85 bg-[#172d49] text-white">
        <CardContent className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#65e2da]"><ShieldCheck /></span>
            <div>
              <h2 className="text-lg font-bold">이미 접속했거나 정보를 입력했나요?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">지체할수록 피해가 커집니다. 은행·카드사에 지급정지를 요청하고, 아래 번호로 바로 신고하세요.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-56">
            {[
              { name: '경찰청 사이버범죄', tel: '112' },
              { name: '금융감독원 지급정지', tel: '1332' },
              { name: 'KISA 침해대응센터', tel: '118' },
            ].map((hotline) => (
              <a
                key={hotline.tel}
                href={`tel:${hotline.tel}`}
                className="inline-flex h-11 items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/20"
              >
                <span className="text-white/70">{hotline.name}</span>
                <span className="flex items-center gap-1.5"><PhoneCall className="size-4 text-[#65e2da]" /> {hotline.tel}</span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
