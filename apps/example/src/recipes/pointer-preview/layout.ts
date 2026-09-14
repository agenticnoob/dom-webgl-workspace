export const pointerPreviewQuery = "(hover: hover) and (pointer: fine)";
export const pointerPreviewMinimumWidth = 680;

type Size = { readonly width: number; readonly height: number };
export type PreviewPoint = { readonly x: number; readonly y: number };

/** All coordinates are local to the directory, never the browser viewport. */
export function resolvePointerPreviewPosition(
  pointer: PreviewPoint,
  bounds: Size,
  size: Size,
): PreviewPoint {
  const insetX = Math.min(16, Math.max(0, (bounds.width - size.width) / 2));
  const insetY = Math.min(16, Math.max(0, (bounds.height - size.height) / 2));
  return {
    x: Math.max(
      insetX,
      Math.min(pointer.x + 24, bounds.width - size.width - insetX),
    ),
    y: Math.max(
      insetY,
      Math.min(
        pointer.y - size.height / 2,
        bounds.height - size.height - insetY,
      ),
    ),
  };
}
