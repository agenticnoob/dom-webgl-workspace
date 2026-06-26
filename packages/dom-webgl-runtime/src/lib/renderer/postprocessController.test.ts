import { describe, expect, test, vi } from "vitest";

import { createPostprocessController } from "./postprocessController";

describe("postprocess controller", () => {
  test("stores named requests and updates duplicate keys", () => {
    const controller = createPostprocessController();
    const first = controller.requestPostprocess({
      key: "glow",
      bloom: { strength: 0.4 },
    });
    const second = controller.requestPostprocess({
      key: "glow",
      bloom: { strength: 0.9 },
      grain: { amount: 0.05 },
    });

    expect(controller.inspectRequests()).toEqual([
      {
        key: "glow",
        bloom: { strength: 0.9 },
        grain: { amount: 0.05 },
      },
    ]);

    first.dispose();
    expect(controller.inspectRequests()).toHaveLength(1);

    second.dispose();
    expect(controller.inspectRequests()).toHaveLength(0);
  });

  test("handle update replaces the current request and dispose is idempotent", () => {
    const controller = createPostprocessController();
    const handle = controller.requestPostprocess({
      key: "blur",
      blur: { radius: 0.1 },
    });

    handle.update({ key: "blur", blur: { radius: 0.5 } });
    handle.dispose();
    handle.dispose();

    expect(controller.inspectRequests()).toEqual([]);
  });

  test("falls back to the base render path when no requests are active", () => {
    const controller = createPostprocessController();
    const renderBase = vi.fn();

    controller.render(renderBase);

    expect(renderBase).toHaveBeenCalledTimes(1);
  });
});
