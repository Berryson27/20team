/**
 * S3 도메인 휴리스틱 (검증엔진 §4-S3). HanQ 서버 휴리스틱 + 20team 로컬 URL 규칙(R1~R18)의 합집합.
 * ⚠ HTTPS 유무는 무점수(피싱 87%가 HTTPS). 자물쇠 신화 배제.
 *
 * 반환 score 는 **캡 없이** raw 합산한다(granular 규칙·decisive-combo 보존). 최종 상한은
 * 엔진의 combineScore 가 min(S3,40) 로 적용하므로(§3.6) 여기서 캡을 없애도 판정은 불변.
 * 예외: 신뢰 도메인은 안전측으로 15 상한(20team R1).
 *
 * 중복 제거 원칙: HanQ 기존 신호(ip_literal / idn_homoglyph / risky_tld / 브랜드 레벤슈타인 /
 * RDAP 연령)는 유지하고, 20team 동일 규칙은 데이터 테이블만 병합(중복 신호 금지).
 * shortener 는 S2(redirect)가 담당하므로 여기서는 신호를 만들지 않는다.
 */
import { BRANDS, OFFICIAL_DOMAINS, RISKY_TLDS } from "../shared/brands.ts";

const RDAP_TIMEOUT_MS = 2500;

// ── 병합 데이터 테이블 (20team src/lib/url-analysis.ts 이식 + HanQ shared/brands 병합) ──

// 다단계 공용 접미사 (registrable 도메인 계산용)
const MULTI_SUFFIXES = new Set([
  "co.kr", "go.kr", "or.kr", "ac.kr", "ne.kr", "pe.kr", "re.kr", "hs.kr", "ms.kr", "es.kr", "sc.kr",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "co.uk", "org.uk", "gov.uk", "ac.uk",
  "com.cn", "com.tw", "com.hk", "com.sg", "com.au", "com.br", "co.in", "co.nz",
]);

// 접미사 전체를 신뢰 (정부·교육 기관 전용 등록 영역)
const TRUSTED_SUFFIXES = ["go.kr", "ac.kr", "mil.kr"];

// 20team 신뢰 도메인 화이트리스트(registrable 기준) — HanQ OFFICIAL_DOMAINS 와 병합해서 사용
const TRUSTED_DOMAINS_20 = [
  // 포털·플랫폼
  "naver.com", "naver.me", "navercorp.com", "kakao.com", "kakaocorp.com", "daum.net",
  "google.com", "google.co.kr", "youtube.com", "gmail.com", "apple.com", "icloud.com",
  "microsoft.com", "live.com", "office.com", "github.com", "wikipedia.org",
  "instagram.com", "facebook.com", "x.com", "twitter.com", "linkedin.com", "netflix.com",
  "amazon.com", "paypal.com", "telegram.org", "whatsapp.com", "line.me",
  // 금융
  "kakaobank.com", "kakaopay.com", "toss.im", "tossbank.com", "tosspayments.com",
  "kbstar.com", "kbcard.com", "kbanknow.com", "shinhan.com", "shinhancard.com",
  "wooribank.com", "wooricard.com", "kebhana.com", "hanacard.co.kr", "hanafn.com",
  "nonghyup.com", "nhbank.com", "ibk.co.kr", "suhyup-bank.com", "citibank.co.kr", "scfirstbank.com",
  "samsungcard.com", "hyundaicard.com", "lottecard.co.kr", "bccard.com", "upbit.com", "bithumb.com",
  // 쇼핑·생활
  "coupang.com", "coupangplay.com", "gmarket.co.kr", "auction.co.kr", "11st.co.kr",
  "ssg.com", "lotteon.com", "musinsa.com", "kurly.com", "oliveyoung.co.kr", "danawa.com",
  "baemin.com", "yogiyo.co.kr", "daangn.com", "bunjang.co.kr", "interpark.com",
  "yes24.com", "aladin.co.kr", "kyobobook.co.kr", "cgv.co.kr", "megabox.co.kr", "lottecinema.co.kr",
  "melon.com", "genie.co.kr", "wanted.co.kr", "saramin.co.kr", "jobkorea.co.kr", "inflearn.com",
  "hanatour.com", "koreanair.com", "flyasiana.com", "kakaofriends.com", "kakaomobility.com",
  // 공공·통신·택배
  "gov.kr", "korea.kr", "epost.kr", "kisa.or.kr", "fss.or.kr", "kftc.or.kr",
  "sktelecom.com", "kt.com", "lguplus.com", "cjlogistics.com", "hanjin.co.kr", "lotteglogis.com",
  // 언론
  "yna.co.kr", "chosun.com", "joongang.co.kr", "donga.com", "hani.co.kr", "khan.co.kr",
  "mk.co.kr", "hankyung.com", "mt.co.kr", "edaily.co.kr", "sedaily.com", "newsis.com", "news1.kr",
  "ytn.co.kr", "kbs.co.kr", "imbc.com", "sbs.co.kr", "jtbc.co.kr", "yonhapnewstv.co.kr",
];

