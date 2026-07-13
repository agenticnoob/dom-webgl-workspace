# Next.js Tetrahedron Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/hero-next`, a production-buildable Next.js App Router workspace that uses the current Viselora packages, GSAP, and Lenis to render a breathing black tetrahedron in a frosted gray-white full-screen space.

**Architecture:** A client hero composition wraps public scene-native Viselora React declarations in `WebGLScrollRuntime`. A stable scene-object effect owns GSAP-backed breath state, managed transforms, and material styling; the app copies the existing Draco GLB and decoder assets without changing runtime code.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.8, `@viselora/dom-webgl` 0.1.0-alpha.1, `@viselora/scroll-adapters` 0.1.0-alpha.1, GSAP 3.15, Lenis 1.3, Vitest 3.2.

## Global Constraints

- Create `apps/hero-next` as a private npm workspace using App Router and TypeScript.
- Consume only package public entrypoints; never import package `src/` paths or raw Three.js handles.
- Do not modify runtime/package behavior.
- Render exactly one `100svh` pure-visual hero with no visible copy, navigation, controls, branding, CTA, badges, or loading text.
- Copy `apps/example/public/models/4.glb` and its existing Draco decoder files.
- Keep the reserved runtime default scene empty; use `hero.tetrahedron.scene`.
- Reduced-motion mode is static. Extra sections, pointer interaction, postprocessing, deployment, publishing, pushing, and version changes are out of scope.

## File Map

- `apps/hero-next/package.json`, `next.config.ts`, `tsconfig.json`, `next-env.d.ts` — workspace and Next configuration.
- `apps/hero-next/app/layout.tsx`, `page.tsx`, `globals.css` — document shell and exact visual surface.
- `apps/hero-next/src/HeroExperience.tsx` — runtime, scene, camera, model, and lights.
- `apps/hero-next/src/heroEffect.ts` — GSAP-backed managed effect and pure transform helper.
- `apps/hero-next/src/heroScroll.ts` — stable Lenis/GSAP/ScrollTrigger configuration.
- `apps/hero-next/test/*.test.ts(x)` — effect and declaration contracts.
- `apps/hero-next/public/models/4.glb`, `public/draco/gltf/*` — model and decoder assets.
- `docs/README.md`, `docs/STATUS.md` — active documentation truth.

---

### Task 1: Visual Reference And Next.js Workspace Shell

**Files:**
- Create: `apps/hero-next/package.json`
- Create: `apps/hero-next/next.config.ts`
- Create: `apps/hero-next/tsconfig.json`
- Create: `apps/hero-next/next-env.d.ts`
- Create: `apps/hero-next/app/layout.tsx`
- Create: `apps/hero-next/app/page.tsx`
- Create: `apps/hero-next/app/globals.css`
- Create temporarily: `.codex/qa/hero-next/concept.png`

**Interfaces:**
- Consumes: npm workspaces and the approved design spec.
- Produces: a buildable Next workspace and a 1440×1000 visual reference.

- [ ] **Step 1: Generate and inspect the visual reference**

Use `imagegen` with this exact brief and save the result as `.codex/qa/hero-next/concept.png`:

```text
1440x1000 website hero concept, no text and no UI. Cool frosted gray-white
architectural studio, matte, softly luminous, restrained bright center,
slightly darker edges, extremely fine monochrome grain. One regular black
obsidian/smoked-mirror tetrahedron at the exact center, about 38% of the shorter
viewport dimension. Each triangular face and edge is separated only by cool
and subtly warm grazing strip lights plus a weak top fill. No wireframe, neon,
bloom, text, navigation, buttons, logos, badges, or other objects. Quiet,
physically plausible, editorial product photography, effectively monochrome.
```

Inspect it with `view_image`; regenerate if it has UI/text, outline edges, a white/cream background, or a flat black silhouette.

- [ ] **Step 2: Create the manifest**

```json
{
  "name": "@viselora/hero-next",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@viselora/dom-webgl": "0.1.0-alpha.1",
    "@viselora/scroll-adapters": "0.1.0-alpha.1",
    "gsap": "^3.15.0",
    "lenis": "^1.3.23",
    "next": "^16.2.10",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3"
  }
}
```

- [ ] **Step 3: Create Next and TypeScript configuration**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig = {
  transpilePackages: ["@viselora/dom-webgl", "@viselora/scroll-adapters"],
} satisfies NextConfig;

export default nextConfig;
```

`tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "incremental": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", ".next/types/**/*.ts", "app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "test"]
}
```

`next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 4: Create the initial shell**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tetrahedron",
  description: "A Viselora tetrahedron study.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
