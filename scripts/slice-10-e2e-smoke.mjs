#!/usr/bin/env node
/**
 * Slice 10 smoke checks against api-dev (no Shopify admin session required).
 * Usage: node scripts/slice-10-e2e-smoke.mjs [shop.myshopify.com]
 */

const API_ORIGIN = process.env.RAZZL_API_ORIGIN ?? "https://api-dev.razzl.com";
const shopArg = process.argv[2]?.trim();

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { response, body };
}

let passed = 0;
let failed = 0;

async function run(name, fn) {
  if (await check(name, fn)) passed += 1;
  else failed += 1;
}

await run("health", async () => {
  const { response, body } = await fetchJson(`${API_ORIGIN}/health`);
  if (!response.ok || body.ok !== true) {
    throw new Error(`Expected ok health, got ${response.status}`);
  }
});

await run("webhook route exists (not 404)", async () => {
  const { response } = await fetchJson(`${API_ORIGIN}/api/commerce/shopify/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  if (response.status === 404) {
    throw new Error("Webhook route returned 404 — check shopify.app.toml absolute URIs");
  }
  if (response.status !== 400 && response.status !== 401) {
    throw new Error(`Expected 400/401 without headers, got ${response.status}`);
  }
});

await run("deployed webhook path is not /shopify/api prefix", async () => {
  const { response } = await fetchJson(`${API_ORIGIN}/shopify/api/commerce/shopify/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  if (response.status !== 404) {
    throw new Error(
      "Wrong webhook URL responds — shopify.app.toml may still use relative URIs under /shopify"
    );
  }
});

if (shopArg) {
  const shop = shopArg.includes(".myshopify.com") ? shopArg : `${shopArg}.myshopify.com`;

  await run(`connection status (${shop})`, async () => {
    const { response, body } = await fetchJson(
      `${API_ORIGIN}/api/commerce/shopify/connection?shop=${encodeURIComponent(shop)}`
    );
    if (!response.ok || body.ok !== true) {
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    console.log(`      install=${body.installStatus ?? "none"} tenantLinked=${body.tenantLinked ?? false}`);
  });

  await run(`billing status (${shop})`, async () => {
    const { response, body } = await fetchJson(
      `${API_ORIGIN}/api/commerce/billing/status?shop=${encodeURIComponent(shop)}`
    );
    if (response.status === 400 && body.error === "Tenant is not linked") {
      console.log("      skipped — tenant not linked yet");
      return;
    }
    if (!response.ok || body.ok !== true) {
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    console.log(
      `      billingSource=${body.billingSource} hasEntitlement=${body.hasEntitlement} plans=${body.plans?.length ?? 0}`
    );
  });
} else {
  console.log("INFO  Pass shop domain for connection/billing checks: node scripts/slice-10-e2e-smoke.mjs YOUR-STORE.myshopify.com");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
