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

test("renders the homeowner-only planning entry", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /Home Project Planner/i);
  assert.match(html, /Get a useful home-project price range/i);
  assert.match(html, /Quick photo quote/i);
  assert.match(html, /Guided self-inspection/i);
  assert.match(html, /No account needed/i);
  assert.match(html, /planning estimate, not a contractor bid/i);
  assert.match(html, /AI never sets the price/i);
  assert.doesNotMatch(html, /OPENAI_API_KEY/i);
});

test("preserves later-round screens only on the prototype route", async () => {
  const response = await render("/prototypes");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Active construction/i);
  assert.match(html, /protected construction/i);
});
