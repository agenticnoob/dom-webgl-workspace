# Hero Next Hold-Driven Radial Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the uncommitted scroll-driven tetrahedron cover with a reversible hold-driven radial semantic-color transition that starts only from a real primary-pointer mesh hit, commits after approximately one second of geometric full coverage, retracts proportionally, resumes in place, and toggles `initial -> inverted -> initial`.

**Architecture:** Keep one `WebGLScrollRuntime`, its stable public progress store, Lenis, one managed canvas, and one transition state machine owned by the tetrahedron scene-object effect. `HeroScene` injects a stable minimal signal writer into that effect; the effect steps the pure hold state and publishes normalized signals, while the background effect independently reads those signals and resolves the aspect-correct radial shader uniforms. React never mirrors per-frame transition state, the two effects never reference one another, and all authored visuals stay inside public Viselora capabilities.

**Tech Stack:** TypeScript, React 19, Next.js App Router, `@viselora/dom-webgl` public scene-object/material/interaction APIs, `@viselora/scroll-adapters/react` progress store and `WebGLScrollRuntime`, Vitest, production-browser verification with the real workspace package runtime.

**Execution note (2026-07-17):** app implementation and automated gates pass;
desktop production interaction is browser-verified, while complete mobile and
reduced-motion browser acceptance remain pending. A later real-runtime audit
found that scene-native `WebGLMesh` effects receive no `ctx.object.material`.
Therefore this plan's injected-facade material/emissive tests prove adapter
intent only; production semantic material mutation remains a separately tracked
package capability gap.

## Global Constraints

- Work only in `apps/hero-next`, `docs/STATUS.md`, `docs/README.md`, and this active plan. Do not modify `packages/` or `docs/archive/`.
- Preserve the existing dirty worktree. Do not run `git reset`, `git checkout`, `git restore`, or overwrite whole files from `HEAD`; make focused patches against the current on-disk source.
- The only non-light authored colors remain `light: #B8B8B8` and `dark: #5F5F5F`; computed antialiasing/mixing is allowed, but no third authored color is allowed.
- Preserve the task-start key/rim/pointer-light implementation exactly. Current on-disk pointer-light Z is `0.8`; its two stale tests and active-doc claim of `1.1` are baseline inconsistencies to correct without changing runtime behavior.
- Preserve key light `#f2f2f2`, intensity `4.8`, position `[1.2, 1.2, 2]`; rim light `#b8b8b8`, intensity `2.2`, position `[1.8, -1.4, 2]`; pointer light `#f0f0f0`, active intensity `10`, reduced-motion intensity `0.45`, distance `1.8`, decay `3`, and base position `[0, 0.365, 0.8]`.
- Keep `WebGLScrollRuntime`, `heroSmoothScroll`, Lenis, GSAP, ScrollTrigger, and the ability to add future timelines. Remove only the current transition `WebGLScrollTimeline`, its pin/scrub declaration, `+=300%` range, and scroll-cover transform logic.
- The tetrahedron interaction declaration must be `pickable.hitTest: "mesh"` with `pointer.press: true`; only a primary pointer whose down event actually hit the mesh may start or resume expansion.
- Capture radial origin from the runtime pointer coordinates on the confirmed mesh-hit press frame. Do not project the tetrahedron separately or derive the origin from its visual center.
- Expansion rate is `1 / 1000 ms`; full-range retraction rate is `1 / 300 ms`; commit is a state-machine decision after resolved radius covers the farthest corner, not an independent timer callback.
- At commit, require release before another attempt. Holding continuously must never toggle repeatedly.
- Reduced motion disables shake and any additional fast transform, but retains hold timing, circle expansion/retraction, resume, release gate, and reversible semantic switching.
- CSS remains layout and pointer routing only. It must not draw the circle, color, mask, shake, opacity, or animation.
- Preserve one runtime and one canvas. Do not add a global theme store, DOM event bus, React context state, second transition state, second renderer, direct Three.js ownership, private imports, or effect-to-effect imports.
- Do not commit or push during this execution unless the user separately authorizes it.
- Protect `apps/hero-next/next-env.d.ts` as user-owned task-start state. Its required task-start SHA-256 is `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`, and its route import is `import "./.next/dev/types/routes.d.ts";`.

## File Responsibility Map

| File | Responsibility after implementation | Migration decision |
| --- | --- | --- |
| `apps/hero-next/src/heroTransitionConfig.ts` | Stable palette, scheme, signal keys/codes, timing, radial, shake, geometry, and ambient constants | Keep and refactor; remove scroll phase/cover/camera-traversal fields |
| `apps/hero-next/src/heroHoldTransition.ts` | Pure hold state machine, semantic resolver, radial geometry, farthest-corner coverage, deterministic shake envelope helpers | Create |
| `apps/hero-next/src/heroTransitionSignals.ts` | Minimal writer/reader dependency boundary and normalized progress-store encoding | Create |
| `apps/hero-next/src/HeroExperience.tsx` | Stable runtime plus internal `HeroScene`, public store hook, stable writer/effect declarations, mesh interaction | Keep and refactor; remove only transition timeline/pin/range |
| `apps/hero-next/src/heroEffect.ts` | Public mesh interaction adapter, pure state stepping, signal publication, semantic material and ambient/shake composition | Keep and refactor; remove scroll resolver/cover transforms |
| `apps/hero-next/src/heroGhostEffects.ts` | Read shared signals, resolve semantic/radial program inputs, preserve Ghost Cursor and pointer light | Keep and refactor; no gesture ownership |
| `apps/hero-next/src/heroGhostCursorProgram.ts` | Shader program and explicit base/target/radial uniforms; pixel-space circular mask | Keep and refactor |
| `apps/hero-next/src/heroTransition.ts` | Obsolete scroll-cover resolver | Delete only after all imports/tests have migrated |
| `apps/hero-next/src/heroScroll.ts` | Existing smooth-scroll stack | Keep byte-for-byte |
| `apps/hero-next/app/globals.css` | Fixed single-viewport hero layout and pointer routing | Revert only transition-specific auto-height/visible-overflow edits with a focused patch |
| `apps/hero-next/test/heroTransition.test.ts` | Obsolete scroll-cover resolver contract | Delete after new hold-state/radial tests are green |
| `apps/hero-next/test/heroTransitionConfig.test.ts` | Static hold/radial config contract | Keep and rewrite |
| `apps/hero-next/test/heroHoldTransition.test.ts` | State, timing, cancellation, resume, release gate, toggling, invalid input, radial geometry | Create |
| `apps/hero-next/test/heroTransitionSignals.test.ts` | Writer/reader encoding and semantic snapshots | Create |
| Existing Hero/Ghost/palette/style tests | Integration and regression contracts | Keep and update narrowly |
| `docs/superpowers/plans/2026-07-16-hero-next-two-tone-tetrahedron-cover.md` | Evidence of the superseded uncommitted implementation | Leave untouched and remove its active-doc link; do not archive or delete it in this task |

