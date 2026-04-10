"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import ProductSelector from "@/components/ProductSelector";
import type { Variant } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  function handleSelect(variant: Variant, productName: string) {
    const params = new URLSearchParams({
      article: variant.articleNumber,
    });
    router.push(`/result?${params.toString()}`);
  }

  return (
    <main className="max-w-[430px] mx-auto px-4 pt-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-[11px] text-apple-gray font-medium tracking-wide uppercase">
            Apple Promoter
          </p>
          <h1 className="text-[28px] font-bold text-apple-dark tracking-tight leading-tight">
            Stock Tracker
          </h1>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-10 h-10 rounded-full bg-apple-blue flex items-center justify-center
                     active:scale-95 transition-transform"
          aria-label="Seite neu laden"
        >
          <RefreshCw className="w-[18px] h-[18px] text-white" />
        </button>
      </div>

      {/* Selector */}
      <ProductSelector onSelect={handleSelect} />
    </main>
  );
}
