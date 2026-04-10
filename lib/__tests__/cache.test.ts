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
