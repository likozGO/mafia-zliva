import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const INDEX_HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const APP_JS = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const FAVICON_URL = new URL("../favicon.svg", import.meta.url);
const EXPECTED_ASSET_VERSION = "20260627-vote-results";

test("local app assets share the current cache-busting version", () => {
  const assetUrls = [...INDEX_HTML.matchAll(/(?:href|src)="\.\/(src\/(?:styles|ui-focus|app)\.(?:css|js)\?v=([^"]+))"/g)]
    .map((match) => ({ path: match[1], version: match[2] }));

  assert.deepEqual(assetUrls, [
    { path: `src/styles.css?v=${EXPECTED_ASSET_VERSION}`, version: EXPECTED_ASSET_VERSION },
    { path: `src/ui-focus.js?v=${EXPECTED_ASSET_VERSION}`, version: EXPECTED_ASSET_VERSION },
    { path: `src/app.js?v=${EXPECTED_ASSET_VERSION}`, version: EXPECTED_ASSET_VERSION }
  ]);
});

test("confetti is loaded from a deployable vendor asset instead of node_modules", () => {
  assert.match(INDEX_HTML, /<script src="\.\/vendor\/canvas-confetti\.browser\.js"><\/script>/);
  assert.doesNotMatch(APP_JS, /\/node_modules\//);
});

test("document links a deployable svg favicon", () => {
  assert.match(INDEX_HTML, /<link rel="icon" type="image\/svg\+xml" href="\.\/favicon\.svg" \/>/);
  assert.equal(existsSync(FAVICON_URL), true);

  const favicon = readFileSync(FAVICON_URL, "utf8");
  assert.match(favicon, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(favicon, /aria-label="Mafia favicon"/);
});
