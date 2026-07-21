// 로컬 URL 위험 분석 엔진 — 네트워크·API 없이 URL 문자열만으로 판정한다.
// 판정 기준은 하단 채점표(R1~R18)를 따르며, 임의 판단을 추가하지 않는다.

export type LocalSignal = {
  stage: 'domain' | 'redirect' | 'content'
  id: string
  points: number
  title: string
  detail: string
  level: 'warning' | 'danger'
}

export type LocalAnalysis = {
  host: string
  registrable: string
  trusted: boolean
  score: number
  signals: LocalSignal[]
}

// ── 도메인 데이터 ────────────────────────────────────────────────

// 다단계 공용 접미사 (registrable 도메인 계산용)
const MULTI_SUFFIXES = new Set([
  'co.kr', 'go.kr', 'or.kr', 'ac.kr', 'ne.kr', 'pe.kr', 're.kr', 'hs.kr', 'ms.kr', 'es.kr', 'sc.kr',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
  'com.cn', 'com.tw', 'com.hk', 'com.sg', 'com.au', 'com.br', 'co.in', 'co.nz',
])

// 접미사 전체를 신뢰 (정부·교육 기관 전용 등록 영역)
const TRUSTED_SUFFIXES = ['go.kr', 'ac.kr', 'mil.kr']

// 신뢰 도메인 화이트리스트 (registrable 기준)
const TRUSTED_DOMAINS = new Set([
  // 포털·플랫폼
  'naver.com', 'naver.me', 'navercorp.com', 'kakao.com', 'kakaocorp.com', 'daum.net',
  'google.com', 'google.co.kr', 'youtube.com', 'gmail.com', 'apple.com', 'icloud.com',
  'microsoft.com', 'live.com', 'office.com', 'github.com', 'wikipedia.org',
  'instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'linkedin.com', 'netflix.com',
  'amazon.com', 'paypal.com', 'telegram.org', 'whatsapp.com', 'line.me',
  // 금융
  'kakaobank.com', 'kakaopay.com', 'toss.im', 'tossbank.com', 'tosspayments.com',
  'kbstar.com', 'kbcard.com', 'kbanknow.com', 'shinhan.com', 'shinhancard.com',
  'wooribank.com', 'wooricard.com', 'kebhana.com', 'hanacard.co.kr', 'hanafn.com',
  'nonghyup.com', 'nhbank.com', 'ibk.co.kr', 'suhyup-bank.com', 'citibank.co.kr', 'scfirstbank.com',
  'samsungcard.com', 'hyundaicard.com', 'lottecard.co.kr', 'bccard.com', 'upbit.com', 'bithumb.com',
  // 쇼핑·생활
  'coupang.com', 'coupangplay.com', 'gmarket.co.kr', 'auction.co.kr', '11st.co.kr',
  'ssg.com', 'lotteon.com', 'musinsa.com', 'kurly.com', 'oliveyoung.co.kr', 'danawa.com',
  'baemin.com', 'yogiyo.co.kr', 'daangn.com', 'bunjang.co.kr', 'interpark.com',
  'yes24.com', 'aladin.co.kr', 'kyobobook.co.kr', 'cgv.co.kr', 'megabox.co.kr', 'lottecinema.co.kr',
  'melon.com', 'genie.co.kr', 'wanted.co.kr', 'saramin.co.kr', 'jobkorea.co.kr', 'inflearn.com',
  'hanatour.com', 'koreanair.com', 'flyasiana.com', 'kakaofriends.com', 'kakaomobility.com',
  // 공공·통신·택배
  'gov.kr', 'korea.kr', 'epost.kr', 'kisa.or.kr', 'fss.or.kr', 'kftc.or.kr',
  'sktelecom.com', 'kt.com', 'lguplus.com', 'cjlogistics.com', 'hanjin.co.kr', 'lotteglogis.com',
])

