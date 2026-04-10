"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import catalog from "@/data/products.json";
import type { ProductCatalog, StockResponse, Variant } from "@/lib/types";
import { PRIMARY_STORE, SECONDARY_STORES } from "@/lib/stores";
import { buildShareText, shareOrFallback } from "@/lib/share";
import StoreCard from "@/components/StoreCard";
import OnlineBanner from "@/components/OnlineBanner";

const typedCatalog = catalog as ProductCatalog;

function findVariantByArticle(articleNumber: string): {
  variant: Variant;
  modelName: string;
  categoryName: string;
} | null {
  for (const cat of typedCatalog.categories) {
    for (const model of cat.models) {
      const variant = model.variants.find(
        (v) => v.articleNumber === articleNumber
      );
      if (variant) {
        return {
          variant,
          modelName: model.name,
          categoryName: cat.name,
        };
      }
    }
  }
  return null;
}

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const articleNumber = searchParams.get("article") ?? "";

  const [stock, setStock] = useState<StockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const productInfo = findVariantByArticle(articleNumber);
  const variantLabel = productInfo
    ? [
        productInfo.variant.storage,
        productInfo.variant.color,
        productInfo.variant.connectivity,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  useEffect(() => {
    if (!articleNumber) {
      setError("Keine Artikelnummer angegeben");
      setLoading(false);
      return;
    }

    async function fetchStock() {
      try {
        const res = await fetch(`/api/stock?articleNumber=${articleNumber}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        const data: StockResponse = await res.json();
        setStock(data);

        // Save to localStorage as offline fallback
        try {
          localStorage.setItem(
            `stock-${articleNumber}`,
            JSON.stringify(data)
          );
        } catch {}
      } catch (err) {
        // Try localStorage fallback
        try {
          const cached = localStorage.getItem(`stock-${articleNumber}`);
          if (cached) {
            setStock(JSON.parse(cached));
            setError("Offline-Daten — moeglicherweise veraltet");
            setLoading(false);
            return;
          }
        } catch {}

        setError(
          err instanceof Error
            ? err.message
            : "Bestandsdaten konnten nicht geladen werden"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchStock();
  }, [articleNumber]);

  const primaryStock = stock?.stores.find((s) => s.id === PRIMARY_STORE.id);
  const secondaryStocks = stock?.stores.filter((s) =>
    SECONDARY_STORES.some((ss) => ss.id === s.id)
  );

  function handleShare(storeName: string, storeAddress: string, pickup: boolean) {
    if (!productInfo) return;
    const text = buildShareText({
      productName: productInfo.modelName,
      variantLabel,
      storeName,
      storeAddress,
      pickup,
    });
    shareOrFallback(text);
  }

  function handleCall(phone: string) {
    window.location.href = `tel:${phone}`;
  }

  return (
    <main className="max-w-[430px] mx-auto px-4 pt-4 pb-10">
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="text-[13px] text-apple-blue font-medium mb-3 flex items-center gap-1
                   active:opacity-70 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurueck
      </button>

      {/* Product info */}
      {productInfo && (
        <div className="text-center mb-5">
          <p className="text-[13px] text-apple-gray">
            {productInfo.modelName}
          </p>
          <p className="text-[17px] font-semibold text-apple-dark">
            {variantLabel}
          </p>
        </div>
      )}

      {/* Product not in catalog */}
      {!productInfo && !loading && (
        <div className="bg-yellow-50 rounded-[12px] p-4 mb-4">
          <p className="text-sm text-yellow-800">
            Produkt nicht im Katalog gefunden (Artikel: {articleNumber})
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 text-sm text-apple-blue font-medium"
          >
            Zurueck zur Auswahl
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse">
          <div className="bg-white rounded-[16px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] mb-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gray-200" />
              <div>
                <div className="w-16 h-3 bg-gray-200 rounded mb-1.5" />
                <div className="w-32 h-5 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="w-full h-12 bg-gray-100 rounded-[10px] mb-3" />
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-gray-100 rounded-[10px]" />
              <div className="flex-1 h-10 bg-gray-100 rounded-[10px]" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-white rounded-[12px] p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.04)] h-32" />
            <div className="flex-1 bg-white rounded-[12px] p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.04)] h-32" />
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 rounded-apple p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              window.location.reload();
            }}
            className="mt-2 text-sm text-apple-blue font-medium"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Results */}
      {stock && !loading && (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
          {/* Primary store */}
          {primaryStock && (
            <div className="mb-3">
              <StoreCard
                store={primaryStock}
                isPrimary
                online={stock.online}
                productName={productInfo?.modelName ?? ""}
                variantLabel={variantLabel}
                onShare={() =>
                  handleShare(
                    primaryStock.name,
                    primaryStock.address,
                    primaryStock.pickup
                  )
                }
                onCall={() => handleCall(primaryStock.phone)}
              />
            </div>
          )}

          {/* Secondary stores */}
          {secondaryStocks && secondaryStocks.length > 0 && (
            <>
              <p className="text-xs text-apple-gray font-medium uppercase tracking-wide mb-2">
                Ausweichmaerkte
              </p>
              <div className="flex gap-2 mb-4">
                {secondaryStocks.map((s) => (
                  <StoreCard
                    key={s.id}
                    store={s}
                    online={stock.online}
                    productName={productInfo?.modelName ?? ""}
                    variantLabel={variantLabel}
                  />
                ))}
              </div>
            </>
          )}

          {/* Online banner */}
          <OnlineBanner
            online={stock.online}
            articleNumber={articleNumber}
          />

          {/* Cache info */}
          {stock.cachedAt && (
            <p className="text-[11px] text-apple-gray text-center mt-4">
              Stand:{" "}
              {new Date(stock.cachedAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Uhr
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
