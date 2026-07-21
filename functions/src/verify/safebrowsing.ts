/**
 * S5: Google Safe Browsing 위협목록 조회 (20team `src/lib/verification.ts`의
 * checkSafeBrowsing/THREAT_LABELS 이식). 매치 시 엔진이 score floor 90을 건다(§8).
 *
 * 키 없음/미활성화/네트워크 오류/타임아웃은 전부 조용히 null — 적층 원칙(§8):
 * 이 스테이지가 죽어도 나머지 파이프라인(S3/S4)만으로 판정은 나온다.
 *
 * ⚠ 시크릿은 `defineSecret(...).value()`가 아니라 process.env로 읽는다.
 * v2 Cloud Functions는 `secrets:[]`에 등록된 시크릿을 런타임에 process.env로 노출하므로
 * (실제로 GEMINI_API_KEY가 이미 verify 함수의 secrets 배열에 등록돼 있음 — 추가 등록 불필요)
 * 이 방식은 에뮬레이터/배포 모두에서 동작하면서, 동시에 함수 호출 밖(모듈 로드 시점,
 * `node --test` 단위 테스트)에서도 안전하다. `defineSecret().value()`는 라이브 함수
 * 호출 컨텍스트 밖에서 호출하면 throw하므로 테스트가 깨진다.
 * SAFE_BROWSING_API_KEY는 별도 Secret Manager 등록 없이도 쓸 수 있는 선택적 오버라이드.
 */

const THREAT_LABELS: Record<string, string> = {
  MALWARE: "악성코드",
  SOCIAL_ENGINEERING: "피싱/사회공학",
  UNWANTED_SOFTWARE: "원치 않는 소프트웨어",
  POTENTIALLY_HARMFUL_APPLICATION: "유해 애플리케이션",
};

export interface SafeBrowsingResult {
  matched: boolean;
  threatType?: string;
  label?: string;
}

export async function checkSafeBrowsing(url: string): Promise<SafeBrowsingResult | null> {
  const key = process.env.SAFE_BROWSING_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "hanq", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: { threatType: string }[] };
    const first = data.matches?.[0];
    if (!first) return null;
    return { matched: true, threatType: first.threatType, label: THREAT_LABELS[first.threatType] ?? "위협" };
  } catch {
    return null;
  }
}
