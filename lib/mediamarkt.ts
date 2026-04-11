import { STORES } from "@/lib/stores";
import type { StockResponse, StoreStock } from "@/lib/types";

// ─── Helpers ───────────────────────────────────────────────

export function normalizeStockLevel(input: {
  available: boolean;
  pickup: boolean;
}): "high" | "low" | "none" {
  if (input.pickup) return "high";
  if (input.available) return "low";
  return "none";
}

export function mapPickupStatus(
  pickupStatus: string,
  displayStatus: string,
  isInAssortment: boolean
): { available: boolean; pickup: boolean; stockLevel: "high" | "low" | "none" } {
  if (
    pickupStatus === "IMMEDIATELY_AVAILABLE" ||
    pickupStatus === "AVAILABLE_WITHIN_REASONABLE_TIMEFRAME"
  ) {
    return { available: true, pickup: true, stockLevel: "high" };
  }
  if (isInAssortment) {
    return { available: false, pickup: false, stockLevel: "none" };
  }
  return { available: false, pickup: false, stockLevel: "none" };
}

// ─── Product Page Scraper (JSON-LD + HTML text) ────────────

const SCRAPE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
  "Cache-Control": "no-cache",
};

interface PageScrapResult {
  productName: string | null;
  onlineAvailable: boolean;
  price: number | null;
  deliveryDays: string;
  source: "json-ld" | "html-text";
}

function extractJsonLd(html: string): PageScrapResult | null {
  // Find all JSON-LD blocks (type= may not be the first attribute)
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // We look for the BuyAction type which contains product + offers
      if (data["@type"] === "BuyAction" && data.object) {
        const product = data.object;
        const rawOffers = product.offers;

        if (!rawOffers) continue;

        // offers can be a single object or an array (multiple sellers)
        const offersList = Array.isArray(rawOffers) ? rawOffers : [rawOffers];
        const primaryOffer = offersList[0];

        if (!primaryOffer) continue;

        // Check availability — any offer InStock means product is available
        const isInStock = offersList.some((offer) => {
          const availUrl: string = offer.availability || "";
          return (
            availUrl.includes("InStock") ||
            availUrl.includes("PreOrder") ||
            availUrl.includes("LimitedAvailability")
          );
        });

        // Extract delivery days from primary offer
        let deliveryDays = "3-5";
        const transit =
          primaryOffer.shippingDetails?.deliveryTime?.transitTime;
        if (transit) {
          const min = transit.minValue || 2;
          const max = transit.maxValue || 5;
          deliveryDays = min === max ? `${min}` : `${min}-${max}`;
        }

        return {
          productName: product.name || null,
          onlineAvailable: isInStock,
          price:
            typeof primaryOffer.price === "number"
              ? primaryOffer.price
              : null,
          deliveryDays,
          source: "json-ld",
        };
      }

      // Also check for standalone Product type
      if (data["@type"] === "Product" && data.offers) {
        const offers = data.offers;
        const availUrl: string = offers.availability || "";
        const isInStock =
          availUrl.includes("InStock") || availUrl.includes("PreOrder");

        return {
          productName: data.name || null,
          onlineAvailable: isInStock,
          price: typeof offers.price === "number" ? offers.price : null,
          deliveryDays: "3-5",
          source: "json-ld",
        };
      }
    } catch {
      // JSON parse failed for this block, try next
    }
  }

  return null;
}

function extractFromHtmlText(html: string): PageScrapResult {
  const lower = html.toLowerCase();

  // Determine availability from text patterns
  let onlineAvailable = false;
  if (
    lower.includes("in den warenkorb") ||
    lower.includes("sofort lieferbar") ||
    lower.includes("sofort-lieferung")
  ) {
    onlineAvailable = true;
  }
  if (
    lower.includes("dieser artikel ist aktuell nicht verfügbar") ||
    lower.includes("dieser artikel ist dauerhaft ausverkauft") ||
    lower.includes("nicht mehr verfügbar")
  ) {
    onlineAvailable = false;
  }

  // Extract price from meta tag or JSON pattern
  let price: number | null = null;
  const priceMatch = html.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/);
  if (priceMatch) {
    price = parseFloat(priceMatch[1]);
  }

  // Extract product name from og:title
  let productName: string | null = null;
  const ogTitle = html.match(
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
  );
  if (ogTitle) {
    productName = ogTitle[1];
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      productName = titleMatch[1].replace(/\s*bei MediaMarkt.*$/, "").trim();
    }
  }

  return {
    productName,
    onlineAvailable,
    price,
    deliveryDays: "3-5",
    source: "html-text",
  };
}

