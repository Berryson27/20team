import { onRequest } from "firebase-functions/v2/https";
import { db } from "../shared/admin";
import { applyCors } from "../shared/http";
import type { MapSummaryResponse, MapRegion, MapCell, MapRecent, PlaceType } from "../shared/types";

function level(count: number): MapRegion["level"] {
  return count >= 20 ? "high" : count >= 8 ? "mid" : "low";
}

export const mapSummary = onRequest(
  { region: "us-central1", timeoutSeconds: 20, memory: "256MiB", invoker: "public" },
  async (req, res) => {
    if (applyCors(req, res)) return;
    try {
      const [counterSnap, aggSnap, cellSnap, recentSnap] = await Promise.all([
        db.doc("counters/global").get(),
        db.collection("map_agg").orderBy("count", "desc").limit(30).get(),
        db.collection("map_cells").orderBy("count", "desc").limit(300).get(),
        db.collection("reports").orderBy("at", "desc").limit(8).get(),
      ]);

      const regions: MapRegion[] = aggSnap.docs.map((d) => {
        const v = d.data();
        return {
          regionCode: d.id,
          name: (v.name as string) ?? "기타",
          count: (v.count as number) ?? 0,
          level: level((v.count as number) ?? 0),
        };
      });

      const byPlaceType: Record<string, number> = {};
      const cells: MapCell[] = cellSnap.docs.map((d) => {
        const v = d.data();
        const bpt = (v.byPlaceType as Record<string, number>) ?? {};
        for (const [k, n] of Object.entries(bpt)) byPlaceType[k] = (byPlaceType[k] ?? 0) + n;
        return {
          geohash: d.id,
          lat: (v.lat as number) ?? 0,
          lng: (v.lng as number) ?? 0,
          count: (v.count as number) ?? 0,
          topPlaceType: (Object.entries(bpt).sort((a, b) => b[1] - a[1])[0]?.[0] as PlaceType) ?? null,
          lastAt: (v.lastAt?.toDate?.() ?? new Date()).toISOString(),
        };
      });

      const recent: MapRecent[] = recentSnap.docs.map((d) => {
        const v = d.data();
        return {
          at: (v.at?.toDate?.() ?? new Date()).toISOString(),
          regionName: (v.regionName as string) ?? "기타",
          category: v.category,
          placeType: v.placeType ?? null,
        };
      });

      const counter = counterSnap.data() ?? {};
      const total = (counter.totalReports as number) ?? regions.reduce((s, r) => s + r.count, 0);
      const thisWeek = aggSnap.docs.reduce((s, d) => s + ((d.data().weekCount as number) ?? 0), 0);
      const blockedToday = (counter.todayBlocked as number) ?? 0;

      const payload: MapSummaryResponse = {
        total, thisWeek, blockedToday, regions, cells, byPlaceType, recent,
      };
      // 데모의 "신고 → 지도 실시간 +1"이 캐시에 가리지 않도록 항상 최신 반환
      res.set("Cache-Control", "no-store");
      res.json(payload);
    } catch (e) {
      console.error("mapSummary error", e);
      res.status(500).json({ error: { code: "INTERNAL", message: "지도 조회 오류" } });
    }
  }
);
