import { describe, it, expect } from "vitest";
import catalog from "@/data/products.json";
import type { ProductCatalog, Variant } from "@/lib/types";

describe("Product Catalog", () => {
  const typedCatalog = catalog as ProductCatalog;

  it("has all ten categories", () => {
    const names = typedCatalog.categories.map((c) => c.name);
    expect(names).toEqual([
      "iPhone",
      "iPad",
      "MacBook",
      "Mac",
      "Watch",
      "AirPods",
      "Apple TV",
      "Pencil",
      "HomePod",
      "AirTag",
    ]);
  });

  it("every variant has a non-empty articleNumber", () => {
    const variants: Variant[] = [];
    for (const cat of typedCatalog.categories) {
      for (const model of cat.models) {
        variants.push(...model.variants);
      }
    }
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      expect(v.articleNumber).toBeTruthy();
    }
  });

  it("iPad variants have connectivity, others have null", () => {
    for (const cat of typedCatalog.categories) {
      for (const model of cat.models) {
        for (const v of model.variants) {
          if (cat.name === "iPad") {
            expect(["WiFi", "WiFi + Cellular"]).toContain(v.connectivity);
          } else {
            expect(v.connectivity).toBeNull();
          }
        }
      }
    }
  });

  it("no duplicate articleNumbers", () => {
    const numbers: string[] = [];
    for (const cat of typedCatalog.categories) {
      for (const model of cat.models) {
        for (const v of model.variants) {
          numbers.push(v.articleNumber);
        }
      }
    }
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });
});
