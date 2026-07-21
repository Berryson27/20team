import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSafeBrowsing } from "./safebrowsing.ts";

// S5: Google Safe Browsing. 키는 process.env에서 읽는다(SAFE_BROWSING_API_KEY 우선,
// 없으면 GEMINI_API_KEY 폴백 — v2 secrets는 런타임에 process.env로 노출된다).
// 각 테스트는 fetch/env를 모킹하고 반드시 원복한다(다른 테스트 오염 방지).

test("returns matched on threat response", async () => {
  const origFetch = globalThis.fetch;
  const origKey = process.env.SAFE_BROWSING_API_KEY;
  process.env.SAFE_BROWSING_API_KEY = "test-key";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }), { status: 200 })
  ) as typeof fetch;
  try {
    const r = await checkSafeBrowsing("https://evil.example");
    assert.equal(r?.matched, true);
    assert.equal(r?.threatType, "SOCIAL_ENGINEERING");
    assert.equal(typeof r?.label, "string");
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.SAFE_BROWSING_API_KEY;
    else process.env.SAFE_BROWSING_API_KEY = origKey;
  }
});

test("returns null when no key available", async () => {
  const origSb = process.env.SAFE_BROWSING_API_KEY;
  const origGemini = process.env.GEMINI_API_KEY;
  delete process.env.SAFE_BROWSING_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const r = await checkSafeBrowsing("https://x.example");
    assert.equal(r, null);
  } finally {
    if (origSb !== undefined) process.env.SAFE_BROWSING_API_KEY = origSb;
    if (origGemini !== undefined) process.env.GEMINI_API_KEY = origGemini;
  }
});

test("returns null on non-200 response (key present)", async () => {
  const origFetch = globalThis.fetch;
  const origKey = process.env.SAFE_BROWSING_API_KEY;
  process.env.SAFE_BROWSING_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  try {
    const r = await checkSafeBrowsing("https://x.example");
    assert.equal(r, null);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.SAFE_BROWSING_API_KEY;
    else process.env.SAFE_BROWSING_API_KEY = origKey;
  }
});

test("returns null when fetch throws", async () => {
  const origFetch = globalThis.fetch;
  const origKey = process.env.SAFE_BROWSING_API_KEY;
  process.env.SAFE_BROWSING_API_KEY = "test-key";
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  try {
    const r = await checkSafeBrowsing("https://x.example");
    assert.equal(r, null);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.SAFE_BROWSING_API_KEY;
    else process.env.SAFE_BROWSING_API_KEY = origKey;
  }
});
