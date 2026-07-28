# Hero Next Two-Tone Tetrahedron Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the confirmed `light`/`dark` semantic palette and a deterministic, reversible tetrahedron geometry-cover scroll transition in `apps/hero-next`.

**Architecture:** A stable app-owned config defines the only two non-light author colors, scheme roles, progress key, phase boundaries, and motion constants. A pure `resolveHeroTransition(progress, viewport, config)` function is the sole source of transition state; the background and tetrahedron effects independently read the same public progress signal and consume the resolver result without referencing one another or introducing mutable theme state. `HeroExperience` owns the stable declarations and pinned `WebGLScrollTimeline`, while the shader only accepts resolved background/foreground uniforms.

**Tech Stack:** TypeScript, React 19, Next.js App Router, `@viselora/dom-webgl` public effects and managed material facade, `@viselora/scroll-adapters/react` `WebGLScrollTimeline`, Vitest, Playwright/Chromium browser QA against the production build.

## Global Constraints

- Work only in `apps/hero-next` and active documentation; do not modify `packages/` or historical archive documents.
- CSS is layout/size/scroll-space only; no CSS colors, backgrounds, opacity, transforms, masks, clipping artwork, or animation.
- The only non-light author input colors are `light: #B8B8B8` and `dark: #5F5F5F`.
- Initial scheme is `background=light`, `foreground=dark`; inverted scheme is `background=dark`, `foreground=light`.
- Keep key, rim, and pointer light colors, intensities, positions, distance, and decay unchanged.
- Use `progressKey: "hero.transition.tetrahedron-cover"` through `WebGLScrollTimeline` and `ctx.progress.get(config.progressKey)`.
- Missing, non-finite, or out-of-range progress must resolve safely and deterministically to a clamped state; missing progress is initial state.
- Background scheme changes only after full geometric cover; tetrahedron stays dark while occluding and becomes light only after it is invisible.
- Reverse scrolling uses the same resolver and therefore strictly reverses the phase order.
- Reduced motion avoids large rotation, fast Z approach, and camera crossing, but still reaches a synchronized inverted background/foreground scheme through low-motion opacity/role transition.
- Preserve `apps/hero-next/next-env.d.ts` byte-for-byte from its task-start SHA-256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651` after builds.
- Do not commit or push implementation unless the user explicitly asks.

---

### Task 1: Static palette and transition configuration

**Files:**
- Create: `apps/hero-next/src/heroTransitionConfig.ts`
- Create: `apps/hero-next/test/heroTransitionConfig.test.ts`

**Interfaces:**
- Produces: `HeroColorToken`, `HeroSchemeName`, `HeroTransitionConfig`, `heroTransitionConfig`, and semantic helpers used by every later task.
- Invariant: no effect or declaration owns a non-light hex value outside this config.

- [ ] **Step 1: Write the failing config contract test**

```ts
import { describe, expect, test } from "vitest";
import { heroTransitionConfig } from "../src/heroTransitionConfig";

