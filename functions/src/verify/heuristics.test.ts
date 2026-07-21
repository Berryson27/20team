import { test } from "node:test";
import assert from "node:assert/strict";
import { runHeuristics } from "./heuristics.ts";

// runHeuristics는 RDAP를 best-effort로 호출하는 async 함수다(오프라인이면 null → 무점수).
// 문자열 규칙 단정은 네트워크 없이도 결정론적이어야 한다.

test("userinfo trick raises score", async () => {
  const r = await runHeuristics("https://naver.com@evil-login.tk/");
  assert.ok(r.signals.some((s) => s.id === "userinfo"));
  assert.ok(r.score >= 45);
});

test("brand embedded as subdomain", async () => {
  const r = await runHeuristics("https://naver.com.secure-login.xyz/");
  assert.ok(r.signals.some((s) => s.id === "brand-subdomain"));
});

test("fake cc-tld go-kr", async () => {
  const r = await runHeuristics("https://hometax.go-kr.com/");
  assert.ok(r.signals.some((s) => s.id === "fake-cctld"));
});

test("qr interstitial", async () => {
  const r = await runHeuristics("https://me-qr.com/abc123");
  assert.ok(r.signals.some((s) => s.id === "qr-interstitial"));
});

test("apk path is high risk", async () => {
  const r = await runHeuristics("https://random-host.top/app/update.apk");
  assert.ok(r.signals.some((s) => s.id === "apk-path"));
  assert.ok(r.score >= 40);
});

test("trusted domain stays low", async () => {
  const r = await runHeuristics("https://www.kakaobank.com/");
  assert.equal(r.trusted, true);
  assert.ok(r.score <= 15);
});
