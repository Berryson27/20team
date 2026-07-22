/**
 * Task 6 — 정확도 회귀 벤치마크: 통합(NEW) heuristics vs 20team 기존 로컬(OLD) 엔진.
 *
 * 실행: cd functions && node --experimental-strip-types src/verify/heuristics.bench.ts
 *
 * 설계 메모:
 * - NEW 엔진은 `runHeuristics`(./heuristics.ts, Task 4/5 병합본, RDAP 포함) — 상대경로 in-tree import.
 * - OLD 엔진(20team 로컬 엔진, `src/lib/url-analysis.ts`)은 이 파일 안에 그대로 복사해 넣었다.
 *   이유: functions/tsconfig.json 의 rootDir 가 "src"(functions/src) 로 고정되어 있어
 *   `../../../src/lib/url-analysis.ts` 처럼 레포 루트 밖 파일을 import 하면
 *   `npm run build`(tsc) 가 TS6059(File is not under 'rootDir')로 실패한다 (직접 검증함).
 *   런타임(`node --experimental-strip-types`)만 놓고 보면 상대경로 import 자체는 되지만,
 *   tsc 빌드 게이트를 깨뜨리지 않기 위해 OLD 엔진 로직을 그대로 복사하는 쪽을 택했다
 *   (task-6-brief.md 의 fallback 지시: "copying just the analyzeUrlLocally scoring ... reporting the deviation").
 *   복사본은 `src/lib/url-analysis.ts` 와 100% 동일한 로직이며, 실제 판정 함수만 별도 이름
 *   (`analyzeUrlLocallyOld`)으로 export 해 NEW 엔진과 이름이 섞이지 않게 했다.
 * - 샘플도 같은 이유로 `scripts/benchmark.ts` 의 배열을 그대로 복사했다(레포 밖 import 회피).
 * - RDAP 오프라인 타임아웃(약 2.5초)이 샘플마다 순차 대기되는 것을 막기 위해
 *   NEW 엔진 채점은 `Promise.all`로 전부 동시 실행한다 — 전체 소요시간이 N×2.5초가 아니라
 *   ~2.5초 근처가 되도록. 오프라인에서는 RDAP 가 age 신호를 전혀 못 얻으므로(0점 기여),
 *   이 벤치마크는 문자열 규칙만으로 측정한 하한값이다 — 실제 RDAP 는 피싱 신호를 더할 뿐
 *   낮추지 않으므로 recall 은 실전에서 이보다 같거나 높다.
 * - 판정 기준(게이트, spec §9): phish는 score>=40 이면 정답, benign은 score<40 이면 정답.
 *   OLD 엔진은 원래도 캡 100 + score>=40 을 "탐지"로 취급했으므로(20team scripts/benchmark.ts 참조)
 *   동일 기준을 그대로 쓴다. NEW 엔진은 캡 없는 raw score 를 그대로 같은 기준(>=40)으로 비교한다
 *   (엔진의 최종 combineScore 는 S3 자체를 min(40)으로 캡하지만, 그 캡 자체가 ">=40 여부"에는
 *   영향을 주지 않으므로 결과는 동일하다).
 */

import { runHeuristics } from "./heuristics.ts";

// ────────────────────────────────────────────────────────────────
// OLD 엔진 — 20team src/lib/url-analysis.ts 그대로 복사 (§ 상단 설명 참조)
// ────────────────────────────────────────────────────────────────

type OldSignal = {
  stage: "domain" | "redirect" | "content";
  id: string;
  points: number;
  title: string;
  detail: string;
  level: "warning" | "danger";
};

type OldAnalysis = {
  host: string;
  registrable: string;
  trusted: boolean;
  score: number;
  signals: OldSignal[];
};

const OLD_MULTI_SUFFIXES = new Set([
  "co.kr", "go.kr", "or.kr", "ac.kr", "ne.kr", "pe.kr", "re.kr", "hs.kr", "ms.kr", "es.kr", "sc.kr",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "co.uk", "org.uk", "gov.uk", "ac.uk",
  "com.cn", "com.tw", "com.hk", "com.sg", "com.au", "com.br", "co.in", "co.nz",
]);

const OLD_TRUSTED_SUFFIXES = ["go.kr", "ac.kr", "mil.kr"];

