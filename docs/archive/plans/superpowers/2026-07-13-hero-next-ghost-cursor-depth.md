# Hero Next Ghost Cursor Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-compliant CSS matte studio in `apps/hero-next` with a single-scene, package-only Ghost Cursor composition containing background smoke, the existing mirrored tetrahedron GLB, and a light foreground smoke layer.

**Architecture:** One `perspective-stage` `WebGLScene` owns two fullscreen `dom/element` surfaces, the existing `WebGLModel`, one camera, and managed lights. Public `screen-depth` placement puts the opaque Ghost Cursor surface behind the model and the transparent lightweight smoke surface in front; app-owned managed effects own every visible pixel and motion while CSS remains layout-only.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 5.8, `@viselora/dom-webgl` 0.1.0-alpha.1 public APIs, `@viselora/scroll-adapters` 0.1.0-alpha.1, GLSL material layers, Vitest 3.2.

## Global Constraints

- Follow `apps/hero-next/AGENTS.md` before every task.
- Keep exactly one runtime, one canvas, one renderer, one explicit scene, one camera, and one render pass.
- Keep `/models/4.glb` and the current managed Draco loader; do not create programmatic geometry in this slice.
- Use only public package entrypoints and managed capability facades; do not import `three`, package `src/`, `apps/example`, React Three Fiber, or private runtime handles.
- Do not modify anything under `packages/`.
- CSS may only perform reset, sizing, positioning, layout, stacking, overflow control, and pointer-event routing; it must not create visible artwork.
- Do not add copy, navigation, CTA, branding, controls, extra page sections, postprocessing, a second pointer pipeline, or a second scroll pipeline.
- Preserve the empty reserved default scene; all app content belongs to `hero.tetrahedron.scene`.
- Keep runtime-level `effects` and all declarations referentially stable at module scope.
- Do not deploy, publish, push, create a PR, or change package versions.

## File Map

- `apps/hero-next/src/heroGhostCursorProgram.ts` — background/foreground GLSL programs and uniform normalization only.
- `apps/hero-next/test/heroGhostCursorProgram.test.ts` — shader text, compile-time sample limits, transparency, and uniform contract.
- `apps/hero-next/src/heroGhostCursorState.ts` — pure pointer smoothing, trail, idle decay, and reduced-motion state transitions.
- `apps/hero-next/test/heroGhostCursorState.test.ts` — deterministic state transition tests.
- `apps/hero-next/src/heroGhostEffects.ts` — public `defineWebGLEffect` wiring and material-layer lifecycle.
- `apps/hero-next/test/heroGhostEffects.test.ts` — definition identity and scheduling contract.
- `apps/hero-next/src/heroEffect.ts` — mirrored model material, 48-second rotation, proximity tilt, and idle return.
- `apps/hero-next/test/heroEffect.test.ts` — model motion, responsive framing, and reduced-motion contract.
- `apps/hero-next/src/HeroExperience.tsx` — one-scene declarations and initial depth/light tokens.
- `apps/hero-next/test/HeroExperience.test.tsx` — one-scene composition and ordered depth assertions.
- `apps/hero-next/app/globals.css` — layout-only full-viewport shell.
- `apps/hero-next/test/assetsAndStyle.test.ts` — asset integrity plus negative CSS visual-boundary assertions.
- `docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md` — implementation status and accepted browser tuning values.
- `docs/archive/plans/superpowers/` — destination for the two superseded hero plans after verified closeout.

---

### Task 1: Background And Foreground Ghost Cursor Material Programs

**Files:**
- Create: `apps/hero-next/src/heroGhostCursorProgram.ts`
- Create: `apps/hero-next/test/heroGhostCursorProgram.test.ts`

**Interfaces:**
- Consumes: public `WebGLEffectMaterialProgram` and `WebGLEffectUniformValue` types.
- Produces: `HeroGhostLayer`, `heroGhostTrailLengths`, `createHeroGhostCursorMaterialProgram(...)`, and `createHeroGhostCursorUniforms(...)`.

- [ ] **Step 1: Write the failing shader contract test**

Create `apps/hero-next/test/heroGhostCursorProgram.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
  heroGhostTrailLengths,
} from "../src/heroGhostCursorProgram";

const baseOptions = {
  width: 1200,
  height: 900,
  pointerX: 600,
  pointerY: 450,
  pointerIntensity: 0.8,
  time: 1200,
  color: "#b497cf",
  brightness: 0.9,
  trailPoints: [
    [600, 450],
    [560, 430],
  ],
} as const;

describe("hero Ghost Cursor material programs", () => {
  test("compiles an opaque 36-sample background program without source copy", () => {
    const program = createHeroGhostCursorMaterialProgram("background", baseOptions);

    expect(heroGhostTrailLengths.background).toBe(36);
    expect(program.defines).toEqual({
      HERO_FOREGROUND: 0,
      MAX_TRAIL_LENGTH: 36,
    });
    expect(program.blend).toBe("normal");
    expect(program.fragmentShader).toContain("float fbm(vec2 p)");
    expect(program.fragmentShader).toContain("vec4 blob(");
    expect(program.fragmentShader).toContain("vec3(0.027, 0.020, 0.047)");
    expect(program.fragmentShader).not.toContain("uSource");
    expect(program.fragmentShader).not.toContain("Boo!");
  });

  test("compiles a transparent 12-sample foreground program", () => {
    const program = createHeroGhostCursorMaterialProgram("foreground", baseOptions);

    expect(heroGhostTrailLengths.foreground).toBe(12);
    expect(program.defines).toEqual({
      HERO_FOREGROUND: 1,
      MAX_TRAIL_LENGTH: 12,
    });
    expect(program.blend).toBe("screen");
    expect(program.fragmentShader).toContain("#if HERO_FOREGROUND == 1");
    expect(program.fragmentShader).toContain("vec4(colorAcc * 0.32, outAlpha * 0.18)");
  });

  test("normalizes DOM pointer and pads the layer-specific trail", () => {
    const uniforms = createHeroGhostCursorUniforms("foreground", baseOptions);

    expect(uniforms.iTime).toBe(1.2);
    expect(uniforms.iResolution).toEqual([1200, 900, 1]);
    expect(uniforms.iMouse).toEqual([0.5, 0.5]);
    expect(uniforms.iBaseColor).toEqual([180 / 255, 151 / 255, 207 / 255]);
    expect(uniforms.iPrevMouse).toEqual(
      expect.arrayContaining([
        [0.5, 0.5],
        [560 / 1200, 1 - 430 / 900],
      ]),
    );
    expect((uniforms.iPrevMouse as readonly unknown[]).length).toBe(12);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostCursorProgram.test.ts
```

