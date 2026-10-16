// Shared PNU contract with korean-site-core (fixtures only; src/ is kept in sync with upstream).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isPnu } from "../src/lib/vworld.js";

const cases = JSON.parse(
  readFileSync(new URL("./fixtures/site-core-pnu-cases.json", import.meta.url), "utf8"),
) as {
  valid: { pnu: string; sigungu: string; bjdong: string; mountain: boolean; bun: string; ji: string; jibun: string }[];
  invalid_shape: string[];
  invalid_land_type: string[];
};

// Reference split (same as korean_site_core.PNU): 시군구5 + 법정동5 + 대장구분1 + 본번4 + 부번4.
function split(p: string) {
  const mountain = p[10] === "2";
  const bun = p.slice(11, 15);
  const ji = p.slice(15, 19);
  const jibun = `${mountain ? "산" : ""}${Number(bun)}${Number(ji) ? `-${Number(ji)}` : ""}`;
  return { sigungu: p.slice(0, 5), bjdong: p.slice(5, 10), mountain, bun, ji, jibun };
}

describe("korean-site-core PNU contract", () => {
  for (const c of cases.valid) {
    it(`accepts and splits ${c.pnu}`, () => {
      expect(isPnu(c.pnu)).toBe(true);
      const { pnu: _pnu, note: _note, ...expected } = c as typeof c & { note?: string };
      expect(split(c.pnu)).toEqual(expected);
    });
  }
  for (const bad of cases.invalid_shape) {
    it(`rejects malformed ${JSON.stringify(bad)}`, () => {
      expect(isPnu(bad)).toBe(false);
    });
  }
  it("documents that isPnu is shape-only (land-type digit 1/2 is checked in korean-site-core)", () => {
    for (const p of cases.invalid_land_type) expect(isPnu(p)).toBe(true);
  });
});
