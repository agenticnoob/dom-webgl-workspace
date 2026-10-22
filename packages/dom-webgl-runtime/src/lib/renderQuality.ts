export type QualityTier = "high" | "medium" | "low";

/** Drawing-buffer pixel budget per tier. */
export type QualityBudgets = Readonly<Record<QualityTier, number>>;

export const defaultQualityBudgets: QualityBudgets = {
  high: 4_000_000,
  medium: 2_000_000,
  low: 1_000_000,
};

const tiers: readonly QualityTier[] = ["low", "medium", "high"];

export type DprRange = { readonly min: number; readonly max: number };

/**
 * The pixel ratio that keeps the drawing buffer within the tier's budget,
 * bounded by the device ratio and the configured range. The same ratio costs
 * twice as many pixels on a large display, so the budget sets it, not the ratio.
 */
export function budgetedDpr(
  tier: QualityTier,
  budgets: QualityBudgets,
  viewport: { readonly width: number; readonly height: number },
  deviceDpr: number,
  range: DprRange,
) {
  const area = Math.max(1, viewport.width * viewport.height);
  const fit = Math.sqrt(budgets[tier] / area);
  const ceiling = Math.min(range.max, Math.max(deviceDpr, range.min));
  return roundDpr(Math.max(range.min, Math.min(ceiling, fit)));
}

/** Two decimals avoid resizing the drawing buffer for imperceptible changes. */
function roundDpr(value: number) {
  return Math.round(value * 100) / 100;
}

export type QualityEnvironment = {
  readonly coarsePointer: boolean;
  readonly smallScreen: boolean;
  readonly saveData: boolean;
};

/** Phones start one tier down; Save-Data starts lowest. No GPU lookup. */
export function initialQualityTier(environment: QualityEnvironment): QualityTier {
  if (environment.saveData) return "low";
  if (environment.coarsePointer && environment.smallScreen) return "medium";
  return "high";
}

export const qualityThresholds = {
  /** Step down when p90 frame time stays above this (about 45 fps). */
  downgradeMs: 22,
  /** Far above the threshold (a heavy scene starting), drop straight to `low`. */
  severeMs: 44,
  /**
   * Step up when p90 stays within this factor of the display's frame interval
   * (estimated from the fastest frames), i.e. frames keep up with vsync.
   */
  upgradeVsyncFactor: 1.15,
  /** Longest frame interval treated as a display refresh (about 57 Hz). */
  refreshCeilingMs: 17.5,
  downgradeWindowMs: 2_000,
  upgradeWindowMs: 5_000,
  /**
   * A downgrade that does not cut p90 by this fraction did not hit the
   * bottleneck (CPU work or uploads, not pixels); it is undone.
   */
  minimumImprovement: 0.1,
  /** No further downgrade for this long after an undone one. */
  ineffectiveCooldownMs: 10_000,
  /** Frames longer than this are pauses (tab switch, idle demand loop). */
  ignoreFrameMs: 250,
  /** Startup frames (shader compiles, asset decoding) are not representative. */
  startupGraceMs: 3_000,
  /** Upgrades allowed after the first downgrade, so tiers do not oscillate. */
  maxUpgrades: 3,
};

export type QualityGovernor = ReturnType<typeof createQualityGovernor>;

