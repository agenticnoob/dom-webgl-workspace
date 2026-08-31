export type HeroColorToken = "light" | "dark";
export type HeroSchemeName = "initial" | "inverted";
export type HeroTransitionPhase =
  "idle" | "expanding" | "retracting" | "awaiting-release";

type HeroScheme = {
  readonly background: HeroColorToken;
  readonly foreground: HeroColorToken;
};

export type HeroTransitionConfig = {
  readonly signalKeys: {
    readonly committedScheme: string;
    readonly targetScheme: string;
    readonly coverage: string;
    readonly originX: string;
    readonly originY: string;
    readonly phase: string;
  };
  readonly signalCodes: {
    readonly scheme: Readonly<Record<HeroSchemeName, number>>;
    readonly phase: Readonly<Record<HeroTransitionPhase, number>>;
  };
  readonly colors: Readonly<Record<HeroColorToken, string>>;
  readonly schemes: Readonly<Record<HeroSchemeName, HeroScheme>>;
  readonly timing: {
    readonly expandMs: number;
    readonly retractMs: number;
    readonly maxFrameDeltaMs: number;
  };
  readonly radial: {
    readonly overscan: number;
    readonly edgeFeatherPx: number;
  };
  readonly shake: {
    readonly positionAmplitude: number;
    readonly rotationAmplitude: number;
    readonly frequenciesHz: readonly [number, number, number];
  };
  readonly geometry: { readonly radius: number };
  readonly chapterScroll: {
    readonly entry: {
      readonly introHandoffEnd: number;
      readonly orientEnd: number;
      readonly lockEnd: number;
    };
    readonly exit: {
      readonly contractEnd: number;
      readonly retreatEnd: number;
    };
  };
  readonly portal: {
    readonly handoffYaw: number;
    readonly pointerYaw: number;
    readonly pointerPitch: number;
    readonly pointerDampingMs: number;
  };
  readonly chapterGeometry: {
    readonly cameraDistance: number;
    readonly cameraFov: number;
    readonly cameraTargetY: number;
    readonly lockTriangleWidthFraction: number;
    readonly lockTriangleMaxHeightFraction: number;
    readonly revealOverscan: number;
    readonly approachArcX: number;
    readonly approachArcY: number;
    readonly approachPullback: number;
    readonly approachBank: number;
  };
  readonly visual: {
    readonly ghostBrightness: number;
    readonly facePaletteStrength: number;
    readonly fresnelStrength: number;
    readonly fresnelPower: number;
    readonly metalness: number;
    readonly roughness: number;
    readonly keyLightIntensity: number;
    readonly rimLightIntensity: number;
  };
  readonly motion: {
    readonly baseScale: number;
    readonly mobileScaleFactor: number;
    readonly mobileBreakpoint: number;
    readonly desktopYOffset: number;
    readonly mobileYOffset: number;
    readonly baseRotation: readonly [number, number, number];
    readonly reducedRotation: readonly [number, number, number];
    readonly initialOpacity: number;
    readonly emissiveIntensity: number;
    readonly breathingScaleAmplitude: number;
    readonly floatingAmplitude: number;
    readonly pointerPitch: number;
    readonly pointerYaw: number;
    readonly pointerDampingMs: number;
    readonly transitionAmbientFactor: number;
    readonly transitionPointerFactor: number;
  };
};

export const heroTransitionConfig = {
  signalKeys: {
    committedScheme: "hero.transition.hold.committed-scheme",
    targetScheme: "hero.transition.hold.target-scheme",
    coverage: "hero.transition.hold.coverage",
    originX: "hero.transition.hold.origin-x",
    originY: "hero.transition.hold.origin-y",
    phase: "hero.transition.hold.phase",
  },
  signalCodes: {
    scheme: { initial: 0, inverted: 1 },
    phase: {
      idle: 0,
      expanding: 1 / 3,
      retracting: 2 / 3,
      "awaiting-release": 1,
    },
  },
  colors: { light: "#B8B8B8", dark: "#5F5F5F" },
  schemes: {
    initial: { background: "light", foreground: "dark" },
    inverted: { background: "dark", foreground: "light" },
  },
  timing: { expandMs: 1000, retractMs: 300, maxFrameDeltaMs: 64 },
  radial: { overscan: 1.02, edgeFeatherPx: 1.5 },
  shake: {
    positionAmplitude: 0.008,
    rotationAmplitude: 0.018,
    frequenciesHz: [11, 13, 17],
  },
  geometry: { radius: 0.52 },
  chapterScroll: {
    entry: { introHandoffEnd: 0.28, orientEnd: 0.26, lockEnd: 0.62 },
    exit: { contractEnd: 0.38, retreatEnd: 0.74 },
  },
  portal: {
    handoffYaw: 0.42,
    pointerYaw: 0.065,
    pointerPitch: 0.045,
    pointerDampingMs: 140,
  },
  chapterGeometry: {
    cameraDistance: 3.2,
    cameraFov: 38,
    cameraTargetY: 0.32,
    lockTriangleWidthFraction: 1,
    lockTriangleMaxHeightFraction: 1,
    revealOverscan: 1.035,
    approachArcX: 0.34,
    approachArcY: 0.16,
    approachPullback: 0.18,
    approachBank: 0.14,
  },
  visual: {
    ghostBrightness: 0.72,
    facePaletteStrength: 0.45,
    fresnelStrength: 0.22,
    fresnelPower: 3.2,
    metalness: 0.62,
    roughness: 0.28,
    keyLightIntensity: 5.4,
    rimLightIntensity: 1.35,
  },
  motion: {
    baseScale: 1.12,
    mobileScaleFactor: 0.72,
    mobileBreakpoint: 700,
    desktopYOffset: 0.365,
    mobileYOffset: 0.555,
    baseRotation: [-0.6, 0.82, 0.08],
    reducedRotation: [-0.6, 0.85, 0.08],
    initialOpacity: 0.92,
    emissiveIntensity: 0.035,
    breathingScaleAmplitude: 0.012,
    floatingAmplitude: 0.018,
    pointerPitch: 0.14,
    pointerYaw: 0.18,
    pointerDampingMs: 130,
    transitionAmbientFactor: 0.55,
    transitionPointerFactor: 0.72,
  },
} as const satisfies HeroTransitionConfig;
