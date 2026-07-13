# Hero Next Matte Studio Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat gray-white hero background with a matte warm-gray seamless studio that has a soft horizon and contact shadow while keeping the tetrahedron as the only subject.

**Architecture:** CSS layers behind the runtime canvas own the loading-safe studio surface, horizon, vignette, contact shadow, and grain. The existing explicit WebGL scene continues to own only the model, camera, and lights; no runtime API or raw Three.js access is added.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.8, CSS gradients, Vitest 3.2, existing `@viselora/dom-webgl` 0.1.0-alpha.1 runtime.

## Global Constraints

- Keep the hero pure visual: no copy, navigation, controls, branding, CTA, or decorative objects.
- Use a matte warm gray-white palette; do not use pure white, saturated color, a visible grid, fog, particles, or postprocessing.
- Keep `hero.tetrahedron.scene` explicit and the reserved default scene empty.
- Do not change runtime/package behavior or import raw Three.js handles.
- Keep the model motion, responsive scale, and reduced-motion behavior unchanged unless browser evidence demonstrates a regression.
- Do not deploy, publish, push, or change package versions.

## File Map

- `apps/hero-next/test/assetsAndStyle.test.ts` — executable contract for the studio palette, layered depth, contact shadow, grain, and responsive fallback.
- `apps/hero-next/app/globals.css` — the entire matte studio background implementation behind the WebGL canvas.
- `docs/superpowers/specs/2026-07-13-hero-next-matte-studio-depth-design.md` — records the verified CSS/WebGL ownership boundary.

---

### Task 1: Matte Studio Background Contract And Implementation

**Files:**
- Modify: `apps/hero-next/test/assetsAndStyle.test.ts`
- Modify: `apps/hero-next/app/globals.css`

**Interfaces:**
- Consumes: the existing `.hero-runtime`, `.hero-runtime canvas`, `.hero-space`, and `.hero-space::after` selectors.
- Produces: `.hero-runtime::before` as the canvas-behind horizon/contact-shadow layer and stable palette tokens `#d2d0ca`, `#efeee9`, `#e4e2dc`, `#cfcdc6`.

- [ ] **Step 1: Replace the visual-surface assertions with the failing studio-depth contract**

Keep the asset-copy test unchanged. Replace the second test in `apps/hero-next/test/assetsAndStyle.test.ts` with:

```ts
  test("defines the matte studio depth layers and motion fallback", () => {
    const css = readFileSync(resolve(appRoot, "app/globals.css"), "utf8");

    expect(css).toContain("#d2d0ca");
    expect(css).toContain("#efeee9");
    expect(css).toContain("#e4e2dc");
    expect(css).toContain("#cfcdc6");
    expect(css).toMatch(
      /\.hero-runtime[\s\S]*radial-gradient[\s\S]*linear-gradient[\s\S]*100svh[\s\S]*overflow:\s*hidden/,
    );
    expect(css).toMatch(
      /\.hero-runtime::before[\s\S]*radial-gradient[\s\S]*linear-gradient[\s\S]*filter:\s*blur\(10px\)[\s\S]*z-index:\s*0/,
    );
    expect(css).toMatch(
      /\.hero-runtime canvas[\s\S]*position:\s*fixed[\s\S]*z-index:\s*1/,
    );
    expect(css).toMatch(
      /\.hero-space[\s\S]*z-index:\s*2[\s\S]*\.hero-space::after[\s\S]*feTurbulence[\s\S]*opacity:\s*\.07/,
    );
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("ellipse 30% 7% at 50% 72%");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("scroll-behavior: auto");
  });
```

- [ ] **Step 2: Run the focused test to verify it fails for the missing depth layers**

Run:

```bash
npm test -- --run apps/hero-next/test/assetsAndStyle.test.ts
```

Expected: FAIL on the new warm-gray tokens and `.hero-runtime::before` assertions because the current stylesheet still contains only one radial background.

- [ ] **Step 3: Replace `apps/hero-next/app/globals.css` with the matte studio implementation**