---

### Task 1: Lock the dirty-worktree baseline and refactor static configuration

**Files:**
- Modify: `apps/hero-next/src/heroTransitionConfig.ts`
- Modify: `apps/hero-next/test/heroTransitionConfig.test.ts`
- Modify: `apps/hero-next/test/heroGhostEffects.test.ts`

**Interfaces:**
- Produces: `HeroColorToken`, `HeroSchemeName`, `HeroTransitionPhase`, `HeroTransitionConfig`, and `heroTransitionConfig`.
- Invariant: all signal values fit the public progress store's `[0, 1]` range.
- Invariant: pointer-light source behavior remains at task-start Z `0.8`; only stale expectations are corrected.

- [ ] **Step 1: Record the current dirty baseline before editing**

Run:

```bash
git status --short --branch
git diff --stat
git diff -- packages
shasum -a 256 apps/hero-next/next-env.d.ts
npm test -- --run apps/hero-next/test
```

Expected: branch `codex/hero-next`, HEAD `5d2fd048`; the listed app/docs changes remain present; `git diff -- packages` is empty; `next-env.d.ts` SHA is `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`; the only baseline failures are the two stale `1.1` pointer-light assertions receiving `0.8`.

- [ ] **Step 2: Make the existing pointer-light characterization green without changing source behavior**

Change only the two stale expectations in `heroGhostEffects.test.ts`:

```ts
expect(
  resolveHeroPointerLightTarget({
    localX: 500,
    localY: 250,
    width: 1000,
    height: 500,
  }),
).toEqual([0, 0.365, 0.8]);

expect(state).toMatchObject({
  x: 0,
  y: 0.365,
  z: 0.8,
  intensity: 0.45,
});
```

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostEffects.test.ts
```

Expected: PASS; `apps/hero-next/src/heroGhostEffects.ts` is unchanged by this step.

- [ ] **Step 3: Rewrite the config test as the RED hold/radial contract**

Replace the scroll-phase/face-normal assertions with exact static values:

```ts
expect(heroTransitionConfig).toMatchObject({
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
    phase: { idle: 0, expanding: 1 / 3, retracting: 2 / 3, "awaiting-release": 1 },
  },
  colors: { light: "#B8B8B8", dark: "#5F5F5F" },
  schemes: {
    initial: { background: "light", foreground: "dark" },
    inverted: { background: "dark", foreground: "light" },
  },
  timing: {
    expandMs: 1000,
    retractMs: 300,
    maxFrameDeltaMs: 64,
  },
  radial: { overscan: 1.02, edgeFeatherPx: 1.5 },
  shake: {
    positionAmplitude: 0.008,
    rotationAmplitude: 0.018,
    frequenciesHz: [11, 13, 17],
  },
});
expect(new Set(Object.values(heroTransitionConfig.colors))).toEqual(
  new Set(["#B8B8B8", "#5F5F5F"]),
);
```

Run:

```bash
npm test -- --run apps/hero-next/test/heroTransitionConfig.test.ts
```

Expected: FAIL because the current config still exposes `progressKey`, scroll phases, cover scale, and camera traversal.

- [ ] **Step 4: Implement the immutable hold/radial config**

Use one cohesive object and preserve the still-valid palette, scheme, Ghost brightness, tetrahedron size, base pose, material, responsive scale, and ambient constants:

```ts
export type HeroColorToken = "light" | "dark";
export type HeroSchemeName = "initial" | "inverted";
export type HeroTransitionPhase =
  | "idle"
  | "expanding"
  | "retracting"
  | "awaiting-release";

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
  readonly schemes: Readonly<Record<HeroSchemeName, {
    readonly background: HeroColorToken;
    readonly foreground: HeroColorToken;
  }>>;
  readonly timing: {
    readonly expandMs: number;
    readonly retractMs: number;
    readonly maxFrameDeltaMs: number;
  };
  readonly radial: { readonly overscan: number; readonly edgeFeatherPx: number };
  readonly shake: {
    readonly positionAmplitude: number;
    readonly rotationAmplitude: number;
    readonly frequenciesHz: readonly [number, number, number];
  };
  readonly geometry: { readonly radius: number };
  readonly visual: { readonly ghostBrightness: number };
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
    phase: { idle: 0, expanding: 1 / 3, retracting: 2 / 3, "awaiting-release": 1 },
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
  visual: { ghostBrightness: 0.72 },
  motion: {
    baseScale: 1.12,
    mobileScaleFactor: 0.6,
    mobileBreakpoint: 700,
    desktopYOffset: 0.365,
    mobileYOffset: 0.555,
    baseRotation: [-0.6, 0.82, 0.08],
    reducedRotation: [-0.6, 0.85, 0.08],
    initialOpacity: 0.92,
    emissiveIntensity: 0.06,
  },
} as const satisfies HeroTransitionConfig;
```

- [ ] **Step 5: Run GREEN**

Run:

```bash
npm test -- --run apps/hero-next/test/heroTransitionConfig.test.ts apps/hero-next/test/heroGhostEffects.test.ts
```

Expected: config and pointer-light characterization tests PASS. Other files may not typecheck until later tasks migrate old config consumers.

### Task 2: Build the pure hold state machine and radial geometry

**Files:**
- Create: `apps/hero-next/src/heroHoldTransition.ts`
- Create: `apps/hero-next/test/heroHoldTransition.test.ts`

**Interfaces:**
- Produces: `HeroNormalizedPoint`, `HeroViewport`, `HeroHoldTransitionState`, `HeroHoldTransitionInput`, `HeroRadialGeometry`, `HeroTransitionVisualState`, `createHeroHoldTransitionState`, `stepHeroHoldTransition`, `resolveHeroRadialGeometry`, `resolveHeroTransitionVisual`, and `resolveHeroShake`.
- Consumes: static `HeroTransitionConfig`; imports no React, DOM, or Viselora module.

- [ ] **Step 1: Write RED idle, expansion, and geometric-commit tests**

Use a helper that advances in legal frame chunks so `maxFrameDeltaMs` remains meaningful:

```ts
function advance(
  state: HeroHoldTransitionState,
  totalMs: number,
  overrides: Partial<HeroHoldTransitionInput> = {},
) {
  let next = state;
  let remaining = totalMs;
  while (remaining > 0) {
    const deltaMs = Math.min(16, remaining);
    next = stepHeroHoldTransition(next, {
      meshPressed: true,
      primaryPointerDown: true,
      hitConfirmed: true,
      pointer: { x: 0.5, y: 0.5 },
      viewport: { width: 1200, height: 835 },
      deltaMs,
      reducedMotion: false,
      ...overrides,
    });
    remaining -= deltaMs;
  }
  return next;
}

