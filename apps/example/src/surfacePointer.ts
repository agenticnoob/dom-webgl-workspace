type TargetLocalPointerInput = {
  readonly layout: { readonly width: number; readonly height: number };
  readonly pointer: {
    readonly isInside: boolean;
    readonly localX: number;
    readonly localY: number;
  };
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
