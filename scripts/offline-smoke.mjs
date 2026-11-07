#!/usr/bin/env node
// Offline end-to-end smoke test: no V-World key, no network.
//
// 1. Starts a tiny fixture V-World server on 127.0.0.1 (random port) that answers
//    LP_PA_CBND_BUBUN from tests/fixtures/lp_pa_cbnd_bubun_polygon.json, a 일반상업지역
//    polygon on LT_C_UQ111, a 방화지구 on LT_C_UQ124 and NOT_FOUND for every other layer.
// 2. Spawns the built server (dist/server.js) over stdio with VWORLD_BASE_URL pointing at it.
// 3. Sends MCP initialize, tools/list and tools/call for a few tools and checks the answers.
//
// Usage: npm run build && node scripts/offline-smoke.mjs     (exit code 0 = pass)
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parcelFixture = JSON.parse(readFileSync(resolve(root, "tests/fixtures/lp_pa_cbnd_bubun_polygon.json"), "utf8"));
const PNU = parcelFixture.response.result.featureCollection.features[0].properties.pnu;
const square = { type: "MultiPolygon", coordinates: [[[[126.709, 35.979], [126.711, 35.979], [126.711, 35.981], [126.709, 35.981], [126.709, 35.979]]]] };
const ok = (props) => ({ response: { status: "OK", result: { featureCollection: { type: "FeatureCollection", features: [{ type: "Feature", properties: props, geometry: square }] } } } });
const LAYERS = {
  LP_PA_CBND_BUBUN: () => parcelFixture,
  LT_C_UQ111: () => ok({ uname: "일반상업지역", ucode: "UQA220", sido_name: "전북특별자치도", sigg_name: "군산시" }),
  LT_C_UQ124: () => ok({ uname: "방화지구", ucode: "UQQ300" }),
};

const seen = [];
const fixture = createServer((req, res) => {
  const u = new URL(req.url, "http://fixture");
  const layer = u.searchParams.get("data");
  seen.push(layer ?? u.pathname);
  if (u.searchParams.get("key") !== "offline-fixture-key") {
    res.writeHead(401).end();
    return;
  }
  const body = layer && LAYERS[layer] ? LAYERS[layer]() : { response: { status: "NOT_FOUND" } };
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
});
await new Promise((r) => fixture.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${fixture.address().port}/req`;

const child = spawn(process.execPath, [resolve(root, "dist/server.js")], {
  env: { ...process.env, MCP_TRANSPORT: "stdio", VWORLD_API_KEY: "offline-fixture-key", VWORLD_DOMAIN: "localhost", VWORLD_BASE_URL: base, HTTPS_PROXY: "", HTTP_PROXY: "", https_proxy: "", http_proxy: "" },
  stdio: ["pipe", "pipe", "inherit"],
});
const pending = new Map();
createInterface({ input: child.stdout }).on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
let nextId = 0;
const rpc = (method, params) =>
  new Promise((res, rej) => {
    const id = ++nextId;
    const t = setTimeout(() => rej(new Error(`timeout: ${method}`)), 20_000);
    pending.set(id, (m) => (clearTimeout(t), res(m)));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
const call = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.error || r.result?.isError) throw new Error(`${name}: ${JSON.stringify(r.error ?? r.result.content)}`);
  return JSON.parse(r.result.content[0].text);
};

const failures = [];
const check = (cond, what) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${what}`);
  if (!cond) failures.push(what);
};

try {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "offline-smoke", version: "0" } });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  check(init.result?.serverInfo?.name === "korean-land-mcp", `initialize -> ${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version} (protocol ${init.result?.protocolVersion})`);

  const tools = (await rpc("tools/list", {})).result.tools.map((t) => t.name).sort();
  check(tools.length === 9 && tools.includes("get_parcel_boundary"), `tools/list -> ${tools.length}: ${tools.join(", ")}`);

  const b = await call("get_parcel_boundary", { query: PNU });
  check(b.jibun === "36대" && b.vertex_count === 5 && b.approx_area_m2 > 95 && b.approx_area_m2 < 105,
    `get_parcel_boundary(${PNU}) -> ${b.jibun}, ${b.vertex_count} vertices, ~${b.approx_area_m2} m²`);

  const z = await call("get_zoning", { query: PNU });
  const zoneNames = (z.use_zone ?? []).map((h) => h.zone_name);
  const districtNames = (z.use_district ?? []).map((h) => h.zone_name);
  check(zoneNames.includes("일반상업지역") && districtNames.includes("방화지구"),
    `get_zoning -> 용도지역 ${JSON.stringify(zoneNames)}, 용도지구 ${JSON.stringify(districtNames)}`);

  const a = await call("analyze_parcel", { query: PNU });
  check(a.parcel?.pnu === PNU && Array.isArray(a.next_steps) && a.next_steps.length > 0,
    `analyze_parcel -> pnu ${a.parcel?.pnu}, next_steps ${a.next_steps?.length}`);

  check(seen.length > 0 && seen.every((s) => s !== null), `fixture V-World served ${seen.length} requests (no live calls)`);
} catch (e) {
  failures.push(String(e));
  console.error("ERROR", e);
} finally {
  child.kill();
  fixture.close();
}
console.log(failures.length ? `offline smoke FAILED (${failures.length})` : "offline smoke OK");
process.exit(failures.length ? 1 : 0);