// 신뢰 집합: HanQ OFFICIAL_DOMAINS(BRANDS.officialDomains + GLOBAL_TRUSTED) ∪ 20team TRUSTED_DOMAINS
const TRUSTED_SET = new Set<string>([...OFFICIAL_DOMAINS, ...TRUSTED_DOMAINS_20]);

// 위험 TLD: HanQ RISKY_TLDS 에 20team HIGH/MED_RISK_TLDS 를 접어 넣어 커버리지 확장(신호는 하나만).
const RISKY_TLDS_EXT = new Set<string>([
  ...RISKY_TLDS,
  // HIGH_RISK_TLDS
  "tk", "ml", "ga", "cf", "gq", "top", "click", "zip", "mov", "icu", "cyou", "rest",
  "buzz", "cam", "quest", "work", "monster", "stream", "download", "racing", "win",
  "bid", "loan", "men", "party", "date", "faith", "review", "accountant", "science", "pw",
  // MED_RISK_TLDS
  "xyz", "shop", "site", "online", "live", "vip", "best", "lol", "sbs",
]);

// 20team 브랜드 사전(brand-subdomain 위장 탐지용 공식 도메인 목록) + HanQ OFFICIAL_DOMAINS 병합
const DISGUISE_OFFICIALS = [...new Set<string>([
  ...OFFICIAL_DOMAINS,
  "naver.com", "naver.me", "navercorp.com",
  "kakao.com", "kakaocorp.com", "kakaobank.com", "kakaopay.com", "kakaofriends.com", "kakaomobility.com",
  "daum.net", "toss.im", "tossbank.com", "tosspayments.com", "coupang.com", "coupangplay.com",
  "google.com", "google.co.kr", "youtube.com", "gmail.com", "apple.com", "icloud.com",
  "samsung.com", "samsungcard.com", "samsungfire.com", "samsungpop.com",
  "kbstar.com", "kbcard.com", "kbanknow.com", "shinhan.com", "shinhancard.com",
  "wooribank.com", "wooricard.com", "kebhana.com", "hanacard.co.kr", "hanafn.com",
  "nonghyup.com", "nhbank.com", "ibk.co.kr", "hometax.go.kr", "police.go.kr",
  "gov.kr", "minwon.go.kr", "epost.kr", "epost.go.kr", "cjlogistics.com", "hanjin.co.kr",
  "upbit.com", "bithumb.com", "paypal.com", "netflix.com", "instagram.com", "telegram.org",
])];

// QR 중개(콘텐츠 공유) 페이지 — 실제 목적지를 가림
const QR_INTERSTITIALS = new Set([
  "me-qr.com", "qrco.de", "qr.io", "qrfy.com", "flowcode.com", "qr-code-generator.com",
  "qrs.ly", "linktr.ee", "qr.link", "beaconstac.com",
]);

const FREE_HOSTS = new Set([
  "duckdns.org", "000webhostapp.com", "weebly.com", "wixsite.com", "webnode.page",
  "netlify.app", "vercel.app", "web.app", "firebaseapp.com", "pages.dev", "glitch.me",
  "repl.co", "onrender.com", "github.io", "blogspot.com", "square.site", "mystrikingly.com",
]);

const HOST_KEYWORDS = [
  "login", "signin", "verify", "verification", "secure", "security", "account", "update",
  "confirm", "password", "banking", "wallet", "billing", "invoice", "delivery", "parcel",
  "tracking", "shipment", "refund", "tax", "bonus", "prize", "gift", "auth", "official", "support",
  "vaccine", "booking", "reserve", "safety", "loan",
];