```

`app/page.tsx`:

```tsx
export default function Page() {
  return <main className="hero-space" aria-label="Tetrahedron visual study" />;
}
```

`app/globals.css`:

```css
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { overflow-x: hidden; }
.hero-space { min-height: 100svh; }
```

- [ ] **Step 5: Install, build, and commit the shell**

Run: `npm install`

Run: `npm run typecheck -w @viselora/hero-next && npm run build -w @viselora/hero-next`

Expected: both pass and Next reports a static `/` route.

```bash
git add package-lock.json apps/hero-next
git commit -m "feat: scaffold Next.js hero workspace"
```

---

### Task 2: Tetrahedron Scene-Object Effect

**Files:**
- Create: `apps/hero-next/src/heroEffect.ts`
- Create: `apps/hero-next/test/heroEffect.test.ts`

**Interfaces:**
- Produces: `heroTetrahedronEffect`, `heroEffects`, `HeroMotionState`, and `applyHeroFrame(...)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test, vi } from "vitest";
import { applyHeroFrame, heroTetrahedronEffect, type HeroMotionState } from "../src/heroEffect";

describe("hero tetrahedron effect", () => {
  test("applies restrained multi-axis breath motion", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = { breath: 1, float: 0.5, phase: Math.PI / 2, reducedMotion: false } satisfies HeroMotionState;
    applyHeroFrame(target, state, 1.08);
    expect(target.scale.setScalar).toHaveBeenCalledWith(expect.closeTo(1.1016, 6));
    expect(target.position.set).toHaveBeenCalledWith(0, 0.0175, 0);
    expect(target.rotation.set).toHaveBeenCalledWith(-0.14, 0.58, 0.05);
  });

  test("reduced motion is static", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    applyHeroFrame(target, { breath: 1, float: 1, phase: Math.PI, reducedMotion: true }, 1.08);
    expect(target.scale.setScalar).toHaveBeenCalledWith(1.08);
    expect(target.position.set).toHaveBeenCalledWith(0, 0, 0);
    expect(target.rotation.set).toHaveBeenCalledWith(-0.22, 0.58, 0.05);
  });

  test("declares managed model frame scheduling", () => {
    expect(heroTetrahedronEffect.kind).toBe("hero.tetrahedron.breathe");
    expect(heroTetrahedronEffect.source).toBe("model");
    expect(heroTetrahedronEffect.schedule).toBe("frame");
  });
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- --run apps/hero-next/test/heroEffect.test.ts`

Expected: FAIL because `heroEffect.ts` does not exist.

- [ ] **Step 3: Implement the effect**

```ts
import gsap from "gsap";
import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";

type HeroEffectParams = { kind: "hero.tetrahedron.breathe"; baseScale?: number };
export type HeroMotionState = { breath: number; float: number; phase: number; reducedMotion: boolean };
type HeroTarget = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: { setScalar(value: number): void };
};

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyHeroFrame(target: HeroTarget, state: HeroMotionState, baseScale: number): void {
  if (state.reducedMotion) {
    target.scale.setScalar(baseScale);
    target.position.set(0, 0, 0);
    target.rotation.set(-0.22, 0.58, 0.05);
    return;
  }
  target.scale.setScalar(baseScale * (1 + state.breath * 0.02));
  target.position.set(0, state.float * 0.035, 0);
  target.rotation.set(-0.22 + Math.sin(state.phase) * 0.08, 0.58 + Math.cos(state.phase) * 0.06, 0.05);
}

export const heroTetrahedronEffect = defineWebGLSceneObjectEffect<HeroEffectParams, HeroMotionState>({
  kind: "hero.tetrahedron.breathe",
  source: "model",
  schedule: "frame",
  setup(ctx) {
    const state = { breath: 0, float: -0.5, phase: 0, reducedMotion: reducedMotion() } satisfies HeroMotionState;
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.color.set("#050607");
      mesh.material.emissive.set("#08090b", 0.08);
      mesh.material.metalness = 0.94;
      mesh.material.roughness = 0.16;
      mesh.material.opacity = 1;
    });
    if (!state.reducedMotion) {
      const breath = gsap.to(state, { breath: 1, duration: 2.5, ease: "sine.inOut", repeat: -1, yoyo: true });
      const float = gsap.to(state, { float: 0.5, duration: 2.8, delay: 0.35, ease: "sine.inOut", repeat: -1, yoyo: true });
      const phase = gsap.to(state, { phase: Math.PI * 2, duration: 24, ease: "none", repeat: -1 });
      ctx.resources.addDisposable(() => { breath.kill(); float.kill(); phase.kill(); });
    }
    return state;
  },
  update(ctx, state, params) {
    ctx.object.visible = true;
    applyHeroFrame(ctx.object, state, params.baseScale ?? 1.08);
  },
});

