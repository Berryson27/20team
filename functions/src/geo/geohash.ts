/**
 * 위치 비식별화 (기획서 §5, 설계 §2-1):
 * 정확 좌표는 어디에도 저장하지 않는다. 서버가 받은 즉시
 *  ① 구 단위 행정코드(통계·랭킹용)  ② ~150m 격자 스냅 geohash7(지도 핀용)
 * 로 변환하고 원좌표는 폐기한다. 지도 핀은 격자 중심점이라 동선 재구성 불가.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** geohash 인코드 (기본 7자 ≈ 153m × 153m 격자) */
export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "";
  let bits = 0;
  let bit = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { bit = (bit << 1) | 1; lngMin = mid; } else { bit = bit << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { bit = (bit << 1) | 1; latMin = mid; } else { bit = bit << 1; latMax = mid; }
    }
    even = !even;
    if (++bits === 5) { hash += BASE32[bit]; bits = 0; bit = 0; }
  }
  return hash;
}

/** geohash 디코드 → 격자 중심점 (지도 핀 좌표) */
export function decodeGeohashCenter(hash: string): { lat: number; lng: number } {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let even = true;
  for (const ch of hash) {
    const idx = BASE32.indexOf(ch);
    for (let n = 4; n >= 0; n--) {
      const bit = (idx >> n) & 1;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (bit) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bit) latMin = mid; else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 };
}

/** 서울 25개 구 근사 중심좌표 + 행정구 코드 (데모용 비식별 매핑) */
const SEOUL_GU: { code: string; name: string; lat: number; lng: number }[] = [
  { code: "11680", name: "강남구", lat: 37.5172, lng: 127.0473 },
  { code: "11440", name: "마포구", lat: 37.5663, lng: 126.9019 },
  { code: "11710", name: "송파구", lat: 37.5145, lng: 127.1059 },
  { code: "11650", name: "서초구", lat: 37.4837, lng: 127.0324 },
  { code: "11560", name: "영등포구", lat: 37.5264, lng: 126.8963 },
  { code: "11170", name: "용산구", lat: 37.5326, lng: 126.9905 },
  { code: "11140", name: "중구", lat: 37.5636, lng: 126.9976 },
  { code: "11110", name: "종로구", lat: 37.5730, lng: 126.9794 },
  { code: "11200", name: "성동구", lat: 37.5634, lng: 127.0369 },
  { code: "11215", name: "광진구", lat: 37.5385, lng: 127.0823 },
  { code: "11230", name: "동대문구", lat: 37.5744, lng: 127.0396 },
  { code: "11260", name: "중랑구", lat: 37.6063, lng: 127.0925 },
  { code: "11290", name: "성북구", lat: 37.5894, lng: 127.0167 },
  { code: "11305", name: "강북구", lat: 37.6396, lng: 127.0257 },
  { code: "11320", name: "도봉구", lat: 37.6688, lng: 127.0471 },
  { code: "11350", name: "노원구", lat: 37.6542, lng: 127.0568 },
  { code: "11380", name: "은평구", lat: 37.6027, lng: 126.9291 },
  { code: "11410", name: "서대문구", lat: 37.5791, lng: 126.9368 },
  { code: "11470", name: "양천구", lat: 37.5170, lng: 126.8666 },
  { code: "11500", name: "강서구", lat: 37.5509, lng: 126.8495 },
  { code: "11530", name: "구로구", lat: 37.4954, lng: 126.8874 },
  { code: "11545", name: "금천구", lat: 37.4569, lng: 126.8955 },
  { code: "11590", name: "동작구", lat: 37.5124, lng: 126.9393 },
  { code: "11620", name: "관악구", lat: 37.4784, lng: 126.9516 },
  { code: "11740", name: "강동구", lat: 37.5301, lng: 127.1238 },
];

/** lat/lng → 최근접 구 (행정코드 + 이름). 서울 밖이면 강남구로 폴백(데모). */
export function toRegion(lat: number, lng: number): { code: string; name: string } {
  let best = SEOUL_GU[0];
  let bestD = Infinity;
  for (const g of SEOUL_GU) {
    const d = (g.lat - lat) ** 2 + (g.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = g; }
  }
  return { code: best.code, name: best.name };
}

/** 행정코드 → 이름 (랭킹 위젯용) */
export function regionName(code: string): string {
  return SEOUL_GU.find((g) => g.code === code)?.name ?? "기타";
}

export const SEOUL_DISTRICTS = SEOUL_GU;
