import { describe, expect, it, vi } from "vitest";

import { loadProductsAfterSync } from "@/app/shopify/shopify-sync-retry";

describe("loadProductsAfterSync", () => {
  it("retries an empty list after a sync that saw products", async () => {
    const loadProducts = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, items: [] })
      .mockResolvedValueOnce({ ok: true, items: [] })
      .mockResolvedValueOnce({ ok: true, items: [{ id: "1" }] });
    const delay = vi.fn().mockResolvedValue(undefined);

    const result = await loadProductsAfterSync(loadProducts, 10, {
      maxRetries: 3,
      retryDelayMs: 500,
      delay
    });

    expect(result.items).toEqual([{ id: "1" }]);
    expect(loadProducts).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(500);
  });

  it("stops after the bounded retry count", async () => {
    const loadProducts = vi.fn().mockResolvedValue({ ok: true, items: [] });
    const delay = vi.fn().mockResolvedValue(undefined);

    await loadProductsAfterSync(loadProducts, 10, { maxRetries: 3, delay });

    expect(loadProducts).toHaveBeenCalledTimes(4);
    expect(delay).toHaveBeenCalledTimes(3);
  });

  it("does not retry a legitimate empty Shopify catalog", async () => {
    const loadProducts = vi.fn().mockResolvedValue({ ok: true, items: [] });

    await loadProductsAfterSync(loadProducts, 0);

    expect(loadProducts).toHaveBeenCalledTimes(1);
  });
});
