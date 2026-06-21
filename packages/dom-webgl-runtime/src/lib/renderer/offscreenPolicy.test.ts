import { describe, expect, test } from "vitest";
import { compileOffscreenPolicy } from "./offscreenPolicy";

describe("compileOffscreenPolicy", () => {
  test("defaults to restore-dom with no warm retention", () => {
    expect(compileOffscreenPolicy(undefined)).toEqual({
      strategy: "restore-dom",
      warmTtlMs: 0,
    });
  });

  test("keeps explicit park strategy and warm TTL", () => {
    expect(
      compileOffscreenPolicy({
        offscreen: {
          strategy: "park",
          warmTtlMs: 2500,
        },
      }),
    ).toEqual({ strategy: "park", warmTtlMs: 2500 });
  });

  test("clamps warm TTL to the maximum retention window", () => {
    expect(
      compileOffscreenPolicy({
        offscreen: {
          strategy: "park",
          warmTtlMs: 60_000,
        },
      }),
    ).toEqual({ strategy: "park", warmTtlMs: 30_000 });
  });

  test("normalizes invalid warm TTL values to zero", () => {
    expect(
      compileOffscreenPolicy({
        offscreen: {
          strategy: "park",
          warmTtlMs: -1,
        },
      }),
    ).toEqual({ strategy: "park", warmTtlMs: 0 });
  });
});
