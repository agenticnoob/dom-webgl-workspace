import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type SequenceCardParams = {
  kind: "example.sequenceCard";
  progressKey: string;
  travel?: number;
  minOpacity?: number;
  maxOpacity?: number;
};

export const exampleSequenceCardEffect =
  defineWebGLEffect<SequenceCardParams>({
    kind: "example.sequenceCard",
    source: "dom/element",
    update(ctx, _state, params) {
      if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
        return;
      }

      const progress = clampNumber(ctx.progress.get(params.progressKey), 0, 1, 0);
      const travel = clampNumber(params.travel, 0, 640, 280);
      const minOpacity = clampNumber(params.minOpacity, 0, 1, 0.18);
      const maxOpacity = clampNumber(params.maxOpacity, minOpacity, 1, 0.82);
      const entry = smoothstep(0.08, 0.3, progress);
      const exit = smoothstep(0.7, 0.92, progress);
      const presence = clampNumber(entry * (1 - exit), 0, 1, 0);
      const offsetX = (1 - entry) * -travel + exit * travel;
      const opacity = roundTo(
        minOpacity + (maxOpacity - minOpacity) * presence,
        1000,
      );

      ctx.target?.setVisible(true);
      ctx.target?.setOpacity(opacity);
      ctx.target?.setPosition(offsetX, 0, 0);
    },
  });

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1, 0);
  return t * t * (3 - 2 * t);
}

function roundTo(value: number, scale: number): number {
  return Math.round(value * scale) / scale;
}
