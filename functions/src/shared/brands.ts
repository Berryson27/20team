/**
 * 국내·글로벌 브랜드/기관 사전 (검증엔진 §4 S3 사칭·타이포스쿼팅 탐지용).
 * name = 표시용 브랜드명, aliases = 도메인 라벨(세그먼트)에서 찾는 토큰,
 * officialDomains = 공식 도메인(사칭 판정에서 제외되는 화이트리스트).
 *
 * ⚠ 이 사전은 20team 로컬 엔진(src/lib/url-analysis.ts)의 BRANDS(~25개)를 그대로 이식한 것이다.
 * 축소하면 samsung/icloud/google/paypal/instagram/upbit/bithumb/police/cjlogistics 등의
 * 브랜드 사칭 피싱이 무신호(0점)로 빠져나가 recall 이 급락한다(Task 6 회귀). 임의 축소 금지.
 */
export interface BrandEntry {
  name: string;
  aliases: string[]; // 도메인 세그먼트와 비교하는 토큰(20team tokens)
  officialDomains: string[]; // 공식 도메인 — 이 위에 있으면 사칭 아님(오탐 방지)
}

export const BRANDS: BrandEntry[] = [
  { name: "네이버", aliases: ["naver", "naverpay", "navercorp"], officialDomains: ["naver.com", "naver.me", "navercorp.com", "pay.naver.com"] },
  { name: "카카오", aliases: ["kakao", "kakaopay", "kakaobank", "kakaotalk"], officialDomains: ["kakao.com", "kakaocorp.com", "kakaobank.com", "kakaopay.com", "kakaofriends.com", "kakaomobility.com"] },
  { name: "다음", aliases: ["daum"], officialDomains: ["daum.net"] },
  { name: "토스", aliases: ["toss", "tossbank", "tosspay"], officialDomains: ["toss.im", "tossbank.com", "tosspayments.com"] },
  { name: "쿠팡", aliases: ["coupang"], officialDomains: ["coupang.com", "coupangplay.com"] },
  { name: "구글", aliases: ["google"], officialDomains: ["google.com", "google.co.kr", "youtube.com", "gmail.com"] },
  { name: "애플/아이클라우드", aliases: ["apple", "icloud"], officialDomains: ["apple.com", "icloud.com"] },
  { name: "삼성", aliases: ["samsung", "samsungcard", "samsungpay"], officialDomains: ["samsung.com", "samsungcard.com", "samsungfire.com", "samsungpop.com"] },
  { name: "국민은행", aliases: ["kbstar", "kbcard", "kbank"], officialDomains: ["kbstar.com", "kbcard.com", "kbanknow.com", "kbpay.co.kr"] },
  { name: "신한은행", aliases: ["shinhan"], officialDomains: ["shinhan.com", "shinhancard.com"] },
  { name: "우리은행", aliases: ["woori", "wooribank"], officialDomains: ["wooribank.com", "wooricard.com"] },
  { name: "하나은행", aliases: ["hanabank", "hanacard", "kebhana"], officialDomains: ["kebhana.com", "hanacard.co.kr", "hanafn.com", "hanabank.com"] },
  { name: "농협", aliases: ["nonghyup", "nhbank"], officialDomains: ["nonghyup.com", "nhbank.com", "banking.nonghyup.com"] },
  { name: "기업은행", aliases: ["ibk"], officialDomains: ["ibk.co.kr"] },
  { name: "홈택스", aliases: ["hometax"], officialDomains: ["hometax.go.kr"] },
  { name: "경찰청", aliases: ["police"], officialDomains: ["police.go.kr"] },
  { name: "정부24/민원", aliases: ["gov24", "minwon"], officialDomains: ["gov.kr", "minwon.go.kr"] },
  { name: "우체국", aliases: ["epost", "koreapost"], officialDomains: ["epost.kr", "epost.go.kr"] },
  { name: "CJ대한통운", aliases: ["cjlogistics"], officialDomains: ["cjlogistics.com"] },
  { name: "한진택배", aliases: ["hanjin"], officialDomains: ["hanjin.co.kr"] },
  { name: "업비트", aliases: ["upbit"], officialDomains: ["upbit.com"] },
  { name: "빗썸", aliases: ["bithumb"], officialDomains: ["bithumb.com"] },
  { name: "페이팔", aliases: ["paypal"], officialDomains: ["paypal.com"] },
  { name: "넷플릭스", aliases: ["netflix"], officialDomains: ["netflix.com"] },
  { name: "인스타그램", aliases: ["instagram"], officialDomains: ["instagram.com"] },
  { name: "텔레그램", aliases: ["telegram"], officialDomains: ["telegram.org"] },
  { name: "제로페이", aliases: ["zeropay"], officialDomains: ["zeropay.or.kr"] },
  { name: "배달의민족", aliases: ["baemin"], officialDomains: ["baemin.com"] },
];

/**
 * 브랜드 토큰 앞뒤에 흔히 붙는 접두·접미사 (부분일치 오탐 방지용).
 * matchBrandToken 이 "token+affix"(예: samsungcard, naver-security, kakao-gift) 형태만
 * 사칭으로 인정하고, 무관한 단어에 브랜드 토큰이 우연히 포함된 경우는 걸러낸다.
 */
export const BRAND_AFFIXES = new Set([
  "pay", "bank", "card", "event", "login", "secure", "help", "center", "support",
  "kr", "korea", "official", "mall", "shop", "gift", "point", "plus", "app", "web",
  "my", "e", "m", "id", "auth", "wallet", "check", "verify", "care", "service",
  "update", "delivery", "safe", "safety", "cert", "info", "notice", "cs",
]);

/**
 * 글로벌 신뢰 도메인 — 최종 목적지가 이들(또는 서브도메인)이면 "공식"으로 간주.
 * 목적: 오탐 방지. LLM이 실제 google.com 로그인을 "구글 사칭"이라 잘못 판정하는 것을 원천 차단.
 * (공식 도메인에 착지 = 그 브랜드 본인 → 사칭이 아님)
 */
export const GLOBAL_TRUSTED = [
  "google.com", "youtube.com", "gmail.com", "facebook.com", "instagram.com",
  "microsoft.com", "live.com", "office.com", "apple.com", "icloud.com",
  "amazon.com", "paypal.com", "github.com", "linkedin.com", "x.com", "twitter.com",
  "naver.com", "daum.net", "kakao.com", "coupang.com", "baemin.com",
];

/** 공식 도메인 화이트리스트(플랫) — 리다이렉트 최종지가 여기면 감점 상쇄 */
export const OFFICIAL_DOMAINS = new Set(
  [...BRANDS.flatMap((b) => b.officialDomains), ...GLOBAL_TRUSTED]
);

/** 위험 TLD (검증엔진 §4 S3) */
export const RISKY_TLDS = new Set([
  "xyz", "top", "click", "cn", "gq", "tk", "ml", "cf", "work", "loan", "zip", "mov",
]);