const OLD_TRUSTED_DOMAINS = new Set([
  "naver.com", "naver.me", "navercorp.com", "kakao.com", "kakaocorp.com", "daum.net",
  "google.com", "google.co.kr", "youtube.com", "gmail.com", "apple.com", "icloud.com",
  "microsoft.com", "live.com", "office.com", "github.com", "wikipedia.org",
  "instagram.com", "facebook.com", "x.com", "twitter.com", "linkedin.com", "netflix.com",
  "amazon.com", "paypal.com", "telegram.org", "whatsapp.com", "line.me",
  "kakaobank.com", "kakaopay.com", "toss.im", "tossbank.com", "tosspayments.com",
  "kbstar.com", "kbcard.com", "kbanknow.com", "shinhan.com", "shinhancard.com",
  "wooribank.com", "wooricard.com", "kebhana.com", "hanacard.co.kr", "hanafn.com",
  "nonghyup.com", "nhbank.com", "ibk.co.kr", "suhyup-bank.com", "citibank.co.kr", "scfirstbank.com",
  "samsungcard.com", "hyundaicard.com", "lottecard.co.kr", "bccard.com", "upbit.com", "bithumb.com",
  "coupang.com", "coupangplay.com", "gmarket.co.kr", "auction.co.kr", "11st.co.kr",
  "ssg.com", "lotteon.com", "musinsa.com", "kurly.com", "oliveyoung.co.kr", "danawa.com",
  "baemin.com", "yogiyo.co.kr", "daangn.com", "bunjang.co.kr", "interpark.com",
  "yes24.com", "aladin.co.kr", "kyobobook.co.kr", "cgv.co.kr", "megabox.co.kr", "lottecinema.co.kr",
  "melon.com", "genie.co.kr", "wanted.co.kr", "saramin.co.kr", "jobkorea.co.kr", "inflearn.com",
  "hanatour.com", "koreanair.com", "flyasiana.com", "kakaofriends.com", "kakaomobility.com",
  "gov.kr", "korea.kr", "epost.kr", "kisa.or.kr", "fss.or.kr", "kftc.or.kr",
  "sktelecom.com", "kt.com", "lguplus.com", "cjlogistics.com", "hanjin.co.kr", "lotteglogis.com",
  "yna.co.kr", "chosun.com", "joongang.co.kr", "donga.com", "hani.co.kr", "khan.co.kr",
  "mk.co.kr", "hankyung.com", "mt.co.kr", "edaily.co.kr", "sedaily.com", "newsis.com", "news1.kr",
  "ytn.co.kr", "kbs.co.kr", "imbc.com", "sbs.co.kr", "jtbc.co.kr", "yonhapnewstv.co.kr",
]);

const OLD_BRANDS: { tokens: string[]; official: string[] }[] = [
  { tokens: ["naver", "naverpay", "navercorp"], official: ["naver.com", "naver.me", "navercorp.com"] },
  { tokens: ["kakao", "kakaopay", "kakaobank", "kakaotalk"], official: ["kakao.com", "kakaocorp.com", "kakaobank.com", "kakaopay.com", "kakaofriends.com", "kakaomobility.com"] },
  { tokens: ["daum"], official: ["daum.net"] },
  { tokens: ["toss", "tossbank", "tosspay"], official: ["toss.im", "tossbank.com", "tosspayments.com"] },
  { tokens: ["coupang"], official: ["coupang.com", "coupangplay.com"] },
  { tokens: ["google"], official: ["google.com", "google.co.kr", "youtube.com", "gmail.com"] },
  { tokens: ["apple", "icloud"], official: ["apple.com", "icloud.com"] },
  { tokens: ["samsung", "samsungcard", "samsungpay"], official: ["samsung.com", "samsungcard.com", "samsungfire.com", "samsungpop.com"] },
  { tokens: ["kbstar", "kbcard", "kbank"], official: ["kbstar.com", "kbcard.com", "kbanknow.com"] },
  { tokens: ["shinhan"], official: ["shinhan.com", "shinhancard.com"] },
  { tokens: ["woori", "wooribank"], official: ["wooribank.com", "wooricard.com"] },
  { tokens: ["hanabank", "hanacard", "kebhana"], official: ["kebhana.com", "hanacard.co.kr", "hanafn.com"] },
  { tokens: ["nonghyup", "nhbank"], official: ["nonghyup.com", "nhbank.com"] },
  { tokens: ["ibk"], official: ["ibk.co.kr"] },
  { tokens: ["hometax"], official: ["hometax.go.kr"] },
  { tokens: ["police"], official: ["police.go.kr"] },
  { tokens: ["gov24", "minwon"], official: ["gov.kr", "minwon.go.kr"] },
  { tokens: ["epost", "koreapost"], official: ["epost.kr", "epost.go.kr"] },
  { tokens: ["cjlogistics"], official: ["cjlogistics.com"] },
  { tokens: ["hanjin"], official: ["hanjin.co.kr"] },
  { tokens: ["upbit"], official: ["upbit.com"] },
  { tokens: ["bithumb"], official: ["bithumb.com"] },
  { tokens: ["paypal"], official: ["paypal.com"] },
  { tokens: ["netflix"], official: ["netflix.com"] },
  { tokens: ["instagram"], official: ["instagram.com"] },
  { tokens: ["telegram"], official: ["telegram.org"] },
];

const OLD_BRAND_AFFIXES = new Set([
  "pay", "bank", "card", "event", "login", "secure", "help", "center", "support",
  "kr", "korea", "official", "mall", "shop", "gift", "point", "plus", "app", "web",
  "my", "e", "m", "id", "auth", "wallet", "check", "verify", "care", "service",
  "update", "delivery", "safe", "safety", "cert", "info", "notice", "cs",
]);

const OLD_HIGH_RISK_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", "top", "click", "zip", "mov", "icu", "cyou", "rest",
  "buzz", "cam", "quest", "work", "monster", "stream", "download", "racing", "win",
  "bid", "loan", "men", "party", "date", "faith", "review", "accountant", "science", "pw",
]);
const OLD_MED_RISK_TLDS = new Set(["xyz", "shop", "site", "online", "live", "vip", "best", "lol", "sbs"]);

