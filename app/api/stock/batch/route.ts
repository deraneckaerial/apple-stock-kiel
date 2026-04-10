import { NextRequest, NextResponse } from "next/server";
import { Cache } from "@/lib/cache";
import { fetchStockFromMediaMarkt } from "@/lib/mediamarkt";
import type { StockResponse } from "@/lib/types";

const CACHE_TTL = 5 * 60 * 1000;
const stockCache = new Cache<StockResponse>(CACHE_TTL);

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

export async function GET(request: NextRequest) {
  const articlesParam = request.nextUrl.searchParams.get("articles");

  if (!articlesParam) {
    return NextResponse.json(
      { error: "articles parameter is required (comma-separated)" },
      { status: 400 }
    );
  }

  const articles = articlesParam.split(",").filter((a) => /^\d+$/.test(a));
  if (articles.length === 0) {
    return NextResponse.json(
      { error: "No valid article numbers provided" },
      { status: 400 }
    );
  }

  if (articles.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 articles per batch" },
      { status: 400 }
    );
  }

  const results: Record<string, StockResponse> = {};

  for (const articleNumber of articles) {
    const cached = stockCache.get(articleNumber);
    if (cached) {
      results[articleNumber] = cached;
      continue;
    }

    // Rate limiting
    const now = Date.now();
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
    lastRequestTime = now + waitMs;
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }

    try {
      const data = await fetchStockFromMediaMarkt(articleNumber);
      stockCache.set(articleNumber, data);
      results[articleNumber] = data;
    } catch (error) {
      console.error(`[api/stock/batch] Error for ${articleNumber}:`, error);
      results[articleNumber] = {
        product: articleNumber,
        articleNumber,
        stores: [],
        online: { available: false, deliveryDays: "?" },
        cachedAt: new Date().toISOString(),
      };
    }
  }

  return NextResponse.json(results);
}
