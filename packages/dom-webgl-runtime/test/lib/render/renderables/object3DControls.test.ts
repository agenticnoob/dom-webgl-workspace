import { describe, expect, test } from "vitest";

import { createObject3DControls } from "../../../../src/lib/render/renderables/object3DControls";

describe("createObject3DControls", () => {
  test("setOpacity does not reset material transparent to false at opacity 1", () => {
    const material = { transparent: true, opacity: 0.4 };
    const controls = createObject3DControls(
      {},
      { opacity: { kind: "material", material } },
    );

    controls.setOpacity(1);

    expect(material).toMatchObject({
      opacity: 1,
      transparent: true,
      needsUpdate: true,
    });
  });
});
