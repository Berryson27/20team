import { useEffect, useRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { verifyPayload } from '@/lib/verification'

// 서명 QR 랜딩: /r/<qrId>?sig=<hex> 로 접속하면 전체 URL을 서버 검증(S1 서명 확인)에 넘긴다.
// 정품이면 safe, 위조면 danger(forgery)로 판정되어 결과 화면으로 이동한다.
export function RPage() {
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const fullUrl = window.location.href
    verifyPayload(fullUrl)
      .then((result) => navigate('/result', { state: { result }, replace: true }))
      .catch(() => navigate('/result', { replace: true }))
  }, [navigate])

  return (
    <AppShell hideMobileHeader>
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold">QR 서명을 확인하고 있어요…</p>
          <p className="text-xs text-muted-foreground">정품 여부와 연결 주소를 검증 중입니다.</p>
        </div>
      </div>
    </AppShell>
  )
}