Expected: FAIL because `heroGhostCursorProgram.ts` does not exist.

- [ ] **Step 3: Implement the material-program boundary**

Create `apps/hero-next/src/heroGhostCursorProgram.ts` with these exports and shader contract:

```ts
import type {
  WebGLEffectMaterialProgram,
  WebGLEffectUniformValue,
} from "@viselora/dom-webgl";

export type HeroGhostLayer = "background" | "foreground";

export const heroGhostTrailLengths = {
  background: 36,
  foreground: 12,
} as const;

export type HeroGhostCursorProgramOptions = {
  readonly width: number;
  readonly height: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerIntensity: number;
  readonly time: number;
  readonly color: string;
  readonly brightness: number;
  readonly trailPoints: readonly (readonly [number, number])[];
};

export function createHeroGhostCursorMaterialProgram(
  layer: HeroGhostLayer,
  options: HeroGhostCursorProgramOptions,
): WebGLEffectMaterialProgram {
  return {
    defines: {
      HERO_FOREGROUND: layer === "foreground" ? 1 : 0,
      MAX_TRAIL_LENGTH: heroGhostTrailLengths[layer],
    },
    fragmentShader: heroGhostCursorFragmentShader,
    uniforms: createHeroGhostCursorUniforms(layer, options),
    blend: layer === "foreground" ? "screen" : "normal",
  };
}

export function createHeroGhostCursorUniforms(
  layer: HeroGhostLayer,
  options: HeroGhostCursorProgramOptions,
): Record<string, WebGLEffectUniformValue> {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const pointer = [
    clamp(options.pointerX / width, 0, 1),
    clamp(1 - options.pointerY / height, 0, 1),
  ] satisfies [number, number];
  const trail = options.trailPoints
    .slice(0, heroGhostTrailLengths[layer])
    .map(
      ([x, y]) =>
        [clamp(x / width, 0, 1), clamp(1 - y / height, 0, 1)] satisfies [
          number,
          number,
        ],
    );

  while (trail.length < heroGhostTrailLengths[layer]) {
    trail.push([pointer[0], pointer[1]]);
  }

  return {
    iTime: options.time * 0.001,
    iResolution: [width, height, 1],
    iMouse: pointer,
    iPrevMouse: trail,
    iOpacity: clamp(options.pointerIntensity, 0, 1),
    iScale: clamp(Math.min(width, height) / 600, 0.5, 2),
    iBaseColor: readColor(options.color),
    iBrightness: clamp(options.brightness, 0, 2),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readColor(color: string): [number, number, number] {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }

  return [180 / 255, 151 / 255, 207 / 255];
}

const heroGhostCursorFragmentShader = `
  uniform float iTime;
  uniform vec3 iResolution;
  uniform vec2 iMouse;
  uniform vec2 iPrevMouse[MAX_TRAIL_LENGTH];
  uniform float iOpacity;
  uniform float iScale;
  uniform vec3 iBaseColor;
  uniform float iBrightness;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  vec4 blob(vec2 point, vec2 mouse, float strength) {
    vec2 q = vec2(
      fbm(point * iScale + iTime * 0.10),
      fbm(point * iScale + vec2(5.2, 1.3) + iTime * 0.10)
    );
    vec2 r = vec2(
      fbm(point * iScale + q * 1.5 + iTime * 0.15),
      fbm(point * iScale + q * 1.5 + vec2(8.3, 2.8) + iTime * 0.15)
    );
    float smoke = fbm(point * iScale + r * 0.8);
    float radius = 0.5 + 0.3 / iScale;
    float distanceMask = 1.0 - smoothstep(
      0.0,
      radius * max(iOpacity, 0.001),
      length(point - mouse)
    );
    float alpha = pow(smoke, 2.5) * distanceMask * strength;
    vec3 tint = mix(iBaseColor, vec3(0.86, 0.90, 1.0), 0.24);
    return vec4(tint * alpha, alpha);
  }

  void main() {
    vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
    vec2 point = (vUv * 2.0 - 1.0) * aspect;
    vec2 mouse = (iMouse * 2.0 - 1.0) * aspect;
    vec3 colorAcc = vec3(0.0);
    float alphaAcc = 0.0;

    vec4 head = blob(point, mouse, 1.0);
    colorAcc += head.rgb;
    alphaAcc += head.a;

    for (int index = 0; index < MAX_TRAIL_LENGTH; index++) {
      vec2 previous = (iPrevMouse[index] * 2.0 - 1.0) * aspect;
      float weight = 1.0 - float(index) / float(MAX_TRAIL_LENGTH);
      weight = pow(weight, 2.0);
      if (weight > 0.01) {
        vec4 sampleBlob = blob(point, previous, weight * 0.8);
        colorAcc += sampleBlob.rgb;
        alphaAcc += sampleBlob.a;
      }
    }

    colorAcc *= iBrightness;
    float outAlpha = clamp(alphaAcc * iOpacity, 0.0, 1.0);

    #if HERO_FOREGROUND == 1
      gl_FragColor = vec4(colorAcc * 0.32, outAlpha * 0.18);
    #else
      vec3 base = vec3(0.027, 0.020, 0.047);
      gl_FragColor = vec4(base + colorAcc * outAlpha, 1.0);
    #endif
  }
