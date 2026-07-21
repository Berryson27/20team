import { test } from "node:test";
import assert from "node:assert/strict";
import { GeminiClient } from "./llmClient.ts";

// S4 모델 폴백: primary(예: gemini-pro-latest)가 404/429/throw로 실패하면
// fallback(예: gemini-flash-latest)로 1회 재시도한다. usedFallback으로 관측 가능해야 한다.
// 각 테스트는 globalThis.fetch를 모킹하고 반드시 원복한다(다른 테스트 오염 방지).

const PRIMARY = "gemini-pro-latest";
const FALLBACK = "gemini-flash-latest";

function jsonAnalysisResponse(overrides: Partial<Record<string, unknown>> = {}): Response {
  const payload = {
    impersonates_brand: null,
    has_credential_form: true,
    urgency_language: false,
    apk_prompt: false,
    threat_type: "credential",
    reasoning: "테스트 근거",
    ...overrides,
  };
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200 }
  );
}

test("primary 404 -> fallback 200: returns normalized result + usedFallback true", async () => {
  const origFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    if (u.includes(`/models/${PRIMARY}:`)) return new Response("not found", { status: 404 });
    if (u.includes(`/models/${FALLBACK}:`)) return jsonAnalysisResponse();
    throw new Error("unexpected model in url: " + u);
  }) as typeof fetch;
  try {
    const client = new GeminiClient("test-key", PRIMARY, FALLBACK);
    const result = await client.analyzePage("evil.example", "some phishing page text");
    assert.equal(result.has_credential_form, true);
    assert.equal(result.threat_type, "credential");
    assert.equal(client.usedFallback, true);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("primary 200: fallback not called, usedFallback false", async () => {
  const origFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    calls.push(String(url));
    return jsonAnalysisResponse({ has_credential_form: false });
  }) as typeof fetch;
  try {
    const client = new GeminiClient("test-key", PRIMARY, FALLBACK);
    const result = await client.analyzePage("safe.example", "normal page text");
    assert.equal(result.has_credential_form, false);
    assert.equal(client.usedFallback, false);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("primary 404 + fallback 404: throws (caller treats as unavailable)", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("not found", { status: 404 })) as typeof fetch;
  try {
    const client = new GeminiClient("test-key", PRIMARY, FALLBACK);
    await assert.rejects(() => client.analyzePage("evil.example", "some text"));
  } finally {
    globalThis.fetch = origFetch;
  }
});