const PATH_KEYWORD_PATTERN = /login|signin|verify|account|password|passwd|billing|wallet|seed|recovery|bank/i;

// ── 타입 ────────────────────────────────────────────────────────

export interface HeuristicSignal {
  id: string;
  points: number;
  title: string;
  detail: string;
  level: "warning" | "danger";
}

export interface HeuristicResult {
  score: number; // raw 합산(비신뢰 도메인은 캡 없음; 신뢰 도메인은 15 상한). 최종 상한은 combineScore.
  flags: string[];
  detail: string;
  domainAgeDays: number | null;
  trusted: boolean; // 공식/신뢰 도메인 화이트리스트 매치
  brandImitated: string | null;
  signals: HeuristicSignal[]; // 개별 규칙 신호(id/points)
}

// ── 유틸 ────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

/** registrable 도메인(등록 가능한 최상위 라벨) 계산 */
function registrableDomain(host: string): string {
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
}

function isTrusted(host: string, registrable: string): boolean {
  if (TRUSTED_SET.has(registrable) || TRUSTED_SET.has(host)) return true;
  if ([...TRUSTED_SET].some((d) => host === d || host.endsWith("." + d))) return true;
  return TRUSTED_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
}

/** RDAP 로 도메인 등록일 조회(무키, best-effort) → 등록 후 경과일. 오프라인/실패 시 null. */
async function domainAgeDays(host: string): Promise<number | null> {
  const domain = registrableDomain(host);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RDAP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: ctrl.signal,
      headers: { accept: "application/rdap+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
    };
    const reg = data.events?.find((e) => e.eventAction === "registration");
    if (!reg?.eventDate) return null;
    const ageMs = Date.now() - new Date(reg.eventDate).getTime();
    return Math.max(0, Math.floor(ageMs / 86_400_000));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 타이포스쿼팅/사칭(HanQ 레벤슈타인): 공식 아닌 도메인이 브랜드를 흉내내는가 */
function detectBrandImitation(sld: string): {
  score: number;
  brand: string | null;
  flag: string | null;
} {
  if (!sld) return { score: 0, brand: null, flag: null };
  const label = sld.toLowerCase();
  const tokens = label.split(/[^a-z0-9]+/).filter(Boolean);

  let best: { score: number; brand: string; flag: string } | null = null;
  for (const brand of BRANDS) {
    for (const alias of brand.aliases) {
      const short = alias.length <= 4;
      if (tokens.includes(alias) || label.includes(alias)) {
        const cand = { score: 30, brand: brand.name, flag: "brand_lookalike" };
        if (!best || cand.score > best.score) best = cand;
        continue;
      }
      const dist = Math.min(
        levenshtein(label, alias),
        ...tokens.map((t) => levenshtein(t, alias))
      );
      if (dist === 1) {
        const cand = { score: 30, brand: brand.name, flag: "typosquat_d1" };
        if (!best || cand.score > best.score) best = cand;
      } else if (dist === 2 && !short) {
        const cand = { score: 20, brand: brand.name, flag: "typosquat_d2" };
        if (!best || cand.score > best.score) best = cand;
      }
    }
  }
  return best
    ? { score: best.score, brand: best.brand, flag: best.flag }
    : { score: 0, brand: null, flag: null };
}

// ── 분석 본체 ───────────────────────────────────────────────────

/**
 * @param finalUrl 리다이렉트 최종 URL(전체). 호스트만 넘어와도(스킴 없이) https:// 로 보정.
 */
export async function runHeuristics(finalUrl: string): Promise<HeuristicResult> {
  let url: URL;
  try {
    url = new URL(finalUrl);
  } catch {
    try {
      url = new URL("https://" + finalUrl);
    } catch {
      // 파싱 불가 — 안전측으로 특이신호 없음 처리
      return {
        score: 0, flags: [], detail: "URL 파싱 불가", domainAgeDays: null,
        trusted: false, brandImitated: null, signals: [],
      };
    }
  }

  const fullUrl = url.toString();
  const host = url.hostname.toLowerCase();
  const registrable = registrableDomain(host);
  const tld = host.split(".").at(-1) ?? "";
  const trusted = isTrusted(host, registrable);

  const signals: HeuristicSignal[] = [];
  const flags: string[] = [];
  const add = (
    id: string, points: number, title: string, detail: string,
    level: "warning" | "danger" = "warning",
  ) => {
    signals.push({ id, points, title, detail, level });
    flags.push(id);
  };

  // R1: 신뢰(공식) 도메인 — 구조 신호 검사 면제, 안전측 상한.
  if (trusted) {
    return {
      score: 0,
      flags: ["official_domain"],
      detail: "공식 등록 도메인",
      domainAgeDays: null,
      trusted: true,
      brandImitated: null,
      signals: [],
    };
  }

  // R2: userinfo(@) 트릭
  if (url.username || url.password) {
    add("userinfo", 45, "주소 속 가짜 도메인", "@ 앞에 가짜 주소를 넣어 실제 접속지를 숨기는 수법입니다.", "danger");
  }

  // (HanQ) IP 직결 — 20team ip-host 와 중복이므로 HanQ 신호 하나만.
  if (isIpLiteral(host)) {
    add("ip_literal", 20, "도메인 없는 직접 접속", "일반 도메인 대신 IP 주소로 연결합니다.", "danger");
  }

  // (HanQ) punycode/homoglyph — 20team homoglyph 와 중복이므로 HanQ 신호 하나만.
  if (host.includes("xn--")) {
    add("idn_homoglyph", 25, "위장 문자 사용", "비슷하게 보이는 다른 문자 체계를 사용할 수 있습니다.", "danger");
  }

  // R8: 호스트에 인코딩 문자(%xx)
  if (/%[0-9a-f]{2}/i.test(fullUrl.split("/")[2] ?? "")) {
    add("encoded-host", 25, "주소 인코딩 위장", "호스트 이름에 인코딩된 문자가 섞여 있습니다.", "danger");
  }

  const segments = host.split(/[.-]/).filter(Boolean);

  // R4: 공식 도메인이 서브도메인 자리에 위장 (naver.com.evil.xyz)
  const disguised = DISGUISE_OFFICIALS.find(
    (official) => host !== official && !host.endsWith(`.${official}`) && host.includes(official),
  );
  if (disguised) {
    add("brand-subdomain", 50, "공식 주소를 앞에 붙인 위장", `${disguised}처럼 보이지만 실제 도메인은 ${registrable}입니다.`, "danger");
  }

  // R3/R5 (HanQ 레벤슈타인 통합): 브랜드 토큰/타이포스쿼팅. brand-subdomain 이 이미 잡았으면 생략.
  const sld = registrable.split(".")[0] ?? host;
  const brand = disguised
    ? { score: 0, brand: null as string | null, flag: null as string | null }
    : detectBrandImitation(sld);
  if (brand.score > 0) {
    add(brand.flag ?? "brand-impersonation", brand.score, `${brand.brand} 사칭 의심 주소`, `${brand.brand} 관련 이름을 쓰지만 공식 도메인이 아닙니다.`, "danger");
  }

  // R5-2: 가짜 국가도메인 — go.kr 을 흉내 낸 go-kr 등 하이픈 변형
  if (/(^|[.-])(go|co|or|ac|gov)-kr([.-]|$)/.test(host)) {
    add("fake-cctld", 45, "가짜 정부·기관 주소 형식", "go.kr 같은 공식 국가도메인을 하이픈으로 흉내 낸 주소입니다.", "danger");
  }

  // R11 (HanQ risky_tld): 위험 TLD — 20team HIGH/MED 를 병합한 RISKY_TLDS_EXT 사용, 신호는 하나(+10).
  if (RISKY_TLDS_EXT.has(tld)) {
    add("risky_tld", 10, "피싱에 자주 쓰이는 주소 형식", `.${tld} 주소는 피싱에 자주 악용됩니다.`);
  }

  // R12-2: QR 중개 서비스
  if (QR_INTERSTITIALS.has(registrable)) {
    add("qr-interstitial", 25, "QR 중개 서비스 주소", "실제 콘텐츠를 가린 중개 페이지입니다. 최종 도착지를 확인해야 합니다.");
  }

  // R9: 무료 호스팅·DDNS
  if (FREE_HOSTS.has(registrable)) {
    add("free-host", 22, "무료 호스팅 주소", "누구나 만들 수 있는 무료 호스팅에 올라간 페이지입니다.");
  }

  // R10: 호스트 민감 키워드
  const keywordHits = HOST_KEYWORDS.filter((keyword) =>
    segments.some((segment) => segment === keyword || (keyword.length >= 5 && segment.includes(keyword))),
  );
  if (keywordHits.length) {
    const points = Math.min(20 + (keywordHits.length - 1) * 10, 30);
    add("host-keyword", points, "유인 단어가 든 주소", `주소에 '${keywordHits.slice(0, 3).join(", ")}' 같은 유인 단어가 들어 있습니다.`);
  }

  // R13: 비표준 포트
  if (url.port && url.port !== "80" && url.port !== "443") {
    add("odd-port", 15, "비표준 포트 사용", `일반적이지 않은 포트(${url.port})로 연결합니다.`);
  }

  // R14: 과도한 서브도메인
  const extraLabels = host.split(".").length - registrable.split(".").length;
  if (extraLabels >= 3) {
    add("deep-subdomain", 15, "겹겹이 쌓인 서브도메인", "주소 앞부분을 길게 만들어 진짜 도메인을 숨기는 수법입니다.");
  }

  // R16: 구조 이상 신호
  if (host.length > 45) {
    add("long-host", 10, "비정상적으로 긴 주소", "호스트 이름이 비정상적으로 깁니다.");
  }
  if ((registrable.split(".")[0] ?? "").replace(/-/g, "").length >= 20) {
    add("long-sld", 15, "단어를 길게 이어 붙인 도메인", "단어를 길게 이어 붙인 도메인은 일회용 피싱 사이트에 자주 쓰입니다.");
  }
  if (((registrable.split(".")[0] ?? "").match(/-/g)?.length ?? 0) >= 3) {
    add("many-hyphens", 12, "하이픈 남용 주소", "하이픈을 여러 개 이어 붙인 의심 주소입니다.");
  }
  if (PATH_KEYWORD_PATTERN.test(url.pathname + url.search)) {
    add("path-keyword", 10, "로그인·계정 경로", "주소 경로가 로그인·계정 정보 입력을 가리킵니다.");
  }

  // R17: APK 직접 다운로드 경로 (엔진은 S0 executable 에서 선처리하지만, 휴리스틱 단독 호출 시에도 고위험).
  if (/\.apk(?:$|[?#])/i.test(fullUrl)) {
    add("apk-path", 60, "APK 직접 설치 주소", "앱스토어를 거치지 않는 설치 파일로 연결됩니다.", "danger");
  }

  // 도메인 연령 (RDAP, best-effort)
  const age = await domainAgeDays(host);
  if (age !== null) {
    if (age < 7) add("domain_lt_7d", 25, "신생 도메인", `등록 ${age}일차 신생 도메인입니다.`, "danger");
    else if (age < 30) add("domain_lt_30d", 18, "신생 도메인", `등록 ${age}일차 신생 도메인입니다.`);
    else if (age < 90) add("domain_lt_90d", 8, "비교적 새 도메인", `등록 ${age}일차 도메인입니다.`);
  }

  let score = signals.reduce((sum, s) => sum + s.points, 0);

  // R18: 약한 신호 결합 상향 — 유인 키워드·무료호스팅·QR중개·긴 SLD 가 다른 신호와 겹치면 경고선까지.
  const comboTrigger = signals.some((s) =>
    ["host-keyword", "free-host", "qr-interstitial", "long-sld"].includes(s.id),
  );
  if (comboTrigger && signals.length >= 2 && score >= 25 && score < 40) {
    signals.push({ id: "combo-bump", points: 40 - score, title: "복합 위험 신호", detail: "약한 신호가 여러 개 겹쳐 경고선까지 상향했습니다.", level: "warning" });
    flags.push("combo-bump");
    score = 40;
  }

  const detailParts: string[] = [];
  if (age !== null) detailParts.push(age < 30 ? `등록 ${age}일차 신생 도메인` : `등록 ${Math.floor(age / 365)}년`);
  if (brand.brand) detailParts.push(`${brand.brand} 사칭 의심`);
  if (disguised) detailParts.push("공식 주소 위장");
  if (RISKY_TLDS_EXT.has(tld)) detailParts.push(`위험 TLD .${tld}`);
  if (isIpLiteral(host)) detailParts.push("IP 직접 접속");

  return {
    score,
    flags,
    detail: detailParts.join(" · ") || "특이 신호 없음",
    domainAgeDays: age,
    trusted: false,
    brandImitated: brand.brand,
    signals,
  };
}
