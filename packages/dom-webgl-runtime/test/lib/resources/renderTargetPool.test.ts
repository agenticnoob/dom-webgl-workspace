import { describe, expect, test, vi } from "vitest";

import { createRenderTargetPool } from "../../../src/lib/resources/renderTargetPool";

describe("render target pool", () => {
  test("reuses released render targets and disposes retained targets", () => {
    const dispose = vi.fn();
    const pool = createRenderTargetPool({
      createTarget: () => ({ dispose }),
    });

    const first = pool.acquire("snapshot", 256, 256);
    pool.release(first);
    const second = pool.acquire("snapshot", 256, 256);

    expect(second).toBe(first);

    pool.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
