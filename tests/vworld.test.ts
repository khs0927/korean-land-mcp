import { describe, it, expect } from "vitest";
import { isPnu, vworldBase } from "../src/lib/vworld.js";

describe("isPnu", () => {
  it("accepts 19-digit string", () => {
    expect(isPnu("1144012400102290001")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isPnu("  1144012400102290001  ")).toBe(true);
  });

  it("rejects shorter strings", () => {
    expect(isPnu("123456789012345678")).toBe(false);
  });

  it("rejects longer strings", () => {
    expect(isPnu("11440124001022900012")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isPnu("114401240010229000A")).toBe(false);
    expect(isPnu("경기도 평택시 포승읍 내기리 680")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isPnu("")).toBe(false);
  });
});

describe("vworldBase", () => {
  const saved = process.env.VWORLD_BASE_URL;
  const restore = () => {
    if (saved === undefined) delete process.env.VWORLD_BASE_URL;
    else process.env.VWORLD_BASE_URL = saved;
  };

  it("defaults to the public V-World endpoint", () => {
    delete process.env.VWORLD_BASE_URL;
    expect(vworldBase()).toBe("https://api.vworld.kr/req");
    restore();
  });

  it("honours VWORLD_BASE_URL and trims trailing slashes", () => {
    process.env.VWORLD_BASE_URL = "http://127.0.0.1:8787/req/";
    expect(vworldBase()).toBe("http://127.0.0.1:8787/req");
    restore();
  });

  it("rejects non-http(s) or malformed overrides", () => {
    process.env.VWORLD_BASE_URL = "file:///etc/passwd";
    expect(() => vworldBase()).toThrow(/http\(s\)/);
    process.env.VWORLD_BASE_URL = "not a url";
    expect(() => vworldBase()).toThrow(/valid URL/);
    restore();
  });
});