const OLD_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "buff.ly", "cutt.ly", "rb.gy",
  "ow.ly", "han.gl", "me2.do", "url.kr", "vo.la", "lrl.kr", "c11.kr", "zrr.kr", "shorturl.at",
]);

const OLD_QR_INTERSTITIALS = new Set([
  "me-qr.com", "qrco.de", "qr.io", "qrfy.com", "flowcode.com", "qr-code-generator.com",
  "qrs.ly", "linktr.ee", "qr.link", "beaconstac.com",
]);

const OLD_FREE_HOSTS = new Set([
  "duckdns.org", "000webhostapp.com", "weebly.com", "wixsite.com", "webnode.page",
  "netlify.app", "vercel.app", "web.app", "firebaseapp.com", "pages.dev", "glitch.me",
  "repl.co", "onrender.com", "github.io", "blogspot.com", "square.site", "mystrikingly.com",
]);

const OLD_HOST_KEYWORDS = [
  "login", "signin", "verify", "verification", "secure", "security", "account", "update",
  "confirm", "password", "banking", "wallet", "billing", "invoice", "delivery", "parcel",
  "tracking", "shipment", "refund", "tax", "bonus", "prize", "gift", "auth", "official", "support",
  "vaccine", "booking", "reserve", "safety", "loan",
];

const OLD_PATH_KEYWORD_PATTERN = /login|signin|verify|account|password|passwd|billing|wallet|seed|recovery|bank/i;

function oldRegistrableDomain(host: string): string {
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (OLD_MULTI_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

function oldEditDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const previous = new Array(b.length + 1).fill(0).map((_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1);
      diagonal = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, substitution);
    }
  }
  return previous[b.length];
}

