import { STORES } from "@/lib/stores";
import type { StockResponse, StoreStock } from "@/lib/types";

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
  // NOT_AVAILABLE
  if (isInAssortment) {
    return { available: false, pickup: false, stockLevel: "none" };
  }
  return { available: false, pickup: false, stockLevel: "none" };
}

export function buildMockStockResponse(articleNumber: string): StockResponse {
  const seed = parseInt(articleNumber.slice(-1), 10) || 0;

  const mockStores: StoreStock[] = STORES.map((store, i) => {
    const isAvailable = (seed + i) % 3 !== 0;
    const hasPickup = isAvailable && (seed + i) % 2 === 0;
    return {
      id: store.id,
      name: store.name,
      address: store.address,
      available: isAvailable,
      pickup: hasPickup,
      stockLevel: normalizeStockLevel({
        available: isAvailable,
        pickup: hasPickup,
      }),
    };
  });

  return {
    product: `Mock Product ${articleNumber}`,
    articleNumber,
    stores: mockStores,
    online: { available: true, deliveryDays: "3-5" },
    cachedAt: new Date().toISOString(),
  };
}

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

export async function fetchStockFromMediaMarkt(
  articleNumber: string
): Promise<StockResponse> {
  const variables = buildVariables(articleNumber);
  const extensions = buildExtensions();

  const params = new URLSearchParams({
    operationName: "GetClosestStoresByZipCodeOrCityWithFoundLocation",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });

  const url = `${GRAPHQL_ENDPOINT}?${params.toString()}`;

  let apiStores: ApiStoreResult[] = [];
  let apiFailed = false;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: GRAPHQL_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const storesData =
      json?.data?.closestStoresWithFoundLocation?.stores ??
      json?.data?.closestStoresByZipCodeOrCityWithFoundLocation?.stores ??
      [];

    apiStores = storesData;
  } catch (err) {
    console.warn(
      `[mediamarkt] Real API call failed for article ${articleNumber}, falling back to mock data.`,
      err
    );
    apiFailed = true;
  }

  if (apiFailed) {
    return buildMockStockResponse(articleNumber);
  }

  // Build a lookup map from store id -> API result
  const storeMap = new Map<string, ApiStoreResult>();
  for (const s of apiStores) {
    storeMap.set(s.id, s);
  }

  // Determine online availability from any store's fulfillment data
  // Use the first store that has data to infer online availability
  let onlineAvailable = false;
  let onlineDeliveryDays = "3-5";
  for (const s of apiStores) {
    const pickup = s.cofrProductAggregate?.cofrPickupFeature;
    if (pickup?.isInAssortment) {
      onlineAvailable = true;
      if (pickup.fulfillmentTime?.earliest) {
        onlineDeliveryDays = calcDeliveryDays(pickup.fulfillmentTime.earliest);
      }
      break;
    }
  }

  const storeStocks: StoreStock[] = STORES.map((store) => {
    const apiStore = storeMap.get(store.id);
    const pickup = apiStore?.cofrProductAggregate?.cofrPickupFeature;

    if (!pickup) {
      // Store not found in API response — treat as not available
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

  return {
    product: articleNumber,
    articleNumber,
    stores: storeStocks,
    online: { available: onlineAvailable, deliveryDays: onlineDeliveryDays },
    cachedAt: new Date().toISOString(),
  };
}
