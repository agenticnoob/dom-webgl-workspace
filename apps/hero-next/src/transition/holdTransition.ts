import {
  heroTransitionConfig,
  type HeroSchemeName,
  type HeroTransitionConfig,
  type HeroTransitionPhase,
} from "./transitionConfig";

import type { HeroViewport } from "../shared/viewport";

export type HeroNormalizedPoint = { readonly x: number; readonly y: number };

export type HeroHoldTransitionState = {
  readonly committedScheme: HeroSchemeName;
  readonly targetScheme: HeroSchemeName;
  readonly origin: HeroNormalizedPoint;
  readonly coverage: number;
  readonly phase: HeroTransitionPhase;
  readonly shakeActive: boolean;
};

export type HeroHoldTransitionInput = {
  readonly interactionEnabled: boolean;
  readonly meshPressed: boolean;
  readonly primaryPointerDown: boolean;
  readonly hitConfirmed: boolean;
  readonly pointer: HeroNormalizedPoint;
  readonly viewport: HeroViewport;
  readonly deltaMs: number;
  readonly reducedMotion: boolean;
};

type HeroResolvedScheme = {
  readonly background: string;
  readonly foreground: string;
};

export type HeroTransitionVisualState = {
  readonly committed: HeroResolvedScheme;
  readonly target: HeroResolvedScheme;
};

export type HeroRadialGeometry = {
  readonly coverage: number;
  readonly easedCoverage: number;
  readonly origin: HeroNormalizedPoint;
  readonly farthestCornerPx: number;
  readonly fullRadiusPx: number;
  readonly radiusPx: number;
  readonly edgeFeatherPx: number;
  readonly coversViewport: boolean;
};

export type HeroShake = {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
};

export function createHeroHoldTransitionState(
  committedScheme: HeroSchemeName = "initial",
): HeroHoldTransitionState {
  return {
    committedScheme,
    targetScheme: committedScheme,
    origin: { x: 0.5, y: 0.5 },
    coverage: 0,
    phase: "idle",
    shakeActive: false,
  };
}

export function stepHeroHoldTransition(
  state: HeroHoldTransitionState,
  input: HeroHoldTransitionInput,
  config: HeroTransitionConfig = heroTransitionConfig,
): HeroHoldTransitionState {
  const safeState = sanitizeState(state);
  const deltaMs = clampFinite(
    input.deltaMs,
    0,
    config.timing.maxFrameDeltaMs,
    0,
  );
  const validPress =
    input.interactionEnabled &&
    input.meshPressed &&
    input.primaryPointerDown &&
    input.hitConfirmed;
  const continuingPress =
    input.interactionEnabled && input.meshPressed && input.primaryPointerDown;

  switch (safeState.phase) {
    case "idle": {
      if (!validPress) {
        return safeState;
      }

      const targetScheme = inverseScheme(safeState.committedScheme);
      return expand(
        {
          ...safeState,
          targetScheme,
          origin: normalizePoint(input.pointer),
          phase: "expanding",
        },
        input,
        deltaMs,
        config,
      );
    }
    case "expanding": {
      if (!continuingPress) {
        return {
          ...safeState,
          phase: "retracting",
          shakeActive: false,
        };
      }

      return expand(safeState, input, deltaMs, config);
    }
    case "retracting": {
      if (validPress) {
        return expand(
          { ...safeState, phase: "expanding" },
          input,
          deltaMs,
          config,
        );
      }

      const coverage = normalizeCoverage(
        safeState.coverage - deltaMs / config.timing.retractMs,
      );
      if (coverage <= 0) {
        return {
          ...safeState,
          targetScheme: safeState.committedScheme,
          coverage: 0,
          phase: "idle",
          shakeActive: false,
        };
      }

      return { ...safeState, coverage, shakeActive: false };
    }
    case "awaiting-release": {
      if (input.primaryPointerDown) {
        return safeState;
      }

      return {
        ...safeState,
        targetScheme: safeState.committedScheme,
        coverage: 0,
        phase: "idle",
        shakeActive: false,
      };
    }
  }
}