const idle = createHeroHoldTransitionState("initial");
const at999 = advance(idle, 999);
expect(at999.phase).toBe("expanding");
expect(at999.coverage).toBeCloseTo(0.999, 6);
expect(at999.committedScheme).toBe("initial");

const complete = advance(at999, 1);
expect(complete).toMatchObject({
  phase: "awaiting-release",
  coverage: 1,
  committedScheme: "inverted",
  targetScheme: "inverted",
  shakeActive: false,
});
expect(resolveHeroRadialGeometry(
  complete.coverage,
  complete.origin,
  { width: 1200, height: 835 },
).coversViewport).toBe(true);
```

Also prove a synthetic `deltaMs: 1000` cannot act as a timer callback: it clamps to `64` and does not commit in one step.

- [ ] **Step 2: Write RED release, proportional retraction, resume, and cancel tests**

For starting coverages `0.25`, `0.5`, and `0.9`, release and advance by `coverage * 300 ms`; assert coverage reaches `0`, phase becomes `idle`, target resets to committed, and the tetrahedron visual returns to committed foreground. At `0.5`, assert `149 ms` still has positive coverage and `150 ms` cancels.

For resume:

```ts
const pressedInput = {
  meshPressed: true,
  primaryPointerDown: true,
  hitConfirmed: true,
  pointer: { x: 0.5, y: 0.5 },
  viewport: { width: 1200, height: 835 },
  deltaMs: 16,
  reducedMotion: false,
} satisfies HeroHoldTransitionInput;
const releasedInput = {
  ...pressedInput,
  meshPressed: false,
  primaryPointerDown: false,
  hitConfirmed: false,
} satisfies HeroHoldTransitionInput;
const expandedToHalf = advance(
  createHeroHoldTransitionState("initial"),
  500,
);
const retracting = stepHeroHoldTransition(expandedToHalf, releasedInput);
const partlyRetracted = stepHeroHoldTransition(retracting, {
  ...releasedInput,
  deltaMs: 60,
});
const resumed = stepHeroHoldTransition(partlyRetracted, {
  ...pressedInput,
  pointer: { x: 0.8, y: 0.2 },
  deltaMs: 16,
});
expect(resumed.phase).toBe("expanding");
expect(resumed.coverage).toBeGreaterThan(partlyRetracted.coverage);
expect(resumed.origin).toEqual(expandedToHalf.origin);
expect(resumed.targetScheme).toBe(expandedToHalf.targetScheme);
```

This locks the original hit origin and current radius across resume.

- [ ] **Step 3: Write RED release-gate and reversible-toggle tests**

Assert continued pressed frames after commit stay `awaiting-release`, keep one committed inversion, and never start a second attempt. Then pass `primaryPointerDown: false`, assert idle, start a new real mesh press, and advance to full coverage:

```ts
expect(firstCommit.committedScheme).toBe("inverted");
expect(heldAfterCommit.committedScheme).toBe("inverted");
expect(released.phase).toBe("idle");
expect(secondCommit.committedScheme).toBe("initial");
```

- [ ] **Step 4: Write RED invalid-input, radial, aspect, edge-origin, and reduced-motion tests**

Cover these exact cases:

```ts
for (const deltaMs of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
  expect(stepHeroHoldTransition(idle, { ...pressedInput, deltaMs }).coverage).toBe(0);
}
expect(stepHeroHoldTransition(idle, { ...pressedInput, deltaMs: 1000 }).coverage)
  .toBeCloseTo(0.064, 6);

for (const viewport of [
  { width: 1200, height: 835 },
  { width: 390, height: 844 },
]) {
  for (const origin of [
    { x: 0.5, y: 0.5 },
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.03, y: 0.97 },
  ]) {
    const radial = resolveHeroRadialGeometry(1, origin, viewport);
    expect(radial.radiusPx).toBeGreaterThan(radial.farthestCornerPx);
    expect(radial.coversViewport).toBe(true);
  }
}

const wide = resolveHeroRadialGeometry(0.5, { x: 0.5, y: 0.5 }, { width: 1600, height: 800 });
expect(wide.farthestCornerPx).toBeCloseTo(Math.hypot(800, 400), 6);
```

Pass `reducedMotion: true` and assert timing/commit remain identical while `shakeActive` and resolved shake offsets stay zero.

- [ ] **Step 5: Run RED**

Run:

```bash
npm test -- --run apps/hero-next/test/heroHoldTransition.test.ts
```

Expected: FAIL because `heroHoldTransition.ts` does not exist.

- [ ] **Step 6: Implement the pure types and state transitions**

Use immutable return values and an exhaustive phase switch:

```ts
export type HeroNormalizedPoint = { readonly x: number; readonly y: number };
export type HeroViewport = { readonly width: number; readonly height: number };

export type HeroHoldTransitionState = {
  readonly committedScheme: HeroSchemeName;
  readonly targetScheme: HeroSchemeName;
  readonly origin: HeroNormalizedPoint;
  readonly coverage: number;
  readonly phase: HeroTransitionPhase;
  readonly shakeActive: boolean;
};

