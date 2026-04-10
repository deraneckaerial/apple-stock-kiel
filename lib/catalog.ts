import type { ProductCatalog, Variant } from "@/lib/types";

export function getModels(catalog: ProductCatalog, category: string) {
  return (
    catalog.categories.find((c) => c.name === category)?.models ?? []
  );
}

export function getVariants(
  catalog: ProductCatalog,
  category: string,
  model: string
): Variant[] {
  return getModels(catalog, category).find((m) => m.name === model)?.variants ?? [];
}

export function getUniqueValues<K extends keyof Variant>(
  variants: Variant[],
  key: K
): Variant[K][] {
  const seen = new Set<string>();
  const result: Variant[K][] = [];
  for (const v of variants) {
    const val = v[key];
    const str = String(val);
    if (val !== null && !seen.has(str)) {
      seen.add(str);
      result.push(val);
    }
  }
  return result;
}

export function filterVariants(
  variants: Variant[],
  filters: Partial<Pick<Variant, "storage" | "color" | "connectivity">>
): Variant[] {
  return variants.filter((v) => {
    if (filters.storage && v.storage !== filters.storage) return false;
    if (filters.color && v.color !== filters.color) return false;
    if (filters.connectivity && v.connectivity !== filters.connectivity)
      return false;
    return true;
  });
}

export function findVariant(
  variants: Variant[],
  storage: string,
  color: string,
  connectivity: string
): Variant | undefined {
  return variants.find(
    (v) =>
      v.storage === storage &&
      v.color === color &&
      (v.connectivity === null || v.connectivity === connectivity)
  );
}
