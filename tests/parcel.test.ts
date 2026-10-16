import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("axios", () => ({ default: { get: vi.fn() } }));
import axios from "axios";
import { getParcelBoundary, summarizeGeometry } from "../src/lib/parcel.js";
import { __resetVWorldStateForTests } from "../src/lib/vworld.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/lp_pa_cbnd_bubun_polygon.json", import.meta.url), "utf8"));

beforeEach(() => {
  process.env.VWORLD_API_KEY = "test-key";
  process.env.VWORLD_DOMAIN = "localhost";
  __resetVWorldStateForTests();
  (axios.get as unknown as ReturnType<typeof vi.fn>).mockReset();
});

describe("getParcelBoundary", () => {
  it("returns polygon and approx area for a PNU (offline fixture)", async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockResolvedValue({ status: 200, data: fixture });
    const b = await getParcelBoundary("4513011200100360000");
    expect(get).toHaveBeenCalledTimes(1);
    const params = get.mock.calls[0][1].params;
    expect(params.data).toBe("LP_PA_CBND_BUBUN");
    expect(params.attrFilter).toBe("pnu:=:4513011200100360000");
    expect(params.geometry).toBe("true");
    expect(b.geometry?.type).toBe("MultiPolygon");
    expect(b.jibun).toBe("36대");
    expect(b.vertex_count).toBe(5);
    // 0.0001° x 0.0001° at lat ~36 ≈ 9.0 m x 11.1 m ≈ 100 m²
    expect(b.approx_area_m2).toBeGreaterThan(95);
    expect(b.approx_area_m2).toBeLessThan(105);
    expect(b.bbox_wgs84).toEqual([126.71, 35.98, 126.7101, 35.9801]);
  });

  it("throws PNU_NOT_FOUND when layer returns NOT_FOUND", async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockResolvedValue({ status: 200, data: { response: { status: "NOT_FOUND" } } });
    await expect(getParcelBoundary("4513011200100369999")).rejects.toMatchObject({ code: "PNU_NOT_FOUND" });
  });
});

describe("summarizeGeometry", () => {
  it("handles missing geometry", () => {
    expect(summarizeGeometry(null)).toEqual({ approx_area_m2: null, bbox_wgs84: null, vertex_count: 0 });
  });
  it("subtracts holes", () => {
    const outer = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]];
    const hole = [[0.0004, 0.0004], [0.0006, 0.0004], [0.0006, 0.0006], [0.0004, 0.0006], [0.0004, 0.0004]];
    const a = summarizeGeometry({ type: "Polygon", coordinates: [outer] }).approx_area_m2!;
    const b = summarizeGeometry({ type: "Polygon", coordinates: [outer, hole] }).approx_area_m2!;
    expect(b).toBeCloseTo(a * 0.96, 0);
  });
});
