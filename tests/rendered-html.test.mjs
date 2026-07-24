import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${pathname}`,
  );
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the secured Round 4 pilot entry", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /Secure roofing intelligence/i);
  assert.match(html, /Controlled Humboldt pilot/i);
  assert.match(html, /Private by default/i);
  assert.match(html, /Money stays deterministic/i);
  assert.match(html, /History stays reproducible/i);
  assert.match(html, /Create account/i);
  assert.doesNotMatch(html, /OPENAI_API_KEY/i);
});

test("preserves later-round screens only on the prototype route", async () => {
  const response = await render("/prototypes");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Active construction/i);
  assert.match(html, /protected construction/i);
});
