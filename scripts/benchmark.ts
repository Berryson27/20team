// 로컬 판별 엔진 정확도 벤치마크
// 실행: node --experimental-strip-types scripts/benchmark.ts
// 기준: phish → warn/danger 판정 시 정답, benign → safe 판정 시 정답. 정확도 = 정답 / 전체.

import { analyzeUrlLocally } from '../src/lib/url-analysis.ts'

export type Sample = { url: string; label: 'phish' | 'benign'; note: string }

export const samples: Sample[] = [
  // ── 정상(benign) 100건 ─────────────────────────────────────
  { url: 'https://www.naver.com', label: 'benign', note: '포털' },
  { url: 'https://m.naver.com', label: 'benign', note: '모바일 포털' },
  { url: 'https://blog.naver.com/foodlover123', label: 'benign', note: '블로그' },
  { url: 'https://nid.naver.com/nidlogin.login?mode=form', label: 'benign', note: '공식 로그인' },
  { url: 'https://pay.naver.com/history', label: 'benign', note: '공식 결제' },
  { url: 'https://cafe.naver.com/joonggonara', label: 'benign', note: '카페' },
  { url: 'https://www.kakao.com', label: 'benign', note: '포털' },
  { url: 'https://accounts.kakao.com/login?continue=https%3A%2F%2Fkakao.com', label: 'benign', note: '공식 로그인' },
  { url: 'https://www.kakaobank.com', label: 'benign', note: '은행' },
  { url: 'https://www.kakaopay.com', label: 'benign', note: '결제' },
  { url: 'https://www.daum.net', label: 'benign', note: '포털' },
  { url: 'https://mail.daum.net', label: 'benign', note: '메일' },
  { url: 'https://www.google.com/search?q=weather', label: 'benign', note: '검색' },
  { url: 'https://docs.google.com/document/d/abc123', label: 'benign', note: '문서' },
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', label: 'benign', note: '영상' },
  { url: 'https://www.apple.com/kr/iphone/', label: 'benign', note: '제조사' },
  { url: 'https://support.apple.com/ko-kr', label: 'benign', note: '고객지원' },
  { url: 'https://www.microsoft.com/ko-kr/windows', label: 'benign', note: '제조사' },
  { url: 'https://github.com/facebook/react', label: 'benign', note: '개발' },
  { url: 'https://ko.wikipedia.org/wiki/대한민국', label: 'benign', note: '백과' },
  { url: 'https://www.instagram.com/p/xyz789', label: 'benign', note: 'SNS' },
  { url: 'https://www.facebook.com/groups/12345', label: 'benign', note: 'SNS' },
  { url: 'https://x.com/home', label: 'benign', note: 'SNS' },
  { url: 'https://www.netflix.com/kr/title/81234567', label: 'benign', note: 'OTT' },
  { url: 'https://www.amazon.com/dp/B0ABCDEF', label: 'benign', note: '쇼핑' },
  { url: 'https://www.paypal.com/kr/home', label: 'benign', note: '결제' },
  { url: 'https://toss.im', label: 'benign', note: '금융' },
  { url: 'https://www.tossbank.com', label: 'benign', note: '은행' },
  { url: 'https://www.kbstar.com', label: 'benign', note: '은행' },
  { url: 'https://obank.kbstar.com/quics?page=oBank', label: 'benign', note: '인터넷뱅킹' },
  { url: 'https://card.kbcard.com', label: 'benign', note: '카드' },
  { url: 'https://www.shinhan.com', label: 'benign', note: '은행' },
  { url: 'https://bank.shinhan.com/rib/easy/index.jsp', label: 'benign', note: '인터넷뱅킹' },
  { url: 'https://www.shinhancard.com', label: 'benign', note: '카드' },
  { url: 'https://www.wooribank.com', label: 'benign', note: '은행' },
  { url: 'https://spot.wooribank.com/pot/Dream?withyou=ps', label: 'benign', note: '인터넷뱅킹' },
  { url: 'https://www.kebhana.com', label: 'benign', note: '은행' },
  { url: 'https://www.hanacard.co.kr', label: 'benign', note: '카드' },
  { url: 'https://www.nonghyup.com', label: 'benign', note: '은행' },
  { url: 'https://banking.nonghyup.com/nhbank.html', label: 'benign', note: '인터넷뱅킹' },
  { url: 'https://www.ibk.co.kr', label: 'benign', note: '은행' },
  { url: 'https://www.samsungcard.com', label: 'benign', note: '카드' },
  { url: 'https://www.hyundaicard.com', label: 'benign', note: '카드' },
  { url: 'https://www.upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC', label: 'benign', note: '거래소' },
  { url: 'https://www.bithumb.com', label: 'benign', note: '거래소' },
  { url: 'https://www.coupang.com/vp/products/123456', label: 'benign', note: '쇼핑' },
  { url: 'https://www.gmarket.co.kr', label: 'benign', note: '쇼핑' },
  { url: 'https://www.11st.co.kr', label: 'benign', note: '쇼핑' },
  { url: 'https://www.ssg.com', label: 'benign', note: '쇼핑' },
  { url: 'https://www.lotteon.com', label: 'benign', note: '쇼핑' },
  { url: 'https://www.musinsa.com/products/12345', label: 'benign', note: '쇼핑' },
  { url: 'https://www.kurly.com/goods/100001', label: 'benign', note: '쇼핑' },
  { url: 'https://www.oliveyoung.co.kr/store/main/main.do', label: 'benign', note: '쇼핑' },
  { url: 'https://www.danawa.com', label: 'benign', note: '가격비교' },
  { url: 'https://www.baemin.com', label: 'benign', note: '배달' },
  { url: 'https://www.yogiyo.co.kr', label: 'benign', note: '배달' },
  { url: 'https://www.daangn.com', label: 'benign', note: '중고거래' },
  { url: 'https://m.bunjang.co.kr', label: 'benign', note: '중고거래' },
  { url: 'https://www.interpark.com', label: 'benign', note: '티켓' },
  { url: 'https://www.yes24.com', label: 'benign', note: '서점' },
  { url: 'https://www.aladin.co.kr', label: 'benign', note: '서점' },
  { url: 'https://product.kyobobook.co.kr/detail/S000001234', label: 'benign', note: '서점' },
  { url: 'https://www.cgv.co.kr', label: 'benign', note: '영화' },
  { url: 'https://www.megabox.co.kr', label: 'benign', note: '영화' },
  { url: 'https://www.melon.com/chart/index.htm', label: 'benign', note: '음악' },
  { url: 'https://www.genie.co.kr', label: 'benign', note: '음악' },
  { url: 'https://www.wanted.co.kr/wd/12345', label: 'benign', note: '채용' },
  { url: 'https://www.saramin.co.kr', label: 'benign', note: '채용' },
  { url: 'https://www.jobkorea.co.kr', label: 'benign', note: '채용' },
  { url: 'https://www.inflearn.com/course/react-basic', label: 'benign', note: '교육' },
  { url: 'https://www.hanatour.com', label: 'benign', note: '여행' },
  { url: 'https://www.koreanair.com/kr/ko', label: 'benign', note: '항공' },
  { url: 'https://flyasiana.com/C/KR/KO/index', label: 'benign', note: '항공' },
  { url: 'https://www.gov.kr', label: 'benign', note: '정부' },
  { url: 'https://www.korea.kr', label: 'benign', note: '정부' },
  { url: 'https://hometax.go.kr/websquare/websquare.html', label: 'benign', note: '국세청' },
  { url: 'https://www.nts.go.kr', label: 'benign', note: '국세청' },
  { url: 'https://www.police.go.kr', label: 'benign', note: '경찰청' },
  { url: 'https://www.seoul.go.kr', label: 'benign', note: '지자체' },
  { url: 'https://www.minwon.go.kr', label: 'benign', note: '민원' },
  { url: 'https://www.epost.kr', label: 'benign', note: '우체국' },
  { url: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm', label: 'benign', note: '우편조회' },
  { url: 'https://www.kisa.or.kr', label: 'benign', note: '공공기관' },
  { url: 'https://www.fss.or.kr', label: 'benign', note: '금감원' },
  { url: 'https://www.snu.ac.kr', label: 'benign', note: '대학' },
  { url: 'https://portal.korea.ac.kr', label: 'benign', note: '대학' },
  { url: 'https://www.sktelecom.com', label: 'benign', note: '통신' },
  { url: 'https://www.kt.com', label: 'benign', note: '통신' },
  { url: 'https://www.lguplus.com', label: 'benign', note: '통신' },
  { url: 'https://www.cjlogistics.com/ko/tool/parcel/tracking', label: 'benign', note: '택배조회' },
  { url: 'https://www.hanjin.co.kr/kor/CMS/DeliveryMgr/WaybillResult.do', label: 'benign', note: '택배조회' },
  { url: 'https://en.wikipedia.org/wiki/QR_code', label: 'benign', note: '백과' },
  { url: 'https://stackoverflow.com/questions/12345', label: 'benign', note: '개발' },
  { url: 'https://littleforest-bakery.com/menu', label: 'benign', note: '일반 소상공인' },
  { url: 'https://cafeblossom.co.kr', label: 'benign', note: '일반 소상공인' },
  { url: 'https://greentable.kr/reservation', label: 'benign', note: '일반 소상공인' },
  { url: 'https://www.seoulartcenter.or.kr', label: 'benign', note: '문화기관' },
  { url: 'https://www.busanmuseum.or.kr', label: 'benign', note: '문화기관' },
  { url: 'https://mysunnygarden.com/about', label: 'benign', note: '개인 홈페이지' },

  // ── 피싱(phish) 100건 ──────────────────────────────────────
  // 타이포스쿼팅
  { url: 'https://www.navver.com/login', label: 'phish', note: '타이포' },
  { url: 'https://naever.com', label: 'phish', note: '타이포' },
  { url: 'https://navercom.xyz', label: 'phish', note: '브랜드+TLD' },
  { url: 'https://kakaoo.com/event', label: 'phish', note: '타이포' },
  { url: 'https://kakaobamk.com', label: 'phish', note: '타이포' },
  { url: 'https://cupang.com/vip-deal', label: 'phish', note: '타이포' },
  { url: 'https://coupamg.com', label: 'phish', note: '타이포' },
  { url: 'https://googie.com/security', label: 'phish', note: '타이포' },
  { url: 'https://paypa1.com/signin', label: 'phish', note: '타이포' },
  { url: 'https://netfliix.com/billing', label: 'phish', note: '타이포' },
  { url: 'https://lnstagram.com/verify', label: 'phish', note: '타이포' },
  { url: 'https://te1egram.org/login', label: 'phish', note: '타이포' },
  { url: 'https://upbiit.com/exchange', label: 'phish', note: '타이포' },
  { url: 'https://bithumh.com/wallet', label: 'phish', note: '타이포' },
  { url: 'https://shinhen.com/card', label: 'phish', note: '타이포' },
  { url: 'https://wooribamk.com', label: 'phish', note: '타이포' },
  { url: 'https://hometex.go-kr.com', label: 'phish', note: '타이포+위장' },
  { url: 'https://kbstor.com/loan', label: 'phish', note: '타이포' },
  { url: 'https://tossbamk.com', label: 'phish', note: '타이포' },
  { url: 'https://samsumg.com/event', label: 'phish', note: '타이포' },
  // 브랜드 사칭 (토큰 + 비공식 도메인)
  { url: 'https://naver-security.com/verify', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://naverpay-event.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://kakao-gift.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://kakaobank-loan.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://kakaopay-refund.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://toss-event.com/cash', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://tossbank-apply.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://coupang-vip.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://kbstar-secure.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://shinhan-cert.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://wooribank-check.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://nonghyup-auth.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://ibk-loan.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://hanacard-point.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://samsungcard-event.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://apple-id-verify.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://icloud-find.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://google-docs-share.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://netflix-kr-billing.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://paypal-limited.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://instagram-help.net/appeal', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://upbit-airdrop.com', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://bithumb-event.net', label: 'phish', note: '브랜드 사칭' },
  { url: 'https://police-mail.com/summons', label: 'phish', note: '기관 사칭' },
  { url: 'https://hometax-refund.com', label: 'phish', note: '기관 사칭' },
  { url: 'https://epost-delivery.com', label: 'phish', note: '기관 사칭' },
  { url: 'https://cjlogistics-track.com', label: 'phish', note: '택배 사칭' },
  { url: 'https://hanjin-parcel.net', label: 'phish', note: '택배 사칭' },
  // 서브도메인 위장
  { url: 'https://naver.com.security-alert.xyz/login', label: 'phish', note: '서브도메인 위장' },
  { url: 'https://kakao.com.verify-user.top', label: 'phish', note: '서브도메인 위장' },
  { url: 'https://toss.im.event-cash.click', label: 'phish', note: '서브도메인 위장' },
  { url: 'https://kbstar.com.secure-check.net', label: 'phish', note: '서브도메인 위장' },
  { url: 'https://apple.com.id-unlock.info', label: 'phish', note: '서브도메인 위장' },
  { url: 'https://hometax.go.kr.refund-now.com', label: 'phish', note: '서브도메인 위장' },
  { url: 'https://www.paypal.com.account-limited.net', label: 'phish', note: '서브도메인 위장' },
  // userinfo(@) 트릭
  { url: 'https://naver.com@evil-site.com/login', label: 'phish', note: '@ 트릭' },
  { url: 'http://kakaobank.com@211.45.33.10/app', label: 'phish', note: '@ 트릭+IP' },
  { url: 'https://toss.im%40cash-event.net@malware.top', label: 'phish', note: '@ 트릭' },
  // IP 직접 접속
  { url: 'http://211.34.123.45/login.php', label: 'phish', note: 'IP 호스트' },
  { url: 'http://45.77.123.9/kakao/index.html', label: 'phish', note: 'IP 호스트' },
  { url: 'https://103.224.182.251/verify', label: 'phish', note: 'IP 호스트' },
  { url: 'http://192.210.145.33:8080/bank', label: 'phish', note: 'IP+포트' },
  // punycode
  { url: 'https://xn--nver-loa.com/login', label: 'phish', note: 'punycode' },
  { url: 'https://xn--kako-n32b.com', label: 'phish', note: 'punycode' },
  { url: 'https://xn--pple-43d.com/icloud', label: 'phish', note: 'punycode' },
  // APK 직접 설치
  { url: 'http://mobile-guard.net/security.apk', label: 'phish', note: 'APK' },
  { url: 'https://quick-check.top/kakaotalk_update.apk', label: 'phish', note: 'APK' },
  { url: 'http://185.234.72.19/police_app.apk', label: 'phish', note: 'APK+IP' },
  { url: 'https://parcel-view.click/cj_tracking.apk?id=88', label: 'phish', note: 'APK+택배' },
  // 무료 호스팅·DDNS
  { url: 'https://kakao-event2024.duckdns.org', label: 'phish', note: 'DDNS' },
  { url: 'https://kb-security-center.000webhostapp.com', label: 'phish', note: '무료호스팅' },
  { url: 'https://toss-cash-friend.weebly.com', label: 'phish', note: '무료호스팅' },
  { url: 'https://nhbank-cert.wixsite.com/main', label: 'phish', note: '무료호스팅' },
  { url: 'https://coupang-partners-event.netlify.app', label: 'phish', note: '무료호스팅' },
  { url: 'https://shinhancard-check.web.app', label: 'phish', note: '무료호스팅' },
  { url: 'https://secure-login-kr.github.io/auth', label: 'phish', note: '무료호스팅+키워드' },
  // 위험 TLD + 유인 키워드
  { url: 'https://delivery-check.top/track?no=1234', label: 'phish', note: '택배 스미싱' },
  { url: 'https://parcel-notice.click', label: 'phish', note: '택배 스미싱' },
  { url: 'https://ems-tracking.xyz/kr', label: 'phish', note: '택배 스미싱' },
  { url: 'https://refund-tax.top/apply', label: 'phish', note: '환급 사기' },
  { url: 'https://prize-winner.click/claim', label: 'phish', note: '경품 사기' },
  { url: 'https://free-gift-event.top', label: 'phish', note: '경품 사기' },
  { url: 'https://mobile-verify.icu/auth', label: 'phish', note: '인증 사기' },
  { url: 'https://account-update-alert.top', label: 'phish', note: '계정 사기' },
  { url: 'https://secure-banking-login.xyz', label: 'phish', note: '뱅킹 사기' },
  { url: 'https://wallet-connect-verify.top', label: 'phish', note: '코인 사기' },
  { url: 'https://vaccine-reserve.click/booking', label: 'phish', note: '접종 사칭' },
  { url: 'https://gov24-minwon.top', label: 'phish', note: '정부 사칭' },
  { url: 'http://safety-check.tk/kisa', label: 'phish', note: '기관 사칭' },
  { url: 'https://bank-cert-update.ml', label: 'phish', note: '뱅킹 사기' },
  // 구조 이상 조합
  { url: 'http://secure.login.verify.account-center.info/session', label: 'phish', note: '다단 서브도메인' },
  { url: 'https://login-secure-check-kr.com/member', label: 'phish', note: '하이픈 남용+키워드' },
  { url: 'http://membership-verify.net/login.php?session=aa8f2', label: 'phish', note: 'http+키워드' },
  { url: 'https://mobile-support-center.site/account/password', label: 'phish', note: '키워드 조합' },
  { url: 'http://online-banking-secure.info:8081/login', label: 'phish', note: '포트+키워드' },
  { url: 'https://update-billing-invoice.online/pay', label: 'phish', note: '키워드 조합' },
  { url: 'https://auth-wallet-recovery.site/seed', label: 'phish', note: '코인 사기' },
  { url: 'http://customer-support-verify.win/chat', label: 'phish', note: '키워드 조합' },
  { url: 'https://id-confirm-safety.buzz', label: 'phish', note: '키워드 조합' },
  { url: 'https://quick-loan-apply.loan/form?ref=sms', label: 'phish', note: '대출 사기' },
]

let correct = 0
const misses: { sample: Sample; score: number; verdict: string }[] = []

for (const sample of samples) {
  const analysis = analyzeUrlLocally(sample.url)
  const verdict = analysis.score >= 70 ? 'danger' : analysis.score >= 40 ? 'warn' : 'safe'
  const detected = verdict !== 'safe'
  const ok = sample.label === 'phish' ? detected : !detected
  if (ok) correct += 1
  else misses.push({ sample, score: analysis.score, verdict })
}

const total = samples.length
const phishTotal = samples.filter((sample) => sample.label === 'phish').length
const benignTotal = total - phishTotal
const phishMissed = misses.filter((miss) => miss.sample.label === 'phish').length
const benignMissed = misses.filter((miss) => miss.sample.label === 'benign').length

console.log(`총 ${total}건 (피싱 ${phishTotal} / 정상 ${benignTotal})`)
console.log(`정답 ${correct}건 → 정확도 ${(correct / total * 100).toFixed(1)}%`)
console.log(`피싱 탐지율(재현율): ${((phishTotal - phishMissed) / phishTotal * 100).toFixed(1)}% (미탐 ${phishMissed})`)
console.log(`정상 통과율: ${((benignTotal - benignMissed) / benignTotal * 100).toFixed(1)}% (오탐 ${benignMissed})`)

if (misses.length) {
  console.log('\n― 오답 목록 ―')
  for (const miss of misses) {
    console.log(`[${miss.sample.label}→${miss.verdict} ${miss.score}점] ${miss.sample.url} (${miss.sample.note})`)
  }
}
