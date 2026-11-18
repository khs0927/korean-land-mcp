// Run after npm run build. Exercises the live HTTP transport locally, no V-World key needed.
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import assert from "node:assert/strict";

const reserve = createNetServer();
await new Promise((ok, reject) => reserve.once("error", reject).listen(0, "127.0.0.1", ok));
const port = reserve.address().port;
await new Promise((ok) => reserve.close(ok));
const token = "http-smoke-only-32-characters-123456789";
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/server.js"], {
  env: { ...process.env, PORT: String(port), MCP_TRANSPORT: "http", MCP_BEARER_TOKEN: token },
  stdio: ["ignore", "ignore", "pipe"],
});
let errors = "";
child.stderr.on("data", (chunk) => { errors += chunk.toString().slice(0, 2000); });

const rpc = (id, method, params) => ({ jsonrpc: "2.0", id, method, params });
async function post(payload, session = "", auth = token) {
  return fetch(base + "/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
      ...(auth ? { authorization: "Bearer " + auth } : {}),
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6000),
  });
}
async function read(r) {
  const body = await r.text();
  if (r.headers.get("content-type")?.includes("text/event-stream")) {
    const lines = body.split("\n").filter((l) => l.startsWith("data:"));
    const last = lines.reverse().find((l) => l.trim().length > 5);
    return JSON.parse(last.slice(5).trim());
  }
  return JSON.parse(body);
}
try {
  let health;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode != null) throw new Error("HTTP MCP exited unexpectedly: " + errors);
    try {
      health = await fetch(base + "/health");
      if (health.ok) break;
    } catch {}
    await new Promise((ok) => setTimeout(ok, 100));
  }
  assert.equal(health?.status, 200, "health must be ready");

  assert.equal((await post(rpc(1, "initialize", {}), "", "")).status, 401, "auth must be required");
  assert.equal((await post(rpc(1, "initialize", {}), "", "incorrect-token-long-long-long")).status, 401);

  async function newSession() {
    const reply = await post(rpc(1, "initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "zium-http-smoke", version: "1.0" },
    }));
    assert.equal(reply.status, 200, await reply.clone().text());
    const id = reply.headers.get("mcp-session-id");
    assert.ok(id?.length > 8, "session ID required");
    assert.equal((await read(reply)).result.serverInfo.name, "korean-land-mcp");
    const notice = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, id);
    assert.equal(notice.status, 202);
    return id;
  }

  const first = await newSession();
  const second = await newSession();
  assert.notEqual(first, second, "independent MCP clients need independent sessions");

  for (const session of [first, second]) {
    const response = await post(rpc(2, "tools/list", {}), session);
    assert.equal(response.status, 200);
    const data = await read(response);
    const names = data.result.tools.map((t) => t.name);
    assert.equal(names.length, 9);
    assert.ok(names.includes("get_parcel_boundary"));
  }
  const badSession = await post(rpc(2, "tools/list", {}), "nonexistent-session");
  assert.equal(badSession.status, 404);

  console.log("HTTP MCP smoke OK: auth 401, 2 independent sessions, 9 tools, unknown session 404");
} finally {
  child.kill("SIGTERM");
}