export function resolveHeroRadialGeometry(
  coverage: number,
  origin: HeroNormalizedPoint,
  viewport: HeroViewport,
  config: HeroTransitionConfig = heroTransitionConfig,
): HeroRadialGeometry {
  const width = positive(viewport.width);
  const height = positive(viewport.height);
  const safeOrigin = normalizePoint(origin);
  const originPx = { x: safeOrigin.x * width, y: safeOrigin.y * height };
  const farthestCornerPx = Math.max(
    Math.hypot(originPx.x, originPx.y),
    Math.hypot(width - originPx.x, originPx.y),
    Math.hypot(originPx.x, height - originPx.y),
    Math.hypot(width - originPx.x, height - originPx.y),
  );
  const safeCoverage = normalizeCoverage(coverage);
  const easedCoverage = smoothstep(safeCoverage);
  const fullRadiusPx =
    farthestCornerPx * config.radial.overscan + config.radial.edgeFeatherPx;
  const radiusPx = fullRadiusPx * easedCoverage;

  return {
    coverage: safeCoverage,
    easedCoverage,
    origin: safeOrigin,
    farthestCornerPx,
    fullRadiusPx,
    radiusPx,
    edgeFeatherPx: config.radial.edgeFeatherPx,
    coversViewport:
      safeCoverage >= 1 &&
      radiusPx >= farthestCornerPx + config.radial.edgeFeatherPx,
  };
}

export function resolveHeroTransitionVisual(
  state: Pick<HeroHoldTransitionState, "committedScheme" | "targetScheme">,
  config: HeroTransitionConfig = heroTransitionConfig,
): HeroTransitionVisualState {
  const committed = resolveScheme(state.committedScheme, config);
  const target = resolveScheme(state.targetScheme, config);

  return {
    committed,
    target,
  };
}

export function resolveHeroShake(
  timeMs: number,
  state: Pick<HeroHoldTransitionState, "coverage" | "phase" | "shakeActive">,
  reducedMotion: boolean,
  config: HeroTransitionConfig = heroTransitionConfig,
): HeroShake {
  if (reducedMotion || state.phase !== "expanding" || !state.shakeActive) {
    return zeroShake();
  }

  const safeTime = Number.isFinite(timeMs) ? timeMs : 0;
  const envelope = Math.sin(Math.PI * normalizeCoverage(state.coverage));
  const [xHz, yHz, zHz] = config.shake.frequenciesHz;
  const xPhase = safeTime * 0.001 * Math.PI * 2 * xHz;
  const yPhase = safeTime * 0.001 * Math.PI * 2 * yHz;
  const zPhase = safeTime * 0.001 * Math.PI * 2 * zHz;

  return {
    position: [
      Math.sin(xPhase) * config.shake.positionAmplitude * envelope,
      Math.cos(yPhase) * config.shake.positionAmplitude * envelope,
      Math.sin(zPhase) * config.shake.positionAmplitude * envelope,
    ],
    rotation: [
      Math.cos(yPhase) * config.shake.rotationAmplitude * envelope,
      Math.sin(zPhase) * config.shake.rotationAmplitude * envelope,
      Math.sin(xPhase) * config.shake.rotationAmplitude * envelope,
    ],
  };
}

function expand(
  state: HeroHoldTransitionState,
  input: HeroHoldTransitionInput,
  deltaMs: number,
  config: HeroTransitionConfig,
): HeroHoldTransitionState {
  const coverage = normalizeCoverage(
    state.coverage + deltaMs / config.timing.expandMs,
  );
  const radial = resolveHeroRadialGeometry(
    coverage,
    state.origin,
    input.viewport,
    config,
  );
  if (radial.coversViewport) {
    return {
      ...state,
      committedScheme: state.targetScheme,
      coverage: 1,
      phase: "awaiting-release",
      shakeActive: false,
    };
  }

  return {
    ...state,
    coverage,
    phase: "expanding",
    shakeActive: !input.reducedMotion,
  };
}

function sanitizeState(
  state: HeroHoldTransitionState,
): HeroHoldTransitionState {
  return {
    ...state,
    origin: normalizePoint(state.origin),
    coverage: normalizeCoverage(state.coverage),
  };
}

function resolveScheme(
  scheme: HeroSchemeName,
  config: HeroTransitionConfig,
): HeroResolvedScheme {
  const roles = config.schemes[scheme];
  return {
    background: config.colors[roles.background],
    foreground: config.colors[roles.foreground],
  };
}

function inverseScheme(scheme: HeroSchemeName): HeroSchemeName {
  switch (scheme) {
    case "initial":
      return "inverted";
    case "inverted":
      return "initial";
  }
}

function normalizePoint(point: HeroNormalizedPoint): HeroNormalizedPoint {
  return {
    x: clampFinite(point.x, 0, 1, 0.5),
    y: clampFinite(point.y, 0, 1, 0.5),
  };
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeCoverage(value: number): number {
  const clamped = clampFinite(value, 0, 1, 0);
  if (clamped <= 1e-9) {
    return 0;
  }
  if (clamped >= 1 - 1e-9) {
    return 1;
  }
  return Math.round(clamped * 1_000_000_000_000) / 1_000_000_000_000;
}

function clampFinite(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function zeroShake(): HeroShake {
  return { position: [0, 0, 0], rotation: [0, 0, 0] };
}
