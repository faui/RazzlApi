import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCommerceLinkToken,
  verifyCommerceLinkToken
} from "@/lib/commerce/core/connections/link-token";

describe("commerce link token", () => {
  beforeEach(() => {
    vi.stubEnv("COMMERCE_STUDIO_LINK_SECRET", "test-link-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a valid token", () => {
    const token = createCommerceLinkToken("demo.myshopify.com", 42);
    const payload = verifyCommerceLinkToken(token);
    expect(payload.shop).toBe("demo.myshopify.com");
    expect(payload.connectionId).toBe(42);
  });

  it("rejects tampered tokens", () => {
    const token = createCommerceLinkToken("demo.myshopify.com", 42);
    expect(() => verifyCommerceLinkToken(`${token}x`)).toThrow();
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    const token = createCommerceLinkToken("demo.myshopify.com", 42);
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(() => verifyCommerceLinkToken(token)).toThrow("expired");
    vi.useRealTimers();
  });
});