export const heroEffects = [heroTetrahedronEffect] as const;
```

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run apps/hero-next/test/heroEffect.test.ts && npm run typecheck -w @viselora/hero-next`

Expected: 3 tests and typecheck PASS.

```bash
git add apps/hero-next/src/heroEffect.ts apps/hero-next/test/heroEffect.test.ts
git commit -m "feat: add managed tetrahedron breathing effect"
```

---

### Task 3: Lenis, GSAP, And Managed Hero Scene

**Files:**
- Create: `apps/hero-next/src/heroScroll.ts`
- Create: `apps/hero-next/src/HeroExperience.tsx`
- Create: `apps/hero-next/test/HeroExperience.test.tsx`
- Modify: `apps/hero-next/app/page.tsx`

**Interfaces:**
- Consumes: `heroEffects` and public React package APIs.
- Produces: an explicit scene, camera, model, three lights, and managed scroll lifecycle.

- [ ] **Step 1: Write the failing render contract test**

Use `renderToStaticMarkup`, mock only the two external React adapter modules as transparent elements, render `<HeroExperience />`, and assert all of these exact facts:

```ts
expect(html).toContain('data-scene="hero.tetrahedron.scene"');
expect(html).toContain('data-camera="hero.tetrahedron.camera"');
expect(html).toContain('data-model="hero.tetrahedron.model"');
expect(html).toContain('data-src="/models/4.glb"');
expect(html.match(/data-light=/g)).toHaveLength(3);
expect(html).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
```

Run: `npm test -- --run apps/hero-next/test/HeroExperience.test.tsx`

Expected: FAIL because `HeroExperience.tsx` does not exist.

- [ ] **Step 2: Create stable smooth-scroll config**

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import type { WebGLScrollSmoothOptions } from "@viselora/scroll-adapters/react";

gsap.registerPlugin(ScrollTrigger);
export const heroSmoothScroll = {
  createLenis: () => new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false }),
  gsap,
  ScrollTrigger,
  disableLagSmoothing: true,
} satisfies WebGLScrollSmoothOptions;
```

- [ ] **Step 3: Compose `HeroExperience`**

Create a `"use client"` component using `WebGLScrollRuntime`, `WebGLScene`, `WebGLCamera`, `WebGLModel`, and three `WebGLLight` declarations with these stable values:

```ts
const renderOptions = { id: "hero.tetrahedron.pass", camera: "hero.tetrahedron.camera", order: 0, clear: true, clearDepth: true } satisfies WebGLSceneRenderOptions;
const modelLoader = { draco: { decoderPath: "/draco/gltf/" } } satisfies NonNullable<WebGLModelProps["loader"]>;
const modelEffects = [{ kind: "hero.tetrahedron.breathe", baseScale: 1.08 }] satisfies NonNullable<WebGLModelProps["effects"]>;
const cameraPosition = [0, 0.18, 3.2] satisfies NonNullable<WebGLCameraProps["position"]>;
const cameraTarget = [0, 0.12, 0] satisfies NonNullable<WebGLCameraProps["target"]>;
const coolLightPosition = [-2.4, 1.2, 2.2] satisfies NonNullable<WebGLLightProps["position"]>;
const warmLightPosition = [2.1, -0.4, 1.4] satisfies NonNullable<WebGLLightProps["position"]>;
```

The returned tree must be:

```tsx
<WebGLScrollRuntime className="hero-runtime" effects={heroEffects} smooth={heroSmoothScroll}>
  <main className="hero-space" aria-label="Tetrahedron visual study">
    <WebGLScene id="hero.tetrahedron.scene" projection="perspective-stage" render={renderOptions}>
      <WebGLCamera id="hero.tetrahedron.camera" default type="perspective" mode="perspective-stage" fov={38} near={0.1} far={50} position={cameraPosition} target={cameraTarget} />
      <WebGLModel id="hero.tetrahedron.model" src="/models/4.glb" loader={modelLoader} effects={modelEffects} prepare={{ renderWarmup: "idle" }} />
      <WebGLLight id="hero.tetrahedron.fill" kind="ambient" color="#dfe3e5" intensity={0.42} />
      <WebGLLight id="hero.tetrahedron.cool-rim" kind="point" color="#d9e5ec" intensity={10.5} distance={8} decay={2} position={coolLightPosition} />
      <WebGLLight id="hero.tetrahedron.warm-rim" kind="point" color="#e8ded2" intensity={8.2} distance={7} decay={2} position={warmLightPosition} />
    </WebGLScene>
  </main>
