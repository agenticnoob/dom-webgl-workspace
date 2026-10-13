import { readHeroChapterScrollState } from "../chapters/scrollState";
import {
  resolveHeroRadialGeometry,
  resolveHeroTransitionVisual,
} from "../transition/holdTransition";
import type { HeroViewport } from "../shared/viewport";
import {
  readHeroTransitionSignals,
  type HeroTransitionSignalReader,
} from "../transition/signals";

type HeroGhostOverscanInput = {
  readonly width: number;
  readonly height: number;
  readonly viewportHeight: number;
  readonly depth: number;
  readonly fov: number;
  readonly overscan: number;
};

export function resolveHeroGhostOverscanScale({
  width,
  height,
  viewportHeight,
  depth,
  fov,
  overscan,
}: HeroGhostOverscanInput): [number, number, number] {
  const verticalSpan = 2 * depth * Math.tan((fov * Math.PI) / 360);
  const unitsPerPixel = verticalSpan / Math.max(1, viewportHeight);

  return [
    width * unitsPerPixel * overscan,
    height * unitsPerPixel * overscan,
    1,
  ];
}

export function resolveHeroGhostProgramState(
  reader: HeroTransitionSignalReader,
  viewport: HeroViewport,
): {
  readonly baseBackgroundColor: string;
  readonly baseForegroundColor: string;
  readonly targetBackgroundColor: string;
  readonly targetForegroundColor: string;
  readonly radialOrigin: readonly [number, number];
  readonly radialRadiusPx: number;
  readonly radialEdgePx: number;
  readonly sceneOpacity: number;
} {
  const snapshot = readHeroTransitionSignals(reader);
  const chapter = readHeroChapterScrollState(reader);
  const visual = resolveHeroTransitionVisual(snapshot);
  const profileBodyActive =
    chapter.chapterId === "self" && chapter.domContentActive;
  const radial = resolveHeroRadialGeometry(
    snapshot.coverage,
    snapshot.origin,
    viewport,
  );

  return {
    baseBackgroundColor: profileBodyActive
      ? visual.committed.foreground
      : visual.committed.background,
    baseForegroundColor: profileBodyActive
      ? visual.committed.background
      : visual.committed.foreground,
    targetBackgroundColor: profileBodyActive
      ? visual.target.foreground
      : visual.target.background,
    targetForegroundColor: profileBodyActive
      ? visual.target.background
      : visual.target.foreground,
    radialOrigin: [radial.origin.x, radial.origin.y],
    radialRadiusPx: radial.radiusPx,
    radialEdgePx: radial.edgeFeatherPx,
    sceneOpacity: profileBodyActive || !chapter.domContentActive ? 1 : 0,
  };
}

export function resolveHeroPointerLightIntensityScale(
  reader: HeroTransitionSignalReader,
): number {
  return resolveChapterIntensityScale(reader, 0.04);
}

export function resolveHeroGhostCursorIntensityScale(
  reader: HeroTransitionSignalReader,
): number {
  return resolveChapterIntensityScale(reader, 0.1);
}

function resolveChapterIntensityScale(
  reader: HeroTransitionSignalReader,
  chapterIntensityScale: number,
): number {
  const chapter = readHeroChapterScrollState(reader);

  if (chapter.exitProgress > 0) {
    return lerp(chapterIntensityScale, 1, smoothstep(chapter.exitProgress));
  }

  return lerp(1, chapterIntensityScale, smoothstep(chapter.entryProgress));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
function smoothstep(value: number): number {
  const safe = Math.max(0, Math.min(1, value));
  return safe * safe * (3 - 2 * safe);
}
