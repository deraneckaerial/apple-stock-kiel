/**
 * Store stock scraper for MediaMarkt Citti-Park Kiel.
 *
 * Uses rebrowser-playwright (stealth Playwright fork) to bypass Cloudflare.
 * Falls back to regular playwright if rebrowser is not available.
 *
 * Flow:
 * 1. Launches headless Chromium (stealth mode)
 * 2. Navigates to a MediaMarkt product page (passes Cloudflare)
 * 3. Makes GraphQL calls from browser context for each product
 * 4. Outputs JSON with Citti-Park availability for all products
 *
 * Usage: node scripts/scrape-store-stock.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/products.json");

const STORE_ID = "441"; // Citti-Park Kiel
const ZIP_CODE = "24113";
const BATCH_SIZE = 5; // Smaller batches, more delay = less detection
const SHA256_HASH =
  "aed000a926d7a91ed636bfbde453059505a83dc3bc1f54dc7e26f5355a5b6c35";

async function getPlaywright() {
  const mod = await import("playwright");
  console.error("[scraper] Using playwright");
  return mod;
}

function getArticleNumbers() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const articles = new Set();
  for (const cat of catalog.categories) {
    for (const model of cat.models) {
      for (const variant of model.variants) {
        articles.add(variant.articleNumber);
      }
    }
  }
  return [...articles];
}

function buildGraphQLUrl(articleNumber) {
  const variables = {
    limit: 5,
    withDeliveryPromise: false,
    zipCodeOrCity: ZIP_CODE,
    productId: articleNumber,
    config: {
      isEnabled: true,
      baseDomain: "https://www.mediamarkt.de",
      channel: "DESKTOP",
      isLegacyDataExcluded: false,
      features: {
        badges: { isFreeShippingBadgeIncluded: false },
        crossSalesLine: { isEnabled: true, isOutputForced: false },
        onlineStatus: { isPermanentlyNaIndexEnabled: true },
        pickup: { isStrictPickupDisplayStatusEnabled: false },
        price: {
          strikePriceTypes: [
            { strikePriceType: "lop" },
            {
              strikePriceType: "rrp",
              shouldBeStruck: true,
              showDiscountBadge: true,
              isLegalTextInlineAllowed: false,
            },
          ],
          isBasePriceRequiredFlagRespected: false,
          isDiscountLabelEnabled: true,
          isDiscountPercentageShown: true,
          isDisplayPriceWithStrikePriceRrpThemed: true,
          isLongerStrikePricePrefixAllowed: false,
          isPromoPriceFiltered: true,
          isPromoPriceUsedAsDisplayPriceInApp: false,
          isHistoryChartEnabled: false,
          discountPercentageMinimum: 10,
          discountPercentageMinimumFractionDigits: 0,
        },
        delivery: {
          isDeliveryStatusByEarliestDateEnabled: true,
          isLocationSourcingEnabled: true,
        },
        refurbishedGoods: { isEnabled: true },
      },
    },
  };

  const extensions = {
    persistedQuery: { version: 1, sha256Hash: SHA256_HASH },
    pwa: {
      captureChannel: "DESKTOP",
      salesLine: "Media",
      country: "DE",
      language: "de",
      globalLoyaltyProgram: true,
      isOneAccountProgramActive: true,
      shouldInactiveContractsBeHidden: true,
      isUsingXccCustomerComponent: true,
      isCheckoutPhoneCompareActive: true,
    },
  };

  const params = new URLSearchParams({
    operationName: "GetClosestStoresByZipCodeOrCityWithFoundLocation",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });

  return `https://www.mediamarkt.de/api/v1/graphql?${params.toString()}`;
}

function parseStoreAvailability(articleNumber, data) {
  const stores =
    data?.data?.closestStoresWithFoundLocation?.stores ??
    data?.data?.closestStoresByZipCodeOrCityWithFoundLocation?.stores ??
    [];

  const cittiPark = stores.find((s) => s.id === STORE_ID);
  if (!cittiPark) {
    return {
      articleNumber,
      available: false,
      pickup: false,
      stockLevel: "none",
    };
  }

  const pickup = cittiPark.cofrProductAggregate?.cofrPickupFeature;
  if (!pickup) {
    return {
      articleNumber,
      available: false,
      pickup: false,
      stockLevel: "none",
    };
  }

  const isAvailable =
    pickup.pickupStatus === "IMMEDIATELY_AVAILABLE" ||
    pickup.pickupStatus === "AVAILABLE_WITHIN_REASONABLE_TIMEFRAME";

  return {
    articleNumber,
    available: isAvailable,
    pickup: isAvailable,
    stockLevel: isAvailable ? "high" : "none",
    pickupStatus: pickup.pickupStatus,
    isInAssortment: pickup.isInAssortment,
  };
}

async function main() {
  const articles = getArticleNumbers();
  console.error(`[scraper] Found ${articles.length} articles to check`);

  const { chromium } = await getPlaywright();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "de-DE",
    viewport: { width: 1920, height: 1080 },
  });

  // Anti-detection init scripts
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["de-DE", "de", "en-US", "en"],
    });
    // Override permissions query
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: "denied" })
          : originalQuery(parameters);
    }
  });

  const page = await context.newPage();

  // Navigate to a real product page to properly pass Cloudflare
  console.error("[scraper] Navigating to product page...");
  try {
    await page.goto("https://www.mediamarkt.de/de/product/-3034649.html", {
      waitUntil: "networkidle",
      timeout: 45000,
    });
  } catch {
    console.error("[scraper] networkidle timeout, continuing anyway...");
  }

  await page.waitForTimeout(5000);

  const title = await page.title();
  console.error(`[scraper] Page title: "${title}"`);

  if (title.includes("Just a moment")) {
    console.error("[scraper] Cloudflare challenge detected, waiting 15s...");
    await page.waitForTimeout(15000);
    const newTitle = await page.title();
    console.error(`[scraper] After wait: "${newTitle}"`);
  }

  // Verify GraphQL access with a test call
  const testResult = await page.evaluate(async (url) => {
    try {
      const r = await fetch(url, {
        headers: {
          "apollographql-client-name": "pwa-client-pqm",
          "apollographql-client-version": "8.406.0",
          "x-mms-salesline": "Media",
          "x-mms-country": "DE",
          "x-mms-language": "de",
          "content-type": "application/json",
        },
      });
      if (!r.ok) return { status: r.status, ok: false };
      const data = await r.json();
      const stores =
        data?.data?.closestStoresWithFoundLocation?.stores ??
        data?.data?.closestStoresByZipCodeOrCityWithFoundLocation?.stores ??
        [];
      return { status: r.status, ok: true, storeCount: stores.length };
    } catch (e) {
      return { error: e.message };
    }
  }, buildGraphQLUrl("3034649"));

  console.error(`[scraper] Test call: ${JSON.stringify(testResult)}`);

  if (!testResult.ok) {
    console.error("[scraper] GraphQL access blocked. Aborting.");
    await browser.close();

    // Output empty cache with error info
    const output = {
      storeId: STORE_ID,
      storeName: "MediaMarkt Kiel (Citti-Park)",
      checkedAt: new Date().toISOString(),
      totalProducts: articles.length,
      availableCount: 0,
      failedCount: articles.length,
      _error: `GraphQL blocked: ${JSON.stringify(testResult)}`,
      products: {},
    };
    process.stdout.write(JSON.stringify(output, null, 2));
    process.exit(0); // Don't fail the whole workflow
  }

  // GraphQL works — batch fetch all products
  const results = {};
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    console.error(
      `[scraper] Batch ${batchNum}/${totalBatches} (${batch.length} articles)`
    );

    const batchResults = await page.evaluate(
      async ({ urls }) => {
        const results = {};
        const promises = urls.map(async ({ articleNumber, url }) => {
          try {
            const resp = await fetch(url, {
              headers: {
                "apollographql-client-name": "pwa-client-pqm",
                "apollographql-client-version": "8.406.0",
                "x-mms-salesline": "Media",
                "x-mms-country": "DE",
                "x-mms-language": "de",
                "content-type": "application/json",
              },
            });
            if (!resp.ok) {
              results[articleNumber] = { error: `HTTP ${resp.status}` };
              return;
            }
            results[articleNumber] = await resp.json();
          } catch (err) {
            results[articleNumber] = { error: err.message };
          }
        });
        await Promise.all(promises);
        return results;
      },
      { urls: batch.map((a) => ({ articleNumber: a, url: buildGraphQLUrl(a) })) }
    );

    for (const [articleNumber, data] of Object.entries(batchResults)) {
      if (data.error) {
        failCount++;
        results[articleNumber] = {
          articleNumber,
          available: false,
          pickup: false,
          stockLevel: "none",
          _error: data.error,
        };
      } else {
        const parsed = parseStoreAvailability(articleNumber, data);
        results[articleNumber] = parsed;
        if (parsed.available) successCount++;
      }
    }

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < articles.length) {
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();

  const output = {
    storeId: STORE_ID,
    storeName: "MediaMarkt Kiel (Citti-Park)",
    checkedAt: new Date().toISOString(),
    totalProducts: articles.length,
    availableCount: successCount,
    failedCount: failCount,
    products: results,
  };

  console.error(
    `[scraper] Done: ${successCount} available, ${failCount} failed, ${
      articles.length - successCount - failCount
    } not in stock`
  );

  process.stdout.write(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("[scraper] Fatal error:", err);
  process.exit(1);
});
