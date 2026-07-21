/**
 * ThinkingEngine 서버측 전송 (수신기 = 공개 HTTPS라 GCP에서 직접 전송 가능).
 * 실 스캔·신고·발급이 발생하면 Functions가 여기로 이벤트를 흘린다(설계 §3 택소노미).
 * best-effort: TE 전송 실패가 본 응답을 막지 않는다.
 */
import { config } from "./admin";

const COMMON = { app_ver: "hanq-fn-0.1", channel: "server" as const };

function pad(n: number, w = 2) { return String(n).padStart(w, "0"); }
function teTime(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export interface TrackInput {
  event: string;
  distinctId?: string;
  regionCode?: string | null;
  props?: Record<string, unknown>;
  /** 채널 오버라이드. 서버 발생 이벤트는 기본 "server", 클라 퍼널(/track 프록시)은 "pwa". */
  channel?: string;
  /** app_ver 오버라이드. 클라 이벤트는 프론트 버전을 싣는다. */
  appVer?: string;
}

/** 이벤트(들)를 TE 수신기로 전송. 설정 없으면 no-op. */
export async function trackTE(inputs: TrackInput | TrackInput[]): Promise<void> {
  if (!config.teAppId || !config.teUrl) return;
  const arr = Array.isArray(inputs) ? inputs : [inputs];
  if (!arr.length) return;
  const events = arr.map((i) => ({
    "#type": "track",
    "#event_name": i.event,
    "#time": teTime(),
    "#distinct_id": i.distinctId || `hanq-${i.regionCode || "anon"}`,
    properties: {
      ...COMMON,
      ...(i.channel ? { channel: i.channel } : {}),
      ...(i.appVer ? { app_ver: i.appVer } : {}),
      region_code: i.regionCode ?? null,
      ...(i.props || {}),
    },
  }));
  try {
    await fetch(`${config.teUrl}/sync_json?appid=${encodeURIComponent(config.teAppId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(events),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    console.warn("trackTE failed:", (e as Error).message);
  }
}
