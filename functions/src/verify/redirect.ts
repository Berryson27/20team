/**
 * S2 리다이렉트 추적 (검증엔진 §4-S2, 범주 상한 25).
 * 원칙(§2-1): 위험한 링크는 사용자 대신 서버가 밟는다. redirect:manual 로 hop 단위 추적,
 * 최대 3 hop, 사설 IP(SSRF) 차단, 최종 URL/HTML 텍스트 확보(S4 입력).
 */

const MAX_HOPS = 3;
const FETCH_TIMEOUT_MS = 4500;
const MAX_HTML_BYTES = 200_000;

const SHORTENERS = new Set([
  "bit.ly", "t.co", "goo.gl", "tinyurl.com", "is.gd", "buff.ly",
  "ow.ly", "han.gl", "url.kr", "vo.la", "me2.do", "abr.ge",
]);

export interface RedirectResult {
  startHost: string;
  finalUrl: string;
  finalHost: string;
  hops: number;
  shortenerHops: number;
  hostChanged: boolean;
  httpsDowngrade: boolean;
  hitCaptcha: boolean;
  blockedSsrf: boolean;
  tooManyRedirects: boolean;
  pageUnreachable: boolean;
  html: string; // 최종 페이지 텍스트(S4 입력). 실패 시 "".
  flags: string[];
  score: number; // cap 25
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    a === 0
  );
}

async function fetchNoFollow(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: {
        // 실제 모바일 브라우저 UA — 피싱 사이트의 봇 클로킹을 우회해 진짜 콘텐츠를 확보(방어 목적)
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.8",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function followRedirects(payload: string): Promise<RedirectResult> {
  const startHost = hostOf(payload);
  const flags: string[] = [];
  let current = payload;
  let hops = 0;
  let shortenerHops = 0;
  let httpsDowngrade = false;
  let hitCaptcha = false;
  let tooManyRedirects = false;
  let pageUnreachable = false;
  let html = "";

  if (SHORTENERS.has(startHost)) shortenerHops++;

  try {
    while (hops <= MAX_HOPS) {
      const host = hostOf(current);
      if (isPrivateHost(host)) {
        return {
          startHost, finalUrl: current, finalHost: host, hops,
          shortenerHops, hostChanged: host !== startHost, httpsDowngrade,
          hitCaptcha, blockedSsrf: true, tooManyRedirects, pageUnreachable: true,
          html: "", flags: [...flags, "ssrf_private_ip"], score: 25,
        };
      }

      const res = await fetchNoFollow(current);
      const status = res.status;

      if (status >= 300 && status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current).toString();
        if (current.startsWith("https://") && next.startsWith("http://")) {
          httpsDowngrade = true;
        }
        if (SHORTENERS.has(hostOf(next))) shortenerHops++;
        current = next;
        hops++;
        if (hops > MAX_HOPS) { tooManyRedirects = true; break; }
        continue;
      }

      // 최종 응답 — 본문 확보(S4)
      const buf = await res.arrayBuffer();
      const bytes = buf.byteLength > MAX_HTML_BYTES
        ? buf.slice(0, MAX_HTML_BYTES) : buf;
      html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const low = html.toLowerCase();
      if (
        low.includes("captcha") ||
        low.includes("cf-challenge") ||
        low.includes("are you human") ||
        low.includes("잠시 후 다시")
      ) {
        hitCaptcha = true;
      }
      break;
    }
  } catch {
    pageUnreachable = true;
  }

  const finalHost = hostOf(current);
  const hostChanged = !!finalHost && finalHost !== startHost;

  // 채점 (§4-S2)
  let score = 0;
  if (hops >= 3 || tooManyRedirects) { score += 15; flags.push("many_redirects"); }
  else if (hops === 2) { score += 10; flags.push("redirect_2hop"); }
  if (shortenerHops >= 1 && hostChanged) { flags.push("shortener_chain"); }
  if (hostChanged) { score += 12; flags.push("host_mismatch"); }
  if (httpsDowngrade) { score += 8; flags.push("https_downgrade"); }
  if (hitCaptcha) { score += 10; flags.push("captcha_wall"); }

  return {
    startHost, finalUrl: current, finalHost, hops, shortenerHops,
    hostChanged, httpsDowngrade, hitCaptcha, blockedSsrf: false,
    tooManyRedirects, pageUnreachable, html,
    flags, score: Math.min(score, 25),
  };
}

/** S2 detail 문자열 (S2 진행 화면 렌더용) */
export function redirectDetail(r: RedirectResult): string {
  if (r.blockedSsrf) return "내부망 주소로 유도 — 접근 차단";
  if (r.pageUnreachable) return "최종 페이지 접근 불가";
  const chain = r.hostChanged
    ? `${r.startHost} → ${r.hops}회 경유 → ${r.finalHost}`
    : `${r.finalHost} (직접)`;
  return chain;
}
