/**
 * S3 도메인 휴리스틱 (검증엔진 §4-S3, 범주 상한 40, 신호 병렬 조회).
 * ⚠ HTTPS 유무는 무점수(피싱 87%가 HTTPS). 자물쇠 신화 배제.
 */
import { BRANDS, OFFICIAL_DOMAINS, RISKY_TLDS } from "../shared/brands";

const RDAP_TIMEOUT_MS = 2500;

// 흔한 2단계 공개 접미사(SLD 추출용)
const TWO_LEVEL_SUFFIX = new Set([
  "co.kr", "or.kr", "go.kr", "ne.kr", "re.kr", "pe.kr", "ac.kr",
  "com.cn", "co.jp", "co.uk", "com.au",
]);

export interface HeuristicResult {
  score: number; // cap 40
  flags: string[];
  detail: string;
  domainAgeDays: number | null;
  trusted: boolean; // 공식 도메인 화이트리스트 매치
  brandImitated: string | null;
}

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

function splitHost(host: string): { sld: string; tld: string; isOfficial: boolean } {
  const isOfficial =
    OFFICIAL_DOMAINS.has(host) ||
    [...OFFICIAL_DOMAINS].some((d) => host === d || host.endsWith("." + d));
  const parts = host.split(".");
  const lastTwo = parts.slice(-2).join(".");
  let sld: string, tld: string;
  if (parts.length >= 3 && TWO_LEVEL_SUFFIX.has(lastTwo)) {
    sld = parts[parts.length - 3];
    tld = lastTwo;
  } else {
    sld = parts[parts.length - 2] ?? host;
    tld = parts[parts.length - 1] ?? "";
  }
  return { sld: sld ?? "", tld: tld ?? "", isOfficial };
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/** RDAP 로 도메인 등록일 조회(무키, best-effort) → 등록 후 경과일 */
async function domainAgeDays(host: string): Promise<number | null> {
  const parts = host.split(".");
  const lastTwo = parts.slice(-2).join(".");
  const domain = TWO_LEVEL_SUFFIX.has(lastTwo) && parts.length >= 3
    ? parts.slice(-3).join(".")
    : parts.slice(-2).join(".");
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

/** 타이포스쿼팅/사칭: 공식 아닌 도메인이 브랜드를 흉내내는가 */
function detectBrandImitation(sld: string, isOfficial: boolean): {
  score: number;
  brand: string | null;
  flag: string | null;
} {
  if (isOfficial || !sld) return { score: 0, brand: null, flag: null };
  const label = sld.toLowerCase();
  const tokens = label.split(/[^a-z0-9]+/).filter(Boolean);

  let best: { score: number; brand: string; flag: string } | null = null;
  for (const brand of BRANDS) {
    for (const alias of brand.aliases) {
      const short = alias.length <= 4;
      // 토큰 완전일치 or 라벨이 별칭 포함(toss-pay 안의 toss)
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

export async function runHeuristics(finalHost: string): Promise<HeuristicResult> {
  const flags: string[] = [];
  const { sld, tld, isOfficial } = splitHost(finalHost);

  if (isOfficial) {
    return {
      score: 0, flags: ["official_domain"], detail: "공식 등록 도메인",
      domainAgeDays: null, trusted: true, brandImitated: null,
    };
  }

  let score = 0;

  // IP 직결
  if (isIpLiteral(finalHost)) { score += 20; flags.push("ip_literal"); }

  // 위험 TLD
  if (RISKY_TLDS.has(tld)) { score += 10; flags.push("risky_tld"); }

  // IDN/호모글리프 (punycode)
  if (finalHost.includes("xn--")) { score += 25; flags.push("idn_homoglyph"); }

  // 브랜드 사칭
  const brand = detectBrandImitation(sld, isOfficial);
  if (brand.score > 0) {
    score += brand.score;
    if (brand.flag) flags.push(brand.flag);
  }

  // 도메인 연령 (RDAP)
  const age = await domainAgeDays(finalHost);
  if (age !== null) {
    if (age < 7) { score += 25; flags.push("domain_lt_7d"); }
    else if (age < 30) { score += 18; flags.push("domain_lt_30d"); }
    else if (age < 90) { score += 8; flags.push("domain_lt_90d"); }
  }

  const detailParts: string[] = [];
  if (age !== null) detailParts.push(age < 30 ? `등록 ${age}일차 신생 도메인` : `등록 ${Math.floor(age / 365)}년`);
  if (brand.brand) detailParts.push(`${brand.brand} 사칭 의심`);
  if (RISKY_TLDS.has(tld)) detailParts.push(`위험 TLD .${tld}`);
  if (isIpLiteral(finalHost)) detailParts.push("IP 직접 접속");

  return {
    score: Math.min(score, 40),
    flags,
    detail: detailParts.join(" · ") || "특이 신호 없음",
    domainAgeDays: age,
    trusted: false,
    brandImitated: brand.brand,
  };
}