</WebGLScrollRuntime>
```

Hoist all tuple arrays and declaration objects to module-level `const` values with `satisfies` so React does not re-register them.

- [ ] **Step 4: Route and verify**

Replace `app/page.tsx`:

```tsx
import { HeroExperience } from "../src/HeroExperience";
export default function Page() { return <HeroExperience />; }
```

Run: `npm test -- --run apps/hero-next/test/heroEffect.test.ts apps/hero-next/test/HeroExperience.test.tsx`

Run: `npm run typecheck -w @viselora/hero-next`

Expected: 4 tests and typecheck PASS.

```bash
git add apps/hero-next/app/page.tsx apps/hero-next/src apps/hero-next/test/HeroExperience.test.tsx
git commit -m "feat: compose managed tetrahedron hero scene"
```

---

### Task 4: Assets, Styling, Browser Fidelity, And Docs

**Files:**
- Copy: model and three Draco files into `apps/hero-next/public/`
- Modify: `apps/hero-next/app/globals.css`
- Modify: `docs/README.md`
- Modify: `docs/STATUS.md`
- Remove before handoff: `.codex/qa/hero-next/`

**Interfaces:**
- Produces: final browser-verified hero and synchronized active docs.

- [ ] **Step 1: Copy only required assets**

```bash
mkdir -p apps/hero-next/public/models apps/hero-next/public/draco/gltf
cp apps/example/public/models/4.glb apps/hero-next/public/models/4.glb
cp apps/example/public/draco/gltf/draco_decoder.js apps/hero-next/public/draco/gltf/
cp apps/example/public/draco/gltf/draco_decoder.wasm apps/hero-next/public/draco/gltf/
cp apps/example/public/draco/gltf/draco_wasm_wrapper.js apps/hero-next/public/draco/gltf/
```

- [ ] **Step 2: Implement frosted-space CSS**

Use a `#d9dcdd` page base; `.hero-runtime` is isolated, `100svh`, overflow hidden, and uses:

```css
background: radial-gradient(circle at 50% 46%, #f0f1f1 0%, #e4e6e6 38%, #cfd2d3 100%);
```

Make the runtime canvas fixed/inset 0/full size. Make `.hero-space` `100svh`, pointerless, and add only one `::after` grain overlay using an inline SVG `feTurbulence`, `opacity: .12`, and `mix-blend-mode: soft-light`. Add a `max-width: 700px` cooler gray radial-gradient adjustment and a reduced-motion `scroll-behavior: auto` rule. Do not add visible elements.

- [ ] **Step 3: Verify real runtime and assets**

Run: `npm run dev -w @viselora/hero-next`

Using the in-app browser, prove `/models/4.glb` and the selected Draco decoder return 200, the canvas/model render, and no error contains `unknown effect`, `not a scene-object effect`, or Draco/model load failure.

- [ ] **Step 4: Desktop fidelity loop**

At 1440×1000 capture `.codex/qa/hero-next/desktop.png`; inspect concept and render with `view_image` in the same pass. Fix these five points: zero visible copy/UI, centered 38%-short-side model, cool gray-white background, legible faces/edges without wireframe/bloom, and nearly invisible grain. Tune only camera/FOV, base scale, managed lights/materials, and approved CSS values.

- [ ] **Step 5: Motion, mobile, and reduced-motion proof**

Observe one full five-second breath; scale stays within 2%. At 390×844 capture mobile proof and confirm no overflow. Emulate reduced motion, reload, and confirm the object is static. Use a browser-injected temporary page height to prove Lenis updates, then remove it without committing extra content.

- [ ] **Step 6: Synchronize docs**

Add `apps/hero-next` to `docs/README.md`. Add a dated `2026-07-13` note to `docs/STATUS.md` distinguishing implemented (workspace, public managed model, Lenis/GSAP), verified (tests/build/browser GLB+Draco desktop/mobile), and unchanged (runtime API/roadmap). Do not claim deployment.

- [ ] **Step 7: Full verification**

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all exit 0; import guard prints `Example import boundaries OK`.

- [ ] **Step 8: Scope audit, cleanup, and commit**

```bash
rg -n "packages/.*/src|from ['\"]three|<h[1-6]|<p|<button|<nav|<a " apps/hero-next --glob '!public/**'
git status --short
```

Expected: no forbidden imports or visible-copy elements. Remove `.codex/qa/hero-next/` while preserving pre-existing user files.

```bash
git add apps/hero-next docs/README.md docs/STATUS.md package-lock.json
git diff --cached --check
git commit -m "feat: add verified tetrahedron hero"
```

Final handoff: report concept and browser methods, GLB/Draco proof, five comparison points, copy diff, verification commands, intentional deviations, and known issues.