```css
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: #d2d0ca;
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
  background:
    radial-gradient(
      ellipse 48% 36% at 50% 42%,
      rgba(255, 255, 252, 0.82) 0%,
      rgba(239, 238, 233, 0.42) 58%,
      rgba(239, 238, 233, 0) 100%
    ),
    linear-gradient(
      180deg,
      #efeee9 0%,
      #e9e7e1 48%,
      #e4e2dc 59%,
      #d9d7d0 72%,
      #cfcdc6 100%
    );
}

.hero-runtime::before {
  position: fixed;
  inset: 0;
  z-index: 0;
  content: "";
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 26% 8% at 50% 69%,
      rgba(74, 72, 67, 0.2) 0%,
      rgba(91, 88, 82, 0.1) 42%,
      rgba(117, 113, 105, 0) 76%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 54%,
      rgba(135, 131, 122, 0.08) 61%,
      rgba(255, 255, 252, 0.12) 69%,
      rgba(255, 255, 255, 0) 88%
    );
  filter: blur(10px);
  opacity: 0.82;
}

.hero-runtime canvas {
  position: fixed;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
}

.hero-space {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100svh;
  min-height: 100svh;
  overflow: hidden;
  pointer-events: none;
}

.hero-space::after {
  position: fixed;
  inset: 0;
  content: "";
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='.34'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  opacity: .07;
  mix-blend-mode: soft-light;
}

@media (max-width: 700px) {
  .hero-runtime {
    background:
      radial-gradient(
        ellipse 62% 38% at 50% 44%,
        rgba(255, 255, 252, 0.76) 0%,
        rgba(239, 238, 233, 0.32) 62%,
        rgba(239, 238, 233, 0) 100%
      ),
      linear-gradient(
        180deg,
        #efeee9 0%,
        #e8e6e0 51%,
        #dfddd7 64%,
        #cfcdc6 100%
      );
  }

  .hero-runtime::before {
    background:
      radial-gradient(
        ellipse 30% 7% at 50% 72%,
        rgba(74, 72, 67, 0.17) 0%,
        rgba(91, 88, 82, 0.08) 46%,
        rgba(117, 113, 105, 0) 78%
      ),
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0) 58%,
        rgba(135, 131, 122, 0.07) 65%,
        rgba(255, 255, 252, 0.1) 73%,
        rgba(255, 255, 255, 0) 90%
      );
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

- [ ] **Step 4: Run the focused style test and hero workspace checks**

Run:

```bash
npm test -- --run apps/hero-next/test/assetsAndStyle.test.ts
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
git diff --check
```

Expected: the focused test passes, TypeScript reports no errors, Next produces the `/` route successfully, and `git diff --check` prints nothing.

- [ ] **Step 5: Commit the tested studio background**

```bash
git add apps/hero-next/app/globals.css apps/hero-next/test/assetsAndStyle.test.ts
git commit -m "feat: add matte studio depth to hero"
```

---

### Task 2: Real-Browser Visual Verification And Closeout

**Files:**
- Modify only if browser evidence requires it: `apps/hero-next/app/globals.css`

**Interfaces:**
- Consumes: the production-built hero and its matte studio CSS layers.
- Produces: desktop/mobile browser evidence that the real GLB remains visible and the background reads as a seamless studio.

- [ ] **Step 1: Start the production hero and capture desktop/mobile screenshots**

Run:

```bash
npm run start -w @viselora/hero-next -- --hostname 127.0.0.1 --port 3100
```

Use browser automation to open `http://127.0.0.1:3100` at `1440x1000` and `390x844`. Capture screenshots and inspect the console.

Expected at both sizes:

- the real tetrahedron is visible and remains the only subject;
- the page reads as warm-gray matte rather than blue-gray, pure white, or glossy;
- a soft wall-to-floor transition is visible without a hard room corner;
- the contact shadow sits below the object and does not overlap its lower faces;
- no visible text, horizontal overflow, white flash, or console error appears.

- [ ] **Step 2: Apply at most one evidence-driven CSS tuning pass**

If the studio still reads flat, adjust only these values in `app/globals.css`:

- desktop contact-shadow Y position: `69%` within `66%` to `72%`;
- desktop contact-shadow opacity: first radial alpha `0.16` to `0.24`;
- horizon transition: linear-gradient stops `54%` to `69%`;
- edge depth: final background color between `#cbc9c2` and `#d4d2cc`.

Do not add new layers, animation, WebGL primitives, or runtime changes. Re-run the focused test after any tuning; update exact token assertions only when the accepted browser result changes a tested literal.

- [ ] **Step 3: Run the full repository verification sequence**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all commands pass with no TypeScript errors, failing tests, workspace build errors, import-boundary violations, or whitespace errors.

- [ ] **Step 4: Commit an evidence-driven tuning pass only if Step 2 changed files**

```bash
git add apps/hero-next/app/globals.css apps/hero-next/test/assetsAndStyle.test.ts
git commit -m "fix: tune hero studio depth"
```

If Step 2 required no file changes, do not create an empty commit.
