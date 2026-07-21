/**
 * 페이지 '코드' 구조 추출 (설계 §5-6 get_page_dom / inspect_form_targets 편입).
 * AI가 텍스트뿐 아니라 실제 코드를 보게: 폼이 어디로 전송되는지, 어떤 입력 필드가 있는지,
 * 외부 리소스는 어느 도메인인지. 정규식 기반(헤드리스 없이) — 강한 신호만 추출.
 */

export interface FormInfo {
  actionHost: string | null;
  crossDomain: boolean;
  toIp: boolean;
  hasPassword: boolean;
  hasCardField: boolean;
}
export interface PageStructure {
  title: string;
  forms: FormInfo[];
  hasPasswordInput: boolean;
  hasCardField: boolean;
  externalHosts: string[];
  formPostsCrossDomain: boolean;
  formPostsToIp: boolean;
}

function hostOf(url: string, base: string): string | null {
  try { return new URL(url, base).hostname.toLowerCase(); } catch { return null; }
}
function isIp(h: string): boolean { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h); }
function registrable(h: string): string {
  const p = h.split(".");
  return p.length >= 2 ? p.slice(-2).join(".") : h;
}

const CARD_HINT = /(card|cvc|cvv|expiry|카드|카드번호|유효기간|보안코드|계좌|account|주민|비밀번호|password|pin)/i;

export function extractStructure(html: string, finalUrl: string): PageStructure {
  const baseHost = hostOf(finalUrl, finalUrl) ?? "";
  const baseReg = registrable(baseHost);

  const title = (html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+/g, " ").trim();

  // 폼별로 action + 내부 input 스캔
  const forms: FormInfo[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  let count = 0;
  while ((fm = formRe.exec(html)) && count < 8) {
    count++;
    const attrs = fm[1];
    const inner = fm[2];
    const action = attrs.match(/action\s*=\s*["']([^"']+)["']/i)?.[1] ?? finalUrl;
    const actionHost = hostOf(action, finalUrl);
    const crossDomain = !!actionHost && actionHost !== baseHost && registrable(actionHost) !== baseReg;
    const toIp = !!actionHost && isIp(actionHost);
    const hasPassword = /<input[^>]*type\s*=\s*["']?password/i.test(inner);
    const hasCardField = CARD_HINT.test(inner) && /<input/i.test(inner);
    forms.push({ actionHost, crossDomain, toIp, hasPassword, hasCardField });
  }

  const hasPasswordInput = /<input[^>]*type\s*=\s*["']?password/i.test(html);
  const hasCardField = forms.some((f) => f.hasCardField) || (CARD_HINT.test(html) && /<input/i.test(html));

  // 외부 리소스 호스트 (script/link/img/iframe)
  const hosts = new Set<string>();
  const resRe = /<(?:script|link|img|iframe)\b[^>]*\s(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let rm: RegExpExecArray | null;
  let rc = 0;
  while ((rm = resRe.exec(html)) && rc < 200) {
    rc++;
    const h = hostOf(rm[1], finalUrl);
    if (h && h !== baseHost && registrable(h) !== baseReg && !h.endsWith("gstatic.com") && !h.endsWith("googleapis.com")) {
      hosts.add(h);
    }
  }

  return {
    title,
    forms,
    hasPasswordInput,
    hasCardField,
    externalHosts: [...hosts].slice(0, 8),
    formPostsCrossDomain: forms.some((f) => f.crossDomain && (f.hasPassword || f.hasCardField)),
    formPostsToIp: forms.some((f) => f.toIp),
  };
}

/** LLM 프롬프트에 넣을 코드 구조 요약(한 문단) */
export function structureSummary(s: PageStructure): string {
  const lines: string[] = [];
  if (s.title) lines.push(`페이지 제목: ${s.title}`);
  if (s.forms.length) {
    lines.push(`폼 ${s.forms.length}개:`);
    s.forms.forEach((f, i) => {
      const bits = [`전송대상=${f.actionHost ?? "?"}`];
      if (f.crossDomain) bits.push("⚠외부도메인");
      if (f.toIp) bits.push("⚠IP직결");
      if (f.hasPassword) bits.push("비밀번호입력");
      if (f.hasCardField) bits.push("카드/계좌입력");
      lines.push(`  #${i + 1} ${bits.join(" · ")}`);
    });
  } else {
    lines.push("입력 폼 없음");
  }
  if (s.externalHosts.length) lines.push(`외부 리소스 도메인: ${s.externalHosts.join(", ")}`);
  return lines.join("\n");
}
