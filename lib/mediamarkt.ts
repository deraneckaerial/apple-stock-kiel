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

export function buildMockStockResponse(articleNumber: string): StockResponse {
  const seed = parseInt(articleNumber.slice(-1), 10) || 0;

  const mockStores: StoreStock[] = STORES.map((store, i) => {
    const isAvailable = (seed + i) % 3 !== 0;
    const hasPickup = isAvailable && (seed + i) % 2 === 0;
    return {
      id: store.id,
      name: store.name,
      address: store.address,
      phone: store.phone,
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

export async function fetchStockFromMediaMarkt(
  articleNumber: string
): Promise<StockResponse> {
  // TODO: Replace with real Media Markt GraphQL query once reverse-engineered.
  console.warn(
    `[mediamarkt] Using mock data for article ${articleNumber}. Real API integration pending.`
  );

  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

  return buildMockStockResponse(articleNumber);
}