`;
```

- [ ] **Step 4: Run the focused shader test**

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostCursorProgram.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the shader boundary**

```bash
git add apps/hero-next/src/heroGhostCursorProgram.ts apps/hero-next/test/heroGhostCursorProgram.test.ts
git commit -m "feat: add hero ghost cursor shaders"
```

---

### Task 2: Ghost Cursor State And Managed Surface Effects

**Files:**
- Create: `apps/hero-next/src/heroGhostCursorState.ts`
- Create: `apps/hero-next/src/heroGhostEffects.ts`
- Create: `apps/hero-next/test/heroGhostCursorState.test.ts`
- Create: `apps/hero-next/test/heroGhostEffects.test.ts`

**Interfaces:**
- Consumes: Task 1's `HeroGhostLayer`, program builder, uniform builder, and trail limits.
- Produces: `createHeroGhostCursorState(...)`, `stepHeroGhostCursorState(...)`, `heroGhostBackgroundEffect`, `heroGhostForegroundEffect`, and `heroGhostEffects`.

- [ ] **Step 1: Write failing state tests**

Create `apps/hero-next/test/heroGhostCursorState.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  createHeroGhostCursorState,
  stepHeroGhostCursorState,
} from "../src/heroGhostCursorState";

describe("hero Ghost Cursor state", () => {
  test("smooths active pointer input and prepends a background trail", () => {
    const state = createHeroGhostCursorState("background", 1000, 800, false);

    stepHeroGhostCursorState(state, {
      active: true,
      x: 700,
      y: 300,
    });

    expect(state.pointerX).toBe(588);
    expect(state.pointerY).toBe(356);
    expect(state.intensity).toBe(0.36);
    expect(state.trail[0]).toEqual([588, 356]);
    expect(state.trail).toHaveLength(36);
  });

  test("decays foreground smoke faster than background smoke", () => {
    const background = createHeroGhostCursorState("background", 1000, 800, false);
    const foreground = createHeroGhostCursorState("foreground", 1000, 800, false);
    background.intensity = 1;
    foreground.intensity = 1;

    stepHeroGhostCursorState(background, { active: false, x: 500, y: 400 });
    stepHeroGhostCursorState(foreground, { active: false, x: 500, y: 400 });

    expect(background.intensity).toBe(0.82);
    expect(foreground.intensity).toBe(0.68);
  });

  test("freezes a static background and removes foreground in reduced motion", () => {
    const background = createHeroGhostCursorState("background", 1000, 800, true);
    const foreground = createHeroGhostCursorState("foreground", 1000, 800, true);

    stepHeroGhostCursorState(background, { active: true, x: 900, y: 100 });
    stepHeroGhostCursorState(foreground, { active: true, x: 900, y: 100 });

    expect(background.intensity).toBe(0.22);
    expect(background.pointerX).toBe(500);
    expect(background.pointerY).toBe(400);
    expect(foreground.intensity).toBe(0);
  });
});
```

Create `apps/hero-next/test/heroGhostEffects.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  heroGhostBackgroundEffect,
  heroGhostEffects,
  heroGhostForegroundEffect,
} from "../src/heroGhostEffects";

describe("hero Ghost Cursor effects", () => {
  test("registers two frame-scheduled dom element effects", () => {
    expect(heroGhostBackgroundEffect).toMatchObject({
      kind: "hero.ghost.background",
      source: "dom/element",
      schedule: "frame",
    });
    expect(heroGhostForegroundEffect).toMatchObject({
      kind: "hero.ghost.foreground",
      source: "dom/element",
      schedule: "frame",
    });
    expect(heroGhostEffects).toEqual([
      heroGhostBackgroundEffect,
      heroGhostForegroundEffect,
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostCursorState.test.ts apps/hero-next/test/heroGhostEffects.test.ts
```

Expected: FAIL because both source modules are missing.

- [ ] **Step 3: Implement the pure state transition module**

Create `apps/hero-next/src/heroGhostCursorState.ts`:

```ts
import {
  heroGhostTrailLengths,
  type HeroGhostLayer,
} from "./heroGhostCursorProgram";

export type HeroGhostCursorState = {
  readonly layer: HeroGhostLayer;
  readonly reducedMotion: boolean;
  intensity: number;
  pointerX: number;
  pointerY: number;
  trail: readonly [number, number][];
};

export type HeroGhostPointerInput = {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
};

export function createHeroGhostCursorState(
  layer: HeroGhostLayer,
  width: number,
  height: number,
  reducedMotion: boolean,
): HeroGhostCursorState {
  const pointerX = width * 0.5;
  const pointerY = height * 0.5;
  return {
    layer,
    reducedMotion,
    intensity: reducedMotion && layer === "background" ? 0.22 : 0,
    pointerX,
    pointerY,
    trail: Array.from(
      { length: heroGhostTrailLengths[layer] },
      () => [pointerX, pointerY] satisfies [number, number],
    ),
  };
}

export function stepHeroGhostCursorState(
  state: HeroGhostCursorState,
  input: HeroGhostPointerInput,
): void {
  if (state.reducedMotion) {
    state.intensity = state.layer === "background" ? 0.22 : 0;
    return;
  }

  if (input.active) {
    state.pointerX += (input.x - state.pointerX) * 0.44;
    state.pointerY += (input.y - state.pointerY) * 0.44;
    state.intensity += (1 - state.intensity) * 0.36;
  } else {
    state.intensity *= state.layer === "background" ? 0.82 : 0.68;
    if (state.intensity < 0.0001) {
      state.intensity = 0;
    }
  }

  state.trail = [
    [state.pointerX, state.pointerY] satisfies [number, number],
    ...state.trail,
  ].slice(0, heroGhostTrailLengths[state.layer]);
}
```

