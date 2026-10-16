import { getFeatures, isPnu, VWorldError } from "./vworld.js";
import { resolveToParcel } from "./resolve.js";

export interface ParcelBoundary {
  pnu: string | null;
  jibun: string | null;
  address: string | null;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } | null;
  /** Approximate planar area (m²) on a local equirectangular projection. NOT the 토지대장 official area. */
  approx_area_m2: number | null;
  bbox_wgs84: [number, number, number, number] | null;
  vertex_count: number;
  source_layer: "LP_PA_CBND_BUBUN";
}

const R = 6378137;

function ringArea(ring: number[][], lat0: number): number {
  const k = Math.cos((lat0 * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += x1 * k * y2 - x2 * k * y1;
  }
  const deg = Math.PI / 180;
  return Math.abs(s / 2) * (R * deg) * (R * deg);
}

function polygons(geom: { type: string; coordinates: unknown }): number[][][][] {
  if (geom.type === "Polygon") return [geom.coordinates as number[][][]];
  if (geom.type === "MultiPolygon") return geom.coordinates as number[][][][];
  return [];
}

export function summarizeGeometry(geom: unknown): Pick<ParcelBoundary, "approx_area_m2" | "bbox_wgs84" | "vertex_count"> {
  const g = geom as { type?: string; coordinates?: unknown } | undefined;
  if (!g?.type || !g.coordinates) return { approx_area_m2: null, bbox_wgs84: null, vertex_count: 0 };
  const polys = polygons(g as { type: string; coordinates: unknown });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
  for (const p of polys) for (const r of p) for (const [x, y] of r) {
    n++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!n) return { approx_area_m2: null, bbox_wgs84: null, vertex_count: 0 };
  const lat0 = (minY + maxY) / 2;
  let area = 0;
  for (const p of polys) p.forEach((r, i) => { area += (i === 0 ? 1 : -1) * ringArea(r, lat0); });
  return { approx_area_m2: Math.round(area * 100) / 100, bbox_wgs84: [minX, minY, maxX, maxY], vertex_count: n };
}

/** Fetch the cadastral parcel polygon (V-World LP_PA_CBND_BUBUN, EPSG:4326) for a PNU or address. */
export async function getParcelBoundary(query: string): Promise<ParcelBoundary> {
  const q = query.trim();
  let props: Record<string, string | number | null> = {};
  let geometry: unknown = null;
  if (isPnu(q)) {
    const feats = await getFeatures({ layer: "LP_PA_CBND_BUBUN", attrFilter: `pnu:=:${q}`, includeGeometry: true, size: 1 });
    if (feats.length === 0) throw new VWorldError(`PNU ${q} not found in LP_PA_CBND_BUBUN`, "PNU_NOT_FOUND");
    props = feats[0].properties;
    geometry = feats[0].geometry ?? null;
  } else {
    const r = await resolveToParcel(q);
    props = { pnu: r.pnu, jibun: r.jibun, addr: r.address };
    geometry = r.parcel_geometry;
  }
  const g = geometry as { type?: string } | null;
  const valid = g && (g.type === "Polygon" || g.type === "MultiPolygon");
  return {
    pnu: props.pnu ? String(props.pnu) : null,
    jibun: props.jibun ? String(props.jibun) : null,
    address: props.addr ? String(props.addr) : null,
    geometry: valid ? (geometry as ParcelBoundary["geometry"]) : null,
    ...summarizeGeometry(valid ? geometry : null),
    source_layer: "LP_PA_CBND_BUBUN",
  };
}