async function fetchFromProductPage(
  articleNumber: string
): Promise<PageScrapResult | null> {
  const url = `https://www.mediamarkt.de/de/product/-${articleNumber}.html`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: SCRAPE_HEADERS,
      redirect: "follow",
    });

    if (!response.ok) {
      console.warn(
        `[scraper] Product page returned ${response.status} for article ${articleNumber}`
      );
      return null;
    }

    const html = await response.text();

    // Check for Cloudflare challenge page
    if (
      html.includes("Just a moment...") ||
      html.includes("cf-browser-verification")
    ) {
      console.warn(
        `[scraper] Cloudflare challenge detected for article ${articleNumber}`
      );
      return null;
    }

    // Try JSON-LD first (most reliable)
    const jsonLdResult = extractJsonLd(html);
    if (jsonLdResult) {
      return jsonLdResult;
    }

    // Fallback to HTML text analysis
    return extractFromHtmlText(html);
  } catch (err) {
    console.warn(`[scraper] Failed to fetch product page for ${articleNumber}:`, err);
    return null;
  }
}

// ─── GraphQL Store Availability (existing, kept as backup) ──

const GRAPHQL_ENDPOINT = "https://www.mediamarkt.de/api/v1/graphql";

const GRAPHQL_HEADERS: Record<string, string> = {
  "apollographql-client-name": "pwa-client-pqm",
  "apollographql-client-version": "8.406.0",
  "x-mms-salesline": "Media",
  "x-mms-country": "DE",
  "x-mms-language": "de",
  "content-type": "application/json",
  "x-operation": "GetClosestStoresByZipCodeOrCityWithFoundLocation",
  "x-cacheable": "true",
};

const SHA256_HASH =
  "aed000a926d7a91ed636bfbde453059505a83dc3bc1f54dc7e26f5355a5b6c35";

function buildVariables(articleNumber: string) {
  return {
    limit: 15,
    withDeliveryPromise: false,
    zipCodeOrCity: "24103",
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
}

function buildExtensions() {
  return {
    persistedQuery: {
      version: 1,
      sha256Hash: SHA256_HASH,
    },
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
}

function calcDeliveryDays(earliestISO: string | undefined): string {
  if (!earliestISO) return "3-5";
  const earliest = new Date(earliestISO);
  const now = new Date();
  const diffMs = earliest.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return "1";
  if (diffDays <= 3) return "1-3";
  if (diffDays <= 5) return "3-5";
  return `${diffDays}`;
}

interface ApiStoreResult {
  id: string;
  displayName: string;
  address: {
    street: string;
    houseNumber: string;
    zipCode: string;
    city: string;
  };
  cofrProductAggregate?: {
    cofrPickupFeature?: {
      displayStatus: string;
      pickupStatus: string;
      isProductPickable: boolean;
      isInAssortment: boolean;
      fulfillmentTime?: {
        earliest: string;
      };
    };
  };
}

/**
 * Fetches store-level pickup data via GraphQL.
 * Returns null on failure (no more mock fallback).
 */
async function fetchStoreDataFromGraphQL(
  articleNumber: string
): Promise<{ stores: StoreStock[]; onlineAvailable: boolean; deliveryDays: string } | null> {
  const variables = buildVariables(articleNumber);
  const extensions = buildExtensions();

  const params = new URLSearchParams({
    operationName: "GetClosestStoresByZipCodeOrCityWithFoundLocation",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });

  const url = `${GRAPHQL_ENDPOINT}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: GRAPHQL_HEADERS,
    });

    if (!response.ok) {
      console.warn(
        `[graphql] HTTP ${response.status} for article ${articleNumber}`
      );
      return null;
    }

    const json = await response.json();

    // Check for GraphQL errors
    if (json.errors && json.errors.length > 0) {
      console.warn(
        `[graphql] GraphQL errors for article ${articleNumber}:`,
        json.errors[0]?.message
      );
      return null;
    }

    const apiStores: ApiStoreResult[] =
      json?.data?.closestStoresWithFoundLocation?.stores ??
      json?.data?.closestStoresByZipCodeOrCityWithFoundLocation?.stores ??
      [];

    if (apiStores.length === 0) {
      return null;
    }

    // Determine online availability from store data
    let onlineAvailable = false;
    let deliveryDays = "3-5";
    for (const s of apiStores) {
      const pickup = s.cofrProductAggregate?.cofrPickupFeature;
      if (pickup?.isInAssortment) {
        onlineAvailable = true;
        if (pickup.fulfillmentTime?.earliest) {
          deliveryDays = calcDeliveryDays(pickup.fulfillmentTime.earliest);
        }
        break;
      }
    }

    // Build store lookup
    const storeMap = new Map<string, ApiStoreResult>();
    for (const s of apiStores) {
      storeMap.set(s.id, s);
    }

    const storeStocks: StoreStock[] = STORES.map((store) => {
      const apiStore = storeMap.get(store.id);
      const pickup = apiStore?.cofrProductAggregate?.cofrPickupFeature;

      if (!pickup) {
        return {
          id: store.id,
          name: store.name,
          address: store.address,
          available: false,
          pickup: false,
          stockLevel: "none" as const,
        };
      }

      const { available, pickup: hasPickup, stockLevel } = mapPickupStatus(
        pickup.pickupStatus,
        pickup.displayStatus,
        pickup.isInAssortment
      );

      return {
        id: store.id,
        name: store.name,
        address: store.address,
        available,
        pickup: hasPickup,
        stockLevel,
      };
    });

    return { stores: storeStocks, onlineAvailable, deliveryDays };
  } catch (err) {
    console.warn(
      `[graphql] Request failed for article ${articleNumber}:`,
      err
    );
    return null;
  }
}

// ─── Cached Store Data (from GitHub Actions scraper) ───────

const STOCK_CACHE_URL =
  "https://raw.githubusercontent.com/deraneckaerial/apple-stock-kiel/master/data/stock-cache.json";

interface CachedStoreProduct {
  articleNumber: string;
  available: boolean;
  pickup: boolean;
  stockLevel: "high" | "low" | "none";
  pickupStatus?: string;
  isInAssortment?: boolean;
  _error?: string;
}

interface CachedStoreData {
  storeId: string;
  storeName: string;
  checkedAt: string;
  totalProducts: number;
  availableCount: number;
  products: Record<string, CachedStoreProduct>;
}

let cachedStoreData: CachedStoreData | null = null;
let cacheLoadedAt = 0;
const STORE_CACHE_TTL = 3 * 60 * 1000; // 3 minutes (re-fetch Gist)

async function fetchCachedStoreData(): Promise<CachedStoreData | null> {
  const now = Date.now();
  if (cachedStoreData && now - cacheLoadedAt < STORE_CACHE_TTL) {
    return cachedStoreData;
  }

  try {
    // Add cache-bust to avoid GitHub CDN caching stale data
    const url = `${STOCK_CACHE_URL}?t=${now}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`[gist-cache] HTTP ${response.status}`);
      return cachedStoreData; // Return stale data if available
    }

    const data = await response.json();
    cachedStoreData = data as CachedStoreData;
    cacheLoadedAt = now;

    // Check freshness — warn if data is older than 30 minutes
    const checkedAt = new Date(cachedStoreData.checkedAt).getTime();
    const ageMinutes = Math.round((now - checkedAt) / 60000);
    if (ageMinutes > 30) {
      console.warn(`[gist-cache] Data is ${ageMinutes} minutes old`);
    }

    return cachedStoreData;
  } catch (err) {
    console.warn("[gist-cache] Failed to fetch:", err);
    return cachedStoreData; // Return stale data if available
  }
}

