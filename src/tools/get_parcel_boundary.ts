import { getParcelBoundary } from "../lib/parcel.js";
import { DISCLAIMER } from "../lib/disclaimer.js";

export const getParcelBoundaryTool = async ({ query }: { query: string }) => {
  const b = await getParcelBoundary(query);
  const result = {
    ...b,
    crs: "EPSG:4326",
    note: "approx_area_m2 is computed from the polygon and is not the official 토지대장 area.",
    source: { parcel_layer: "vworld LP_PA_CBND_BUBUN", resolved_at: new Date().toISOString() },
    disclaimer: DISCLAIMER,
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
};