test("defines the confirmed two-token semantic palette", () => {
  expect(heroTransitionConfig).toMatchObject({
    progressKey: "hero.transition.tetrahedron-cover",
    colors: { light: "#B8B8B8", dark: "#5F5F5F" },
    schemes: {
      initial: { background: "light", foreground: "dark" },
      inverted: { background: "dark", foreground: "light" },
    },
    phases: {
      orientEnd: 0.32,
      approachEnd: 0.68,
      coverEnd: 0.78,
      backgroundSwapPoint: 0.8,
      foregroundResetPoint: 0.94,
      exitEnd: 1,
    },
    motion: { coverOverscan: 1.08, coverOpacity: 1, easing: "smoothstep" },
  });
  expect(new Set(Object.values(heroTransitionConfig.colors))).toEqual(
    new Set(["#B8B8B8", "#5F5F5F"]),
  );
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run apps/hero-next/test/heroTransitionConfig.test.ts`

Expected: FAIL because `heroTransitionConfig.ts` does not exist.

- [ ] **Step 3: Implement the immutable config**

```ts
export const heroTransitionConfig = {
  progressKey: "hero.transition.tetrahedron-cover",
  colors: { light: "#B8B8B8", dark: "#5F5F5F" },
  schemes: {
    initial: { background: "light", foreground: "dark" },
    inverted: { background: "dark", foreground: "light" },
  },
  phases: {
    orientEnd: 0.32,
    approachEnd: 0.68,
    coverEnd: 0.78,
    backgroundSwapPoint: 0.8,
    foregroundResetPoint: 0.94,
    exitEnd: 1,
  },
  motion: {
    coverOverscan: 1.08,
    coverOpacity: 1,
    easing: "smoothstep",
    cameraZ: 3.2,
    baseRotation: [-0.6, 0.82, 0.08],
    coverRotation: [0, Math.PI / 4, 0],
    exitZ: 4.2,
  },
} as const;

export type HeroTransitionConfig = typeof heroTransitionConfig;
export type HeroColorToken = keyof HeroTransitionConfig["colors"];
export type HeroSchemeName = keyof HeroTransitionConfig["schemes"];
```

Keep geometry-specific tunables centralized here. If browser QA requires changing `coverRotation`, `exitZ`, or phase values, edit only this config.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- --run apps/hero-next/test/heroTransitionConfig.test.ts`

Expected: PASS.

### Task 2: Pure deterministic transition resolver

**Files:**
- Create: `apps/hero-next/src/heroTransition.ts`
- Create: `apps/hero-next/test/heroTransition.test.ts`

**Interfaces:**
- Consumes: `HeroTransitionConfig` and `heroTransitionConfig`.
- Produces: `HeroViewport`, `HeroTransitionState`, `resolveHeroTransition(progress, viewport, config, reducedMotion?)`, phase interpolation, color interpolation for reduced motion, and responsive cover-scale calculation.
- Consumers must not recalculate phase thresholds, schemes, or coverage.

- [ ] **Step 1: Write failing tests for sanitization and semantic endpoints**

```ts
const desktop = { width: 1440, height: 900 };

expect(resolveHeroTransition(0, desktop, heroTransitionConfig)).toMatchObject({
  progress: 0,
  scheme: "initial",
  background: "#B8B8B8",
  foreground: "#5F5F5F",
  tetrahedronColor: "#5F5F5F",
});
expect(resolveHeroTransition(1, desktop, heroTransitionConfig)).toMatchObject({
  progress: 1,
  scheme: "inverted",
  background: "#5F5F5F",
  foreground: "#B8B8B8",
  tetrahedronColor: "#B8B8B8",
  visible: false,
});
for (const input of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  expect(resolveHeroTransition(input, desktop, heroTransitionConfig).progress).toBe(0);
}
expect(resolveHeroTransition(-1, desktop, heroTransitionConfig).progress).toBe(0);
expect(resolveHeroTransition(2, desktop, heroTransitionConfig).progress).toBe(1);
```

- [ ] **Step 2: Write failing phase-order and reversibility tests**

Assert exact state at `orientEnd`, `approachEnd`, `coverEnd`, `backgroundSwapPoint`, `foregroundResetPoint`, and `exitEnd`. In particular:

```ts
const beforeSwap = resolveHeroTransition(0.7999, desktop, config);
const atSwap = resolveHeroTransition(0.8, desktop, config);
expect(beforeSwap.scheme).toBe("initial");
expect(beforeSwap.covered).toBe(true);
expect(atSwap.scheme).toBe("inverted");
expect(atSwap.tetrahedronColor).toBe(config.colors.dark);

const beforeReset = resolveHeroTransition(0.9399, desktop, config);
const atReset = resolveHeroTransition(0.94, desktop, config);
expect(beforeReset.tetrahedronColor).toBe(config.colors.dark);
expect(atReset.visible).toBe(false);
expect(atReset.tetrahedronColor).toBe(config.colors.light);

for (const progress of [0, 0.16, 0.32, 0.68, 0.78, 0.8, 0.94, 1]) {
  expect(resolveHeroTransition(progress, desktop, config)).toEqual(
    resolveHeroTransition(progress, desktop, config),
  );
}
```

- [ ] **Step 3: Write failing responsive-cover tests**

For desktop `1440×900` and mobile `390×844`, assert that the returned face half-span is at least `max(viewportHalfWidthAtCover, viewportHalfHeightAtCover) * coverOverscan`. The implementation should derive the visible frustum span at the cover Z using camera FOV/aspect, not a hardcoded desktop scalar.

- [ ] **Step 4: Write failing reduced-motion tests**

Assert that reduced motion keeps Z and rotation deltas small/static, changes scheme at the configured swap threshold, produces synchronized background/foreground role interpolation, and ends at exact inverted tokens without creating another authored hex literal.

- [ ] **Step 5: Run RED**

Run: `npm test -- --run apps/hero-next/test/heroTransition.test.ts`

Expected: FAIL because resolver exports do not exist.

- [ ] **Step 6: Implement the pure resolver**

Use focused helpers:

```ts
export type HeroViewport = { readonly width: number; readonly height: number };

export type HeroTransitionState = {
  readonly progress: number;
  readonly easedProgress: number;
  readonly scheme: "initial" | "inverted";
  readonly background: string;
  readonly foreground: string;
  readonly tetrahedronColor: string;
  readonly rotation: readonly [number, number, number];
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly opacity: number;
  readonly visible: boolean;
  readonly covered: boolean;
};

export function resolveHeroTransition(
  progress: number | undefined,
  viewport: HeroViewport,
  config: HeroTransitionConfig = heroTransitionConfig,
  reducedMotion = false,
): HeroTransitionState;
```

Implementation rules:

- Non-finite or missing progress becomes `0`; finite values clamp to `[0, 1]`.
- Segment progress is `clamp((p-start)/(end-start))` followed by `smoothstep(t)=t*t*(3-2*t)`.
- Normal motion composes orient, approach/scale, cover hold, and Z exit segments; `covered` begins at `coverEnd` and stays true through the background swap.
- Compute minimum cover radius from perspective FOV `38`, camera Z `3.2`, viewport aspect, tetrahedron face geometry, and `coverOverscan`.
- Keep tetrahedron dark until `foregroundResetPoint`; set it light only together with `visible=false`.
- Reduced motion keeps the initial transform, uses a bounded opacity veil/role interpolation around cover/swap, and returns exact endpoint tokens.

- [ ] **Step 7: Run GREEN and refactor while green**

Run: `npm test -- --run apps/hero-next/test/heroTransition.test.ts`

Expected: PASS with endpoint, phase, cover, reduced-motion, and determinism cases.

### Task 3: Timeline declaration and stable semantic scene declarations

**Files:**
- Modify: `apps/hero-next/src/HeroExperience.tsx`
- Modify: `apps/hero-next/app/globals.css`
- Modify: `apps/hero-next/test/HeroExperience.test.tsx`
- Modify: `apps/hero-next/test/assetsAndStyle.test.ts`

**Interfaces:**
- Consumes: `heroTransitionConfig`.
- Produces: one pinned `WebGLScrollTimeline` whose `id`/progress key exactly match config, stable effect declarations with no color params, and layout-only scroll range.

- [ ] **Step 1: Extend the render contract test and watch it fail**

Mock `WebGLScrollTimeline` and assert:

```ts
expect(html).toContain('data-timeline="hero.transition.tetrahedron-cover"');
expect(html).toContain('data-start="top top"');
expect(html).toContain('data-end="+=300%"');
expect(html).toContain('data-pin="true"');
expect(html).not.toContain("data-effect-color");
expect(html).toContain('data-color="#5F5F5F"');
expect(html).toContain('data-emissive="#5F5F5F"');
```

Also assert the existing camera, render quality, key/rim light declarations, and exact light params remain unchanged.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run apps/hero-next/test/HeroExperience.test.tsx`

Expected: FAIL because no timeline exists and declarations still contain scattered colors.

- [ ] **Step 3: Implement stable declarations**

- Import `WebGLScrollTimeline` and `WebGLScrollTimelineProps`.
- Wrap the existing hero `<main>`/scene with one pinned timeline using `id={heroTransitionConfig.progressKey}`, `start="top top"`, `end="+=300%"`, `pin`, and `scrub`.
- Remove background `color`/`brightness` inputs; effect receives only geometry projection params.
- Initialize material `color` and `emissive` from `heroTransitionConfig.colors.dark`; preserve `emissiveIntensity`, metalness, roughness, and the initial opacity contract until resolver takes control per frame.
- Preserve all light declarations byte-for-byte.
- If extra document height is required, express it through the timeline pin/end behavior or allowed `height`/`min-height` CSS only.

- [ ] **Step 4: Run GREEN and CSS boundary test**

Run: `npm test -- --run apps/hero-next/test/HeroExperience.test.tsx apps/hero-next/test/assetsAndStyle.test.ts`

Expected: PASS; CSS still contains none of the forbidden visual properties.

### Task 4: Tetrahedron transition/motion/material consumer

**Files:**
- Modify: `apps/hero-next/src/heroEffect.ts`
- Modify: `apps/hero-next/test/heroEffect.test.ts`

**Interfaces:**
- Consumes: `heroTransitionConfig`, `resolveHeroTransition`, the public signal `ctx.progress.get(...)`, and managed `ctx.object.material`.
- Produces: a frame application function that composes transition transform with breathing/floating/pointer tilt before cover, then lets the geometric cover take ownership as progress advances.

- [ ] **Step 1: Write a failing effect-consumer test**

Create a target stub with transform, visibility, opacity, and managed material spies:

```ts
const material = {
  color: { value: "#5F5F5F", set: vi.fn() },
  emissive: { value: "#5F5F5F", intensity: 0.06, set: vi.fn() },
  opacity: 0.92,
  metalness: 0.9,
  roughness: 0.12,
  createLayer: vi.fn(),
  restore: vi.fn(),
};
```

Assert that applying progress `0`, `0.8`, `0.94`, and `1` uses resolver transform/visibility/opacity and calls `material.color.set(state.tetrahedronColor)` plus `material.emissive.set(state.tetrahedronColor, 0.06)`.

- [ ] **Step 2: Add failing composition tests**

Assert normal progress `0` retains six-second breathing, eight-second float, and pointer tilt; transition progress overrides base Z/scale/rotation in a deterministic order; reduced motion suppresses large rotation/Z changes but still reaches inverted material state.

- [ ] **Step 3: Run RED**

Run: `npm test -- --run apps/hero-next/test/heroEffect.test.ts`

Expected: FAIL because the effect does not read progress or material.

- [ ] **Step 4: Implement the scene-object consumer**

In `update`:

```ts
const progress = ctx.progress.get(heroTransitionConfig.progressKey);
const viewport = readHeroViewport();
const transition = resolveHeroTransition(
  progress,
  viewport,
  heroTransitionConfig,
  state.reducedMotion,
);
applyHeroFrame(ctx.object, state, ctx.time, resolvedBaseScale, yOffset, transition);
ctx.object.opacity = transition.opacity;
ctx.object.visible = transition.visible;
ctx.object.material?.color.set(transition.tetrahedronColor);
ctx.object.material?.emissive.set(transition.tetrahedronColor, 0.06);
if (ctx.object.material) ctx.object.material.opacity = transition.opacity;
```

Use `window.innerWidth/innerHeight` only in a tiny adapter (`readHeroViewport`) because scene-object context has no viewport dimensions. Keep all geometry/state math in the pure resolver. Missing material remains a safe no-op.

- [ ] **Step 5: Run GREEN**

Run: `npm test -- --run apps/hero-next/test/heroEffect.test.ts apps/hero-next/test/heroTransition.test.ts`

Expected: PASS.

### Task 5: Background effect and explicit shader color uniforms

**Files:**
- Modify: `apps/hero-next/src/heroGhostEffects.ts`
- Modify: `apps/hero-next/src/heroGhostCursorProgram.ts`
- Modify: `apps/hero-next/test/heroGhostEffects.test.ts`
- Modify: `apps/hero-next/test/heroGhostCursorProgram.test.ts`

**Interfaces:**
- Consumes: the same `heroTransitionConfig`, `resolveHeroTransition`, and `ctx.progress.get(...)` as Task 4.
- Produces: `iBackgroundColor` and `iForegroundColor` uniforms only; the program has no design tokens or fallback palette literals.

- [ ] **Step 1: Write failing uniform/shader tests**

Change test options to carry resolved `background` and `foreground`. Assert:

```ts
expect(uniforms.iBackgroundColor).toEqual([184 / 255, 184 / 255, 184 / 255]);
expect(uniforms.iForegroundColor).toEqual([95 / 255, 95 / 255, 95 / 255]);
expect(program.fragmentShader).toContain("uniform vec3 iBackgroundColor");
expect(program.fragmentShader).toContain("uniform vec3 iForegroundColor");
expect(program.fragmentShader).not.toContain("vec3(0.72)");
expect(program.fragmentShader).not.toContain("iBaseColor");
```

- [ ] **Step 2: Write failing background resolver-consumer test**

Extract/export a small `resolveHeroGhostProgramColors(progress, viewport, reducedMotion)` adapter or test `createProgramOptions` through a focused exported helper. Assert progress `0` gives light/dark, swap progress gives dark/light, missing progress gives initial, and both values come from one resolver result.

- [ ] **Step 3: Run RED**

Run: `npm test -- --run apps/hero-next/test/heroGhostCursorProgram.test.ts apps/hero-next/test/heroGhostEffects.test.ts`

Expected: FAIL because old `iBaseColor`, `vec3(0.72)`, and effect color params remain.

- [ ] **Step 4: Implement explicit semantic uniforms**

- Replace program option `color` with `backgroundColor` and `foregroundColor`.
- Convert both using a strict local hex-to-linear tuple parser whose fallback is passed by the caller, not a third design literal.
- Shader `blob()` uses `iForegroundColor`; background output uses `mix(iBackgroundColor, fogTint, fogStrength)`.
- `heroGhostBackgroundEffect.update` reads `ctx.progress.get(heroTransitionConfig.progressKey)`, resolves against `ctx.layout.viewport`, and passes `transition.background`/`transition.foreground` to uniform creation.
- Keep Ghost Cursor motion, overscan, pointer mapping, point light creation/update/removal, and every point-light parameter unchanged.

- [ ] **Step 5: Run GREEN**

Run: `npm test -- --run apps/hero-next/test/heroGhostCursorProgram.test.ts apps/hero-next/test/heroGhostEffects.test.ts`

Expected: PASS.

### Task 6: Cross-module palette and lighting regression guards

**Files:**
- Create: `apps/hero-next/test/heroPaletteBoundary.test.ts`
- Modify: `apps/hero-next/test/HeroExperience.test.tsx`

**Interfaces:**
- Verifies: all non-light author hex literals in app source resolve to the two config tokens, while exact light literals remain exempt and unchanged.

- [ ] **Step 1: Write the failing source boundary test**

Read `apps/hero-next/src/**/*.{ts,tsx}` and classify hex literals by explicit light declaration locations. Assert the remaining author palette equals exactly `#B8B8B8`/`#5F5F5F`; reject prior `#3f3f3f`, `#0d0d0d`, shader numeric base `vec3(0.72)`, and any newly introduced third non-light hex.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run apps/hero-next/test/heroPaletteBoundary.test.ts`

Expected: FAIL until old literals and shader base are removed.

- [ ] **Step 3: Finish source cleanup without changing lights**

Ensure only these exempt light inputs remain outside config:

- key `#f2f2f2`, intensity `4.8`, position `[1.2, 1.2, 2]`;
- rim `#b8b8b8`, intensity `2.2`, position `[1.8, -1.4, 2]`;
- pointer `#f0f0f0`, target intensity `10`, distance `1.8`, decay `3`, base position `[0, 0.365, 1.1]`.

- [ ] **Step 4: Run the complete app suite**

Run: `npm test -- --run apps/hero-next/test`

Expected: all app tests PASS.

### Task 7: Active documentation closeout

**Files:**
- Modify: `apps/hero-next/AGENTS.md`
- Modify: `apps/hero-next/VISUAL_DESIGN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/README.md`

**Interfaces:**
- Documents current implemented truth, automated verification separately from browser verification, and exact tuning points.

- [ ] **Step 1: Update app execution truth**

Replace stale palette/current-motion paragraphs in `apps/hero-next/AGENTS.md` with the centralized config/resolver/timeline contract, exact two tokens, phase order, material/emissive semantics, reduced-motion behavior, and preserved light exception.

- [ ] **Step 2: Update visual design status**

Change `VISUAL_DESIGN.md` from “设计已确认，尚未实现” to implemented status. Record the final config values actually in source and clearly label browser-tuned values, if any.

- [ ] **Step 3: Update repository status and index**

Add a concise `hero-next` transition implemented section to `docs/STATUS.md`, preserving release/package truth. Update the `apps/hero-next` summary and add `VISUAL_DESIGN.md`/the active plan link in `docs/README.md`. Do not edit `docs/archive/`.

- [ ] **Step 4: Check docs/source consistency**

Run targeted searches for stale `#3f3f3f`, `#0d0d0d`, `vec3(0.72)`, “尚未实现”, and direct-crossfade descriptions in the four active docs and app source; update only current-truth passages.

### Task 8: Automated and real-browser verification

**Files:**
- Potential generated side effect only: `apps/hero-next/next-env.d.ts` (must be restored to task-start content)
- Browser evidence: temporary screenshots/logs outside tracked product files.

**Interfaces:**
- Proves automated contracts and records visual evidence without conflating them.

- [ ] **Step 1: Record protected file state immediately before build**

Run:

```bash
shasum -a 256 apps/hero-next/next-env.d.ts
git diff -- apps/hero-next/next-env.d.ts
```

Expected SHA-256: `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.

- [ ] **Step 2: Run required automated verification**

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Restore and verify generated churn**

If build changes `next-env.d.ts`, restore the exact task-start content (not arbitrary current HEAD assumptions), then verify its SHA and that `git diff -- apps/hero-next/next-env.d.ts` is empty.

- [ ] **Step 4: Run production browser QA at desktop and mobile**

Start the built hero workspace with the real package runtime. At `1200×835` and `390×844`, capture/check progress near `0`, `coverEnd`, `backgroundSwapPoint`, `foregroundResetPoint`, and `1`, including reverse travel. Verify:

- one managed canvas, no console/page errors;
- initial light background/dark Ghost Cursor/dark tetrahedron;
- a dark triangular face overscans the viewport before scheme swap;
- no light flash while occluding;
- inverted dark background/light Ghost Cursor appears after exit;
- tetrahedron becomes light only after it is invisible;
- reverse scroll performs the exact inverse order;
- reduced motion reaches synchronized inverted roles without large Z crossing;
- key/rim/pointer lighting visually remains active and declaration values are unchanged.

If browser automation cannot reliably pause exact GSAP progress, report that limitation and leave phase/rotation/Z/scale/overscan values as explicit user visual-QA tuning points rather than claiming browser acceptance.

- [ ] **Step 5: Final diff and scope audit**

Run:

```bash
git status --short
git diff --stat
git diff -- apps/hero-next docs/STATUS.md docs/README.md
git diff -- packages
git ls-files --others --exclude-standard
```

Expected: no `packages/` changes, no generated `next-env.d.ts` churn, no unintended untracked files, no commit, and no push.

## Self-Review Record

- Spec coverage: config, resolver, progress signal, timeline, geometry cover order, material/emissive, shader uniforms, reduced motion, deterministic reverse, cover overscan, missing/invalid progress, two-color guard, lights unchanged, active docs, protected generated file, automated verification, desktop/mobile production browser QA, and final git audit are all assigned to explicit tasks.
- Placeholder scan: all implementation and test steps contain concrete behavior, interfaces, commands, and expected outcomes.
- Type consistency: both effects consume `resolveHeroTransition(progress, viewport, heroTransitionConfig, reducedMotion)`; the resolver returns the exact semantic and transform fields used by both consumers; timeline and effects share `heroTransitionConfig.progressKey`.
- User override: per explicit instruction, this plan has no commit steps and execution proceeds inline in the current branch without asking for the normal execution-choice handoff.
