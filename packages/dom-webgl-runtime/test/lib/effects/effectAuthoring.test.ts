import { describe, expect, test } from "vitest";

import { defineWebGLEffect } from "../../../src/lib/effects/effectAuthoring";

describe("defineWebGLEffect", () => {
  test("returns the definition unchanged so authors can keep stable references", () => {
    const definition = {
      kind: "custom.test",
      update() {
        return;
      },
    } as const;

    expect(defineWebGLEffect(definition)).toBe(definition);
  });

  test("keeps source filters while authors use object texture metadata", () => {
    const definition = defineWebGLEffect({
      kind: "custom.sequenceProbe",
      source: "media/image-sequence",
      update(ctx) {
        const texture = ctx.object.texture;
        if (!texture) {
          throw new Error("Expected image sequence source.");
        }

        texture.frame satisfies number | undefined;
        texture.src satisfies string | undefined;
        texture.setTransform({ repeatX: 1, repeatY: 1 });
      },
    });

    expect(definition.source).toBe("media/image-sequence");
  });

  test("supports object-first effect authoring syntax", () => {
    const definition = defineWebGLEffect({
      kind: "custom.objectSyntax",
      update(ctx) {
        ctx.object.position.y += Math.sin(ctx.time / 1000) * 8;
        ctx.object.rotation.y += ctx.delta / 1000;
        ctx.object.scale.setScalar(1.05);
        ctx.object.opacity = 0.9;
      },
    });

    expect(definition.kind).toBe("custom.objectSyntax");
  });

  test("supports Three-like managed object authoring syntax", () => {
    const definition = defineWebGLEffect({
      kind: "custom.threeLikeSyntax",
      update(ctx) {
        ctx.object.position.set(1, 2, 3);
        ctx.object.rotation.y += ctx.delta / 1000;
        ctx.object.scale.setScalar(1.2);
        ctx.object.material?.emissive.set("#38bdf8", 2);
        ctx.object.lights?.point("rim", { intensity: 1.5, follow: "object" });
        ctx.object.animation?.play("Idle");
      },
    });

    expect(definition.kind).toBe("custom.threeLikeSyntax");
  });

  test("does not expose source target or visual on public effect context", () => {
    const definition = defineWebGLEffect({
      kind: "custom.objectOnlySyntax",
      update(ctx) {
        ctx.object.opacity = 0.8;
        ctx.runtime.postprocess.request({
          key: "soft",
          scope: { canvas: true },
          grain: { amount: 0.1 },
        });

        // @ts-expect-error source is no longer public effect context.
        ctx.source;
        // @ts-expect-error target is no longer public effect context.
        ctx.target;
        // @ts-expect-error visual is no longer public effect context.
        ctx.visual;
      },
    });

    expect(definition.kind).toBe("custom.objectOnlySyntax");
  });
});
