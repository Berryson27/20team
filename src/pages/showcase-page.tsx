import { useEffect } from 'react'
import { ArrowLeft, ExternalLink, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { readLastVerification, seedDemoVerification } from '@/lib/verification'

const screens = [
  { title: 'QR 진단', description: '실시간 카메라 인식 화면', path: '/scan' },
  { title: '진단 결과', description: '위험 점수와 판단 근거', path: '/result' },
  { title: '큐싱 위험지도', description: '지역별 위험 현황', path: '/map' },
]

function PhoneMockup({ title, description, path }: (typeof screens)[number]) {
  return (
    <article className="w-[min(375px,calc(100vw-2.5rem))] shrink-0">
      <div className="mb-4 flex items-end justify-between px-1">
        <div>
          <h2 className="font-extrabold tracking-[-0.035em] text-[#172b45]">{title}</h2>
          <p className="mt-1 text-xs text-[#718096]">{description}</p>
        </div>
        <Link
          to={path}
          className="grid size-9 place-items-center rounded-full border border-[#dde5ec] bg-white text-[#6b7a90] shadow-sm transition-colors hover:text-[#0fa6b5]"
          aria-label={`${title} 전체 화면으로 열기`}
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>

      <div className="relative rounded-[50px] bg-[#172232] p-[9px] shadow-[0_35px_90px_rgba(29,42,62,0.24),0_8px_24px_rgba(29,42,62,0.14)]">
        {/* 실기기처럼 화면 전체를 콘텐츠로 채우고 노치를 그 위에 겹친다. 앱이 모바일 상단 여백으로 노치 자리를 비워둔다. */}
        <div className="pointer-events-none absolute left-1/2 top-[17px] z-20 h-[22px] w-[104px] -translate-x-1/2 rounded-full bg-[#172232]" />
        <div className="pointer-events-none absolute left-[18px] top-24 z-20 h-20 w-[3px] rounded-full bg-[#293648]" />
        <div className="pointer-events-none absolute right-[18px] top-32 z-20 h-28 w-[3px] rounded-full bg-[#293648]" />
        <div className="overflow-hidden rounded-[42px] bg-white">
          <iframe
            src={path}
            title={`${title} 모바일 화면 미리보기`}
            className="block h-[820px] w-full border-0 bg-white"
            loading="eager"
            allow="camera"
          />
        </div>
      </div>
    </article>
  )
}

export function ShowcasePage() {
  // 진단 결과 프레임이 /scan으로 리다이렉트되지 않도록, 결과가 없을 때만 데모 결과를 심는다.
  useEffect(() => {
    if (!readLastVerification()) seedDemoVerification()
  }, [])

  return (
    <div className="min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_20%_0%,#e3faff_0,transparent_28%),radial-gradient(circle_at_90%_5%,#eee8ff_0,transparent_25%),#f3f6f8]">
      <header className="border-b border-white/80 bg-white/65 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[84px] max-w-[1700px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white bg-white/80 text-[#64748b] shadow-sm hover:text-[#0fa6b5]"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-[#0fa6b5]">
                <Smartphone className="size-4" />
                MOBILE SHOWCASE
              </div>
              <h1 className="mt-1 text-xl font-black tracking-[-0.045em] text-[#172b45] sm:text-2xl">한큐 모바일 화면 미리보기</h1>
            </div>
          </div>
          <p className="hidden text-sm text-[#718096] md:block">각 화면은 실제 라우터를 모바일 크기로 표시합니다.</p>
        </div>
      </header>

      <main className="overflow-x-auto px-5 pb-16 pt-10 sm:px-8">
        <div className="mx-auto grid w-max grid-flow-col gap-7 px-1 pb-8 xl:gap-9">
          {screens.map((screen) => (
            <PhoneMockup key={screen.path} {...screen} />
          ))}
        </div>
      </main>
    </div>
  )
}