/** Moves between tiers from frame times; time is injected for testing. */
export function createQualityGovernor(start: QualityTier, ceiling: QualityTier = "high") {
  let tier = start;
  let samples: Array<{ at: number; ms: number }> = [];
  let changedAt = -Infinity;
  let downgraded = false;
  let upgrades = 0;
  let cooldownUntil = -Infinity;
  // The last downgrade, kept until its effect has been measured.
  let probation: { from: QualityTier; p90: number } | undefined;
  let startedAt: number | undefined;

  function change(next: QualityTier, at: number) {
    tier = next;
    changedAt = at;
    // Frames before a change describe the previous resolution.
    samples = [];
    return next;
  }

  return {
    get tier() {
      return tier;
    },
    /** Records one frame; returns the new tier when it changes. */
    sample(frameMs: number, at: number): QualityTier | undefined {
      if (!(frameMs > 0) || frameMs > qualityThresholds.ignoreFrameMs) {
        samples = [];
        return undefined;
      }
      startedAt ??= at;
      if (at - startedAt < qualityThresholds.startupGraceMs) return undefined;
      samples.push({ at, ms: frameMs });
      const oldest = at - qualityThresholds.upgradeWindowMs;
      while (samples.length > 0 && samples[0].at < oldest) samples.shift();
      if (at - changedAt < qualityThresholds.downgradeWindowMs) return undefined;

      const recent = samples.filter(
        (item) => item.at >= at - qualityThresholds.downgradeWindowMs,
      );
      const measured = covers(recent, qualityThresholds.downgradeWindowMs);
      if (probation && measured) {
        const before = probation;
        probation = undefined;
        if (percentile(recent, 0.9) > before.p90 * (1 - qualityThresholds.minimumImprovement)) {
          cooldownUntil = at + qualityThresholds.ineffectiveCooldownMs;
          return change(before.from, at);
        }
      }

      const index = tiers.indexOf(tier);
      if (index > 0 && measured && at >= cooldownUntil) {
        const p90 = percentile(recent, 0.9);
        if (p90 > qualityThresholds.downgradeMs) {
          downgraded = true;
          probation = { from: tier, p90 };
          return change(p90 > qualityThresholds.severeMs ? "low" : tiers[index - 1], at);
        }
      }
      if (
        index < tiers.indexOf(ceiling) &&
        (!downgraded || upgrades < qualityThresholds.maxUpgrades) &&
        covers(samples, qualityThresholds.upgradeWindowMs) &&
        keepsUpWithDisplay(samples)
      ) {
        if (downgraded) upgrades += 1;
        return change(tiers[index + 1], at);
      }
      return undefined;
    },
  };
}

// The fastest frames estimate the refresh interval; slow ones must stay near it.
function keepsUpWithDisplay(samples: ReadonlyArray<{ ms: number }>) {
  const refresh = percentile(samples, 0.1);
  return (
    refresh <= qualityThresholds.refreshCeilingMs &&
    percentile(samples, 0.9) <= refresh * qualityThresholds.upgradeVsyncFactor
  );
}

// A window counts once its samples span nearly all of it.
function covers(samples: ReadonlyArray<{ at: number }>, windowMs: number) {
  if (samples.length < 2) return false;
  return samples[samples.length - 1].at - samples[0].at >= windowMs * 0.9;
}

function percentile(samples: ReadonlyArray<{ ms: number }>, fraction: number) {
  const sorted = samples.map((item) => item.ms).sort((a, b) => a - b);
  const rank = Math.ceil(sorted.length * fraction) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

/** Current render quality, read with `useRenderQuality()`. */
export type RenderQuality = {
  readonly tier: QualityTier;
  /** Canvas pixel ratio in effect. */
  readonly dpr: number;
  /** `prefers-reduced-motion: reduce`; a signal only, it does not change the tier. */
  readonly reducedMotion: boolean;
};

export type QualityStore = ReturnType<typeof createQualityStore>;

export function createQualityStore() {
  let state: RenderQuality = { tier: "high", dpr: 1, reducedMotion: false };
  let governor: QualityGovernor | undefined;
  const listeners = new Set<() => void>();

  function update(patch: Partial<RenderQuality>) {
    const next = { ...state, ...patch };
    if (
      next.tier === state.tier &&
      next.dpr === state.dpr &&
      next.reducedMotion === state.reducedMotion
    )
      return;
    state = next;
    for (const listener of listeners) listener();
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Starts at `tier`; frame samples move it only when `adaptive`. */
    configure(tier: QualityTier, adaptive: boolean) {
      governor = adaptive ? createQualityGovernor(tier) : undefined;
      update({ tier });
    },
    setDpr(dpr: number) {
      update({ dpr });
    },
    setReducedMotion(reducedMotion: boolean) {
      update({ reducedMotion });
    },
    sample(frameMs: number, at: number) {
      const next = governor?.sample(frameMs, at);
      if (next) update({ tier: next });
    },
  };
}
