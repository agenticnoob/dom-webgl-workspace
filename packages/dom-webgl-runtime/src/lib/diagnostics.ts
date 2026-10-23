import type { QualityTier } from "./renderQuality";

// Type-only: consumers need no Node types. At runtime the bundler's
// replacement of `process.env.NODE_ENV` or the global `process` is used.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** Renderer cost of the previous frame plus recent frame timing. */
export type RuntimeFrameStats = {
  readonly fps: number;
  readonly p90Ms: number;
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly textures: number;
  readonly geometries: number;
  readonly tier: QualityTier;
  readonly dpr: number;
};

export type RuntimeDiagnosticCode =
  | "section-compiled-on-entry"
  | "section-contains-lights"
  | "over-budget"
  | "below-floor"
  | "ready-without-pixels";

/** A development warning; each code is reported once per subject. */
export type RuntimeDiagnostic = {
  readonly code: RuntimeDiagnosticCode;
  readonly subject: string;
  readonly message: string;
};

/** Per-frame renderer budget for one quality tier. */
export type CostBudget = { readonly calls: number; readonly triangles: number };

export const defaultCostBudgets: Readonly<Record<QualityTier, CostBudget>> = {
  high: { calls: 300, triangles: 1_000_000 },
  medium: { calls: 150, triangles: 500_000 },
  low: { calls: 80, triangles: 250_000 },
};

export const diagnosticThresholds = {
  /** Consecutive frames over budget before warning. */
  overBudgetFrames: 120,
  /** The performance floor: 30 fps. */
  floorMs: 1000 / 30,
  /** Frames at the lowest tier whose p90 must stay over the floor. */
  floorFrames: 150,
};

const timingWindow = 120;

export type FrameInput = {
  readonly deltaMs: number;
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly textures: number;
  readonly geometries: number;
  readonly tier: QualityTier;
  readonly dpr: number;
};

export type RuntimeDiagnostics = ReturnType<typeof createDiagnostics>;

export function createDiagnostics(
  report: (diagnostic: RuntimeDiagnostic) => void = (diagnostic) =>
    console.warn(`[viselora] ${diagnostic.message}`),
) {
  let enabled = false;
  const seen = new Set<string>();
  const warnings: RuntimeDiagnostic[] = [];
  const deltas: number[] = [];
  let last: FrameInput | undefined;
  let overBudget = 0;
  let slowAtFloor = 0;

  function warn(code: RuntimeDiagnosticCode, subject: string, message: string) {
    const key = `${code}\n${subject}`;
    if (!enabled || seen.has(key)) return;
    seen.add(key);
    const diagnostic = { code, subject, message };
    warnings.push(diagnostic);
    report(diagnostic);
  }

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      enabled = next;
    },
    warn,
    /** Records one rendered frame; budget checks run only while enabled. */
    recordFrame(frame: FrameInput) {
      last = frame;
      if (frame.deltaMs > 0 && frame.deltaMs < 1000) {
        deltas.push(frame.deltaMs);
        if (deltas.length > timingWindow) deltas.shift();
      }
      if (!enabled) return;
      const budget = defaultCostBudgets[frame.tier];
      overBudget =
        frame.calls > budget.calls || frame.triangles > budget.triangles
          ? overBudget + 1
          : 0;
      if (overBudget === diagnosticThresholds.overBudgetFrames)
        warn(
          "over-budget",
          frame.tier,
          `The scene drew ${frame.calls} calls and ${frame.triangles} triangles per frame for ${overBudget} frames, over the ${frame.tier} budget of ${budget.calls} calls and ${budget.triangles} triangles. Wrap offscreen content in WebGLSection, instance repeated meshes, or simplify geometry.`,
        );
      slowAtFloor =
        frame.tier === "low" && frame.deltaMs > diagnosticThresholds.floorMs
          ? slowAtFloor + 1
          : 0;
      if (slowAtFloor === diagnosticThresholds.floorFrames)
        warn(
          "below-floor",
          "low",
          `Frames stay slower than 30 fps at the lowest quality tier (${frame.calls} calls, ${frame.triangles} triangles, ${frame.programs} programs, DPR ${frame.dpr}). Scale costly effects by useRenderQuality().tier.`,
        );
    },
    frameStats(): RuntimeFrameStats | undefined {
      if (!last) return undefined;
      const total = deltas.reduce((sum, value) => sum + value, 0);
      const sorted = [...deltas].sort((a, b) => a - b);
      const p90 =
        sorted.length > 0
          ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)]
          : 0;
      return {
        fps: total > 0 ? Math.round((deltas.length * 1000) / total) : 0,
        p90Ms: Math.round(p90 * 10) / 10,
        calls: last.calls,
        triangles: last.triangles,
        programs: last.programs,
        textures: last.textures,
        geometries: last.geometries,
        tier: last.tier,
        dpr: last.dpr,
      };
    },
    warnings(): readonly RuntimeDiagnostic[] {
      return warnings;
    },
  };
}

/**
 * Whether development diagnostics run by default. Bundlers replace
 * `process.env.NODE_ENV`; without one there is no `process` and they stay off.
 */
export function isDevelopment() {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}