- [ ] **Step 4: Implement managed surface effect wiring**

Create `apps/hero-next/src/heroGhostEffects.ts`:

```ts
import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
  type WebGLEffectUpdateContext,
} from "@viselora/dom-webgl";

import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
  type HeroGhostLayer,
} from "./heroGhostCursorProgram";
import {
  createHeroGhostCursorState,
  stepHeroGhostCursorState,
  type HeroGhostCursorState,
} from "./heroGhostCursorState";

type HeroGhostBackgroundParams = {
  kind: "hero.ghost.background";
  color?: string;
  brightness?: number;
};

type HeroGhostForegroundParams = {
  kind: "hero.ghost.foreground";
  color?: string;
  brightness?: number;
};

type HeroGhostEffectState = {
  motion: HeroGhostCursorState;
  materialLayer: WebGLEffectMaterialLayerHandle | undefined;
};

export const heroGhostBackgroundEffect = defineWebGLEffect<
  HeroGhostBackgroundParams,
  HeroGhostEffectState
>({
  kind: "hero.ghost.background",
  source: "dom/element",
  schedule: "frame",
  setup(ctx, params) {
    return createEffectState("background", ctx, params);
  },
  update(ctx, state, params) {
    updateEffect("background", ctx, state, params);
  },
  dispose(_ctx, state) {
    state.materialLayer?.dispose();
    state.materialLayer = undefined;
  },
});

export const heroGhostForegroundEffect = defineWebGLEffect<
  HeroGhostForegroundParams,
  HeroGhostEffectState
>({
  kind: "hero.ghost.foreground",
  source: "dom/element",
  schedule: "frame",
  setup(ctx, params) {
    return createEffectState("foreground", ctx, params);
  },
  update(ctx, state, params) {
    updateEffect("foreground", ctx, state, params);
  },
  dispose(_ctx, state) {
    state.materialLayer?.dispose();
    state.materialLayer = undefined;
  },
});

export const heroGhostEffects = [
  heroGhostBackgroundEffect,
  heroGhostForegroundEffect,
] as const;

function createEffectState(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  params: { color?: string; brightness?: number },
): HeroGhostEffectState {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = createHeroGhostCursorState(
    layer,
    ctx.layout.width,
    ctx.layout.height,
    reducedMotion,
  );
  const materialLayer = ctx.object.surface?.createMaterialLayer({
    key: `hero.ghost.${layer}`,
    mode: "replace-source",
    program: createHeroGhostCursorMaterialProgram(
      layer,
      createProgramOptions(layer, ctx, motion, params),
    ),
  });

  return { motion, materialLayer };
}

function updateEffect(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  state: HeroGhostEffectState,
  params: { color?: string; brightness?: number },
): void {
  const surface = ctx.object.surface;
  if (!surface) {
    return;
  }

  if (!state.materialLayer) {
    state.materialLayer = surface.createMaterialLayer({
      key: `hero.ghost.${layer}`,
      mode: "replace-source",
      program: createHeroGhostCursorMaterialProgram(
        layer,
        createProgramOptions(layer, ctx, state.motion, params),
      ),
    });
  }

  const localX = ctx.targetPointer.localX;
  const localY = ctx.targetPointer.localY;
  const active =
    ctx.targetPointer.isInside &&
    localX >= 0 &&
    localX <= ctx.layout.width &&
    localY >= 0 &&
    localY <= ctx.layout.height;
  stepHeroGhostCursorState(state.motion, {
    active,
    x: active ? localX : ctx.layout.width * 0.5,
    y: active ? localY : ctx.layout.height * 0.5,
  });

  state.materialLayer.setUniforms(
    createHeroGhostCursorUniforms(
      layer,
      createProgramOptions(layer, ctx, state.motion, params),
    ),
  );
  ctx.object.visible = true;
  surface.setVisible?.(true);
  surface.setOpacity?.(1);
}

function createProgramOptions(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  motion: HeroGhostCursorState,
  params: { color?: string; brightness?: number },
) {
  return {
    width: ctx.layout.width,
    height: ctx.layout.height,
    pointerX: motion.pointerX,
    pointerY: motion.pointerY,
    pointerIntensity: motion.intensity,
    time: motion.reducedMotion ? 0 : ctx.time,
    color: params.color ?? "#b497cf",
    brightness: params.brightness ?? (layer === "background" ? 0.9 : 0.18),
    trailPoints: motion.trail,
  };
}
```

- [ ] **Step 5: Run the focused effect tests and typecheck**

Run:

```bash
npm test -- --run apps/hero-next/test/heroGhostCursorState.test.ts apps/hero-next/test/heroGhostEffects.test.ts apps/hero-next/test/heroGhostCursorProgram.test.ts
npm run typecheck -w @viselora/hero-next
```

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit the managed Ghost Cursor effects**

```bash
git add apps/hero-next/src/heroGhostCursorState.ts apps/hero-next/src/heroGhostEffects.ts apps/hero-next/test/heroGhostCursorState.test.ts apps/hero-next/test/heroGhostEffects.test.ts
git commit -m "feat: add managed hero ghost cursor effects"
```

---

### Task 3: Mirrored Tetrahedron Rotation And Pointer Return

**Files:**
- Modify: `apps/hero-next/src/heroEffect.ts`
- Modify: `apps/hero-next/test/heroEffect.test.ts`

