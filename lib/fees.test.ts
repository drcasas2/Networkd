import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { platformFeeBps, platformFeeCents, priceForMinutes } from "./fees";

describe("fees", () => {
  const originalEnv = process.env.PLATFORM_FEE_BPS;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.PLATFORM_FEE_BPS;
    else process.env.PLATFORM_FEE_BPS = originalEnv;
  });

  it("defaults to 1500 bps when unset", () => {
    delete process.env.PLATFORM_FEE_BPS;
    expect(platformFeeBps()).toBe(1500);
  });

  it("clamps invalid values to the default", () => {
    process.env.PLATFORM_FEE_BPS = "not-a-number";
    expect(platformFeeBps()).toBe(1500);
    process.env.PLATFORM_FEE_BPS = "20000";
    expect(platformFeeBps()).toBe(1500);
    process.env.PLATFORM_FEE_BPS = "-5";
    expect(platformFeeBps()).toBe(1500);
  });

  it("computes platform fee in cents at default rate", () => {
    delete process.env.PLATFORM_FEE_BPS;
    expect(platformFeeCents(10_000)).toBe(1500);
    expect(platformFeeCents(0)).toBe(0);
    expect(platformFeeCents(-100)).toBe(0);
  });

  it("scales price by minutes", () => {
    expect(priceForMinutes(10_000, 60)).toBe(10_000);
    expect(priceForMinutes(10_000, 30)).toBe(5_000);
    expect(priceForMinutes(15_000, 45)).toBe(11_250);
  });
});