export type HeroHoldTransitionInput = {
  readonly meshPressed: boolean;
  readonly primaryPointerDown: boolean;
  readonly hitConfirmed: boolean;
  readonly pointer: HeroNormalizedPoint;
  readonly viewport: HeroViewport;
  readonly deltaMs: number;
  readonly reducedMotion: boolean;
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
```

Implementation rules:

- Sanitize state coverage and pointer axes to `[0, 1]`; sanitize viewport dimensions to at least `1`.
- Sanitize non-finite/negative delta to `0` and cap a frame at `maxFrameDeltaMs`.
- A valid start/resume press is `meshPressed && primaryPointerDown && hitConfirmed` only when idle or when re-entering expansion from retraction. Once expansion has started, continuing forward motion requires `meshPressed && primaryPointerDown`; it does not require the runtime to repeat the initial hit payload on every frame.
- Idle valid press captures origin and inverse target, then expands by the current sanitized frame delta.
- Expanding with press lost switches immediately to retraction and does not add forward coverage.
- Expanding commit happens only after `resolveHeroRadialGeometry(nextCoverage, origin, viewport).coversViewport` is true; then commit target, set phase `awaiting-release`, coverage `1`, and shake false.
- Retracting subtracts `delta / retractMs`; a valid re-press preserves origin/target/current coverage and expands from there.
- Coverage reaching `0` returns idle with target equal to committed.
- Awaiting release ignores further held frames. Only `primaryPointerDown === false` returns idle; this prevents repeated toggles.

- [ ] **Step 7: Implement semantic, radial, and deterministic shake resolvers**

Use pixel-space geometry and smooth coverage:

```ts
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
  const safeCoverage = clampFinite(coverage, 0, 1, 0);
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
    coversViewport: safeCoverage >= 1 &&
      radiusPx >= farthestCornerPx + config.radial.edgeFeatherPx,
  };
}
```

`resolveHeroTransitionVisual` resolves base and target background/foreground from semantic tokens and uses target foreground for the tetrahedron whenever phase is not idle. `resolveHeroShake(timeMs, state, reducedMotion, config)` returns zero unless phase is `expanding`; otherwise multiply deterministic sine/cosine offsets by `sin(Math.PI * coverage)` and the configured position/rotation amplitudes. Never call `Math.random()` or schedule a timer.

- [ ] **Step 8: Run GREEN**

Run:

```bash
npm test -- --run apps/hero-next/test/heroHoldTransition.test.ts apps/hero-next/test/heroTransitionConfig.test.ts
```

Expected: PASS for all state, timing, geometry, invalid-input, toggle, and reduced-motion cases.

### Task 3: Add the progress-store dependency boundary

**Files:**
- Create: `apps/hero-next/src/heroTransitionSignals.ts`
- Create: `apps/hero-next/test/heroTransitionSignals.test.ts`

**Interfaces:**
- Produces: `HeroTransitionSignalWriter`, `HeroTransitionSignalReader`, `HeroTransitionSignalSnapshot`, `publishHeroTransitionSignals`, and `readHeroTransitionSignals`.
- Consumes: the config's stable keys/codes and pure state; owns no animation state.

- [ ] **Step 1: Write RED exact writer and reader tests**

```ts
const set = vi.fn();
publishHeroTransitionSignals({ set }, {
  committedScheme: "initial",
  targetScheme: "inverted",
  coverage: 0.5,
  origin: { x: 0.25, y: 0.75 },
  phase: "retracting",
});

expect(set.mock.calls).toEqual([
  [heroTransitionConfig.signalKeys.committedScheme, 0],
  [heroTransitionConfig.signalKeys.targetScheme, 1],
  [heroTransitionConfig.signalKeys.coverage, 0.5],
  [heroTransitionConfig.signalKeys.originX, 0.25],
  [heroTransitionConfig.signalKeys.originY, 0.75],
  [heroTransitionConfig.signalKeys.phase, 2 / 3],
]);
```

Use an explicit `Map` reader to round-trip every phase and both schemes:

```ts
const values = new Map<string, number>();
const reader = {
  get(key: string) {
    return values.get(key) ?? 0;
  },
} satisfies HeroTransitionSignalReader;
```

Feed NaN/out-of-range reader values and assert a safe initial idle snapshot with clamped axes/coverage.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- --run apps/hero-next/test/heroTransitionSignals.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal dependency boundary**

```ts
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
```

`publishHeroTransitionSignals` issues exactly six `set` calls. `readHeroTransitionSignals` clamps numeric fields and decodes scheme/phase by the closest configured code so the background effect depends only on the reader contract, not on the mesh effect.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npm test -- --run apps/hero-next/test/heroTransitionSignals.test.ts
```

Expected: PASS.

### Task 4: Rewire React around a stable `HeroScene` and real mesh press

**Files:**
- Modify: `apps/hero-next/src/HeroExperience.tsx`
- Modify: `apps/hero-next/app/globals.css`
- Modify: `apps/hero-next/test/HeroExperience.test.tsx`
- Modify: `apps/hero-next/test/assetsAndStyle.test.ts`

**Interfaces:**
- Consumes: public `useScrollEffectProgressStore()` and `HeroTransitionSignalWriter`.
- Produces: one stable `HeroScene` declaration tree, one stable injected writer, and `WebGLMesh` press interaction.

- [ ] **Step 1: Rewrite the render contract as RED**

Mock `useScrollEffectProgressStore` with one stable `{ set, reset, clear, source }` object. Remove the old timeline mock assertions and assert:

```ts
expect(html).toContain('data-runtime="hero-scroll"');
expect(html).not.toContain("data-timeline");
expect(html).not.toContain("+=300%");
expect(html).not.toContain("data-pin");
expect(html).toContain('data-hit-test="mesh"');
expect(html).toContain('data-press="true"');
expect(html).toContain('data-mesh-effect="hero.tetrahedron.motion"');
```

Keep the existing assertions for one scene, camera, render quality, material/PBR values, exact lights, Ghost target, and absence of text content.

- [ ] **Step 2: Add a RED stable-reference/no-React-frame-state test**