**Interfaces:**
- Produces: `heroTetrahedronEffect`, `HeroMotionState`, `createHeroMotionState(...)`, `stepHeroMotionState(...)`, `applyHeroFrame(...)`, `resolveHeroBaseScale(...)`, and `resolveHeroYOffset(...)`.
- Replaces: the current GSAP breath/float state and `hero.tetrahedron.breathe` declaration.

- [ ] **Step 1: Replace the old breath tests with the failing rotation/parallax contract**

Replace `apps/hero-next/test/heroEffect.test.ts` with:

```ts
import { describe, expect, test, vi } from "vitest";

import {
  applyHeroFrame,
  createHeroMotionState,
  heroTetrahedronEffect,
  resolveHeroBaseScale,
  resolveHeroYOffset,
  stepHeroMotionState,
} from "../src/heroEffect";

describe("hero tetrahedron effect", () => {
  test("completes one slow base rotation in 48 seconds", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = createHeroMotionState(false);

    applyHeroFrame(target, state, 48_000, 1.08, 0);

    expect(target.scale.setScalar).toHaveBeenCalledWith(1.08);
    expect(target.position.set).toHaveBeenCalledWith(0, 0, 0);
    expect(target.rotation.set).toHaveBeenCalledWith(
      expect.any(Number),
      expect.closeTo(0.92 + Math.PI * 2, 6),
      expect.any(Number),
    );
  });

  test("adds proximity tilt while moving and returns after 120ms idle", () => {
    const state = createHeroMotionState(false);

    stepHeroMotionState(state, {
      time: 16,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    expect(state.targetTiltX).toBeCloseTo(0.016, 6);
    expect(state.targetTiltY).toBeCloseTo(0.04, 6);

    stepHeroMotionState(state, {
      time: 160,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    expect(state.targetTiltX).toBe(0);
    expect(state.targetTiltY).toBe(0);
  });

  test("keeps reduced motion static", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = createHeroMotionState(true);
    stepHeroMotionState(state, {
      time: 24_000,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    applyHeroFrame(target, state, 24_000, 1.08, 0);

    expect(target.rotation.set).toHaveBeenCalledWith(-0.45, 0.92, 0.08);
  });

  test("declares managed GLB frame scheduling and responsive framing", () => {
    expect(heroTetrahedronEffect).toMatchObject({
      kind: "hero.tetrahedron.motion",
      source: "model/glb",
      schedule: "frame",
    });
    expect(resolveHeroBaseScale(1440, 1.08)).toBe(1.08);
    expect(resolveHeroBaseScale(390, 1.08)).toBeCloseTo(0.648, 6);
    expect(resolveHeroYOffset(1440)).toBe(0);
    expect(resolveHeroYOffset(390)).toBe(0.19);
  });
});
```

- [ ] **Step 2: Run the test to verify the old implementation fails**

Run:

```bash
npm test -- --run apps/hero-next/test/heroEffect.test.ts
```

Expected: FAIL because the old effect exposes breath state and the old kind.

- [ ] **Step 3: Replace the model effect with time/delta-driven motion**

Replace `apps/hero-next/src/heroEffect.ts` with:

```ts
import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";

type HeroEffectParams = {
  kind: "hero.tetrahedron.motion";
  baseScale?: number;
};

export type HeroMotionState = {
  readonly reducedMotion: boolean;
  previousPointerX: number;
  previousPointerY: number;
  lastSignificantMoveTime: number;
  tiltX: number;
  tiltY: number;
  targetTiltX: number;
  targetTiltY: number;
};

export type HeroMotionInput = {
  readonly time: number;
  readonly delta: number;
  readonly pointerInside: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
};

type HeroTarget = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: { setScalar(value: number): void };
};

export function createHeroMotionState(reducedMotion: boolean): HeroMotionState {
  return {
    reducedMotion,
    previousPointerX: 0,
    previousPointerY: 0,
    lastSignificantMoveTime: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
  };
}

export function stepHeroMotionState(
  state: HeroMotionState,
  input: HeroMotionInput,
): void {
  if (state.reducedMotion) {
    state.tiltX = 0;
    state.tiltY = 0;
    state.targetTiltX = 0;
    state.targetTiltY = 0;
    return;
  }

  const movement = Math.hypot(
    input.pointerX - state.previousPointerX,
    input.pointerY - state.previousPointerY,
  );
  const nearCenter = Math.hypot(input.pointerX, input.pointerY) <= 0.75;
  const moving = input.pointerInside && nearCenter && movement >= 0.0025;

  if (moving) {
    state.lastSignificantMoveTime = input.time;
    state.targetTiltX = clamp(-input.pointerY * 0.08, -0.08, 0.08);
    state.targetTiltY = clamp(input.pointerX * 0.10, -0.10, 0.10);
  } else if (input.time - state.lastSignificantMoveTime >= 120) {
    state.targetTiltX = 0;
    state.targetTiltY = 0;
  }

  const damping = 1 - Math.exp(-Math.max(0, input.delta) / 160);
  state.tiltX += (state.targetTiltX - state.tiltX) * damping;
  state.tiltY += (state.targetTiltY - state.tiltY) * damping;
  state.previousPointerX = input.pointerX;
  state.previousPointerY = input.pointerY;
}

export function applyHeroFrame(
  target: HeroTarget,
  state: HeroMotionState,
  time: number,
  baseScale: number,
  yOffset = 0,
): void {
  target.scale.setScalar(baseScale);
  target.position.set(0, yOffset, 0);

  if (state.reducedMotion) {
    target.rotation.set(-0.45, 0.92, 0.08);
    return;
  }

  const phase = (time / 48_000) * Math.PI * 2;
  target.rotation.set(
    -0.45 + Math.sin(phase * 0.6) * 0.05 + state.tiltX,
    0.92 + phase + state.tiltY,
    0.08 + Math.sin(phase * 0.35) * 0.03,
  );
}

export function resolveHeroBaseScale(
  viewportWidth: number,
  baseScale: number,
): number {
  return viewportWidth <= 700 ? baseScale * 0.6 : baseScale;
}

export function resolveHeroYOffset(viewportWidth: number): number {
  return viewportWidth <= 700 ? 0.19 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export const heroTetrahedronEffect = defineWebGLSceneObjectEffect<
  HeroEffectParams,
  HeroMotionState
>({
  kind: "hero.tetrahedron.motion",
  source: "model/glb",
  schedule: "frame",
  setup(ctx) {
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.color.set("#171a20");
      mesh.material.emissive.set("#050208", 0.02);
      mesh.material.metalness = 0.94;
      mesh.material.roughness = 0.08;
      mesh.material.opacity = 1;
    });
    return createHeroMotionState(prefersReducedMotion());
  },
  update(ctx, state, params) {
    stepHeroMotionState(state, {
      time: ctx.time,
      delta: ctx.delta,
      pointerInside: ctx.pointer.isInside,
      pointerX: ctx.pointer.normalizedX,
      pointerY: ctx.pointer.normalizedY,
    });
    const baseScale = params.baseScale ?? 1.08;
    const viewportWidth =
      typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerWidth;
    applyHeroFrame(
      ctx.object,
      state,
      ctx.time,
      resolveHeroBaseScale(viewportWidth, baseScale),
      resolveHeroYOffset(viewportWidth),
    );
    ctx.object.visible = true;
  },
});
```

