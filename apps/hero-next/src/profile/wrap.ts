export type HeroProfileWrapRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

export type HeroProfileWrapSide = "left" | "right";

export type HeroProfileWrapExclusion =
  | {
      readonly kind: "ellipse";
      readonly rect: HeroProfileWrapRect;
    }
  | {
      readonly kind: "rounded-rectangle";
      readonly rect: HeroProfileWrapRect;
      readonly radius: number;
    };

export type HeroProfileHorizontalBounds = {
  readonly left: number;
  readonly right: number;
};

export function resolveHeroProfileWrapInset(
  item: HeroProfileWrapRect,
  exclusion: HeroProfileWrapRect,
): number {
  if (!isValidRect(item) || !isValidRect(exclusion)) {
    return 0;
  }

  const radiusX = exclusion.width / 2;
  const radiusY = exclusion.height / 2;
  if (radiusX <= 0 || radiusY <= 0) {
    return 0;
  }

  const centerY = exclusion.top + radiusY;
  const distanceY =
    centerY < item.top
      ? item.top - centerY
      : centerY > item.bottom
        ? centerY - item.bottom
        : 0;
  if (distanceY >= radiusY) {
    return 0;
  }

  const normalizedY = distanceY / radiusY;
  return radiusX * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
}

export function resolveHeroProfileRoundedRectWrapInset(
  item: HeroProfileWrapRect,
  exclusion: HeroProfileWrapRect,
  radius: number,
): number {
  if (
    !isValidRect(item) ||
    !isValidRect(exclusion) ||
    !Number.isFinite(radius) ||
    radius < 0
  ) {
    return 0;
  }

  const radiusX = exclusion.width / 2;
  const radiusY = exclusion.height / 2;
  if (radiusX <= 0 || radiusY <= 0) {
    return 0;
  }

  const resolvedRadius = Math.min(radius, radiusX, radiusY);
  const centerY = exclusion.top + radiusY;
  const distanceY = verticalDistanceToItem(centerY, item);
  if (distanceY >= radiusY + resolvedRadius) {
    return 0;
  }
  if (distanceY >= radiusY) {
    if (resolvedRadius === 0) {
      return 0;
    }
    const approach = 1 - (distanceY - radiusY) / resolvedRadius;
    return (radiusX - resolvedRadius) * smoothstep(approach);
  }

  const cornerDistance = Math.max(0, distanceY - (radiusY - resolvedRadius));
  if (resolvedRadius === 0 || cornerDistance === 0) {
    return radiusX;
  }
  return (
    radiusX -
    resolvedRadius +
    Math.sqrt(
      Math.max(
        0,
        resolvedRadius * resolvedRadius - cornerDistance * cornerDistance,
      ),
    )
  );
}

export function resolveHeroProfileLineShift(
  line: HeroProfileWrapRect,
  exclusion: HeroProfileWrapRect,
  bounds: HeroProfileHorizontalBounds,
  side: HeroProfileWrapSide,
  gap: number,
): number {
  if (
    !isValidRect(line) ||
    !isValidRect(exclusion) ||
    !isValidBounds(bounds) ||
    !Number.isFinite(gap) ||
    gap < 0
  ) {
    return 0;
  }

  return resolveHeroProfileLineShiftWithInset(
    line,
    exclusion,
    bounds,
    side,
    gap,
    resolveHeroProfileWrapInset(line, exclusion),
  );
}

export function resolveHeroProfileLineShiftForExclusions(
  line: HeroProfileWrapRect,
  exclusions: readonly HeroProfileWrapExclusion[],
  bounds: HeroProfileHorizontalBounds,
  side: HeroProfileWrapSide,
  gap: number,
): number {
  let shift = 0;
  for (const exclusion of exclusions) {
    const nextShift = resolveHeroProfileLineShiftForExclusion(
      line,
      exclusion,
      bounds,
      side,
      gap,
    );
    shift =
      side === "left" ? Math.min(shift, nextShift) : Math.max(shift, nextShift);
  }
  return shift;
}