// 브랜드 사칭 탐지: 토큰이 호스트에 있는데 공식 도메인이 아니면 사칭
const BRANDS: { tokens: string[]; official: string[] }[] = [
  { tokens: ['naver', 'naverpay', 'navercorp'], official: ['naver.com', 'naver.me', 'navercorp.com'] },
  { tokens: ['kakao', 'kakaopay', 'kakaobank', 'kakaotalk'], official: ['kakao.com', 'kakaocorp.com', 'kakaobank.com', 'kakaopay.com', 'kakaofriends.com', 'kakaomobility.com'] },
  { tokens: ['daum'], official: ['daum.net'] },
  { tokens: ['toss', 'tossbank', 'tosspay'], official: ['toss.im', 'tossbank.com', 'tosspayments.com'] },
  { tokens: ['coupang'], official: ['coupang.com', 'coupangplay.com'] },
  { tokens: ['google'], official: ['google.com', 'google.co.kr', 'youtube.com', 'gmail.com'] },
  { tokens: ['apple', 'icloud'], official: ['apple.com', 'icloud.com'] },
  { tokens: ['samsung', 'samsungcard', 'samsungpay'], official: ['samsung.com', 'samsungcard.com', 'samsungfire.com', 'samsungpop.com'] },
  { tokens: ['kbstar', 'kbcard', 'kbank'], official: ['kbstar.com', 'kbcard.com', 'kbanknow.com'] },
  { tokens: ['shinhan'], official: ['shinhan.com', 'shinhancard.com'] },
  { tokens: ['woori', 'wooribank'], official: ['wooribank.com', 'wooricard.com'] },
  { tokens: ['hanabank', 'hanacard', 'kebhana'], official: ['kebhana.com', 'hanacard.co.kr', 'hanafn.com'] },
  { tokens: ['nonghyup', 'nhbank'], official: ['nonghyup.com', 'nhbank.com'] },
  { tokens: ['ibk'], official: ['ibk.co.kr'] },
  { tokens: ['hometax'], official: ['hometax.go.kr'] },
  { tokens: ['police'], official: ['police.go.kr'] },
  { tokens: ['gov24', 'minwon'], official: ['gov.kr', 'minwon.go.kr'] },
  { tokens: ['epost', 'koreapost'], official: ['epost.kr', 'epost.go.kr'] },
  { tokens: ['cjlogistics'], official: ['cjlogistics.com'] },
  { tokens: ['hanjin'], official: ['hanjin.co.kr'] },
  { tokens: ['upbit'], official: ['upbit.com'] },
  { tokens: ['bithumb'], official: ['bithumb.com'] },
  { tokens: ['paypal'], official: ['paypal.com'] },
  { tokens: ['netflix'], official: ['netflix.com'] },
  { tokens: ['instagram'], official: ['instagram.com'] },
  { tokens: ['telegram'], official: ['telegram.org'] },
]

// 브랜드 토큰 앞뒤에 흔히 붙는 접두·접미사 (부분일치 오탐 방지용)
const BRAND_AFFIXES = new Set([
  'pay', 'bank', 'card', 'event', 'login', 'secure', 'help', 'center', 'support',
  'kr', 'korea', 'official', 'mall', 'shop', 'gift', 'point', 'plus', 'app', 'web',
  'my', 'e', 'm', 'id', 'auth', 'wallet', 'check', 'verify', 'care', 'service',
  'update', 'delivery', 'safe', 'safety', 'cert', 'info', 'notice', 'cs',
])

const HIGH_RISK_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'click', 'zip', 'mov', 'icu', 'cyou', 'rest',
  'buzz', 'cam', 'quest', 'work', 'monster', 'stream', 'download', 'racing', 'win',
  'bid', 'loan', 'men', 'party', 'date', 'faith', 'review', 'accountant', 'science', 'pw',
])
const MED_RISK_TLDS = new Set(['xyz', 'shop', 'site', 'online', 'live', 'vip', 'best', 'lol', 'sbs'])

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'buff.ly', 'cutt.ly', 'rb.gy',
  'ow.ly', 'han.gl', 'me2.do', 'url.kr', 'vo.la', 'lrl.kr', 'c11.kr', 'zrr.kr', 'shorturl.at',
])

const FREE_HOSTS = new Set([
  'duckdns.org', '000webhostapp.com', 'weebly.com', 'wixsite.com', 'webnode.page',
  'netlify.app', 'vercel.app', 'web.app', 'firebaseapp.com', 'pages.dev', 'glitch.me',
  'repl.co', 'onrender.com', 'github.io', 'blogspot.com', 'square.site', 'mystrikingly.com',
])

const HOST_KEYWORDS = [
  'login', 'signin', 'verify', 'verification', 'secure', 'security', 'account', 'update',
  'confirm', 'password', 'banking', 'wallet', 'billing', 'invoice', 'delivery', 'parcel',
  'tracking', 'shipment', 'refund', 'tax', 'bonus', 'prize', 'gift', 'auth', 'official', 'support',
  'vaccine', 'booking', 'reserve', 'safety', 'loan',
]

const PATH_KEYWORD_PATTERN = /login|signin|verify|account|password|passwd|billing|wallet|seed|recovery|bank/i

// ── 유틸 ────────────────────────────────────────────────────────