- [ ] **Step 4: Run the model test and typecheck**

Run:

```bash
npm test -- --run apps/hero-next/test/heroEffect.test.ts
npm run typecheck -w @viselora/hero-next
```

Expected: 4 tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit the model motion replacement**

```bash
git add apps/hero-next/src/heroEffect.ts apps/hero-next/test/heroEffect.test.ts
git commit -m "feat: add mirrored tetrahedron pointer motion"
```

---

### Task 4: Single-Scene Composition And Layout-Only CSS

**Files:**
- Modify: `apps/hero-next/src/HeroExperience.tsx`
- Modify: `apps/hero-next/test/HeroExperience.test.tsx`
- Modify: `apps/hero-next/app/globals.css`
- Modify: `apps/hero-next/test/assetsAndStyle.test.ts`

**Interfaces:**
- Consumes: Task 2's two surface effects and Task 3's model effect.
- Produces: one explicit scene with background depth `5`, model distance about `3.2`, foreground depth `2`, and a stable combined runtime registry.

- [ ] **Step 1: Replace the composition test with a failing one-scene depth contract**

Update the `@viselora/dom-webgl/react` mock in `apps/hero-next/test/HeroExperience.test.tsx` to include `WebGLTarget` and assert the rendered declaration facts:

```tsx
vi.mock("@viselora/dom-webgl/react", () => ({
  WebGLScene: ({ id, children }: PropsWithChildren<{ id: string }>) =>
    createElement("div", { "data-scene": id }, children),
  WebGLCamera: ({ id }: { id: string }) =>
    createElement("div", { "data-camera": id }),
  WebGLModel: ({ id, src }: { id: string; src: string }) =>
    createElement("div", { "data-model": id, "data-src": src }),
  WebGLLight: ({ id }: { id: string }) =>
    createElement("div", { "data-light": id }),
  WebGLTarget: ({
    webgl,
    className,
  }: {
    webgl: {
      key: string;
      placement?: { mode?: string; depth?: number };
      effects?: readonly { kind: string }[];
    };
    className?: string;
  }) =>
    createElement("div", {
      className,
      "data-target": webgl.key,
      "data-placement": webgl.placement?.mode,
      "data-depth": webgl.placement?.depth,
      "data-effect": webgl.effects?.[0]?.kind,
    }),
}));
```

Replace the test body with:

```tsx
test("declares one managed scene with ordered Ghost Cursor depths", () => {
  const html = renderToStaticMarkup(createElement(HeroExperience));

  expect(html.match(/data-scene=/g)).toHaveLength(1);
  expect(html).toContain('data-scene="hero.tetrahedron.scene"');
  expect(html).toContain('data-target="hero.ghost.background"');
  expect(html).toContain('data-effect="hero.ghost.background"');
  expect(html).toContain('data-depth="5"');
  expect(html).toContain('data-model="hero.tetrahedron.model"');
  expect(html).toContain('data-src="/models/4.glb"');
  expect(html).toContain('data-target="hero.ghost.foreground"');
  expect(html).toContain('data-effect="hero.ghost.foreground"');
  expect(html).toContain('data-depth="2"');
  expect(html.match(/data-placement="screen-depth"/g)).toHaveLength(2);
  expect(html.match(/data-light=/g)).toHaveLength(3);
  expect(html).not.toContain("Boo!");
  expect(html).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
});
```

- [ ] **Step 2: Replace the positive CSS-artwork test with a failing negative boundary test**

Keep the asset byte-equality test in `apps/hero-next/test/assetsAndStyle.test.ts`. Replace the second test with:

```ts
test("keeps hero CSS layout-only", () => {
  const css = readFileSync(resolve(appRoot, "app/globals.css"), "utf8");

  expect(css).toMatch(/\.hero-runtime[\s\S]*height:\s*100svh/);
  expect(css).toMatch(/\.hero-runtime canvas[\s\S]*position:\s*fixed/);
  expect(css).toMatch(/\.hero-ghost-surface[\s\S]*position:\s*fixed/);
  expect(css).toMatch(/\.hero-ghost-surface[\s\S]*pointer-events:\s*none/);

  for (const forbidden of [
    /\bbackground(?:-image)?\s*:/,
    /\bcolor\s*:/,
    /\bborder(?:-[\w-]+)?\s*:/,
    /\bbox-shadow\s*:/,
    /\bfilter\s*:/,
    /\bopacity\s*:/,
    /\bmix-blend-mode\s*:/,
    /\btransform\s*:/,
    /\banimation(?:-[\w-]+)?\s*:/,
    /::before|::after/,
    /gradient\(/,
    /data:image/,
  ]) {
    expect(css).not.toMatch(forbidden);
  }
});
```

