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

  test("narrows image sequence sources to a texture-capable handle", () => {
    const definition = defineWebGLEffect({
      kind: "custom.sequenceProbe",
      source: "media/image-sequence",
      update(ctx) {
        if (ctx.source.kind !== "media" || ctx.source.type !== "image-sequence") {
          throw new Error("Expected image sequence source.");
        }

        ctx.source.frame satisfies number;
        ctx.source.src satisfies string;
        ctx.source.image?.setTextureTransform({ repeatX: 1, repeatY: 1 });
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
});
