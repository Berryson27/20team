/**
 * 국내 결제·금융 브랜드 사전 (검증엔진 §4 S3 타이포스쿼팅 탐지용).
 * key = 브랜드 별칭(도메인 라벨에서 찾는 문자열), officialDomains = 공식 도메인.
 * 데모 시나리오(toss-pay.xyz vs toss.im)에 맞춰 toss 포함.
 */
export interface BrandEntry {
  name: string;
  aliases: string[]; // 도메인 라벨과 편집거리 비교에 쓰는 짧은 토큰
  officialDomains: string[];
}

export const BRANDS: BrandEntry[] = [
  { name: "토스", aliases: ["toss", "tosspay"], officialDomains: ["toss.im", "tossbank.com", "tosspayments.com"] },
  { name: "카카오페이", aliases: ["kakaopay", "kakao"], officialDomains: ["kakaopay.com", "kakao.com"] },
  { name: "네이버페이", aliases: ["naverpay", "npay", "naver"], officialDomains: ["naver.com", "pay.naver.com"] },
  { name: "국민은행", aliases: ["kbstar", "kookmin", "kbpay"], officialDomains: ["kbstar.com", "kbpay.co.kr"] },
  { name: "신한은행", aliases: ["shinhan"], officialDomains: ["shinhan.com", "shinhancard.com"] },
  { name: "우리은행", aliases: ["wooribank", "woori"], officialDomains: ["wooribank.com"] },
  { name: "하나은행", aliases: ["hanabank", "kebhana", "hana"], officialDomains: ["hanabank.com", "kebhana.com"] },
  { name: "농협", aliases: ["nonghyup", "nhbank"], officialDomains: ["nonghyup.com", "banking.nonghyup.com"] },
  { name: "제로페이", aliases: ["zeropay"], officialDomains: ["zeropay.or.kr"] },
  { name: "쿠팡", aliases: ["coupang", "coupangpay"], officialDomains: ["coupang.com"] },
  { name: "배달의민족", aliases: ["baemin"], officialDomains: ["baemin.com"] },
];

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
