import type {
  WebGLProgressSignalSource,
  WebGLTimelineActiveRangeDeclaration,
  WebGLTimelineBindingDeclaration,
} from "../types";

export type NormalizedTimelineBinding = {
  readonly id: string;
  readonly progressKey: string;
  readonly active?: {
    readonly from: number;
    readonly to: number;
  };
};

export type TimelineProgressSnapshot = {
  readonly id: string;
  readonly progressKey: string;
  readonly progress: number;
  readonly active: boolean;
};

export function normalizeTimelineBinding(
  declaration: WebGLTimelineBindingDeclaration | undefined,
): NormalizedTimelineBinding | undefined {
  if (declaration === undefined) {
    return undefined;
  }

  if (typeof declaration === "string") {
    const id = normalizeTimelineId(declaration);
    return { id, progressKey: id };
  }

  const id = normalizeTimelineId(declaration.id);
  const progressKey =
    declaration.progressKey === undefined
      ? id
      : normalizeTimelineId(declaration.progressKey);

  return {
    id,
    progressKey,
    ...(declaration.active
      ? { active: normalizeActiveRange(declaration.active) }
      : {}),
  };
}

export function readTimelineProgress(
  binding: NormalizedTimelineBinding,
  progressSignals: WebGLProgressSignalSource,
): TimelineProgressSnapshot {
  const progress = clampProgress(progressSignals.get(binding.progressKey));
  const active = binding.active
    ? progress >= binding.active.from && progress <= binding.active.to
    : true;

  return {
    id: binding.id,
    progressKey: binding.progressKey,
    progress,
    active,
  };
}

function normalizeTimelineId(value: string): string {
  const id = value.trim();
  if (!id) {
    throw new Error("WebGL timeline id must be a non-empty string.");
  }
  return id;
}

function normalizeActiveRange(
  range: WebGLTimelineActiveRangeDeclaration,
): { from: number; to: number } {
  const from = normalizeRangeBoundary(range.from, 0, "from");
  const to = normalizeRangeBoundary(range.to, 1, "to");

  if (from > to) {
    throw new Error("WebGL timeline active range must have from <= to.");
  }

  return { from, to };
}

function normalizeRangeBoundary(
  value: number | undefined,
  fallback: number,
  label: "from" | "to",
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    throw new Error(`WebGL timeline active range ${label} must be finite.`);
  }
  return clampProgress(value);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
