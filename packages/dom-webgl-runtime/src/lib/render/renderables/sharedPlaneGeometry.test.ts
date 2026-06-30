import { describe, expect, test, vi } from "vitest";

import { acquireSharedPlaneGeometry } from "./sharedPlaneGeometry";

describe("shared plane geometry", () => {
  test("reuses one PlaneGeometry until all handles dispose", () => {
    const first = acquireSharedPlaneGeometry();
    const second = acquireSharedPlaneGeometry();
    const dispose = vi.spyOn(first.geometry, "dispose");

    expect(first.geometry).toBe(second.geometry);
    first.dispose();
    expect(dispose).not.toHaveBeenCalled();
    second.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
