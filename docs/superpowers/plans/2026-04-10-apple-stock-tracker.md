# Apple Stock Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Next.js web app that lets Apple promoters check product stock across 3 Media Markt stores in Kiel with two clicks.

**Architecture:** Next.js App Router with a static product catalog (JSON), API Route proxy to Media Markt GraphQL, and Apple-style Tailwind CSS UI. Mock mode for development; real API integration as follow-up.

**Tech Stack:** Next.js 14+, React 18, Tailwind CSS, Lucide React, Vitest, TypeScript

**Design Spec:** `docs/superpowers/specs/2026-04-10-apple-stock-tracker-design.md`

---

## Parallelization Map

```
Task 1 (scaffold)
  → Task 2 (data layer)
    → Task 3 (cache) ──────────┐
    → Task 4 (mediamarkt client)├→ Task 5 (API route) ─┐
    → Task 6 (selector) ───────┤                        │
    → Task 7 (selection page) ─┤                        │
    → Task 8 (store cards) ────┤→ Task 10 (result page)─→ Task 11 (errors) → Task 12 (polish)
    → Task 9 (share button) ───┘
```

Tasks 3, 4, 6, 7, 8, 9 can run in parallel after Task 2.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

If it complains about non-empty directory, answer Yes to proceed. It will preserve existing `docs/` and `.superpowers/` directories.

- [ ] **Step 2: Install additional dependencies**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm install lucide-react
npm install -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Configure Tailwind with Apple-style theme**

Replace `tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          blue: "#0071e3",
          green: "#34c759",
          yellow: "#f5a623",
          red: "#ff3b30",
          gray: "#86868b",
          lightgray: "#f5f5f7",
          dark: "#1d1d1f",
        },
      },
      borderRadius: {
        "apple": "12px",
        "apple-lg": "16px",
      },
      boxShadow: {
        "apple": "0 2px 12px rgba(0,0,0,0.06)",
        "apple-sm": "0 1px 6px rgba(0,0,0,0.04)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Set up globals.css**

Replace `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-[#fafafa] text-apple-dark antialiased;
    -webkit-tap-highlight-color: transparent;
  }
}

@layer components {
  .select-apple {
    @apply w-full bg-white border-[1.5px] border-gray-200 rounded-apple px-3.5 py-3 text-[15px] text-apple-dark appearance-none;
    @apply focus:border-apple-blue focus:ring-[3px] focus:ring-apple-blue/10 focus:outline-none;
    background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 14px;
  }

  .select-apple:disabled {
    @apply opacity-40 cursor-not-allowed;
  }
}
```

- [ ] **Step 5: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 6: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Add .superpowers/ to .gitignore**

Append to `.gitignore`:

```
.superpowers/
```

- [ ] **Step 8: Verify dev server starts**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm run dev
```

Expected: Server starts on `http://localhost:3000` without errors. Kill the server after verifying.

- [ ] **Step 9: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git init
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind Apple theme"
```

---

### Task 2: Data Layer — Types, Store Constants, Product Catalog

**Files:**
- Create: `lib/types.ts`
- Create: `lib/stores.ts`
- Create: `data/products.json`
- Create: `lib/__tests__/catalog.test.ts`

- [ ] **Step 1: Write the test for catalog structure validation**

Create `lib/__tests__/catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import catalog from "@/data/products.json";
import type { ProductCatalog, Variant } from "@/lib/types";

