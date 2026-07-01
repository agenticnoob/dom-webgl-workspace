import type { WebGLEffectUpdateContext } from "@project/dom-webgl-runtime";

type TargetLocalPointerInput = {
  readonly layout: Pick<
    WebGLEffectUpdateContext["layout"],
    "height" | "width"
  >;
  readonly pointer: Pick<
    WebGLEffectUpdateContext["targetPointer"],
    "isInside" | "localX" | "localY"
  >;
};

export type TargetLocalPointer = {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
};

export function readTargetLocalPointer({
  layout,
  pointer,
}: TargetLocalPointerInput): TargetLocalPointer {
  const localX = pointer.localX;
  const localY = pointer.localY;
  const active =
    pointer.isInside &&
    localX >= 0 &&
    localX <= layout.width &&
    localY >= 0 &&
    localY <= layout.height;

  return {
    active,
    x: active ? localX : layout.width * 0.5,
    y: active ? localY : layout.height * 0.5,
  };
}
