import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const INDEX_HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const EXPECTED_ASSET_VERSION = "20260627-dark-alive-dead-contrast";

test("local app assets share the current cache-busting version", () => {
  const assetUrls = [...INDEX_HTML.matchAll(/(?:href|src)="\.\/(src\/(?:styles|ui-focus|app)\.(?:css|js)\?v=([^"]+))"/g)]
    .map((match) => ({ path: match[1], version: match[2] }));

  assert.deepEqual(assetUrls, [
    { path: `src/styles.css?v=${EXPECTED_ASSET_VERSION}`, version: EXPECTED_ASSET_VERSION },
    { path: `src/ui-focus.js?v=${EXPECTED_ASSET_VERSION}`, version: EXPECTED_ASSET_VERSION },
    { path: `src/app.js?v=${EXPECTED_ASSET_VERSION}`, version: EXPECTED_ASSET_VERSION }
  ]);
});