function oldIsTrusted(host: string, registrable: string): boolean {
  if (OLD_TRUSTED_DOMAINS.has(registrable)) return true;
  return OLD_TRUSTED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function oldMatchBrandToken(segments: string[], tokens: string[]): string | null {
  for (const segment of segments) {
    for (const token of tokens) {
      if (segment === token) return token;
      if (token.length >= 5) {
        if (segment.startsWith(token) && OLD_BRAND_AFFIXES.has(segment.slice(token.length))) return token;
        if (segment.endsWith(token) && OLD_BRAND_AFFIXES.has(segment.slice(0, segment.length - token.length))) return token;
      }
    }
  }
  return null;
}

function analyzeUrlLocallyOld(rawUrl: string): OldAnalysis {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const registrable = oldRegistrableDomain(host);
  const signals: OldSignal[] = [];
  const add = (id: string, points: number, title: string, detail: string, level: "warning" | "danger" = "warning") => {
    signals.push({ stage: "domain", id, points, title, detail, level });
  };

  const trusted = oldIsTrusted(host, registrable);

  if (url.protocol === "http:") add("http", 10, "암호화되지 않은 주소", "HTTPS 보안 연결을 사용하지 않습니다.");

  if (trusted) {
    const score = Math.min(signals.reduce((sum, item) => sum + item.points, 0), 15);
    return { host, registrable, trusted, score, signals };
  }

  if (url.username || url.password) add("userinfo", 45, "주소 속 가짜 도메인", "@ 앞에 가짜 주소를 넣어 실제 접속지를 숨기는 수법입니다.", "danger");

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) {
    add("ip-host", 40, "도메인 없는 직접 접속", "일반 도메인 대신 IP 주소로 연결합니다.", "danger");
  }

  if (host.includes("xn--")) add("homoglyph", 40, "위장 문자 사용", "비슷하게 보이는 다른 문자 체계를 사용할 수 있습니다.", "danger");

  if (/%[0-9a-f]{2}/i.test(rawUrl.split("/")[2] ?? "")) add("encoded-host", 25, "주소 인코딩 위장", "호스트 이름에 인코딩된 문자가 섞여 있습니다.", "danger");

  const segments = host.split(/[.-]/).filter(Boolean);

  const officialDomains = OLD_BRANDS.flatMap((brand) => brand.official);
  const disguised = officialDomains.find((official) => host !== official && !host.endsWith(`.${official}`) && host.includes(official));
  if (disguised) {
    add("brand-subdomain", 50, "공식 주소를 앞에 붙인 위장", `${disguised}처럼 보이지만 실제 도메인은 ${registrable}입니다.`, "danger");
  }

  let impersonatedBrand: string | null = null;
  if (!disguised) {
    for (const brand of OLD_BRANDS) {
      const token = oldMatchBrandToken(segments, brand.tokens);
      if (token && !brand.official.includes(registrable)) {
        impersonatedBrand = token;
        add("brand-impersonation", 45, `${token} 사칭 의심 주소`, `${token} 관련 이름을 쓰지만 공식 도메인이 아닙니다.`, "danger");
        break;
      }
    }
  }

  if (!disguised && !impersonatedBrand) {
    const officialSlds = [...new Set([...officialDomains, ...OLD_TRUSTED_DOMAINS].map((domain) => domain.split(".")[0]))];
    const labels = [...new Set([registrable.split(".")[0], ...host.split(".").filter((label) => label.length >= 5)])];
    outer: for (const label of labels) {
      for (const official of officialSlds) {
        if (official.length < 5 || label === official || officialSlds.includes(label)) continue;
        const allowance = official.length >= 7 ? 2 : 1;
        if (oldEditDistance(label, official, allowance) <= allowance) {
          add("typosquat", 45, `${official} 유사 도메인`, `공식 주소 ${official}와(과) 한두 글자만 다릅니다.`, "danger");
          break outer;
        }
      }
    }
  }

  if (/(^|[.-])(go|co|or|ac|gov)-kr([.-]|$)/.test(host)) {
    add("fake-cctld", 45, "가짜 정부·기관 주소 형식", "go.kr 같은 공식 국가도메인을 하이픈으로 흉내 낸 주소입니다.", "danger");
  }

  const tld = host.split(".").at(-1) ?? "";
  if (OLD_HIGH_RISK_TLDS.has(tld)) add("risky-tld", 20, "피싱에 자주 쓰이는 주소 형식", `.${tld} 주소는 피싱에 자주 악용됩니다.`);
  else if (OLD_MED_RISK_TLDS.has(tld)) add("risky-tld", 12, "주의가 필요한 주소 형식", `.${tld} 주소는 추가 확인이 필요합니다.`);

  if (OLD_SHORTENERS.has(registrable)) add("shortener", 15, "단축 주소 사용", "실제 목적지를 가린 단축 주소입니다. 최종 도착지를 확인해야 합니다.");

  if (OLD_QR_INTERSTITIALS.has(registrable)) add("qr-interstitial", 25, "QR 중개 서비스 주소", "실제 콘텐츠를 가린 중개 페이지입니다. 광고·이동을 거친 최종 도착지를 확인해야 합니다.");

  if (OLD_FREE_HOSTS.has(registrable)) add("free-host", 22, "무료 호스팅 주소", "누구나 만들 수 있는 무료 호스팅에 올라간 페이지입니다.");

  const keywordHits = OLD_HOST_KEYWORDS.filter((keyword) => segments.some((segment) => segment === keyword || (keyword.length >= 5 && segment.includes(keyword))));
  if (keywordHits.length) {
    const points = Math.min(20 + (keywordHits.length - 1) * 10, 30);
    add("host-keyword", points, "유인 단어가 든 주소", `주소에 '${keywordHits.slice(0, 3).join(", ")}' 같은 유인 단어가 들어 있습니다.`);
  }

  if (url.port && url.port !== "80" && url.port !== "443") add("odd-port", 15, "비표준 포트 사용", `일반적이지 않은 포트(${url.port})로 연결합니다.`);

  const extraLabels = host.split(".").length - registrable.split(".").length;
  if (extraLabels >= 3) add("deep-subdomain", 15, "겹겹이 쌓인 서브도메인", "주소 앞부분을 길게 만들어 진짜 도메인을 숨기는 수법입니다.");

  if (host.length > 45) add("long-host", 10, "비정상적으로 긴 주소", "호스트 이름이 비정상적으로 깁니다.");
  if ((registrable.split(".")[0] ?? "").replace(/-/g, "").length >= 20) add("long-sld", 15, "단어를 길게 이어 붙인 도메인", "단어를 길게 이어 붙인 도메인은 일회용 피싱 사이트에 자주 쓰입니다.");
  if (((registrable.split(".")[0] ?? "").match(/-/g)?.length ?? 0) >= 3) add("many-hyphens", 12, "하이픈 남용 주소", "하이픈을 여러 개 이어 붙인 의심 주소입니다.");
  if (rawUrl.length > 150) add("long-url", 8, "지나치게 긴 링크", "주소 전체가 비정상적으로 깁니다.");
  if (OLD_PATH_KEYWORD_PATTERN.test(url.pathname + url.search)) add("path-keyword", 10, "로그인·계정 경로", "주소 경로가 로그인·계정 정보 입력을 가리킵니다.");

  if (/\.apk(?:$|[?#])/i.test(rawUrl)) add("apk-path", 60, "APK 직접 설치 주소", "앱스토어를 거치지 않는 설치 파일로 연결됩니다.", "danger");

  let score = Math.min(signals.reduce((sum, item) => sum + item.points, 0), 100);

  const comboTrigger = signals.some((item) => ["host-keyword", "free-host", "shortener", "qr-interstitial", "long-sld"].includes(item.id));
  if (comboTrigger && signals.length >= 2 && score >= 25 && score < 40) score = 40;

  return { host, registrable, trusted, score, signals };
}

// ────────────────────────────────────────────────────────────────
// 샘플 — 20team scripts/benchmark.ts 의 samples 배열 그대로 복사 (레포 밖 import 회피)
// ────────────────────────────────────────────────────────────────

type Sample = { url: string; label: "phish" | "benign"; note: string };

const samples: Sample[] = [
  // ── 정상(benign) 100건 ─────────────────────────────────────
  { url: "https://www.naver.com", label: "benign", note: "포털" },
  { url: "https://m.naver.com", label: "benign", note: "모바일 포털" },
  { url: "https://blog.naver.com/foodlover123", label: "benign", note: "블로그" },
  { url: "https://nid.naver.com/nidlogin.login?mode=form", label: "benign", note: "공식 로그인" },
  { url: "https://pay.naver.com/history", label: "benign", note: "공식 결제" },
  { url: "https://cafe.naver.com/joonggonara", label: "benign", note: "카페" },
  { url: "https://www.kakao.com", label: "benign", note: "포털" },
  { url: "https://accounts.kakao.com/login?continue=https%3A%2F%2Fkakao.com", label: "benign", note: "공식 로그인" },
  { url: "https://www.kakaobank.com", label: "benign", note: "은행" },
  { url: "https://www.kakaopay.com", label: "benign", note: "결제" },
  { url: "https://www.daum.net", label: "benign", note: "포털" },
  { url: "https://mail.daum.net", label: "benign", note: "메일" },
  { url: "https://www.google.com/search?q=weather", label: "benign", note: "검색" },
  { url: "https://docs.google.com/document/d/abc123", label: "benign", note: "문서" },
  { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", label: "benign", note: "영상" },
  { url: "https://www.apple.com/kr/iphone/", label: "benign", note: "제조사" },
  { url: "https://support.apple.com/ko-kr", label: "benign", note: "고객지원" },
  { url: "https://www.microsoft.com/ko-kr/windows", label: "benign", note: "제조사" },
  { url: "https://github.com/facebook/react", label: "benign", note: "개발" },
  { url: "https://ko.wikipedia.org/wiki/대한민국", label: "benign", note: "백과" },
  { url: "https://www.instagram.com/p/xyz789", label: "benign", note: "SNS" },
  { url: "https://www.facebook.com/groups/12345", label: "benign", note: "SNS" },
  { url: "https://x.com/home", label: "benign", note: "SNS" },
  { url: "https://www.netflix.com/kr/title/81234567", label: "benign", note: "OTT" },
  { url: "https://www.amazon.com/dp/B0ABCDEF", label: "benign", note: "쇼핑" },
  { url: "https://www.paypal.com/kr/home", label: "benign", note: "결제" },
  { url: "https://toss.im", label: "benign", note: "금융" },
  { url: "https://www.tossbank.com", label: "benign", note: "은행" },
  { url: "https://www.kbstar.com", label: "benign", note: "은행" },
  { url: "https://obank.kbstar.com/quics?page=oBank", label: "benign", note: "인터넷뱅킹" },
  { url: "https://card.kbcard.com", label: "benign", note: "카드" },
  { url: "https://www.shinhan.com", label: "benign", note: "은행" },
  { url: "https://bank.shinhan.com/rib/easy/index.jsp", label: "benign", note: "인터넷뱅킹" },
  { url: "https://www.shinhancard.com", label: "benign", note: "카드" },
  { url: "https://www.wooribank.com", label: "benign", note: "은행" },
  { url: "https://spot.wooribank.com/pot/Dream?withyou=ps", label: "benign", note: "인터넷뱅킹" },
  { url: "https://www.kebhana.com", label: "benign", note: "은행" },
  { url: "https://www.hanacard.co.kr", label: "benign", note: "카드" },
  { url: "https://www.nonghyup.com", label: "benign", note: "은행" },
  { url: "https://banking.nonghyup.com/nhbank.html", label: "benign", note: "인터넷뱅킹" },
  { url: "https://www.ibk.co.kr", label: "benign", note: "은행" },
  { url: "https://www.samsungcard.com", label: "benign", note: "카드" },
  { url: "https://www.hyundaicard.com", label: "benign", note: "카드" },
  { url: "https://www.upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC", label: "benign", note: "거래소" },
  { url: "https://www.bithumb.com", label: "benign", note: "거래소" },
  { url: "https://www.coupang.com/vp/products/123456", label: "benign", note: "쇼핑" },
  { url: "https://www.gmarket.co.kr", label: "benign", note: "쇼핑" },
  { url: "https://www.11st.co.kr", label: "benign", note: "쇼핑" },
  { url: "https://www.ssg.com", label: "benign", note: "쇼핑" },
  { url: "https://www.lotteon.com", label: "benign", note: "쇼핑" },
  { url: "https://www.musinsa.com/products/12345", label: "benign", note: "쇼핑" },
  { url: "https://www.kurly.com/goods/100001", label: "benign", note: "쇼핑" },
  { url: "https://www.oliveyoung.co.kr/store/main/main.do", label: "benign", note: "쇼핑" },
  { url: "https://www.danawa.com", label: "benign", note: "가격비교" },
  { url: "https://www.baemin.com", label: "benign", note: "배달" },
  { url: "https://www.yogiyo.co.kr", label: "benign", note: "배달" },
  { url: "https://www.daangn.com", label: "benign", note: "중고거래" },
  { url: "https://m.bunjang.co.kr", label: "benign", note: "중고거래" },
  { url: "https://www.interpark.com", label: "benign", note: "티켓" },
  { url: "https://www.yes24.com", label: "benign", note: "서점" },
  { url: "https://www.aladin.co.kr", label: "benign", note: "서점" },
  { url: "https://product.kyobobook.co.kr/detail/S000001234", label: "benign", note: "서점" },
  { url: "https://www.cgv.co.kr", label: "benign", note: "영화" },
  { url: "https://www.megabox.co.kr", label: "benign", note: "영화" },
  { url: "https://www.melon.com/chart/index.htm", label: "benign", note: "음악" },
  { url: "https://www.genie.co.kr", label: "benign", note: "음악" },
  { url: "https://www.wanted.co.kr/wd/12345", label: "benign", note: "채용" },
  { url: "https://www.saramin.co.kr", label: "benign", note: "채용" },
  { url: "https://www.jobkorea.co.kr", label: "benign", note: "채용" },
  { url: "https://www.inflearn.com/course/react-basic", label: "benign", note: "교육" },
  { url: "https://www.hanatour.com", label: "benign", note: "여행" },
  { url: "https://www.koreanair.com/kr/ko", label: "benign", note: "항공" },
  { url: "https://flyasiana.com/C/KR/KO/index", label: "benign", note: "항공" },
  { url: "https://www.gov.kr", label: "benign", note: "정부" },
  { url: "https://www.korea.kr", label: "benign", note: "정부" },
  { url: "https://hometax.go.kr/websquare/websquare.html", label: "benign", note: "국세청" },
  { url: "https://www.nts.go.kr", label: "benign", note: "국세청" },
  { url: "https://www.police.go.kr", label: "benign", note: "경찰청" },
  { url: "https://www.seoul.go.kr", label: "benign", note: "지자체" },
  { url: "https://www.minwon.go.kr", label: "benign", note: "민원" },
  { url: "https://www.epost.kr", label: "benign", note: "우체국" },
  { url: "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm", label: "benign", note: "우편조회" },
  { url: "https://www.kisa.or.kr", label: "benign", note: "공공기관" },
  { url: "https://www.fss.or.kr", label: "benign", note: "금감원" },
  { url: "https://www.snu.ac.kr", label: "benign", note: "대학" },
  { url: "https://portal.korea.ac.kr", label: "benign", note: "대학" },
  { url: "https://www.sktelecom.com", label: "benign", note: "통신" },
  { url: "https://www.kt.com", label: "benign", note: "통신" },
  { url: "https://www.lguplus.com", label: "benign", note: "통신" },
  { url: "https://www.cjlogistics.com/ko/tool/parcel/tracking", label: "benign", note: "택배조회" },
  { url: "https://www.hanjin.co.kr/kor/CMS/DeliveryMgr/WaybillResult.do", label: "benign", note: "택배조회" },
  { url: "https://en.wikipedia.org/wiki/QR_code", label: "benign", note: "백과" },
  { url: "https://stackoverflow.com/questions/12345", label: "benign", note: "개발" },
  { url: "https://littleforest-bakery.com/menu", label: "benign", note: "일반 소상공인" },
  { url: "https://cafeblossom.co.kr", label: "benign", note: "일반 소상공인" },
  { url: "https://greentable.kr/reservation", label: "benign", note: "일반 소상공인" },
  { url: "https://www.seoulartcenter.or.kr", label: "benign", note: "문화기관" },
  { url: "https://www.busanmuseum.or.kr", label: "benign", note: "문화기관" },
  { url: "https://mysunnygarden.com/about", label: "benign", note: "개인 홈페이지" },
  { url: "https://www.yna.co.kr", label: "benign", note: "언론사" },
  { url: "https://www.chosun.com", label: "benign", note: "언론사" },
  { url: "https://www.hani.co.kr", label: "benign", note: "언론사" },
  { url: "https://www.ytn.co.kr", label: "benign", note: "방송사" },
  { url: "https://news.kbs.co.kr", label: "benign", note: "방송사" },

  // ── 피싱(phish) 100건 ──────────────────────────────────────
  { url: "https://www.navver.com/login", label: "phish", note: "타이포" },
  { url: "https://naever.com", label: "phish", note: "타이포" },
  { url: "https://navercom.xyz", label: "phish", note: "브랜드+TLD" },
  { url: "https://kakaoo.com/event", label: "phish", note: "타이포" },
  { url: "https://kakaobamk.com", label: "phish", note: "타이포" },
  { url: "https://cupang.com/vip-deal", label: "phish", note: "타이포" },
  { url: "https://coupamg.com", label: "phish", note: "타이포" },
  { url: "https://googie.com/security", label: "phish", note: "타이포" },
  { url: "https://paypa1.com/signin", label: "phish", note: "타이포" },
  { url: "https://netfliix.com/billing", label: "phish", note: "타이포" },
  { url: "https://lnstagram.com/verify", label: "phish", note: "타이포" },
  { url: "https://te1egram.org/login", label: "phish", note: "타이포" },
  { url: "https://upbiit.com/exchange", label: "phish", note: "타이포" },
  { url: "https://bithumh.com/wallet", label: "phish", note: "타이포" },
  { url: "https://shinhen.com/card", label: "phish", note: "타이포" },
  { url: "https://wooribamk.com", label: "phish", note: "타이포" },
  { url: "https://hometex.go-kr.com", label: "phish", note: "타이포+위장" },
  { url: "https://kbstor.com/loan", label: "phish", note: "타이포" },
  { url: "https://tossbamk.com", label: "phish", note: "타이포" },
  { url: "https://samsumg.com/event", label: "phish", note: "타이포" },
  { url: "https://naver-security.com/verify", label: "phish", note: "브랜드 사칭" },
  { url: "https://naverpay-event.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://kakao-gift.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://kakaobank-loan.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://kakaopay-refund.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://toss-event.com/cash", label: "phish", note: "브랜드 사칭" },
  { url: "https://tossbank-apply.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://coupang-vip.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://kbstar-secure.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://shinhan-cert.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://wooribank-check.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://nonghyup-auth.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://ibk-loan.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://hanacard-point.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://samsungcard-event.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://apple-id-verify.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://icloud-find.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://google-docs-share.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://netflix-kr-billing.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://paypal-limited.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://instagram-help.net/appeal", label: "phish", note: "브랜드 사칭" },
  { url: "https://upbit-airdrop.com", label: "phish", note: "브랜드 사칭" },
  { url: "https://bithumb-event.net", label: "phish", note: "브랜드 사칭" },
  { url: "https://police-mail.com/summons", label: "phish", note: "기관 사칭" },
  { url: "https://hometax-refund.com", label: "phish", note: "기관 사칭" },
  { url: "https://epost-delivery.com", label: "phish", note: "기관 사칭" },
  { url: "https://cjlogistics-track.com", label: "phish", note: "택배 사칭" },
  { url: "https://hanjin-parcel.net", label: "phish", note: "택배 사칭" },
  { url: "https://naver.com.security-alert.xyz/login", label: "phish", note: "서브도메인 위장" },
  { url: "https://kakao.com.verify-user.top", label: "phish", note: "서브도메인 위장" },
  { url: "https://toss.im.event-cash.click", label: "phish", note: "서브도메인 위장" },
  { url: "https://kbstar.com.secure-check.net", label: "phish", note: "서브도메인 위장" },
  { url: "https://apple.com.id-unlock.info", label: "phish", note: "서브도메인 위장" },
  { url: "https://hometax.go.kr.refund-now.com", label: "phish", note: "서브도메인 위장" },
  { url: "https://www.paypal.com.account-limited.net", label: "phish", note: "서브도메인 위장" },
  { url: "https://naver.com@evil-site.com/login", label: "phish", note: "@ 트릭" },
  { url: "http://kakaobank.com@211.45.33.10/app", label: "phish", note: "@ 트릭+IP" },
  { url: "https://toss.im%40cash-event.net@malware.top", label: "phish", note: "@ 트릭" },
  { url: "http://211.34.123.45/login.php", label: "phish", note: "IP 호스트" },
  { url: "http://45.77.123.9/kakao/index.html", label: "phish", note: "IP 호스트" },
  { url: "https://103.224.182.251/verify", label: "phish", note: "IP 호스트" },
  { url: "http://192.210.145.33:8080/bank", label: "phish", note: "IP+포트" },
  { url: "https://xn--nver-loa.com/login", label: "phish", note: "punycode" },
  { url: "https://xn--kako-n32b.com", label: "phish", note: "punycode" },
  { url: "https://xn--pple-43d.com/icloud", label: "phish", note: "punycode" },
  { url: "http://mobile-guard.net/security.apk", label: "phish", note: "APK" },
  { url: "https://quick-check.top/kakaotalk_update.apk", label: "phish", note: "APK" },
  { url: "http://185.234.72.19/police_app.apk", label: "phish", note: "APK+IP" },
  { url: "https://parcel-view.click/cj_tracking.apk?id=88", label: "phish", note: "APK+택배" },
  { url: "https://kakao-event2024.duckdns.org", label: "phish", note: "DDNS" },
  { url: "https://kb-security-center.000webhostapp.com", label: "phish", note: "무료호스팅" },
  { url: "https://toss-cash-friend.weebly.com", label: "phish", note: "무료호스팅" },
  { url: "https://nhbank-cert.wixsite.com/main", label: "phish", note: "무료호스팅" },
  { url: "https://coupang-partners-event.netlify.app", label: "phish", note: "무료호스팅" },
  { url: "https://shinhancard-check.web.app", label: "phish", note: "무료호스팅" },
  { url: "https://secure-login-kr.github.io/auth", label: "phish", note: "무료호스팅+키워드" },
  { url: "https://delivery-check.top/track?no=1234", label: "phish", note: "택배 스미싱" },
  { url: "https://parcel-notice.click", label: "phish", note: "택배 스미싱" },
  { url: "https://ems-tracking.xyz/kr", label: "phish", note: "택배 스미싱" },
  { url: "https://refund-tax.top/apply", label: "phish", note: "환급 사기" },
  { url: "https://prize-winner.click/claim", label: "phish", note: "경품 사기" },
  { url: "https://free-gift-event.top", label: "phish", note: "경품 사기" },
  { url: "https://mobile-verify.icu/auth", label: "phish", note: "인증 사기" },
  { url: "https://account-update-alert.top", label: "phish", note: "계정 사기" },
  { url: "https://secure-banking-login.xyz", label: "phish", note: "뱅킹 사기" },
  { url: "https://wallet-connect-verify.top", label: "phish", note: "코인 사기" },
  { url: "https://vaccine-reserve.click/booking", label: "phish", note: "접종 사칭" },
  { url: "https://gov24-minwon.top", label: "phish", note: "정부 사칭" },
  { url: "http://safety-check.tk/kisa", label: "phish", note: "기관 사칭" },
  { url: "https://bank-cert-update.ml", label: "phish", note: "뱅킹 사기" },
  { url: "http://secure.login.verify.account-center.info/session", label: "phish", note: "다단 서브도메인" },
  { url: "https://login-secure-check-kr.com/member", label: "phish", note: "하이픈 남용+키워드" },
  { url: "http://membership-verify.net/login.php?session=aa8f2", label: "phish", note: "http+키워드" },
  { url: "https://mobile-support-center.site/account/password", label: "phish", note: "키워드 조합" },
  { url: "http://online-banking-secure.info:8081/login", label: "phish", note: "포트+키워드" },
  { url: "https://update-billing-invoice.online/pay", label: "phish", note: "키워드 조합" },
  { url: "https://auth-wallet-recovery.site/seed", label: "phish", note: "코인 사기" },
  { url: "http://customer-support-verify.win/chat", label: "phish", note: "키워드 조합" },
  { url: "https://id-confirm-safety.buzz", label: "phish", note: "키워드 조합" },
  { url: "https://quick-loan-apply.loan/form?ref=sms", label: "phish", note: "대출 사기" },
  { url: "https://portaldocarromtguiasexpress.site/", label: "phish", note: "긴 이어붙이기 도메인 (실제 피싱 DB 표본)" },
];

// ────────────────────────────────────────────────────────────────
// 벤치 본체
// ────────────────────────────────────────────────────────────────

const FLAG_THRESHOLD = 40; // spec §9 게이트: phish는 score>=40 정답, benign은 <40 정답

type Counts = { tp: number; fn: number; tn: number; fp: number };

function summarize(counts: Counts) {
  const { tp, fn, tn, fp } = counts;
  return {
    phishRecall: tp + fn === 0 ? 1 : tp / (tp + fn),
    benignFalsePositive: fp + tn === 0 ? 0 : fp / (fp + tn),
    tp, fn, tn, fp,
  };
}

async function main() {
  const t0 = Date.now();

  // OLD 엔진 — 동기, 순차 채점
  const oldCounts: Counts = { tp: 0, fn: 0, tn: 0, fp: 0 };
  const oldResults: { sample: Sample; score: number; flagged: boolean }[] = [];
  for (const sample of samples) {
    const score = analyzeUrlLocallyOld(sample.url).score;
    const flagged = score >= FLAG_THRESHOLD;
    oldResults.push({ sample, score, flagged });
    if (sample.label === "phish") {
      if (flagged) oldCounts.tp++;
      else oldCounts.fn++;
    } else {
      if (flagged) oldCounts.fp++;
      else oldCounts.tn++;
    }
  }

  // NEW 엔진 — 비동기(RDAP 포함), 전부 동시 실행해 오프라인 타임아웃(~2.5s)이 겹치게 함
  const newCounts: Counts = { tp: 0, fn: 0, tn: 0, fp: 0 };
  const newResults = await Promise.all(
    samples.map(async (sample) => {
      const score = (await runHeuristics(sample.url)).score;
      const flagged = score >= FLAG_THRESHOLD;
      return { sample, score, flagged };
    }),
  );
  for (const r of newResults) {
    if (r.sample.label === "phish") {
      if (r.flagged) newCounts.tp++;
      else newCounts.fn++;
    } else {
      if (r.flagged) newCounts.fp++;
      else newCounts.tn++;
    }
  }

  const elapsedMs = Date.now() - t0;

  const report = {
    new: summarize(newCounts),
    old: summarize(oldCounts),
  };

  console.log(JSON.stringify(report, null, 2));
  console.log(`(elapsed ${elapsedMs}ms, ${samples.length} samples)`);

  // 신규 benign 오탐(OLD 는 안전 판정인데 NEW 는 오탐인 케이스) — 게이트 판단용
  const oldFlaggedBenign = new Set(
    oldResults.filter((r) => r.sample.label === "benign" && r.flagged).map((r) => r.sample.url),
  );
  const newlyFlaggedBenign = newResults.filter(
    (r) => r.sample.label === "benign" && r.flagged && !oldFlaggedBenign.has(r.sample.url),
  );

  if (newlyFlaggedBenign.length) {
    console.log("\n― NEW 엔진에서 새로 오탐 처리된 benign(OLD는 안전 판정) ―");
    for (const r of newlyFlaggedBenign) {
      console.log(`[score ${r.score}] ${r.sample.url} (${r.sample.note})`);
    }
  }

  const regressed = report.new.benignFalsePositive > report.old.benignFalsePositive;
  console.log(`\n게이트(§9): NEW benignFalsePositive(${(report.new.benignFalsePositive * 100).toFixed(1)}%) <= OLD(${(report.old.benignFalsePositive * 100).toFixed(1)}%) → ${regressed ? "FAIL" : "PASS"}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
