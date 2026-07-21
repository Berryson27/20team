import type { ReactNode } from 'react'
import { BookOpen, Home, MapPinned, QrCode, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navigation = [
  { label: '홈', href: '/', icon: Home },
  { label: 'QR 진단', href: '/scan', icon: QrCode },
  { label: '위험지도', href: '/map', icon: MapPinned },
  { label: '예방가이드', href: '/guide', icon: BookOpen },
]

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="한큐 홈">
      <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#dffcff] to-[#ebe8ff] text-primary shadow-[inset_0_0_0_1px_rgba(15,166,181,0.16)]">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </span>
      <span>
        <strong className="block text-[15px] font-extrabold tracking-[-0.04em]">한큐</strong>
        <span className="block text-[10px] font-medium tracking-[0.12em] text-muted-foreground">QR SAFETY</span>
      </span>
    </Link>
  )
}

function DesktopNavigation() {
  const { pathname } = useLocation()

  return (
    <nav className="hidden items-center gap-1 rounded-2xl border border-white/80 bg-white/60 p-1.5 shadow-sm backdrop-blur-xl md:flex" aria-label="주요 메뉴">
      {navigation.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
              active ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/60 hover:text-foreground',
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function MobileNavigation() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto grid max-w-md grid-cols-4 rounded-[24px] border border-white/80 bg-white/90 p-1.5 shadow-[0_18px_50px_rgba(31,47,76,0.16)] backdrop-blur-xl md:hidden" aria-label="주요 메뉴">
      {navigation.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[10px] font-semibold transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-[#718096]',
            )}
          >
            <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

type AppShellProps = {
  children: ReactNode
  tone?: 'aurora' | 'warm'
  hideMobileHeader?: boolean
}

export function AppShell({ children, tone = 'aurora', hideMobileHeader = false }: AppShellProps) {
  return (
    <div className={cn('relative min-h-dvh overflow-x-hidden', tone === 'warm' ? 'bg-[#fbf8f1]' : 'bg-[#f8fbff]')}>
      {tone === 'aurora' && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-24 top-12 size-96 rounded-full bg-[#d9fbff]/65 blur-3xl" />
          <div className="absolute right-[-8rem] top-[-4rem] size-[30rem] rounded-full bg-[#e9e3ff]/70 blur-3xl" />
          <div className="absolute bottom-[-14rem] left-[35%] size-[34rem] rounded-full bg-[#dbeeff]/75 blur-3xl" />
        </div>
      )}

      <header className={cn('relative z-40 border-b border-white/60 bg-white/55 backdrop-blur-xl', hideMobileHeader && 'hidden md:block')}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8 md:h-[72px]">
          <Brand />
          <DesktopNavigation />
          <div className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground lg:flex">
            <span className="size-2 rounded-full bg-[#20b486] shadow-[0_0_0_4px_rgba(32,180,134,0.12)]" />
            위협 데이터 연결 준비
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-28 pt-5 sm:px-8 sm:pt-8 md:pb-14 md:pt-12">{children}</main>
      <MobileNavigation />
    </div>
  )
}
