import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright-core";

const output = resolve(process.argv[2] ?? "");
const executable = process.argv[3];
if (!process.argv[2]?.startsWith("/") || !executable?.startsWith("/"))
  throw new Error("Use capture-web.mjs NEW_ABSOLUTE_OUTPUT ABSOLUTE_CHROMIUM");
await mkdir(output, { mode: 0o700 });
const capturePath = resolve(output, "excalidraw.har");
let browser;
let context;
const requests = [];
const pageErrors = [];
let outcome;
try {
  // Chromium does not read HTTPS_PROXY itself. Keep credentials out of logs.
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const proxy = proxyUrl ? new URL(proxyUrl) : null;
  browser = await playwright.chromium.launch({
    executablePath: executable,
    headless: true,
    chromiumSandbox: true,
    ...(proxy
      ? {
          proxy: {
            server: `${proxy.protocol}//${proxy.host}`,
            ...(proxy.username
              ? { username: decodeURIComponent(proxy.username) }
              : {}),
            ...(proxy.password
              ? { password: decodeURIComponent(proxy.password) }
              : {}),
          },
        }
      : {}),
  });
  context = await browser.newContext({
    recordHar: { path: capturePath, content: "embed", mode: "full" },
  });
  const page = await context.newPage();
  page.on("requestfailed", (request) => {
    requests.push({ url: request.url(), failure: request.failure() });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto("https://excalidraw.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  assert.ok(response?.ok(), "Public application document did not load");
  await page.waitForTimeout(7_000);
  await page.screenshot({ path: resolve(output, "application.png") });
  outcome = {
    product: "Excalidraw public web application",
    requested_url: "https://excalidraw.com/",
    observed_url: page.url(),
    title: await page.title(),
    browser: browser.version(),
    acquisition:
      "Owned empty-profile Chromium navigation; no supplied credentials or UI actions",
    request_failures: requests,
    page_errors: pageErrors,
    coverage:
      "Requests recorded during this one startup window; not all application behavior",
  };
} finally {
  await context?.close();
  await browser?.close();
}
const bytes = await readFile(capturePath);
const capture = JSON.parse(bytes);
assert.ok(capture.log.entries.length > 0);
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(
    {
      ...outcome,
      har_bytes: bytes.length,
      har_sha256: createHash("sha256").update(bytes).digest("hex"),
      retained_entries: capture.log.entries.length,
      owned_browser_closed: !browser.isConnected(),
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(
  JSON.stringify({
    output,
    entries: capture.log.entries.length,
    har_bytes: bytes.length,
    observed_url: outcome.observed_url,
  }) + "\n",
);
