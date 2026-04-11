/**
 * Store stock scraper for MediaMarkt Citti-Park Kiel.
 *
 * Strategy: Set MC_OUTLET_ID=441 cookie, then navigate to each product page.
 * MediaMarkt's own JS loads pickup data via GraphQL (passes Cloudflare natively).
 * We read the pickup status from the rendered DOM.
 */

import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/products.json");

const STORE_ID = "441";
const STORE_NAME = "MediaMarkt Kiel";

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
 * Read pickup status from the rendered DOM.
 * After MC_OUTLET_ID cookie is set, the page shows one of:
 * - "Abholbereit in ..." or "Marktabholung ab ..." → available for pickup
 * - "Nicht abholbar" or "Dieser Artikel ist nicht abholbar" → not available
 * - "Bitte wähle einen Markt aus" → store not set (shouldn't happen)
 */
async function readPickupFromDOM(page) {
  return page.evaluate(() => {
    const body = document.body.innerText;

    // Positive indicators
    const pickupAvailable =
      body.includes("Abholbereit") ||
      body.includes("Marktabholung ab") ||
      body.includes("Marktabholung möglich") ||
      body.includes("Heute abholbar");

    // Negative indicators
    const pickupUnavailable =
      body.includes("Nicht abholbar") ||
      body.includes("nicht abholbar") ||
      body.includes("Dieser Artikel ist leider nicht");

    // No store set
    const noStore = body.includes("Bitte wähle einen Markt aus");

    // Online indicators
    const onlineAvailable =
      body.includes("In den Warenkorb") ||
      body.includes("Sofort-Lieferung") ||
      body.includes("Lieferung nach Hause");

    let status = "unknown";
    if (pickupAvailable) status = "available";
    else if (pickupUnavailable) status = "not_available";
    else if (noStore) status = "no_store";

    return {
      pickupAvailable,
      pickupUnavailable,
      noStore,
      onlineAvailable,
      status,
    };
  });
}

async function main() {
  const articles = getArticleNumbers();
  console.error(`[scraper] ${articles.length} articles to check at ${STORE_NAME}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "de-DE",
    viewport: { width: 1920, height: 1080 },
  });

  // Set the store cookie BEFORE any navigation
  await context.addCookies([
    {
      name: "MC_OUTLET_ID",
      value: STORE_ID,
      domain: ".mediamarkt.de",
      path: "/",
    },
  ]);

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();

  const results = {};
  let availableCount = 0;
  let failCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const articleNumber = articles[i];

    if ((i + 1) % 20 === 1 || i === 0) {
      console.error(`[scraper] Progress: ${i + 1}/${articles.length}`);
    }

    try {
      await page.goto(
        `https://www.mediamarkt.de/de/product/-${articleNumber}.html`,
        { waitUntil: "domcontentloaded", timeout: 15000 }
      );

      // Wait for client-side JS to load pickup data
      // The pickup section needs time to fetch from GraphQL
      await page.waitForTimeout(2500);

      // Check for Cloudflare challenge
      const title = await page.title();
      if (title.includes("Just a moment")) {
        console.error(`[scraper] Cloudflare challenge on ${articleNumber}`);
        await page.waitForTimeout(10000);
      }

      const dom = await readPickupFromDOM(page);

      results[articleNumber] = {
        articleNumber,
        available: dom.pickupAvailable,
        pickup: dom.pickupAvailable,
        stockLevel: dom.pickupAvailable ? "high" : "none",
        onlineAvailable: dom.onlineAvailable,
        status: dom.status,
      };

      if (dom.pickupAvailable) availableCount++;
    } catch (err) {
      failCount++;
      results[articleNumber] = {
        articleNumber,
        available: false,
        pickup: false,
        stockLevel: "none",
        _error: err.message?.substring(0, 80),
      };
    }
  }

  await browser.close();

  const output = {
    storeId: STORE_ID,
    storeName: "MediaMarkt Kiel (Citti-Park)",
    checkedAt: new Date().toISOString(),
    totalProducts: articles.length,
    availableCount,
    failedCount: failCount,
    products: results,
  };

  console.error(
    `[scraper] Done: ${availableCount} pickup-available, ${failCount} failed, ${
      articles.length - availableCount - failCount
    } not in stock`
  );

  process.stdout.write(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("[scraper] Fatal:", err);
  process.exit(1);
});