Use `createRoot` + `act` to render and rerender the same `HeroExperience`. Capture every `WebGLMesh` `effects` reference in the mock:

```ts
expect(capturedEffects).toHaveLength(2);
expect(capturedEffects[1]).toBe(capturedEffects[0]);
expect(capturedEffects[0]?.[0]?.signals).toBe(capturedWriter);

const rendersBeforeSignalWrite = meshRenderCount;
capturedWriter.set(heroTransitionConfig.signalKeys.coverage, 0.5);
expect(meshRenderCount).toBe(rendersBeforeSignalWrite);
```

This test must not introduce React state to simulate frames.

- [ ] **Step 3: Run RED**

Run:

```bash
npm test -- --run apps/hero-next/test/HeroExperience.test.tsx apps/hero-next/test/assetsAndStyle.test.ts
```

Expected: FAIL because the current tree still contains `WebGLScrollTimeline`, no store hook, no `HeroScene`, and no interaction declaration.

- [ ] **Step 4: Implement the stable `HeroScene` wiring**

Keep module constants for geometry/material/render/lights. Add only hook-owned dependencies inside the provider:

```tsx
function HeroScene() {
  const store = useScrollEffectProgressStore();
  const signalWriter = useMemo<HeroTransitionSignalWriter>(
    () => ({ set: (key, value) => store.set(key, value) }),
    [store],
  );
  const tetrahedronEffects = useMemo(
    () =>
      ([
        { kind: "hero.tetrahedron.motion", signals: signalWriter },
      ] satisfies NonNullable<WebGLMeshProps["effects"]>),
    [signalWriter],
  );

  return (
    <main className="hero-space" aria-label="Tetrahedron visual study">
      <WebGLScene
        id="hero.tetrahedron.scene"
        projection="perspective-stage"
        render={renderOptions}
      >
        <WebGLCamera
          id="hero.tetrahedron.camera"
          default
          type="perspective"
          mode="perspective-stage"
          fov={38}
          near={0.1}
          far={50}
          position={cameraPosition}
          target={cameraTarget}
        />
        <WebGLTarget
          as="div"
          className="hero-ghost-surface hero-ghost-surface--background"
          aria-hidden="true"
          webgl={ghostBackgroundDeclaration}
        />
        <WebGLMesh
          id="hero.tetrahedron.mesh"
          geometry={tetrahedronGeometry}
          material={tetrahedronMaterial}
          effects={tetrahedronEffects}
          interaction={tetrahedronInteraction}
        />
        {/* <WebGLLight
          id="hero.tetrahedron.fill"
          kind="ambient"
          color="#d8d8d8"
          intensity={0.22}
        /> */}
        <WebGLLight
          id="hero.tetrahedron.key"
          kind="directional"
          color="#f2f2f2"
          intensity={4.8}
          position={keyLightPosition}
          target={lightTarget}
        />
        <WebGLLight
          id="hero.tetrahedron.rim"
          kind="directional"
          color="#b8b8b8"
          intensity={2.2}
          position={rimLightPosition}
          target={lightTarget}
        />
      </WebGLScene>
    </main>
  );
}

export function HeroExperience() {
  return (
    <WebGLScrollRuntime
      className="hero-runtime"
      effects={heroEffects}
      renderQuality={heroRenderQuality}
      smooth={heroSmoothScroll}
    >
      <HeroScene />
    </WebGLScrollRuntime>
  );
}
```

Keep the existing commented ambient declaration byte-for-byte in its current location. Define the stable interaction at module scope:

```ts
const tetrahedronInteraction = {
  pickable: {
    hitTest: "mesh",
    pointer: { press: true },
  },
} satisfies NonNullable<WebGLMeshProps["interaction"]>;
```

- [ ] **Step 5: Remove only transition-specific CSS scroll space**

Apply a focused patch to restore the single viewport layout:

```css
.hero-runtime {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100svh;
  min-height: 100svh;
  overflow: hidden;
}
```

Keep fixed canvas/surface sizing and pointer routing unchanged. Update `assetsAndStyle.test.ts` to expect `height: 100svh` and `overflow: hidden`; retain all forbidden visual-property scans.

- [ ] **Step 6: Run GREEN**

Run:

```bash
npm test -- --run apps/hero-next/test/HeroExperience.test.tsx apps/hero-next/test/assetsAndStyle.test.ts
```

Expected: PASS; the runtime remains, the obsolete timeline/pin/300% range is absent, interaction is exact, and writer/effect references remain stable.

### Task 5: Adapt the tetrahedron effect to press state, signals, material, and motion

**Files:**
- Modify: `apps/hero-next/src/heroEffect.ts`
- Modify: `apps/hero-next/test/heroEffect.test.ts`

**Interfaces:**
- Consumes: `ctx.objectPointer`, primary global pointer state, `ctx.input.layout.viewport`, injected `HeroTransitionSignalWriter`, and pure state/resolvers.
- Produces: the sole live transition state, six progress signals per frame, semantic material/emissive, and deterministic ambient/shake transforms.

- [ ] **Step 1: Replace old scroll-transform tests with RED interaction-adapter tests**

Change effect params/state to:

```ts
type HeroEffectParams = {
  kind: "hero.tetrahedron.motion";
  signals: HeroTransitionSignalWriter;
};

export type HeroEffectState = {
  readonly reducedMotion: boolean;
  readonly motion: HeroMotionState;
  transition: HeroHoldTransitionState;
};
```

Build a context fixture whose first frame has:

```ts
pointer: {
  isDown: true,
  button: "primary",
  buttons: ["primary"],
  normalizedX: 0.4,
  normalizedY: -0.2,
},
objectPointer: {
  isPressed: true,
  hit: { point: [0, 0, 0], distance: 2 },
},
input: { layout: { viewport: { width: 1200, height: 835 } } },
```

After update, assert phase `expanding`, origin `{ x: 0.7, y: 0.4 }`, and writer calls. Secondary button, pointer-down without `objectPointer.hit`, and global down without `objectPointer.isPressed` must remain idle.

- [ ] **Step 2: Add RED material and motion-composition tests**

Assert:

