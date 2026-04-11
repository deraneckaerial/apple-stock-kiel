/**
 * Playwright-based store stock scraper for MediaMarkt Citti-Park Kiel.
 *
 * Runs inside GitHub Actions every 15 minutes.
 * 1. Launches headless Chromium
 * 2. Navigates to mediamarkt.de (passes Cloudflare)
 * 3. Makes GraphQL calls from browser context for each product
 * 4. Outputs JSON with Citti-Park availability for all products
 *
 * Usage: node scripts/scrape-store-stock.mjs
 * Output: writes stock-cache.json to stdout or --output <file>
 */

import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/products.json");

const STORE_ID = "441"; // Citti-Park Kiel
const ZIP_CODE = "24113";
const BATCH_SIZE = 8;
const SHA256_HASH =
  "aed000a926d7a91ed636bfbde453059505a83dc3bc1f54dc7e26f5355a5b6c35";

// Extract all unique article numbers from the product catalog
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

// Build GraphQL URL for a single product
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

// Parse GraphQL response for a single product
function parseStoreAvailability(articleNumber, data) {
  const stores =
    data?.data?.closestStoresWithFoundLocation?.stores ??
    data?.data?.closestStoresByZipCodeOrCityWithFoundLocation?.stores ??
    [];

  // Find Citti-Park (store 441)
  const cittiPark = stores.find((s) => s.id === STORE_ID);
  if (!cittiPark) {
    return { articleNumber, available: false, pickup: false, stockLevel: "none" };
  }

  const pickup = cittiPark.cofrProductAggregate?.cofrPickupFeature;
  if (!pickup) {
    return { articleNumber, available: false, pickup: false, stockLevel: "none" };
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

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "de-DE",
  });
  const page = await context.newPage();

  // Navigate to MediaMarkt to pass Cloudflare challenge
  console.error("[scraper] Navigating to mediamarkt.de...");
  await page.goto("https://www.mediamarkt.de/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  // Wait a moment for Cloudflare to settle
  await page.waitForTimeout(3000);
  console.error("[scraper] Page loaded, Cloudflare should be passed");

  // Batch fetch GraphQL data from within the browser context
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
      async ({ urls, headers }) => {
        const results = {};
        const promises = urls.map(async ({ articleNumber, url }) => {
          try {
            const resp = await fetch(url, {
              headers: {
                "apollographql-client-name": headers.clientName,
                "apollographql-client-version": headers.clientVersion,
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
      {
        urls: batch.map((a) => ({ articleNumber: a, url: buildGraphQLUrl(a) })),
        headers: {
          clientName: "pwa-client-pqm",
          clientVersion: "8.406.0",
        },
      }
    );

    // Parse results
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

    // Small delay between batches to be respectful
    if (i + BATCH_SIZE < articles.length) {
      await page.waitForTimeout(500);
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
    `[scraper] Done: ${successCount} available, ${failCount} failed, ${articles.length - successCount - failCount} not in stock`
  );

  // Output JSON to stdout
  process.stdout.write(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("[scraper] Fatal error:", err);
  process.exit(1);
});
