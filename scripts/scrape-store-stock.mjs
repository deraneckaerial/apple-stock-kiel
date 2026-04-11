/**
 * Store stock scraper for MediaMarkt Citti-Park Kiel.
 *
 * Strategy: Navigate to each product page like a real user.
 * Read the availability from the __PRELOADED_STATE__ Apollo cache.
 * The pickup data for the nearest store is included in the SSR data.
 *
 * Usage: node scripts/scrape-store-stock.mjs
 */

import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/products.json");

const STORE_ID = "441"; // Citti-Park Kiel

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

/**
 * Extract pickup availability from the product page.
 * Tries multiple strategies:
 * 1. __PRELOADED_STATE__ Apollo cache (CofrPickupFeature)
 * 2. JSON-LD structured data
 * 3. DOM text indicators
 */
async function extractAvailability(page, articleNumber) {
  try {
    return await page.evaluate(({ storeId }) => {
      const result = {
        available: false,
        pickup: false,
        stockLevel: "none",
        onlineAvailable: false,
        source: "none",
      };

      // Strategy 1: Apollo cache in __PRELOADED_STATE__
      const state = window.__PRELOADED_STATE__;
      if (state?.apolloState) {
        const apollo = state.apolloState;
        const keys = Object.keys(apollo);

        // Find CofrPickupFeature entries
        const pickupKeys = keys.filter((k) => k.startsWith("CofrPickupFeature:"));
        for (const key of pickupKeys) {
          const data = apollo[key];
          if (!data) continue;

          // Check if this is for the retail product (not marketplace)
          if (data.isProductOfTypeMarketplace) continue;

          const pickupStatus = data.pickupStatus;
          if (
            pickupStatus === "IMMEDIATELY_AVAILABLE" ||
            pickupStatus === "AVAILABLE_WITHIN_REASONABLE_TIMEFRAME"
          ) {
            result.available = true;
            result.pickup = true;
            result.stockLevel = "high";
            result.pickupStatus = pickupStatus;
            result.source = "apollo-cache";
            break;
          } else if (pickupStatus === "NO_STORE_SELECTED") {
            // No store set — can't determine pickup
            result.pickupStatus = pickupStatus;
            result.source = "apollo-no-store";
          } else if (pickupStatus === "NOT_AVAILABLE") {
            result.pickupStatus = pickupStatus;
            result.source = "apollo-cache";
          }
        }

        // Check online status from CofrOnlineStatusFeature
        const onlineKeys = keys.filter((k) =>
          k.startsWith("CofrOnlineStatusFeature:")
        );
        for (const key of onlineKeys) {
          const data = apollo[key];
          if (data?.isAvailableAndBuyable && !data.isProductOfTypeMarketplace) {
            result.onlineAvailable = true;
            break;
          }
        }
      }

      // Strategy 2: JSON-LD availability
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const s of scripts) {
        try {
          const d = JSON.parse(s.textContent);
          if (d["@type"] === "BuyAction" && d.object?.offers) {
            const offers = Array.isArray(d.object.offers)
              ? d.object.offers
              : [d.object.offers];
            const inStock = offers.some(
              (o) =>
                o.availability?.includes("InStock") &&
                !o.seller // Not marketplace
            );
            if (inStock) result.onlineAvailable = true;
          }
        } catch {}
      }

      // Strategy 3: DOM text as last resort
      const bodyText = document.body.innerText;
      if (
        bodyText.includes("Abholbereit") ||
        bodyText.includes("Marktabholung möglich")
      ) {
        result.available = true;
        result.pickup = true;
        result.stockLevel = "high";
        if (result.source === "none") result.source = "dom-text";
      }

      return result;
    }, { storeId: STORE_ID });
  } catch (err) {
    return {
      available: false,
      pickup: false,
      stockLevel: "none",
      _error: err.message,
    };
  }
}

async function main() {
  const articles = getArticleNumbers();
  console.error(`[scraper] Found ${articles.length} articles to check`);

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

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();

  const results = {};
  let successCount = 0;
  let failCount = 0;
  let processedCount = 0;

  for (const articleNumber of articles) {
    processedCount++;
    if (processedCount % 20 === 1) {
      console.error(
        `[scraper] Progress: ${processedCount}/${articles.length}`
      );
    }

    try {
      const url = `https://www.mediamarkt.de/de/product/-${articleNumber}.html`;
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // Brief wait for SSR data to be available
      await page.waitForTimeout(1000);

      // Check if we hit Cloudflare
      const title = await page.title();
      if (title.includes("Just a moment")) {
        console.error(`[scraper] Cloudflare on ${articleNumber}, waiting...`);
        await page.waitForTimeout(8000);
      }

      const avail = await extractAvailability(page, articleNumber);

      results[articleNumber] = {
        articleNumber,
        available: avail.available,
        pickup: avail.pickup,
        stockLevel: avail.stockLevel,
        pickupStatus: avail.pickupStatus,
        onlineAvailable: avail.onlineAvailable,
        source: avail.source,
      };

      if (avail.available) successCount++;
    } catch (err) {
      failCount++;
      results[articleNumber] = {
        articleNumber,
        available: false,
        pickup: false,
        stockLevel: "none",
        _error: err.message?.substring(0, 100),
      };
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