function getStoreStocksFromCache(
  articleNumber: string,
  cache: CachedStoreData
): StoreStock[] {
  const product = cache.products[articleNumber];
  const PRIMARY_STORE = STORES.find((s) => s.isPrimary)!;

  return STORES.map((store) => {
    // We only have data for Citti-Park (primary store)
    if (store.id === cache.storeId && product) {
      return {
        id: store.id,
        name: store.name,
        address: store.address,
        available: product.available,
        pickup: product.pickup,
        stockLevel: product.stockLevel as "high" | "low" | "none",
      };
    }
    // Other stores: no data available
    return {
      id: store.id,
      name: store.name,
      address: store.address,
      available: false,
      pickup: false,
      stockLevel: "none" as const,
    };
  });
}

// ─── Main Orchestrator ─────────────────────────────────────

/**
 * Checks product availability using a three-layer approach:
 * 1. Product page HTML → JSON-LD for reliable online status
 * 2. GitHub Actions cache → store pickup data (updated every 15 min)
 * 3. GraphQL API → store pickup data (direct, often blocked by Cloudflare)
 *
 * No mock fallback — returns honest "unknown" on failure.
 */
export async function checkAvailability(
  articleNumber: string
): Promise<StockResponse> {
  // Layer 1: Scrape product page for online status
  const pageData = await fetchFromProductPage(articleNumber);

  // Layer 2: Try cached store data from GitHub Actions scraper
  const storeCache = await fetchCachedStoreData();
  let stores: StoreStock[] | null = null;
  let storeSource = "";

  if (storeCache && storeCache.products[articleNumber]) {
    stores = getStoreStocksFromCache(articleNumber, storeCache);
    storeSource = "gist-cache";
  }

  // Layer 3: Fall back to direct GraphQL (often blocked by Cloudflare)
  if (!stores) {
    const graphqlData = await fetchStoreDataFromGraphQL(articleNumber);
    if (graphqlData) {
      stores = graphqlData.stores;
      storeSource = "graphql";
    }
  }

  // Default: no store data available
  if (!stores) {
    stores = STORES.map((store) => ({
      id: store.id,
      name: store.name,
      address: store.address,
      available: false,
      pickup: false,
      stockLevel: "none" as const,
    }));
  }

  // Prefer page scraping for online status (more reliable)
  const onlineAvailable = pageData?.onlineAvailable ?? false;
  const deliveryDays = pageData?.deliveryDays ?? "?";

  const source = pageData?.source ?? (storeSource || undefined);
  const errors: string[] = [];
  if (!pageData) errors.push("page-scrape-failed");
  if (!storeSource) errors.push("no-store-data");

  return {
    product: pageData?.productName ?? articleNumber,
    articleNumber,
    stores,
    online: { available: onlineAvailable, deliveryDays },
    cachedAt: new Date().toISOString(),
    _source: source as StockResponse["_source"],
    _error: errors.length > 0 ? errors.join(", ") : undefined,
  };
}

// Keep the old export name for backwards compatibility during transition
export const fetchStockFromMediaMarkt = checkAvailability;