- idle initial uses dark foreground; idle inverted uses light foreground;
- expansion immediately uses target foreground for `material.color` and `material.emissive`;
- retraction keeps target foreground until cancellation reaches zero;
- cancellation restores committed foreground;
- ambient weight is `1` at idle, fades with expanding/retracting coverage, and returns to `1` immediately at commit;
- shake exists only while non-reduced expansion is active and is deterministic for the same `time`/coverage;
- release/retraction/commit/reduced motion have zero shake;
- existing 6-second breathing, 8-second `±0.018` float, damped pointer tilt, responsive base scale/Y offset, opacity `0.92`, material PBR values, and no time-driven base rotation remain intact.

- [ ] **Step 3: Run RED**

Run:

```bash
npm test -- --run apps/hero-next/test/heroEffect.test.ts
```

Expected: FAIL because the effect still reads scroll progress and applies cover transforms.

- [ ] **Step 4: Implement the public interaction adapter**

In `setup`, create one motion state and one pure transition state. In `update`, derive only adapter inputs:

```ts
const primaryPointerDown =
  ctx.pointer.isDown &&
  (ctx.pointer.button === "primary" || ctx.pointer.buttons.includes("primary"));
const pointer = {
  x: clamp((ctx.pointer.normalizedX + 1) * 0.5, 0, 1),
  y: clamp((ctx.pointer.normalizedY + 1) * 0.5, 0, 1),
};

state.transition = stepHeroHoldTransition(state.transition, {
  meshPressed: ctx.objectPointer.isPressed,
  primaryPointerDown,
  hitConfirmed: ctx.objectPointer.hit !== undefined,
  pointer,
  viewport: ctx.input.layout.viewport,
  deltaMs: ctx.delta,
  reducedMotion: state.reducedMotion,
});

publishHeroTransitionSignals(params.signals, state.transition);
```

The `objectPointer.hit` check is the proof that the origin came from a real mesh hit; the normalized global pointer from that same frame is already the screen-space hit coordinate and avoids a second projection system.

- [ ] **Step 5: Implement semantic material and deterministic transform composition**

Resolve semantic colors from `state.transition`. Apply:

```ts
const activeAttempt =
  transition.phase === "expanding" || transition.phase === "retracting";
const ambientWeight = state.reducedMotion
  ? 0
  : activeAttempt
    ? 1 - smoothstep(transition.coverage)
    : 1;
const shake = resolveHeroShake(time, transition, state.reducedMotion);
```

Compose base pose + responsive Y + ambient float + shake position, base/reduced rotation + weighted pointer tilt + shake rotation, and base scale + weighted breathing. Set `visible=true` and preserve `opacity=initialOpacity`; there is no Z approach/cover/exit. Update material color and emissive to `visual.tetrahedronForeground` with configured emissive intensity. Do not touch lights.

- [ ] **Step 6: Run GREEN**

Run:

```bash
npm test -- --run apps/hero-next/test/heroEffect.test.ts apps/hero-next/test/heroHoldTransition.test.ts apps/hero-next/test/heroTransitionSignals.test.ts
```

Expected: PASS.

### Task 6: Render the aspect-correct radial semantic mask in the Ghost shader

**Files:**
- Modify: `apps/hero-next/src/heroGhostEffects.ts`
- Modify: `apps/hero-next/src/heroGhostCursorProgram.ts`
- Modify: `apps/hero-next/test/heroGhostEffects.test.ts`
- Modify: `apps/hero-next/test/heroGhostCursorProgram.test.ts`

**Interfaces:**
- Consumes: `ctx.progress` through `readHeroTransitionSignals`, pure semantic resolver, and pure radial geometry.
- Produces: explicit base/target palette and radial uniforms; owns no gesture/state-machine state.

- [ ] **Step 1: Write RED signal-consumer tests**

Replace the old progress-number color adapter with a reader fixture whose values are populated through `publishHeroTransitionSignals`:

```ts
const values = new Map<string, number>();
const writer = {
  set(key: string, value: number) {
    values.set(key, value);
  },
} satisfies HeroTransitionSignalWriter;
const reader = {
  get(key: string) {
    return values.get(key) ?? 0;
  },
} satisfies HeroTransitionSignalReader;
resolveHeroGhostProgramState(reader, { width: 1200, height: 835 })
```

Assert initial idle maps both base and target to initial colors with radius zero. Publish an expanding 50% snapshot and assert base initial, target inverted, preserved origin, positive radius, and no state mutation. Publish retracting and assert the same target remains. Publish cancelled idle and assert base/target both return to committed. Publish committed awaiting-release and assert base/target both equal the new committed scheme, eliminating a full-cover jump.

- [ ] **Step 2: Write RED uniform and shader-source tests**

The program options and uniforms become:

```ts
expect(uniforms).toMatchObject({
  iBaseBackgroundColor: [184 / 255, 184 / 255, 184 / 255],
  iBaseForegroundColor: [95 / 255, 95 / 255, 95 / 255],
  iTargetBackgroundColor: [95 / 255, 95 / 255, 95 / 255],
  iTargetForegroundColor: [184 / 255, 184 / 255, 184 / 255],
  iRadialOrigin: [0.25, 0.75],
  iRadialRadiusPx: expect.any(Number),
  iRadialEdgePx: 1.5,
});
```

Assert shader source contains pixel-space distance:

```ts
expect(program.fragmentShader).toContain("vec2 radialPointPx = vUv * iResolution.xy");
expect(program.fragmentShader).toContain("length(radialPointPx - radialOriginPx)");
expect(program.fragmentShader).toContain("smoothstep(");
expect(program.fragmentShader).toContain("mix(iBaseBackgroundColor, iTargetBackgroundColor, radialMask)");
expect(program.fragmentShader).toContain("mix(iBaseForegroundColor, iTargetForegroundColor, radialMask)");
```

Reject the old two-uniform scroll scheme and any palette literal in GLSL.

