"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import type { Variant, StockResponse } from "@/lib/types";
import { PRIMARY_STORE } from "@/lib/stores";

interface ColorAvailabilityGridProps {
  variants: Variant[];
  modelName: string;
  onSelect: (variant: Variant) => void;
}

type StockMap = Record<string, StockResponse>;

export default function ColorAvailabilityGrid({
  variants,
  modelName,
  onSelect,
}: ColorAvailabilityGridProps) {
  const [stockMap, setStockMap] = useState<StockMap>({});
  const [loading, setLoading] = useState(true);

  const articleNumbers = variants.map((v) => v.articleNumber);

  useEffect(() => {
    if (articleNumbers.length === 0) return;

    setLoading(true);
    setStockMap({});

    async function fetchBatch() {
      try {
        const res = await fetch(
          `/api/stock/batch?articles=${articleNumbers.join(",")}`
        );
        if (res.ok) {
          const data: StockMap = await res.json();
          setStockMap(data);
        }
      } catch {
        // Silent fail — cards will show without stock info
      } finally {
        setLoading(false);
      }
    }

    fetchBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleNumbers.join(",")]);

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-apple-gray mb-2 uppercase tracking-wide">
        Verfuegbarkeit {modelName}
      </p>

      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center text-apple-gray">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Bestand wird geladen...</span>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-2">
          {variants.map((variant) => {
            const stock = stockMap[variant.articleNumber];
            const primaryStore = stock?.stores.find(
              (s) => s.id === PRIMARY_STORE.id
            );
            const anyAvailable = stock?.stores.some((s) => s.available);
            const isAvailablePrimary = primaryStore?.pickup === true;
            const stockLevel = primaryStore?.stockLevel ?? "none";

            return (
              <button
                key={variant.articleNumber}
                onClick={() => onSelect(variant)}
                className={`flex items-center gap-2.5 p-3 bg-white rounded-apple shadow-apple-sm
                           text-left transition-all active:scale-[0.97]
                           ${isAvailablePrimary ? "border-[1.5px] border-apple-green" : anyAvailable ? "border-[1.5px] border-apple-yellow" : "border-[1.5px] border-gray-100"}`}
              >
                {/* Color swatch */}
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 border border-gray-200"
                  style={{ backgroundColor: variant.colorHex }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-apple-dark truncate">
                    {variant.color}
                  </p>

                  {!stock && !loading && (
                    <p className="text-[11px] text-apple-gray">—</p>
                  )}

                  {stock && isAvailablePrimary && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-apple-green flex-shrink-0" />
                      <span className="text-[11px] text-apple-green font-medium">
                        Citti-Park
                      </span>
                    </div>
                  )}

                  {stock && !isAvailablePrimary && anyAvailable && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-apple-yellow flex-shrink-0" />
                      <span className="text-[11px] text-apple-yellow font-medium">
                        Anderer Markt
                      </span>
                    </div>
                  )}

                  {stock && !anyAvailable && (
                    <div className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-apple-red flex-shrink-0" />
                      <span className="text-[11px] text-apple-red font-medium">
                        Nicht vorr.
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
