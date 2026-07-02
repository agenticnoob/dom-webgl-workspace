import { describe, expect, test } from "vitest";

import { createEffectObjectTransform } from "../../../src/lib/effects/effectObjectTransform";
import type { WebGLEffectTargetHandle } from "../../../src/lib/effects/effectAuthoring";

describe("createEffectObjectTransform", () => {
  test("maps position mutation to the target handle", () => {
    const calls: string[] = [];
    const target = createTarget(calls);
    const transform = createEffectObjectTransform(target);

    transform.position.set(1, 2, 3);
    transform.position.y += 4;

    expect(calls).toEqual(["position:1,2,3", "position:1,6,3"]);
  });

  test("maps rotation, scale, visibility, and opacity", () => {
    const calls: string[] = [];
    const target = createTarget(calls);
    const transform = createEffectObjectTransform(target);

    transform.rotation.y += 0.5;
    transform.scale.setScalar(1.25);
    transform.visible = false;
    transform.opacity = 0.4;

    expect(calls).toEqual([
      "rotation:0,0.5,0",
      "scale:1.25,1.25,1.25",
      "visible:false",
      "opacity:0.4",
    ]);
  });
});

function createTarget(calls: string[]): WebGLEffectTargetHandle {
  return {
    setVisible(visible) {
      calls.push(`visible:${visible}`);
    },
    setPosition(x, y, z = 0) {
      calls.push(`position:${x},${y},${z}`);
    },
    setRotation(x, y, z = 0) {
      calls.push(`rotation:${x},${y},${z}`);
    },
    setScale(x, y = x, z = 1) {
      calls.push(`scale:${x},${y},${z}`);
    },
    setOpacity(opacity) {
      calls.push(`opacity:${opacity}`);
    },
  };
}