- [ ] **Step 3: Run RED**

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostEffects.test.ts apps/hero-next/test/heroGhostCursorProgram.test.ts
```

Expected: FAIL because the background still reads one scroll progress key and the shader has only one background/foreground pair.

- [ ] **Step 4: Implement the pure background adapter**

```ts
export function resolveHeroGhostProgramState(
  reader: HeroTransitionSignalReader,
  viewport: HeroViewport,
) {
  const snapshot = readHeroTransitionSignals(reader);
  const visual = resolveHeroTransitionVisual(snapshot);
  const radial = resolveHeroRadialGeometry(
    snapshot.coverage,
    snapshot.origin,
    viewport,
  );
  return {
    baseBackgroundColor: visual.committed.background,
    baseForegroundColor: visual.committed.foreground,
    targetBackgroundColor: visual.target.background,
    targetForegroundColor: visual.target.foreground,
    radialOrigin: [radial.origin.x, radial.origin.y] as const,
    radialRadiusPx: radial.radiusPx,
    radialEdgePx: radial.edgeFeatherPx,
  };
}
```

Call it with `ctx.progress` and `ctx.layout.viewport`. Keep Ghost pointer/trail motion, overscan, surface visibility, point-light setup/update/dispose, and every light value unchanged.

- [ ] **Step 5: Implement the exact circular shader mask**

Extend program options with four colors, origin, radius, and feather. In GLSL use viewport pixels, which makes distance circular on both wide and tall viewports without compensating with a second projection:

```glsl
vec2 radialPointPx = vUv * iResolution.xy;
vec2 radialOriginPx = iRadialOrigin * iResolution.xy;
float radialDistancePx = length(radialPointPx - radialOriginPx);
float radialMask = 1.0 - smoothstep(
  iRadialRadiusPx - iRadialEdgePx,
  iRadialRadiusPx + iRadialEdgePx,
  radialDistancePx
);
vec3 radialBackground = mix(
  iBaseBackgroundColor,
  iTargetBackgroundColor,
  radialMask
);
vec3 radialForeground = mix(
  iBaseForegroundColor,
  iTargetForegroundColor,
  radialMask
);
```

Pass `radialForeground` into every Ghost blob sample and mix the opaque background from `radialBackground` toward its fog tint. The only `smoothstep` applied to the transition boundary is the configured narrow feather; no broad color crossfade is added.

- [ ] **Step 6: Run GREEN**

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostCursorProgram.test.ts apps/hero-next/test/heroGhostEffects.test.ts apps/hero-next/test/heroHoldTransition.test.ts
```

Expected: PASS; desktop/mobile/edge coverage is pure-tested, shader distance is pixel-aspect-correct, and all light tests remain green.

### Task 7: Remove obsolete scroll-cover code and strengthen cross-module guards

**Files:**
- Delete: `apps/hero-next/src/heroTransition.ts`
- Delete: `apps/hero-next/test/heroTransition.test.ts`
- Modify: `apps/hero-next/test/heroPaletteBoundary.test.ts`
- Modify: `apps/hero-next/test/HeroExperience.test.tsx`
- Modify: `apps/hero-next/test/assetsAndStyle.test.ts`

**Interfaces:**
- Verifies: one state machine, one signal family, no old scroll-cover artifacts, no third authored color, stable runtime, unchanged lights, layout-only CSS, and zero package changes.

- [ ] **Step 1: Add RED source-boundary assertions before deleting old code**

```ts
expect(sources).not.toMatch(
  /hero\.transition\.tetrahedron-cover|orientEnd|approachEnd|coverEnd|backgroundSwapPoint|foregroundResetPoint|exitPositionZ|coverPositionZ/,
);
expect(sources).not.toMatch(
  /WebGLScrollTimeline|transitionStart|transitionEnd|\+=300%/,
);
expect(sources).toContain("useScrollEffectProgressStore");
expect(sources).toContain('hitTest: "mesh"');
expect(sources).toContain("press: true");
expect(sources).not.toMatch(
  /themeStore|eventBus|dispatchEvent|addEventListener\(["']hero/i,
);
```

Keep the hex inventory exact: config owns only `#B8B8B8`/`#5F5F5F`; explicit light declarations own only the three task-start light literals, including the commented ambient example already present.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- --run apps/hero-next/test/heroPaletteBoundary.test.ts apps/hero-next/test/HeroExperience.test.tsx apps/hero-next/test/assetsAndStyle.test.ts
```

Expected: FAIL while `heroTransition.ts`, its test, or any old identifiers remain.

- [ ] **Step 3: Delete only the superseded resolver and resolver test**

Use a focused patch to remove `heroTransition.ts` and `heroTransition.test.ts` after confirming with `rg` that no imports remain. Do not delete or restore any other untracked file. Leave the old plan file untouched as evidence and do not move it into archive.

- [ ] **Step 4: Run the complete app suite**

Run:

```bash
npm test -- --run apps/hero-next/test
```

Expected: all app tests PASS, including idle/expanding/retracting/awaiting-release, 999 ms, geometric commit, proportional retract, resume, cancellation, release gate, repeated-hold protection, reversible toggle, invalid input, radial geometry, reduced motion, semantic consumers, stable React references, runtime retention, interaction declaration, lights, palette, and CSS.

- [ ] **Step 5: Audit the migration diff without discarding user work**

Run:

```bash
git status --short
git diff -- apps/hero-next/src apps/hero-next/test apps/hero-next/app/globals.css
git diff -- packages
git ls-files --others --exclude-standard
```

Expected: `packages` diff is empty; the worktree is still dirty; old scroll resolver/test are gone; new hold/signal modules and tests are present; unrelated task-start files remain preserved.

### Task 8: Align active documentation with hold-radial truth

**Files:**
- Modify: `apps/hero-next/AGENTS.md`
- Modify: `apps/hero-next/VISUAL_DESIGN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/README.md`

**Interfaces:**
- Documents: implemented behavior, automated verification, browser verification, current light truth, stable architecture, and superseded active links without rewriting history.

- [ ] **Step 1: Update app execution truth**

Replace the scroll-cover implementation paragraphs in `apps/hero-next/AGENTS.md` with:

- stable `WebGLScrollRuntime` + `HeroScene` + `useScrollEffectProgressStore` writer injection;
- real mesh hit/press requirement and primary-pointer origin capture;
- pure hold phases, `1000 ms` expansion, `300 ms` full retract, resume, geometric commit, and release gate;
- radial shader and semantic material/emissive synchronization;
- ambient/shake composition and reduced-motion behavior;
- exact pointer-light task-start Z `0.8`, correcting the stale `1.1` claim while leaving behavior unchanged.

- [ ] **Step 2: Rewrite `VISUAL_DESIGN.md` from scroll-cover to hold-radial**

Keep the two-token/semantic-role/PBR explanation, replace geometry-cover scrolling with the confirmed radial interaction, and document the actual final config values from source. Separate status into:

```md
- **Implemented:** source behavior that exists.
- **Automated-verified:** exact commands and contracts that passed.
- **Browser-verified:** only observations actually made in Task 9.
```

If browser QA has not yet run, state `Browser verification pending` rather than retaining the old scroll-cover browser claims.

- [ ] **Step 3: Replace stale repo status and index entries**

In `docs/STATUS.md`, replace only the hero scroll-cover truth with hold-radial implementation/verification truth; preserve package/release/roadmap sections. In `docs/README.md`:

- describe the hold-driven radial toggle instead of the scroll geometry cover;
- link the approved hold-radial spec and this plan;
- remove the old two-tone scroll-cover plan from the active consumer list without deleting that file;
- keep the existing earlier Ghost/WebGLMesh design references that remain valid.

- [ ] **Step 4: Check active docs/source consistency**

Run:

```bash
rg -n "tetrahedron-cover|WebGLScrollTimeline|\+=300%|orientEnd|approachEnd|coverEnd|backgroundSwapPoint|foregroundResetPoint|Z=1\.1|geometry-cover scroll" \
  apps/hero-next/AGENTS.md apps/hero-next/VISUAL_DESIGN.md apps/hero-next/src apps/hero-next/test docs/STATUS.md docs/README.md