export function registrableDomain(host: string): string {
  const labels = host.split('.')
  if (labels.length <= 2) return host
  const lastTwo = labels.slice(-2).join('.')
  if (MULTI_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.')
  return lastTwo
}

function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const previous = new Array(b.length + 1).fill(0).map((_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      diagonal = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, substitution)
    }
  }
  return previous[b.length]
}

function isTrusted(host: string, registrable: string): boolean {
  if (TRUSTED_DOMAINS.has(registrable)) return true
  return TRUSTED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

function matchBrandToken(segments: string[], tokens: string[]): string | null {
  for (const segment of segments) {
    for (const token of tokens) {
      if (segment === token) return token
      if (token.length >= 5) {
        if (segment.startsWith(token) && BRAND_AFFIXES.has(segment.slice(token.length))) return token
        if (segment.endsWith(token) && BRAND_AFFIXES.has(segment.slice(0, segment.length - token.length))) return token
      }
    }
  }
  return null
}

// ── 분석 본체 ───────────────────────────────────────────────────

export function analyzeUrlLocally(rawUrl: string): LocalAnalysis {
  const url = new URL(rawUrl)
  const host = url.hostname.toLowerCase()
  const registrable = registrableDomain(host)
  const signals: LocalSignal[] = []
  const add = (id: string, points: number, title: string, detail: string, level: 'warning' | 'danger' = 'warning') => {
    signals.push({ stage: 'domain', id, points, title, detail, level })
  }

  const trusted = isTrusted(host, registrable)

  // R15: 비암호화 연결은 신뢰 도메인이어도 표시한다.
  if (url.protocol === 'http:') add('http', 10, '암호화되지 않은 주소', 'HTTPS 보안 연결을 사용하지 않습니다.')

  if (trusted) {
    // R1: 공식 등록 도메인 — 구조 신호 검사를 면제하고 점수를 상한 처리한다.
    const score = Math.min(signals.reduce((sum, item) => sum + item.points, 0), 15)
    return { host, registrable, trusted, score, signals }
  }

  // R2: userinfo(@) 트릭 — 표시 주소와 실제 접속지가 다르다.
  if (url.username || url.password) add('userinfo', 45, '주소 속 가짜 도메인', '@ 앞에 가짜 주소를 넣어 실제 접속지를 숨기는 수법입니다.', 'danger')

  // R7: IP 직접 접속
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
    add('ip-host', 40, '도메인 없는 직접 접속', '일반 도메인 대신 IP 주소로 연결합니다.', 'danger')
  }

  // R6: punycode(국제화 도메인) 위장
  if (host.includes('xn--')) add('homoglyph', 40, '위장 문자 사용', '비슷하게 보이는 다른 문자 체계를 사용할 수 있습니다.', 'danger')

  // R8: 호스트에 인코딩 문자
  if (/%[0-9a-f]{2}/i.test(rawUrl.split('/')[2] ?? '')) add('encoded-host', 25, '주소 인코딩 위장', '호스트 이름에 인코딩된 문자가 섞여 있습니다.', 'danger')

  const segments = host.split(/[.-]/).filter(Boolean)

  // R4: 공식 도메인이 서브도메인 자리에 위장 (naver.com.evil.xyz)
  const officialDomains = BRANDS.flatMap((brand) => brand.official)
  const disguised = officialDomains.find((official) => host !== official && !host.endsWith(`.${official}`) && host.includes(official))
  if (disguised) {
    add('brand-subdomain', 50, '공식 주소를 앞에 붙인 위장', `${disguised}처럼 보이지만 실제 도메인은 ${registrable}입니다.`, 'danger')
  }

  // R3: 브랜드 토큰 포함 + 비공식 도메인
  let impersonatedBrand: string | null = null
  if (!disguised) {
    for (const brand of BRANDS) {
      const token = matchBrandToken(segments, brand.tokens)
      if (token && !brand.official.includes(registrable)) {
        impersonatedBrand = token
        add('brand-impersonation', 45, `${token} 사칭 의심 주소`, `${token} 관련 이름을 쓰지만 공식 도메인이 아닙니다.`, 'danger')
        break
      }
    }
  }

  // R5: 타이포스쿼팅 — 호스트의 각 라벨을 공식 도메인 이름과 편집거리 1~2로 비교
  if (!disguised && !impersonatedBrand) {
    const officialSlds = [...new Set([...officialDomains, ...TRUSTED_DOMAINS].map((domain) => domain.split('.')[0]))]
    const labels = [...new Set([registrable.split('.')[0], ...host.split('.').filter((label) => label.length >= 5)])]
    outer: for (const label of labels) {
      for (const official of officialSlds) {
        if (official.length < 5 || label === official || officialSlds.includes(label)) continue
        const allowance = official.length >= 7 ? 2 : 1
        if (editDistance(label, official, allowance) <= allowance) {
          add('typosquat', 45, `${official} 유사 도메인`, `공식 주소 ${official}와(과) 한두 글자만 다릅니다.`, 'danger')
          break outer
        }
      }
    }
  }

  // R5-2: 가짜 국가도메인 — go.kr을 흉내 낸 go-kr 등 하이픈 변형
  if (/(^|[.-])(go|co|or|ac|gov)-kr([.-]|$)/.test(host)) {
    add('fake-cctld', 45, '가짜 정부·기관 주소 형식', 'go.kr 같은 공식 국가도메인을 하이픈으로 흉내 낸 주소입니다.', 'danger')
  }

  // R11: TLD 위험도
  const tld = host.split('.').at(-1) ?? ''
  if (HIGH_RISK_TLDS.has(tld)) add('risky-tld', 20, '피싱에 자주 쓰이는 주소 형식', `.${tld} 주소는 피싱에 자주 악용됩니다.`)
  else if (MED_RISK_TLDS.has(tld)) add('risky-tld', 12, '주의가 필요한 주소 형식', `.${tld} 주소는 추가 확인이 필요합니다.`)

  // R12: 단축 URL — 최종 목적지를 알 수 없다.
  if (SHORTENERS.has(registrable)) add('shortener', 15, '단축 주소 사용', '실제 목적지를 가린 단축 주소입니다. 최종 도착지를 확인해야 합니다.')

  // R9: 무료 호스팅·DDNS
  if (FREE_HOSTS.has(registrable)) add('free-host', 22, '무료 호스팅 주소', '누구나 만들 수 있는 무료 호스팅에 올라간 페이지입니다.')

  // R10: 호스트 민감 키워드
  const keywordHits = HOST_KEYWORDS.filter((keyword) => segments.some((segment) => segment === keyword || (keyword.length >= 5 && segment.includes(keyword))))
  if (keywordHits.length) {
    const points = Math.min(20 + (keywordHits.length - 1) * 10, 30)
    add('host-keyword', points, '유인 단어가 든 주소', `주소에 '${keywordHits.slice(0, 3).join(', ')}' 같은 유인 단어가 들어 있습니다.`)
  }

  // R13: 비표준 포트
  if (url.port && url.port !== '80' && url.port !== '443') add('odd-port', 15, '비표준 포트 사용', `일반적이지 않은 포트(${url.port})로 연결합니다.`)

  // R14: 과도한 서브도메인
  const extraLabels = host.split('.').length - registrable.split('.').length
  if (extraLabels >= 3) add('deep-subdomain', 15, '겹겹이 쌓인 서브도메인', '주소 앞부분을 길게 만들어 진짜 도메인을 숨기는 수법입니다.')

  // R16: 구조 이상 신호
  if (host.length > 45) add('long-host', 10, '비정상적으로 긴 주소', '호스트 이름이 비정상적으로 깁니다.')
  if ((registrable.split('.')[0].match(/-/g)?.length ?? 0) >= 3) add('many-hyphens', 12, '하이픈 남용 주소', '하이픈을 여러 개 이어 붙인 의심 주소입니다.')
  if (rawUrl.length > 150) add('long-url', 8, '지나치게 긴 링크', '주소 전체가 비정상적으로 깁니다.')
  if (PATH_KEYWORD_PATTERN.test(url.pathname + url.search)) add('path-keyword', 10, '로그인·계정 경로', '주소 경로가 로그인·계정 정보 입력을 가리킵니다.')

  // R17: APK 직접 다운로드 경로
  if (/\.apk(?:$|[?#])/i.test(rawUrl)) add('apk-path', 60, 'APK 직접 설치 주소', '앱스토어를 거치지 않는 설치 파일로 연결됩니다.', 'danger')

  let score = Math.min(signals.reduce((sum, item) => sum + item.points, 0), 100)

  // R18: 약한 신호 결합 상향 — 유인 키워드·무료호스팅·단축주소가 다른 신호와 겹치면 경고선까지 올린다.
  const comboTrigger = signals.some((item) => ['host-keyword', 'free-host', 'shortener'].includes(item.id))
  if (comboTrigger && signals.length >= 2 && score >= 25 && score < 40) score = 40

  return { host, registrable, trusted, score, signals }
}
