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