rg -n "hold|radial|1000|300|awaiting-release|hitTest|useScrollEffectProgressStore" \
  apps/hero-next/AGENTS.md apps/hero-next/VISUAL_DESIGN.md apps/hero-next/src apps/hero-next/test docs/STATUS.md docs/README.md
```

Expected: the first search finds no active scroll-transition truth; the second finds the new source/tests/docs contracts. Historical files outside this search remain untouched.

### Task 9: Automated verification, protected-file restoration, and real-browser acceptance

**Files:**
- Protected generated side effect: `apps/hero-next/next-env.d.ts`
- Browser evidence: temporary screenshots/logs outside tracked product files

**Interfaces:**
- Proves automated and browser outcomes separately; performs no commit or push.

- [ ] **Step 1: Record the protected file immediately before build**

Run:

```bash
shasum -a 256 apps/hero-next/next-env.d.ts
sed -n '1,8p' apps/hero-next/next-env.d.ts
git diff -- apps/hero-next/next-env.d.ts
```

Expected SHA: `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc` and import `./.next/dev/types/routes.d.ts`.

- [ ] **Step 2: Run required automated verification in order**

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

Expected: every command exits `0`. Report this as automated verification only.

- [ ] **Step 3: Restore build churn to the task-start `next-env.d.ts` content**

If build rewrites the file, use a focused patch—not checkout/restore—to return it to exactly:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/dev/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

Then run:

```bash
shasum -a 256 apps/hero-next/next-env.d.ts
git diff -- apps/hero-next/next-env.d.ts
```

Expected: SHA returns to `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`; its existing user diff against HEAD remains the same task-start diff, not an empty diff and not the HEAD version.

- [ ] **Step 4: Run desktop production-browser verification**

At a desktop viewport such as `1200x835`, use the real production build and installed workspace package runtime. Verify interactively:

- pointer down outside the tetrahedron does nothing;
- secondary pointer down on the tetrahedron does nothing;
- primary mesh hit begins at the visible contact point;
- uninterrupted hold takes approximately one second and the circle covers the farthest corner before commit;
- early release at approximately 25%, 50%, and 90% retracts proportionally;
- re-press during retraction resumes from current radius/origin;
- commit has no background/Ghost/material/emissive color jump;
- continued hold after commit cannot toggle again;
- release then second hold performs `inverted -> initial`;
- shake stops on release/lost press/commit and ambient motion returns after commit;
- one canvas exists and console has 0 errors / 0 warnings.

- [ ] **Step 5: Run mobile and reduced-motion production-browser verification**

At a mobile viewport such as `390x844`, verify touch/primary-pointer hit origin, corner coverage, early release, resume, release gate, and reverse toggle. Enable `prefers-reduced-motion: reduce` and verify no shake/extra rapid transform while the one-second hold, circle, retract, resume, material/emissive sync, and reversible scheme still work. Confirm the circle remains circular rather than elliptical in both aspect ratios.

- [ ] **Step 6: Final scope and worktree audit**

Run:

```bash
git status --short --branch
git diff --stat
git diff -- apps/hero-next docs/STATUS.md docs/README.md
git diff -- packages
git diff --check
git ls-files --others --exclude-standard
```

Expected: branch/HEAD are unchanged unless the user separately directed otherwise; worktree remains dirty; no package/archive changes; no unexpected generated files; `next-env.d.ts` retains task-start content; old untracked plan/spec evidence is not silently discarded; no commit and no push occurred.

## Self-Review Record

- Spec coverage: every confirmed state (`idle`, `expanding`, `retracting`, `awaiting-release`), timing boundary, geometric commit, proportional retract, resume, cancellation, release gate, repeated-hold protection, reversible toggle, invalid input, radial geometry, semantic synchronization, reduced motion, React stability, runtime retention, mesh interaction, light/palette boundary, docs, build protection, and browser gate maps to an explicit task/test.
- Migration safety: the plan never resets/checks out a file, preserves the dirty worktree and old plan evidence, keeps valid palette/uniform/test foundations, deletes only the two obsolete scroll-resolver artifacts after consumers migrate, and requires repeated package/scope audits.
- Type consistency: `HeroTransitionPhase`, `HeroHoldTransitionState`, signal snapshot, config keys/codes, effect params, writer/reader contracts, radial geometry, and program option names are introduced once and consumed with the same names in later tasks.
- Placeholder scan: code-changing steps include exact interfaces, values, snippets, commands, and expected RED/GREEN outcomes; there are no unresolved placeholders or tuning decisions.
- Verification truth: automated success is never presented as browser visual acceptance; browser observations are recorded only after real production-runtime checks.
- Execution stop: this document is the only artifact created by the planning turn. Implementation, staging, commit, push, and PR creation are outside this turn.