- [ ] **Step 3: Run both tests to verify they fail against the old studio**

Run:

```bash
npm test -- --run apps/hero-next/test/HeroExperience.test.tsx apps/hero-next/test/assetsAndStyle.test.ts
```

Expected: FAIL because the page has no Ghost Cursor targets and CSS still contains gradients, colors, pseudo-elements, filter, opacity, and blend mode.

- [ ] **Step 4: Compose one scene with stable declarations**

Replace `apps/hero-next/src/HeroExperience.tsx` with:

```tsx
import type { WebGLDeclaration } from "@viselora/dom-webgl";
import {
  WebGLCamera,
  WebGLLight,
  WebGLModel,
  WebGLScene,
  WebGLTarget,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import React from "react";

import { heroTetrahedronEffect } from "./heroEffect";
import { heroGhostEffects } from "./heroGhostEffects";
import { heroSmoothScroll } from "./heroScroll";

const heroEffects = [heroTetrahedronEffect, ...heroGhostEffects] as const;

const renderOptions = {
  id: "hero.tetrahedron.pass",
  camera: "hero.tetrahedron.camera",
  order: 0,
  clear: true,
  clearDepth: true,
} satisfies WebGLSceneRenderOptions;

const ghostBackgroundDeclaration = {
  key: "hero.ghost.background",
  placement: { mode: "screen-depth", depth: 5, size: "dom" },
  source: { kind: "dom", type: "element" },
  lifecycle: { hideWhenReady: true, hideMode: "self" },
  effects: [
    { kind: "hero.ghost.background", color: "#b497cf", brightness: 0.9 },
  ],
} satisfies WebGLDeclaration;

const ghostForegroundDeclaration = {
  key: "hero.ghost.foreground",
  placement: { mode: "screen-depth", depth: 2, size: "dom" },
  source: { kind: "dom", type: "element" },
  lifecycle: { hideWhenReady: true, hideMode: "self" },
  effects: [
    { kind: "hero.ghost.foreground", color: "#b497cf", brightness: 0.18 },
  ],
} satisfies WebGLDeclaration;

const modelLoader = {
  draco: { decoderPath: "/draco/gltf/" },
} satisfies NonNullable<WebGLModelProps["loader"]>;

const modelEffects = [
  { kind: "hero.tetrahedron.motion", baseScale: 1.08 },
] satisfies NonNullable<WebGLModelProps["effects"]>;

const modelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;

const cameraPosition = [0, 0.18, 3.2] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [0, 0.32, 0] satisfies NonNullable<
  WebGLCameraProps["target"]
>;
const keyLightPosition = [-2.4, 1.2, 2.2] satisfies NonNullable<
  WebGLLightProps["position"]
>;
const rimLightPosition = [2.8, -2.4, 2] satisfies NonNullable<
  WebGLLightProps["position"]
>;
const lightTarget = [0, 0, 0] satisfies NonNullable<
  WebGLLightProps["target"]
>;

export function HeroExperience() {
  return (
    <WebGLScrollRuntime
      className="hero-runtime"
      effects={heroEffects}
      smooth={heroSmoothScroll}
    >
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
          <WebGLModel
            id="hero.tetrahedron.model"
            src="/models/4.glb"
            loader={modelLoader}
            effects={modelEffects}
            prepare={modelPrepare}
          />
          <WebGLTarget
            as="div"
            className="hero-ghost-surface hero-ghost-surface--foreground"
            aria-hidden="true"
            webgl={ghostForegroundDeclaration}
          />
          <WebGLLight
            id="hero.tetrahedron.fill"
            kind="ambient"
            color="#d9dce3"
            intensity={0.16}
          />
          <WebGLLight
            id="hero.tetrahedron.key"
            kind="directional"
            color="#eef2f7"
            intensity={3.2}
            position={keyLightPosition}
            target={lightTarget}
          />
          <WebGLLight
            id="hero.tetrahedron.rim"
            kind="directional"
            color="#b497cf"
            intensity={2.6}
            position={rimLightPosition}
            target={lightTarget}
          />
        </WebGLScene>
      </main>
    </WebGLScrollRuntime>
  );
}
```

- [ ] **Step 5: Replace visual CSS with the exact layout-only shell**

Replace `apps/hero-next/app/globals.css` with:

```css
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  overflow-x: hidden;
}

.hero-runtime {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100svh;
  min-height: 100svh;
  overflow: hidden;
}

.hero-runtime canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.hero-space {
  position: relative;
  width: 100%;
  height: 100svh;
  min-height: 100svh;
  overflow: hidden;
  pointer-events: none;
}

.hero-ghost-surface {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
```

- [ ] **Step 6: Run the entire hero test suite, typecheck, and build**

Run:

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

Expected: all hero tests pass, TypeScript reports no errors, Next builds `/`, import checks pass, and `git diff --check` prints nothing.

- [ ] **Step 7: Commit the single-scene migration**

```bash
git add apps/hero-next/src/HeroExperience.tsx apps/hero-next/test/HeroExperience.test.tsx apps/hero-next/app/globals.css apps/hero-next/test/assetsAndStyle.test.ts
git commit -m "feat: compose single-scene ghost cursor hero"
```

---

### Task 5: Real-Browser Tuning, Full Verification, And Documentation Closeout

