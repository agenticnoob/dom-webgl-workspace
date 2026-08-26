import type { HeroHoldTransitionState } from "./holdTransition";
import {
  heroTransitionConfig,
  type HeroSchemeName,
  type HeroTransitionPhase,
} from "./transitionConfig";

export type HeroTransitionSignalWriter = {
  set(key: string, value: number): void;
};

export type HeroTransitionSignalReader = {
  get(key: string): number;
};

export type HeroTransitionSignalSnapshot = Pick<
  HeroHoldTransitionState,
  "committedScheme" | "targetScheme" | "coverage" | "origin" | "phase"
>;

export function publishHeroTransitionSignals(
  writer: HeroTransitionSignalWriter,
  snapshot: HeroTransitionSignalSnapshot,
): void {
  writer.set(
    heroTransitionConfig.signalKeys.committedScheme,
    heroTransitionConfig.signalCodes.scheme[snapshot.committedScheme],
  );
  writer.set(
    heroTransitionConfig.signalKeys.targetScheme,
    heroTransitionConfig.signalCodes.scheme[snapshot.targetScheme],
  );
  writer.set(
    heroTransitionConfig.signalKeys.coverage,
    normalized(snapshot.coverage, 0),
  );
  writer.set(
    heroTransitionConfig.signalKeys.originX,
    normalized(snapshot.origin.x, 0.5),
  );
  writer.set(
    heroTransitionConfig.signalKeys.originY,
    normalized(snapshot.origin.y, 0.5),
  );
  writer.set(
    heroTransitionConfig.signalKeys.phase,
    heroTransitionConfig.signalCodes.phase[snapshot.phase],
  );
}

export function readHeroTransitionSignals(
  reader: HeroTransitionSignalReader,
): HeroTransitionSignalSnapshot {
  return {
    committedScheme: decodeScheme(
      reader.get(heroTransitionConfig.signalKeys.committedScheme),
    ),
    targetScheme: decodeScheme(
      reader.get(heroTransitionConfig.signalKeys.targetScheme),
    ),
    coverage: normalized(
      reader.get(heroTransitionConfig.signalKeys.coverage),
      0,
    ),
    origin: {
      x: normalized(reader.get(heroTransitionConfig.signalKeys.originX), 0.5),
      y: normalized(reader.get(heroTransitionConfig.signalKeys.originY), 0.5),
    },
    phase: decodePhase(reader.get(heroTransitionConfig.signalKeys.phase)),
  };
}

function decodeScheme(value: number): HeroSchemeName {
  if (!Number.isFinite(value)) {
    return "initial";
  }

  return closestCode(value, [
    ["initial", heroTransitionConfig.signalCodes.scheme.initial],
    ["inverted", heroTransitionConfig.signalCodes.scheme.inverted],
  ]);
}

function decodePhase(value: number): HeroTransitionPhase {
  if (!Number.isFinite(value)) {
    return "idle";
  }

  return closestCode(value, [
    ["idle", heroTransitionConfig.signalCodes.phase.idle],
    ["expanding", heroTransitionConfig.signalCodes.phase.expanding],
    ["retracting", heroTransitionConfig.signalCodes.phase.retracting],
    [
      "awaiting-release",
      heroTransitionConfig.signalCodes.phase["awaiting-release"],
    ],
  ]);
}

function closestCode<Name extends string>(
  value: number,
  entries: readonly (readonly [Name, number])[],
): Name {
  const first = entries[0];
  if (!first) {
    throw new TypeError("Expected at least one transition signal code.");
  }

  let closest = first;
  for (const entry of entries.slice(1)) {
    if (Math.abs(value - entry[1]) < Math.abs(value - closest[1])) {
      closest = entry;
    }
  }
  return closest[0];
}

function normalized(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