describe("Product Catalog", () => {
  const typedCatalog = catalog as ProductCatalog;

  it("has all four categories", () => {
    const names = typedCatalog.categories.map((c) => c.name);
    expect(names).toEqual(["iPhone", "iPad", "MacBook", "Watch"]);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run lib/__tests__/catalog.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create types**

Create `lib/types.ts`:

```ts
export interface Variant {
  articleNumber: string;
  storage: string;
  color: string;
  colorHex: string;
  connectivity: "WiFi" | "WiFi + Cellular" | null;
}

export interface Model {
  name: string;
  variants: Variant[];
}

export interface Category {
  name: string;
  models: Model[];
}

export interface ProductCatalog {
  categories: Category[];
}

export interface StoreStock {
  id: string;
  name: string;
  address: string;
  phone: string;
  available: boolean;
  pickup: boolean;
  stockLevel: "high" | "low" | "none";
}

export interface OnlineAvailability {
  available: boolean;
  deliveryDays: string;
}

export interface StockResponse {
  product: string;
  articleNumber: string;
  stores: StoreStock[];
  online: OnlineAvailability;
  cachedAt: string;
}
```

- [ ] **Step 4: Create store constants**

Create `lib/stores.ts`:

```ts
export interface StoreInfo {
  id: string;
  name: string;
  shortName: string;
  address: string;
  phone: string;
  isPrimary: boolean;
}

export const STORES: StoreInfo[] = [
  {
    id: "441",
    name: "Media Markt Citti-Park Kiel",
    shortName: "Citti-Park Kiel",
    address: "Muehlendamm 1, 24113 Kiel",
    phone: "+494312001",
    isPrimary: true,
  },
  {
    id: "1250",
    name: "Media Markt Sophienhof",
    shortName: "Sophienhof",
    address: "Sophienblatt 20, 24103 Kiel",
    phone: "+494319710",
    isPrimary: false,
  },
  {
    id: "368",
    name: "Media Markt Schwentinental",
    shortName: "Schwentinental",
    address: "Mergenthaler Str. 4, 24223 Schwentinental",
    phone: "+494307943",
    isPrimary: false,
  },
];

export const PRIMARY_STORE = STORES.find((s) => s.isPrimary)!;
export const SECONDARY_STORES = STORES.filter((s) => !s.isPrimary);
```

> **Note:** The phone numbers are placeholders. Look up the real numbers on mediamarkt.de before going live.

- [ ] **Step 5: Create product catalog**

Create `data/products.json`:

```json
{
  "categories": [
    {
      "name": "iPhone",
      "models": [
        {
          "name": "iPhone 16 Pro",
          "variants": [
            { "articleNumber": "3013050", "storage": "128 GB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013051", "storage": "128 GB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null },
            { "articleNumber": "3013052", "storage": "128 GB", "color": "Titan Weiss", "colorHex": "#F2F1EB", "connectivity": null },
            { "articleNumber": "3013053", "storage": "128 GB", "color": "Titan Wueste", "colorHex": "#BFB09D", "connectivity": null },
            { "articleNumber": "3013054", "storage": "256 GB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013055", "storage": "256 GB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null },
            { "articleNumber": "3013056", "storage": "256 GB", "color": "Titan Weiss", "colorHex": "#F2F1EB", "connectivity": null },
            { "articleNumber": "3013057", "storage": "256 GB", "color": "Titan Wueste", "colorHex": "#BFB09D", "connectivity": null },
            { "articleNumber": "3013058", "storage": "512 GB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013059", "storage": "512 GB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null },
            { "articleNumber": "3013060", "storage": "1 TB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013061", "storage": "1 TB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null }
          ]
        },
        {
          "name": "iPhone 16 Pro Max",
          "variants": [
            { "articleNumber": "3013070", "storage": "256 GB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013071", "storage": "256 GB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null },
            { "articleNumber": "3013072", "storage": "256 GB", "color": "Titan Weiss", "colorHex": "#F2F1EB", "connectivity": null },
            { "articleNumber": "3013073", "storage": "256 GB", "color": "Titan Wueste", "colorHex": "#BFB09D", "connectivity": null },
            { "articleNumber": "3013074", "storage": "512 GB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013075", "storage": "512 GB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null },
            { "articleNumber": "3013076", "storage": "1 TB", "color": "Titan Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013077", "storage": "1 TB", "color": "Titan Natur", "colorHex": "#4A4845", "connectivity": null }
          ]
        },
        {
          "name": "iPhone 16",
          "variants": [
            { "articleNumber": "3013030", "storage": "128 GB", "color": "Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013031", "storage": "128 GB", "color": "Weiss", "colorHex": "#F2F1EB", "connectivity": null },
            { "articleNumber": "3013032", "storage": "128 GB", "color": "Blaugruen", "colorHex": "#4F8F8A", "connectivity": null },
            { "articleNumber": "3013033", "storage": "128 GB", "color": "Ultramarin", "colorHex": "#3F51B5", "connectivity": null },
            { "articleNumber": "3013034", "storage": "128 GB", "color": "Pink", "colorHex": "#F4A5B8", "connectivity": null },
            { "articleNumber": "3013035", "storage": "256 GB", "color": "Schwarz", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3013036", "storage": "256 GB", "color": "Ultramarin", "colorHex": "#3F51B5", "connectivity": null },
            { "articleNumber": "3013037", "storage": "512 GB", "color": "Schwarz", "colorHex": "#3C3C3C", "connectivity": null }
          ]
        }
      ]
    },
    {
      "name": "iPad",
      "models": [
        {
          "name": "iPad Air M2 11\"",
          "variants": [
            { "articleNumber": "3020010", "storage": "128 GB", "color": "Blau", "colorHex": "#6B7FAD", "connectivity": "WiFi" },
            { "articleNumber": "3020011", "storage": "128 GB", "color": "Blau", "colorHex": "#6B7FAD", "connectivity": "WiFi + Cellular" },
            { "articleNumber": "3020012", "storage": "128 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": "WiFi" },
            { "articleNumber": "3020013", "storage": "128 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": "WiFi + Cellular" },
            { "articleNumber": "3020014", "storage": "256 GB", "color": "Blau", "colorHex": "#6B7FAD", "connectivity": "WiFi" },
            { "articleNumber": "3020015", "storage": "256 GB", "color": "Blau", "colorHex": "#6B7FAD", "connectivity": "WiFi + Cellular" },
            { "articleNumber": "3020016", "storage": "256 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": "WiFi" },
            { "articleNumber": "3020017", "storage": "256 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": "WiFi + Cellular" }
          ]
        },
        {
          "name": "iPad Pro M4 11\"",
          "variants": [
            { "articleNumber": "3020030", "storage": "256 GB", "color": "Space Schwarz", "colorHex": "#2E2E2E", "connectivity": "WiFi" },
            { "articleNumber": "3020031", "storage": "256 GB", "color": "Space Schwarz", "colorHex": "#2E2E2E", "connectivity": "WiFi + Cellular" },
            { "articleNumber": "3020032", "storage": "256 GB", "color": "Silber", "colorHex": "#D4D4D4", "connectivity": "WiFi" },
            { "articleNumber": "3020033", "storage": "256 GB", "color": "Silber", "colorHex": "#D4D4D4", "connectivity": "WiFi + Cellular" }
          ]
        }
      ]
    },
    {
      "name": "MacBook",
      "models": [
        {
          "name": "MacBook Air 13\" M3",
          "variants": [
            { "articleNumber": "3030010", "storage": "256 GB", "color": "Mitternacht", "colorHex": "#2E3642", "connectivity": null },
            { "articleNumber": "3030011", "storage": "256 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": null },
            { "articleNumber": "3030012", "storage": "256 GB", "color": "Silber", "colorHex": "#D4D4D4", "connectivity": null },
            { "articleNumber": "3030013", "storage": "256 GB", "color": "Space Grau", "colorHex": "#7A7A7A", "connectivity": null },
            { "articleNumber": "3030014", "storage": "512 GB", "color": "Mitternacht", "colorHex": "#2E3642", "connectivity": null },
            { "articleNumber": "3030015", "storage": "512 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": null }
          ]
        },
        {
          "name": "MacBook Air 15\" M3",
          "variants": [
            { "articleNumber": "3030020", "storage": "256 GB", "color": "Mitternacht", "colorHex": "#2E3642", "connectivity": null },
            { "articleNumber": "3030021", "storage": "256 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": null },
            { "articleNumber": "3030022", "storage": "512 GB", "color": "Mitternacht", "colorHex": "#2E3642", "connectivity": null },
            { "articleNumber": "3030023", "storage": "512 GB", "color": "Polarstern", "colorHex": "#F4E8CE", "connectivity": null }
          ]
        }
      ]
    },
    {
      "name": "Watch",
      "models": [
        {
          "name": "Apple Watch Series 10 42mm",
          "variants": [
            { "articleNumber": "3040010", "storage": "32 GB", "color": "Polarstern Alu", "colorHex": "#F4E8CE", "connectivity": null },
            { "articleNumber": "3040011", "storage": "32 GB", "color": "Schwarz Alu", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3040012", "storage": "32 GB", "color": "Silber Alu", "colorHex": "#D4D4D4", "connectivity": null }
          ]
        },
        {
          "name": "Apple Watch Series 10 46mm",
          "variants": [
            { "articleNumber": "3040020", "storage": "32 GB", "color": "Polarstern Alu", "colorHex": "#F4E8CE", "connectivity": null },
            { "articleNumber": "3040021", "storage": "32 GB", "color": "Schwarz Alu", "colorHex": "#3C3C3C", "connectivity": null },
            { "articleNumber": "3040022", "storage": "32 GB", "color": "Silber Alu", "colorHex": "#D4D4D4", "connectivity": null }
          ]
        },
        {
          "name": "Apple Watch Ultra 2",
          "variants": [
            { "articleNumber": "3040030", "storage": "32 GB", "color": "Titan Natur", "colorHex": "#C4B9A8", "connectivity": null }
          ]
        }
      ]
    }
  ]
}
```

> **IMPORTANT:** All `articleNumber` values are placeholders. Before going live, replace them with real Media Markt article numbers by searching each product on mediamarkt.de and copying the number from the URL (e.g. `mediamarkt.de/de/product/_iphone-16-pro-max-3013070.html` → `3013070`).

- [ ] **Step 6: Run tests**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run lib/__tests__/catalog.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add lib/types.ts lib/stores.ts data/products.json lib/__tests__/catalog.test.ts
git commit -m "feat: add types, store constants, and product catalog"
```

---

### Task 3: Cache Utility

**Files:**
- Create: `lib/cache.ts`
- Create: `lib/__tests__/cache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Cache } from "@/lib/cache";

describe("Cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns undefined for missing key", () => {
    const cache = new Cache<string>(60_000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    const cache = new Cache<string>(60_000);
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("returns undefined after TTL expires", () => {
    const cache = new Cache<string>(5_000);
    cache.set("key", "value");
    vi.advanceTimersByTime(5_001);
    expect(cache.get("key")).toBeUndefined();
  });

  it("returns value just before TTL expires", () => {
    const cache = new Cache<string>(5_000);
    cache.set("key", "value");
    vi.advanceTimersByTime(4_999);
    expect(cache.get("key")).toBe("value");
  });

  it("returns the timestamp when the value was cached", () => {
    const cache = new Cache<string>(60_000);
    const now = Date.now();
    vi.setSystemTime(now);
    cache.set("key", "value");
    expect(cache.getCachedAt("key")).toBe(now);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run lib/__tests__/cache.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cache**

Create `lib/cache.ts`:

```ts
interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, cachedAt: Date.now() });
  }

  getCachedAt(key: string): number | undefined {
    return this.store.get(key)?.cachedAt;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run lib/__tests__/cache.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add lib/cache.ts lib/__tests__/cache.test.ts
git commit -m "feat: add in-memory cache with TTL"
```

---

### Task 4: Media Markt Client with Mock Mode

**Files:**
- Create: `lib/mediamarkt.ts`
- Create: `lib/__tests__/mediamarkt.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/mediamarkt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeStockLevel, buildMockStockResponse } from "@/lib/mediamarkt";

describe("normalizeStockLevel", () => {
  it("returns 'high' when pickup is true", () => {
    expect(normalizeStockLevel({ available: true, pickup: true })).toBe("high");
  });

  it("returns 'low' when available but no pickup", () => {
    expect(normalizeStockLevel({ available: true, pickup: false })).toBe("low");
  });

  it("returns 'none' when not available", () => {
    expect(normalizeStockLevel({ available: false, pickup: false })).toBe("none");
  });

  it("returns 'high' when pickup is true even if available is false", () => {
    // Edge case: pickup flag should dominate
    expect(normalizeStockLevel({ available: false, pickup: true })).toBe("high");
  });
});

describe("buildMockStockResponse", () => {
  it("returns 3 stores", () => {
    const response = buildMockStockResponse("3013070");
    expect(response.stores).toHaveLength(3);
  });

  it("includes online availability", () => {
    const response = buildMockStockResponse("3013070");
    expect(response.online).toBeDefined();
    expect(typeof response.online.available).toBe("boolean");
  });

  it("includes cachedAt timestamp", () => {
    const response = buildMockStockResponse("3013070");
    expect(response.cachedAt).toBeTruthy();
    expect(() => new Date(response.cachedAt)).not.toThrow();
  });

  it("primary store (441) is always first", () => {
    const response = buildMockStockResponse("3013070");
    expect(response.stores[0].id).toBe("441");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run lib/__tests__/mediamarkt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

Create `lib/mediamarkt.ts`:

```ts
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
  // Deterministic mock: use last digit of articleNumber to vary results
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
  // For now, return mock data.
  //
  // Real implementation will:
  // 1. Call GRAPHQL_ENDPOINT with GetProductAvailabilities operation
  // 2. Pass article number as variable
  // 3. Parse store-specific availability from response
  // 4. Normalize stock levels with normalizeStockLevel()
  //
  // The SHA256 hash for the persisted query and exact variable structure
  // must be captured from mediamarkt.de network traffic.

  console.warn(
    `[mediamarkt] Using mock data for article ${articleNumber}. ` +
      `Real API integration pending.`
  );

  // Simulate network latency
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

  return buildMockStockResponse(articleNumber);
}
```

- [ ] **Step 4: Run tests**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run lib/__tests__/mediamarkt.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add lib/mediamarkt.ts lib/__tests__/mediamarkt.test.ts
git commit -m "feat: add Media Markt client with mock mode and stock level normalization"
```

---

### Task 5: Stock API Route

**Files:**
- Create: `app/api/stock/route.ts`

- [ ] **Step 1: Implement the API route**

Create `app/api/stock/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Cache } from "@/lib/cache";
import { fetchStockFromMediaMarkt } from "@/lib/mediamarkt";
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

  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((r) =>
      setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  try {
    const data = await fetchStockFromMediaMarkt(articleNumber);
    stockCache.set(articleNumber, data);
    return NextResponse.json(data);
  } catch (error) {
    // Return stale cache if available
    const stale = stockCache.get(articleNumber);
    if (stale) {
      return NextResponse.json(stale);
    }

    console.error("[api/stock] Error:", error);
    return NextResponse.json(
      { error: "Bestandsdaten konnten nicht geladen werden" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Verify the route works**

Start dev server and test:

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm run dev &
sleep 3
curl "http://localhost:3000/api/stock?articleNumber=3013070"
```

Expected: JSON response with `product`, `stores` (3 entries), `online`, `cachedAt`. Kill dev server after.

- [ ] **Step 3: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add app/api/stock/route.ts
git commit -m "feat: add /api/stock route with cache and rate limiting"
```

---

### Task 6: Product Selector Component

**Files:**
- Create: `components/ProductSelector.tsx`
- Create: `lib/catalog.ts`

- [ ] **Step 1: Create catalog helper functions**

Create `lib/catalog.ts`:

```ts
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
```

- [ ] **Step 2: Create ProductSelector component**

Create `components/ProductSelector.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import catalog from "@/data/products.json";
import type { ProductCatalog, Variant } from "@/lib/types";
import {
  getModels,
  getVariants,
  getUniqueValues,
  filterVariants,
  findVariant,
} from "@/lib/catalog";

const typedCatalog = catalog as ProductCatalog;

interface ProductSelectorProps {
  onSelect: (variant: Variant, productName: string) => void;
}

export default function ProductSelector({ onSelect }: ProductSelectorProps) {
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [connectivity, setConnectivity] = useState("");

  // Derived data
  const categories = typedCatalog.categories.map((c) => c.name);
  const models = category ? getModels(typedCatalog, category).map((m) => m.name) : [];
  const allVariants = category && model ? getVariants(typedCatalog, category, model) : [];

  const storages = getUniqueValues(allVariants, "storage") as string[];
  const colorsForStorage = getUniqueValues(
    storage ? filterVariants(allVariants, { storage }) : allVariants,
    "color"
  ) as string[];
  const colorHexMap = new Map(
    allVariants.map((v) => [v.color, v.colorHex])
  );
  const connectivities = getUniqueValues(
    filterVariants(allVariants, { storage: storage || undefined, color: color || undefined }),
    "connectivity"
  ) as string[];

  const needsConnectivity = category === "iPad" && connectivities.length > 0;

  // Auto-select when only one option
  const autoSelect = useCallback(
    (values: string[], current: string, setter: (v: string) => void) => {
      if (values.length === 1 && current !== values[0]) {
        setter(values[0]);
      }
    },
    []
  );

  useEffect(() => autoSelect(models, model, setModel), [models, model, autoSelect]);
  useEffect(() => autoSelect(storages, storage, setStorage), [storages, storage, autoSelect]);
  useEffect(
    () => autoSelect(colorsForStorage, color, setColor),
    [colorsForStorage, color, autoSelect]
  );
  useEffect(
    () => autoSelect(connectivities, connectivity, setConnectivity),
    [connectivities, connectivity, autoSelect]
  );

  // Reset downstream on upstream change
  function handleCategoryChange(val: string) {
    setCategory(val);
    setModel("");
    setStorage("");
    setColor("");
    setConnectivity("");
  }

  function handleModelChange(val: string) {
    setModel(val);
    setStorage("");
    setColor("");
    setConnectivity("");
  }

  function handleStorageChange(val: string) {
    setStorage(val);
    setColor("");
    setConnectivity("");
  }

  function handleColorChange(val: string) {
    setColor(val);
    setConnectivity("");
  }

  // Check if selection is complete
  const selectedVariant =
    storage && color && (!needsConnectivity || connectivity)
      ? findVariant(allVariants, storage, color, connectivity)
      : undefined;

  function handleSubmit() {
    if (selectedVariant) {
      onSelect(selectedVariant, model);
    }
  }

  return (
    <div className="space-y-3">
      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-apple-gray mb-1">
          Kategorie
        </label>
        <select
          className="select-apple"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">Waehlen...</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Model */}
      {category && models.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1">
            Modell
          </label>
          <select
            className="select-apple"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            <option value="">Waehlen...</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Storage + Color row */}
      {model && (
        <div className="flex gap-2">
          {storages.length > 1 && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-apple-gray mb-1">
                Speicher
              </label>
              <select
                className="select-apple"
                value={storage}
                onChange={(e) => handleStorageChange(e.target.value)}
              >
                <option value="">Waehlen...</option>
                {storages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {colorsForStorage.length > 1 && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-apple-gray mb-1">
                Farbe
              </label>
              <select
                className="select-apple"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
              >
                <option value="">Waehlen...</option>
                {colorsForStorage.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Connectivity (iPad only) */}
      {needsConnectivity && connectivities.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1">
            Konnektivitaet
          </label>
          <select
            className="select-apple"
            value={connectivity}
            onChange={(e) => setConnectivity(e.target.value)}
          >
            <option value="">Waehlen...</option>
            {connectivities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Submit */}
      <button
        disabled={!selectedVariant}
        onClick={handleSubmit}
        className="w-full py-3.5 bg-apple-blue text-white font-semibold text-base rounded-apple
                   disabled:opacity-40 disabled:cursor-not-allowed
                   active:scale-[0.98] transition-transform mt-2"
      >
        Bestand pruefen
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add lib/catalog.ts components/ProductSelector.tsx
git commit -m "feat: add product selector with cascading dropdowns and auto-select"
```

---

### Task 7: Selection Page (Home)

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update the root layout**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apple Stock Tracker",
  description: "Bestandsabfrage fuer Apple-Produkte bei Media Markt Kiel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Build the selection page**

Replace `app/page.tsx` with:

```tsx
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
```

- [ ] **Step 3: Verify in browser**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm run dev
```

Open `http://localhost:3000`. Expected: Apple-style header + cascading dropdowns. Selecting a complete product and clicking "Bestand pruefen" navigates to `/result?article=...`.

- [ ] **Step 4: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add app/layout.tsx app/page.tsx
git commit -m "feat: add selection page with header and product selector"
```

---

### Task 8: Store Card and Online Banner Components

**Files:**
- Create: `components/StoreCard.tsx`
- Create: `components/OnlineBanner.tsx`

- [ ] **Step 1: Create StoreCard component**

Create `components/StoreCard.tsx`:

```tsx
import { CheckCircle, AlertCircle, XCircle, Monitor } from "lucide-react";
import type { StoreStock, OnlineAvailability } from "@/lib/types";

interface StoreCardProps {
  store: StoreStock;
  isPrimary?: boolean;
  online?: OnlineAvailability;
  productName: string;
  variantLabel: string;
  onShare?: () => void;
  onCall?: () => void;
}

function StockIcon({
  level,
  size,
}: {
  level: "high" | "low" | "none";
  size: number;
}) {
  if (level === "high")
    return (
      <div
        className="rounded-full bg-green-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <CheckCircle className="text-apple-green" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  if (level === "low")
    return (
      <div
        className="rounded-full bg-yellow-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <AlertCircle className="text-apple-yellow" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  return (
    <div
      className="rounded-full bg-red-100 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <XCircle className="text-apple-red" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

function StockLabel({ level }: { level: "high" | "low" | "none" }) {
  if (level === "high")
    return (
      <div>
        <p className="text-[15px] font-semibold text-green-700">
          Sofort verfuegbar
        </p>
        <p className="text-xs text-green-600">Marktabholung heute moeglich</p>
      </div>
    );
  if (level === "low")
    return (
      <p className="text-xs font-medium text-apple-yellow mt-1">
        Geringe Menge
      </p>
    );
  return (
    <p className="text-xs font-medium text-apple-red mt-1">Nicht vorr.</p>
  );
}

export default function StoreCard({
  store,
  isPrimary = false,
  online,
  productName,
  variantLabel,
  onShare,
  onCall,
}: StoreCardProps) {
  if (isPrimary) {
    return (
      <div
        className={`bg-white rounded-apple-lg p-5 shadow-apple border-2 ${
          store.stockLevel === "high"
            ? "border-apple-green"
            : store.stockLevel === "low"
            ? "border-apple-yellow"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <StockIcon level={store.stockLevel} size={48} />
          <div>
            <p className="text-[11px] text-apple-gray uppercase tracking-wide font-medium">
              Dein Markt
            </p>
            <p className="text-lg font-bold text-apple-dark">
              {store.name.replace("Media Markt ", "")}
            </p>
          </div>
        </div>

        {store.stockLevel === "high" && (
          <div className="bg-green-50 rounded-[10px] px-3.5 py-2.5 mb-3">
            <StockLabel level="high" />
          </div>
        )}
        {store.stockLevel === "low" && (
          <div className="bg-yellow-50 rounded-[10px] px-3.5 py-2.5 mb-3">
            <p className="text-[15px] font-semibold text-yellow-700">
              Geringe Menge
            </p>
            <p className="text-xs text-yellow-600">Bald vergriffen</p>
          </div>
        )}
        {store.stockLevel === "none" && (
          <div className="bg-red-50 rounded-[10px] px-3.5 py-2.5 mb-3">
            <p className="text-[15px] font-semibold text-red-700">
              Nicht vorr&auml;tig
            </p>
            {online?.available && (
              <p className="text-xs text-apple-blue font-medium mt-1">
                Online bestellbar
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="flex-1 py-2.5 bg-apple-lightgray rounded-[10px] text-[13px] text-apple-blue font-medium text-center
                         active:scale-[0.97] transition-transform"
            >
              Teilen
            </button>
          )}
          {onCall && (
            <button
              onClick={onCall}
              className="flex-1 py-2.5 bg-apple-lightgray rounded-[10px] text-[13px] text-apple-blue font-medium text-center
                         active:scale-[0.97] transition-transform"
            >
              Anrufen
            </button>
          )}
        </div>
      </div>
    );
  }

  // Secondary (compact) card
  return (
    <div className="flex-1 bg-white rounded-apple p-3.5 shadow-apple-sm">
      <StockIcon level={store.stockLevel} size={32} />
      <p className="text-sm font-semibold text-apple-dark mt-2">
        {store.name.replace("Media Markt ", "")}
      </p>
      <StockLabel level={store.stockLevel} />
      {store.stockLevel === "none" && online?.available && (
        <div className="flex items-center gap-1 mt-1.5 bg-blue-50 rounded-md px-2 py-1">
          <Monitor className="w-3 h-3 text-apple-blue" />
          <span className="text-[11px] text-apple-blue font-medium">
            Online bestellbar
          </span>
        </div>
      )}
      <p className="text-[11px] text-apple-gray mt-1">{store.address.split(",")[0]}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create OnlineBanner component**

Create `components/OnlineBanner.tsx`:

```tsx
import { Monitor, ChevronRight } from "lucide-react";
import type { OnlineAvailability } from "@/lib/types";

interface OnlineBannerProps {
  online: OnlineAvailability;
  articleNumber: string;
}

export default function OnlineBanner({
  online,
  articleNumber,
}: OnlineBannerProps) {
  if (!online.available) return null;

  return (
    <a
      href={`https://www.mediamarkt.de/de/product/_-${articleNumber}.html`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-white rounded-apple p-3.5 shadow-apple-sm
                 active:scale-[0.98] transition-transform"
    >
      <div className="w-9 h-9 rounded-[10px] bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Monitor className="w-[18px] h-[18px] text-apple-blue" />
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-apple-dark">
          Online bestellbar
        </p>
        <p className="text-xs text-apple-gray">
          Lieferung in {online.deliveryDays} Werktagen
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-apple-gray" />
    </a>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add components/StoreCard.tsx components/OnlineBanner.tsx
git commit -m "feat: add StoreCard and OnlineBanner components"
```

---

### Task 9: Share Button

**Files:**
- Create: `components/ShareButton.tsx`
- Create: `lib/share.ts`

- [ ] **Step 1: Create share utility**

Create `lib/share.ts`:

```ts
export interface ShareData {
  productName: string;
  variantLabel: string;
  storeName: string;
  storeAddress: string;
  pickup: boolean;
}

export function buildShareText(data: ShareData): string {
  const status = data.pickup
    ? "ist sofort verfuegbar"
    : "hat geringe Menge";
  return (
    `${data.productName} (${data.variantLabel}) ${status} ` +
    `bei ${data.storeName}, ${data.storeAddress}.` +
    (data.pickup ? " Marktabholung heute moeglich!" : "")
  );
}

export async function shareOrFallback(text: string): Promise<void> {
  if (navigator.share) {
    await navigator.share({ text });
  } else {
    // Fallback: WhatsApp deeplink
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }
}
```

- [ ] **Step 2: The ShareButton is already integrated into StoreCard via the onShare prop**

The `onShare` callback will be wired in the result page (Task 10). No separate component file needed — the share logic lives in `lib/share.ts` and the button is part of `StoreCard`.

- [ ] **Step 3: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add lib/share.ts
git commit -m "feat: add share utility with Web Share API and WhatsApp fallback"
```

---

### Task 10: Result Page

**Files:**
- Create: `app/result/page.tsx`

- [ ] **Step 1: Create the result page**

Create `app/result/page.tsx`:

```tsx
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
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
        <>
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
        </>
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
```

- [ ] **Step 2: Verify full flow in browser**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm run dev
```

Open `http://localhost:3000`:
1. Select "iPhone" → "iPhone 16 Pro Max" → "256 GB" → "Titan Schwarz"
2. Click "Bestand pruefen"
3. Expected: navigates to `/result?article=3013070`, shows loading spinner, then 3 store cards with mock data + online banner

- [ ] **Step 3: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add app/result/page.tsx
git commit -m "feat: add result page with stock display, share, and call actions"
```

---

### Task 11: Error Handling and Loading Polish

**Files:**
- Modify: `app/result/page.tsx`
- Modify: `components/ProductSelector.tsx`

- [ ] **Step 1: Add loading skeleton to result page**

In `app/result/page.tsx`, replace the loading spinner block:

```tsx
{/* Loading */}
{loading && (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
  </div>
)}
```

with:

```tsx
{/* Loading skeleton */}
{loading && (
  <div className="animate-pulse">
    <div className="bg-white rounded-apple-lg p-5 shadow-apple mb-3">
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
      <div className="flex-1 bg-white rounded-apple p-3.5 shadow-apple-sm h-32" />
      <div className="flex-1 bg-white rounded-apple p-3.5 shadow-apple-sm h-32" />
    </div>
  </div>
)}
```

- [ ] **Step 2: Add missing product fallback**

In `app/result/page.tsx`, after the product info block and before the loading block, add:

```tsx
{/* Product not in catalog */}
{!productInfo && !loading && (
  <div className="bg-yellow-50 rounded-apple p-4 mb-4">
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
```

- [ ] **Step 3: Verify**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm run dev
```

1. Open `http://localhost:3000/result?article=3013070` — should show skeleton, then results
2. Open `http://localhost:3000/result?article=9999999` — should show "Produkt nicht im Katalog" warning but still attempt stock fetch

- [ ] **Step 4: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add app/result/page.tsx
git commit -m "feat: add loading skeleton and missing product fallback"
```

---

### Task 12: Final Polish

**Files:**
- Modify: `app/globals.css`
- Create: `app/favicon.ico` (optional)

- [ ] **Step 1: Add page transitions**

In `app/globals.css`, add at the end:

```css
@layer utilities {
  .fade-in {
    animation: fadeIn 0.3s ease-out;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Apply fade-in to result page**

In `app/result/page.tsx`, wrap the `{stock && !loading && (...)}` block content with:

```tsx
{stock && !loading && (
  <div className="fade-in">
    {/* ... existing content ... */}
  </div>
)}
```

- [ ] **Step 3: Run all tests**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Run production build**

```bash
cd B:/PlanB/Projekte/MediaMarkt
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 5: Commit**

```bash
cd B:/PlanB/Projekte/MediaMarkt
git add -A
git commit -m "feat: add polish — page transitions, fade-in animation"
```

---

## Post-Implementation: API Reverse Engineering (Manual)

This step requires manual browser inspection and cannot be fully automated.

### Steps:

1. **Open Chrome DevTools** on `https://www.mediamarkt.de`
2. **Navigate to a product page** (e.g., iPhone 16 Pro Max)
3. **Select "Markt waehlen"** and pick one of the Kiel stores
4. **In the Network tab**, filter for `graphql` and find the availability request
5. **Copy the request** — note:
   - The exact `operationName` (may be `GetProductAvailabilities` or different)
   - The `variables` structure (how store IDs are passed)
   - The `extensions.persistedQuery.sha256Hash`
   - Any required headers (cookies, x-api-key, etc.)
6. **Update `lib/mediamarkt.ts`**: replace the mock implementation of `fetchStockFromMediaMarkt()` with the real GraphQL query using the captured parameters
7. **Test with real data** and update article numbers in `data/products.json`

---

## Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Project scaffolding | — |
| 2 | Types, stores, catalog | 1 |
| 3 | Cache utility | 2 |
| 4 | Media Markt client (mock) | 2 |
| 5 | API route | 3, 4 |
| 6 | Product selector | 2 |
| 7 | Selection page | 6 |
| 8 | Store cards + online banner | 2 |
| 9 | Share utility | 2 |
| 10 | Result page | 5, 8, 9 |
| 11 | Error handling + loading | 10 |
| 12 | Final polish | 11 |