**Files:**
- Modify only when browser evidence requires it: `apps/hero-next/src/HeroExperience.tsx`
- Modify only when browser evidence requires it: `apps/hero-next/src/heroGhostCursorProgram.ts`
- Modify only when browser evidence requires it: `apps/hero-next/src/heroEffect.ts`
- Modify corresponding literal assertions when accepted tokens change: `apps/hero-next/test/*.test.ts(x)`
- Modify: `docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md`
- Move: `docs/superpowers/plans/2026-07-13-nextjs-tetrahedron-hero.md` to `docs/archive/plans/superpowers/2026-07-13-nextjs-tetrahedron-hero.md`
- Move: `docs/superpowers/plans/2026-07-13-hero-next-matte-studio-depth.md` to `docs/archive/plans/superpowers/2026-07-13-hero-next-matte-studio-depth.md`
- Move after all verification passes: `docs/superpowers/plans/2026-07-13-hero-next-ghost-cursor-depth.md` to `docs/archive/plans/superpowers/2026-07-13-hero-next-ghost-cursor-depth.md`

**Interfaces:**
- Consumes: the production-built single-scene hero.
- Produces: real-browser evidence, accepted visual tokens, full repository verification, and aligned active-plan truth.

- [ ] **Step 1: Start the production app and verify the actual managed canvas**

Run in a persistent terminal:

```bash
npm run start -w @viselora/hero-next -- --hostname 127.0.0.1 --port 3100
```

Use browser automation against `http://127.0.0.1:3100` at `1440x1000` and `390x844`. Confirm the inspected page contains one managed canvas, then capture screenshots and console output.

Expected at desktop size:

- opaque deep-black-purple Ghost Cursor smoke fills the viewport;
- the GLB is visible at a restrained exhibit scale and does not collapse into a silhouette;
- some smoke is visibly behind the model and a much lighter short trail crosses in front;
- pointer motion drives both smoke layers and only subtly tilts the model near the center;
- holding the pointer still returns tilt to neutral in roughly 120ms plus damping time;
- there is no text, border, CSS studio layer, white flash after readiness, horizontal overflow, or console error.

Expected at mobile size:

- the model uses the existing 0.6 responsive scale and `0.19` Y offset;
- touch produces short smoke only while active;
- the composition remains centered with no horizontal overflow.

- [ ] **Step 2: Perform at most two evidence-driven tuning passes inside the approved bounds**

Only these values may change without returning to design:

```text
foreground screen depth: 1.6 to 2.4
background screen depth: 4.4 to 6.0
background brightness: 0.72 to 1.0
foreground brightness: 0.12 to 0.20
model metalness: 0.90 to 0.96
model roughness: 0.06 to 0.12
ambient intensity: 0.10 to 0.22
key intensity: 2.6 to 3.8
rim intensity: 2.0 to 3.2
desktop baseScale: 0.98 to 1.12
```

After each tuning pass run:

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
```

Expected: all hero tests and typecheck remain green. If true front/back depth cannot be demonstrated within these values, stop and report a capability/renderer-order gap instead of adding CSS artwork, `renderOrder`, raw Three.js, or extra scenes/passes.

- [ ] **Step 3: Verify reduced motion in the real browser**

Emulate `prefers-reduced-motion: reduce`, reload, and capture one desktop screenshot.

Expected: the model is static, background smoke is a low-intensity frozen shape, foreground smoke is absent, and no CSS animation supplies a fallback.

- [ ] **Step 4: Run the full repository verification sequence**

Run exactly:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all commands pass. Existing documented Vite chunk-size warnings are acceptable; new warnings, errors, import-boundary violations, or whitespace failures are not.

- [ ] **Step 5: Close documentation truth and archive superseded plans**

In `docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md` change:

```md
**状态：** 已实现并通过自动化与真实浏览器验证
```

Append a `## 验证结果` section containing the actual accepted depth, material, light, brightness, desktop/mobile viewport results, reduced-motion result, console result, and full verification commands. Use exact observed values and command outcomes; do not write generic “passed” without counts or build-route evidence.

Archive the two superseded active plans:

```bash
git mv docs/superpowers/plans/2026-07-13-nextjs-tetrahedron-hero.md docs/archive/plans/superpowers/2026-07-13-nextjs-tetrahedron-hero.md
git mv docs/superpowers/plans/2026-07-13-hero-next-matte-studio-depth.md docs/archive/plans/superpowers/2026-07-13-hero-next-matte-studio-depth.md
git mv docs/superpowers/plans/2026-07-13-hero-next-ghost-cursor-depth.md docs/archive/plans/superpowers/2026-07-13-hero-next-ghost-cursor-depth.md
```

Update references in `apps/hero-next/AGENTS.md` if they still point to the old active-plan paths. Archive the current plan only after Steps 1–4 of this task pass, so an interrupted implementation retains an active recovery plan.

- [ ] **Step 6: Commit browser tuning and closeout documentation**

Stage only files changed by accepted browser evidence and documentation closeout:

```bash
git add apps/hero-next docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md docs/superpowers/plans docs/archive/plans/superpowers
git diff --cached --check
git commit -m "docs: verify ghost cursor hero depth"
```

Before committing, inspect `git diff --cached --name-only` and remove any unrelated file, generated screenshot, `.next` output, token, local configuration, or temporary browser artifact from the index.

---

## Plan Self-Review Checklist

- Every confirmed spec requirement maps to Tasks 1–5.
- The only visual CSS operation is removal; all new visible output is managed shader/model/light output.
- Background and foreground surfaces share one scene and one render pass, with geometric depth rather than pass order.
- The foreground program has a compile-time 12-sample ceiling and transparent output.
- Model motion uses `ctx.time`, `ctx.delta`, and managed pointer state; it does not create timers or a second ticker.
- Reduced motion is implemented in effect state, not CSS.
- Package code, public API, versions, deployment, push, and PR creation remain out of scope.