function resolveHeroProfileLineShiftForExclusion(
  line: HeroProfileWrapRect,
  exclusion: HeroProfileWrapExclusion,
  bounds: HeroProfileHorizontalBounds,
  side: HeroProfileWrapSide,
  gap: number,
): number {
  switch (exclusion.kind) {
    case "ellipse":
      return resolveHeroProfileLineShift(
        line,
        exclusion.rect,
        bounds,
        side,
        gap,
      );
    case "rounded-rectangle":
      return resolveHeroProfileLineShiftWithInset(
        line,
        exclusion.rect,
        bounds,
        side,
        gap,
        resolveHeroProfileRoundedRectWrapInset(
          line,
          exclusion.rect,
          exclusion.radius,
        ),
      );
  }
}

function resolveHeroProfileLineShiftWithInset(
  line: HeroProfileWrapRect,
  exclusion: HeroProfileWrapRect,
  bounds: HeroProfileHorizontalBounds,
  side: HeroProfileWrapSide,
  gap: number,
  inset: number,
): number {
  if (
    !isValidRect(line) ||
    !isValidRect(exclusion) ||
    !isValidBounds(bounds) ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    !Number.isFinite(inset) ||
    inset <= 0
  ) {
    return 0;
  }

  const centerX = exclusion.left + exclusion.width / 2;
  if (side === "left") {
    const desiredShift = Math.min(0, centerX - inset - gap - line.right);
    return Math.max(bounds.left - line.left, desiredShift);
  }

  const desiredShift = Math.max(0, centerX + inset + gap - line.left);
  return Math.min(bounds.right - line.right, desiredShift);
}

export function splitHeroProfileText(text: string): readonly string[] {
  return (
    text.match(
      /[\u3400-\u9fff\uf900-\ufaff]|\s+|[^\u3400-\u9fff\uf900-\ufaff\s]+/g,
    ) ?? []
  );
}

export function groupHeroProfileLineIndexes(
  rects: readonly HeroProfileWrapRect[],
): readonly (readonly number[])[] {
  const indexedRects = rects
    .map((rect, index) => ({ index, rect }))
    .filter(({ rect }) => isValidRect(rect))
    .sort(
      (a, b) =>
        verticalCenter(a.rect) - verticalCenter(b.rect) ||
        a.rect.left - b.rect.left,
    );
  const lines: {
    top: number;
    bottom: number;
    indexes: number[];
  }[] = [];

  for (const { index, rect } of indexedRects) {
    const line = lines.find((candidate) => sharesVisualLine(candidate, rect));
    if (!line) {
      lines.push({ top: rect.top, bottom: rect.bottom, indexes: [index] });
      continue;
    }

    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
    line.indexes.push(index);
  }

  return lines.map(({ indexes }) => indexes.sort((a, b) => a - b));
}

function isValidRect(rect: HeroProfileWrapRect): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.bottom) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.right >= rect.left &&
    rect.bottom >= rect.top &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

function isValidBounds(bounds: HeroProfileHorizontalBounds): boolean {
  return (
    Number.isFinite(bounds.left) &&
    Number.isFinite(bounds.right) &&
    bounds.right >= bounds.left
  );
}

function verticalCenter(rect: HeroProfileWrapRect): number {
  return (rect.top + rect.bottom) / 2;
}

function verticalDistanceToItem(
  centerY: number,
  item: HeroProfileWrapRect,
): number {
  return centerY < item.top
    ? item.top - centerY
    : centerY > item.bottom
      ? centerY - item.bottom
      : 0;
}

function smoothstep(value: number): number {
  const progress = Math.max(0, Math.min(1, value));
  return progress * progress * (3 - 2 * progress);
}

function sharesVisualLine(
  line: { readonly top: number; readonly bottom: number },
  rect: HeroProfileWrapRect,
): boolean {
  const overlap =
    Math.min(line.bottom, rect.bottom) - Math.max(line.top, rect.top);
  const smallerHeight = Math.min(line.bottom - line.top, rect.height);
  return smallerHeight > 0 && overlap / smallerHeight >= 0.5;
}
