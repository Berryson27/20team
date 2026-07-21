import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { applyCors, fail, tooManyRequests } from "../shared/http";
import { rateLimit, clientIp } from "../shared/ratelimit";
import { toRegion, regionName, encodeGeohash, decodeGeohashCenter } from "../geo/geohash";
import { trackTE } from "../shared/te";
import type { ReportRequest } from "../shared/types";

const DEFAULT_REGION = "11680"; // 강남구 (데모 기본 — 위치 미동의 시)
const REPORT_RATE = { limit: 15, windowSec: 60 }; // IP당 분당 15회 (가짜 신고 스팸 방어)

export const reports = onRequest(
  { region: "us-central1", timeoutSeconds: 20, memory: "256MiB", invoker: "public" },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") return fail(res, 405, "INVALID_PAYLOAD", "POST only");

    const body = (req.body ?? {}) as ReportRequest;
    if (!body.category) return fail(res, 400, "INVALID_PAYLOAD", "category가 필요합니다");

    // 레이트리밋(IP 기준) — 가짜 신고로 지도를 오염시키는 것 방어.
    const rl = await rateLimit("reports", clientIp(req), REPORT_RATE.limit, REPORT_RATE.windowSec);
    if (!rl.allowed) return tooManyRequests(res, rl.retryAfterSec);

    try {
      // 위치 → 구 단위 + 격자(정확 좌표 폐기)
      let regionCode = body.regionCode ?? null;
      let geohash: string | null = null;
      let cellLat: number | null = null;
      let cellLng: number | null = null;
      if (body.geo && typeof body.geo.lat === "number" && typeof body.geo.lng === "number") {
        const reg = toRegion(body.geo.lat, body.geo.lng);
        regionCode = reg.code;
        geohash = encodeGeohash(body.geo.lat, body.geo.lng, 7);
        const c = decodeGeohashCenter(geohash);
        cellLat = c.lat; cellLng = c.lng;
      }
      if (!regionCode) regionCode = DEFAULT_REGION;
      const name = regionName(regionCode);

      // 신고 원본
      const ref = await db.collection("reports").add({
        verifyRef: body.verifyId ?? null,
        regionCode, regionName: name, category: body.category,
        placeType: body.placeType ?? null,
        geohash, at: FieldValue.serverTimestamp(),
      });

      // 구 단위 집계
      await db.doc(`map_agg/${regionCode}`).set(
        {
          name, count: FieldValue.increment(1), weekCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 격자 핀 집계 (좌표는 격자 중심점만)
      if (geohash) {
        const cellUpdate: Record<string, unknown> = {
          lat: cellLat, lng: cellLng, count: FieldValue.increment(1),
          lastAt: FieldValue.serverTimestamp(),
        };
        if (body.placeType) cellUpdate[`byPlaceType.${body.placeType}`] = FieldValue.increment(1);
        await db.doc(`map_cells/${geohash}`).set(cellUpdate, { merge: true });
      }

      // 글로벌 카운터 + 최근 피드
      await db.doc("counters/global").set(
        { totalReports: FieldValue.increment(1) }, { merge: true }
      );
      await db.collection("events").add({
        name: "report_submitted", category: body.category,
        place_type: body.placeType ?? null, has_geo: !!geohash,
        region_code: regionCode, ts: FieldValue.serverTimestamp(),
      });
      await trackTE({ event: "report_submitted", regionCode, props: { category: body.category, place_type: body.placeType ?? null, has_geo: !!geohash } });

      res.json({
        reportId: ref.id, regionCode, regionName: name,
        mapUrl: `/map?focus=${regionCode}`,
      });
    } catch (e) {
      console.error("reports error", e);
      fail(res, 500, "INTERNAL", "신고 처리 중 오류가 발생했습니다");
    }
  }
);
