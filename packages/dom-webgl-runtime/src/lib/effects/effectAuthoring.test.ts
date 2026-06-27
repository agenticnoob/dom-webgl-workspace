import { describe, expect, test } from "vitest";

import { defineWebGLEffect } from "./effectAuthoring";

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
});
