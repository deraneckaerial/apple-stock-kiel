import { NextRequest, NextResponse } from "next/server";
import { Cache } from "@/lib/cache";
import { checkAvailability } from "@/lib/mediamarkt";
import type { StockResponse } from "@/lib/types";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const stockCache = new Cache<StockResponse>(CACHE_TTL);

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between Media Markt requests

export async function GET(request: NextRequest) {
  const articleNumber = request.nextUrl.searchParams.get("articleNumber");

  if (!articleNumber || !/^\d+$/.test(articleNumber)) {
    return NextResponse.json(
      { error: "articleNumber is required and must be numeric" },
      { status: 400 }
    );
  }

  // Check cache
  const cached = stockCache.get(articleNumber);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Rate limiting — reserve slot before waiting to prevent concurrent bypass
  const now = Date.now();
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
  lastRequestTime = now + waitMs;
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  try {
    const data = await checkAvailability(articleNumber);
    stockCache.set(articleNumber, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/stock] Error:", error);
    return NextResponse.json(
      { error: "Bestandsdaten konnten nicht geladen werden" },
      { status: 502 }
    );
  }
}
