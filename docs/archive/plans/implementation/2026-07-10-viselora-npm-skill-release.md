# Viselora npm Package And Skill Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare, validate, document, and commit the capability-stable Viselora `0.1.0-alpha.0` npm packages and same-repository `viselora-dom-webgl` Agent Skill without publishing them or creating the later MVP repository.

**Architecture:** Preserve the existing runtime/API implementation and change only its release engineering, public identity, consumer verification, documentation, and agent guidance. Build both ESM-only entrypoint pairs with tsup, validate exact tarball contents, install those tarballs into an OS-temporary React/Vite consumer, and centralize lockstep version and idempotent registry logic in tested Node ESM scripts. Keep the skill procedural and small, with detailed public API, recipe, troubleshooting, and verification material under one-level references/templates.

**Tech Stack:** npm workspaces, TypeScript 5.8, tsup 8, Vitest 3, React 19, Vite, Node.js ESM scripts, npm 11, GitHub Actions, Agent Skills.

## Global Constraints

- Brand is `Viselora`; npm scope is `@viselora`; license is `MIT`.
- Release both `@viselora/dom-webgl@0.1.0-alpha.0` and `@viselora/scroll-adapters@0.1.0-alpha.0` together with exact lockstep versions.
- Publish ESM only; use tsup to emit `dist/index.js`, `dist/index.js.map`, `dist/index.d.ts`, `dist/react.js`, `dist/react.js.map`, and `dist/react.d.ts` for each package.
- Package `exports` must reference `dist` only; do not retain `@project/*` compatibility aliases.
- Do not add CommonJS, Changesets, R3F, built-in effect exports, a CLI, a project generator, or new runtime capability.
- Preserve one page-level runtime/canvas, one scroll source, one pointer source, public entrypoints, stable effects/declarations, fallback/offscreen/disposal ownership, and runtime-private Three.js internals.
- Create the public skill at `skills/viselora-dom-webgl/` and keep it in this repository for the alpha.
- The five consumer recipe families are surface pulse, video background texture, image hover overlay or Ghost Cursor, pinned model animation with emissive glow, and scroll-controlled image sequence.
- Keep existing user documentation changes; replace uncommitted `docs/project-freeze.md` with `docs/project-release-validation.md` and rewrite active docs to capability-stable release-validation state.
- Do not create the formal MVP repository in this workspace.
- `verify.yml` and `release.yml` use Node 24 and npm 11; `release.yml` uses the protected `npm-release` Environment and `id-token: write`.
- Publication order is core then adapters; retries are idempotent; never unpublish or overwrite an existing version.
- Do not run `npm publish` in local implementation. Stop after commit and report the exact npm/GitHub bootstrap checklist.
- Preserve existing public API behavior and package boundaries; release work must not refactor runtime internals.

---

### Task 1: Public package identity, ESM build, and consumer import migration

**Files:**
- Create: `LICENSE`
- Create: `packages/dom-webgl-runtime/LICENSE`
- Create: `packages/dom-webgl-scroll-adapters/LICENSE`
- Create: `packages/dom-webgl-runtime/README.md`
- Create: `packages/dom-webgl-scroll-adapters/README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/dom-webgl-runtime/package.json`
- Modify: `packages/dom-webgl-scroll-adapters/package.json`
- Modify: `apps/example/package.json`
- Modify: every source/test/script public import returned by `rg -l '@project/dom-webgl-runtime|@project/dom-webgl-scroll-adapters' apps packages test scripts AGENTS.md`
- Modify: `scripts/assert-example-public-imports.mjs`
- Modify: `packages/dom-webgl-runtime/test/index.test.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `test/workspace.test.ts`
- Test: `test/release-packages.test.ts`

**Interfaces:**
- Consumes: existing `src/index.ts` and `src/react.ts` entrypoints in each package without changing their exported symbols.
- Produces: installable `@viselora/dom-webgl` and `@viselora/scroll-adapters` workspaces, exact ESM `dist` entrypoints, MIT package metadata, and migrated repository consumers.

- [ ] **Step 1: Write failing package release-contract tests**

Create `test/release-packages.test.ts` that reads both manifests and asserts the exact package names/version, `type: "module"`, `files`, `exports`, `publishConfig`, repository metadata, dependency/peer split, and six expected dist filenames. Extend `test/workspace.test.ts` and `packages/dom-webgl-runtime/test/index.test.ts` to expect `@viselora/*`, `dist` exports, and the new root release scripts introduced by later tasks only when those tasks land.

The manifest assertions must include:

```ts
expect(runtimePackage).toMatchObject({
  name: "@viselora/dom-webgl",
  version: "0.1.0-alpha.0",
  type: "module",
  files: ["dist", "README.md", "LICENSE"],
  license: "MIT",
  publishConfig: { access: "public" },
  repository: {
    type: "git",
    url: "git+https://github.com/agenticnoob/dom-webgl-workspace.git",
    directory: "packages/dom-webgl-runtime",
  },
  exports: {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./react": { types: "./dist/react.d.ts", import: "./dist/react.js" },
  },
});

expect(adaptersPackage.dependencies).toEqual({
  "@viselora/dom-webgl": "0.1.0-alpha.0",
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- --run test/release-packages.test.ts test/workspace.test.ts packages/dom-webgl-runtime/test/index.test.ts
```

Expected: FAIL because package names are still `@project/*`, exports still point to `src`, and publish metadata/dist scripts do not exist.

- [ ] **Step 3: Add MIT license and package metadata/build configuration**

Use the standard MIT text with `Copyright (c) 2026 Viselora` in all three LICENSE files. Configure both packages with:

```json
{
  "version": "0.1.0-alpha.0",
  "type": "module",
  "files": ["dist", "README.md", "LICENSE"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsup src/index.ts src/react.ts --format esm --dts --sourcemap --clean --splitting false --out-dir dist"
  },
  "bugs": { "url": "https://github.com/agenticnoob/dom-webgl-workspace/issues" },
  "homepage": "https://github.com/agenticnoob/dom-webgl-workspace#readme",
  "license": "MIT",
  "publishConfig": { "access": "public" }
}
```

Set runtime dependencies to `three: ^0.184.0` and optional peer `react: >=18.0.0`. Set adapter exact dependency to `@viselora/dom-webgl: 0.1.0-alpha.0` and optional peers `gsap: >=3.12.0`, `lenis: >=1.0.0`, and `react: >=18.0.0`. Add `tsup: ^8.5.0` to root devDependencies with npm so the lockfile records it.

- [ ] **Step 4: Migrate all repository code consumers and boundary checks**

Replace only package identity strings:

```text
@project/dom-webgl-runtime         -> @viselora/dom-webgl
@project/dom-webgl-scroll-adapters -> @viselora/scroll-adapters
```

Rename the private example workspace to `@viselora/example`. Update `scripts/assert-example-public-imports.mjs` so allowed public prefixes are `@viselora/dom-webgl` and `@viselora/scroll-adapters`, and so any `@project/` import fails. Do not alter effect kinds, runtime behavior, target keys, assets, or example visuals.

- [ ] **Step 5: Add package-specific READMEs**

The core README must show `npm install @viselora/dom-webgl@alpha`, root and `/react` entrypoints, optional React peer, one stable module-scope effect example, and no raw Three/R3F escape hatch. The adapters README must show `npm install @viselora/scroll-adapters@alpha gsap lenis`, root and `/react` entrypoints, optional peers, and exact core-version lockstep.

- [ ] **Step 6: Install dependencies, build, and verify GREEN**

Run:

```bash
npm install
npm test -- --run test/release-packages.test.ts test/workspace.test.ts packages/dom-webgl-runtime/test/index.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
npm run build
npm run check:imports
rg -n '@project/dom-webgl-runtime|@project/dom-webgl-scroll-adapters' apps packages test scripts AGENTS.md
```

Expected: focused tests/build/import check PASS; the final `rg` returns no matches in code/test/script/AGENTS surfaces; each package has exactly the six expected `dist` outputs.

- [ ] **Step 7: Commit Task 1**

```bash
git add LICENSE package.json package-lock.json packages apps test scripts AGENTS.md
git commit -m "build: prepare Viselora alpha packages"
```

### Task 2: Public `viselora-dom-webgl` Agent Skill and five recipes

**Files:**
- Create: `skills/viselora-dom-webgl/SKILL.md`
- Create: `skills/viselora-dom-webgl/agents/openai.yaml`
- Create: `skills/viselora-dom-webgl/references/quickstart.md`
- Create: `skills/viselora-dom-webgl/references/public-api.md`
- Create: `skills/viselora-dom-webgl/references/architecture-rules.md`
- Create: `skills/viselora-dom-webgl/references/effect-recipes.md`
- Create: `skills/viselora-dom-webgl/references/troubleshooting.md`
- Create: `skills/viselora-dom-webgl/references/verification.md`
- Create: `skills/viselora-dom-webgl/templates/react-vite/package.json`
- Create: `skills/viselora-dom-webgl/templates/react-vite/src/App.tsx`
- Create: `skills/viselora-dom-webgl/templates/react-vite/src/effects.ts`
- Create: `skills/viselora-dom-webgl/templates/effects/surface-pulse.ts`
- Create: `skills/viselora-dom-webgl/templates/effects/video-background-texture.ts`
- Create: `skills/viselora-dom-webgl/templates/effects/image-hover-overlay.ts`
- Create: `skills/viselora-dom-webgl/templates/effects/pinned-model-glow.tsx`
- Create: `skills/viselora-dom-webgl/templates/effects/scroll-image-sequence.tsx`
- Create: `skills/viselora-dom-webgl/scripts/verify-consumer.mjs`
- Test: `test/skill.test.ts`

**Interfaces:**
- Consumes: only `@viselora/dom-webgl`, `@viselora/dom-webgl/react`, `@viselora/scroll-adapters`, and `@viselora/scroll-adapters/react` public entrypoints.
- Produces: an Agent Skills-compatible skill declaring `Compatible package version: 0.1.0-alpha.0`, five complete consumer recipes, a reusable React/Vite template, and a deterministic consumer verifier.

- [ ] **Step 1: Initialize the skill with the official scaffold tool**

Run:

```bash
python /Users/ai/.codex/skills/.system/skill-creator/scripts/init_skill.py viselora-dom-webgl \
  --path skills \
  --resources scripts,references \
  --interface 'display_name=Viselora DOM WebGL' \
  --interface 'short_description=Build verified DOM-first WebGL pages with Viselora' \
  --interface 'default_prompt=Use $viselora-dom-webgl to build a DOM-first WebGL page with one runtime and verified public package imports.'
```

Create `templates/` manually because it is a skill-specific reusable output resource required by the approved design.

- [ ] **Step 2: Write failing structural and verifier tests**

Create `test/skill.test.ts` to assert the exact required tree, YAML frontmatter with only `name` and `description`, matching `agents/openai.yaml`, compatible version text, five recipe headings/files, no `@project/*`, no `@react-three/fiber`, and executable verifier behavior. In temp consumer directories, verify that the script rejects:

```text
@project/* imports
packages/dom-webgl-runtime/src imports
two WebGLRuntime/WebGLScrollRuntime roots
new WebGLRenderer(...)
@react-three/fiber or <Canvas>
runtimeEffects declared inside a React component
missing video, pointer-hover, pinned-model/glow, or image-sequence surfaces
```

and accepts the supplied `templates/react-vite` consumer.

- [ ] **Step 3: Run skill tests and verify RED**

Run:

```bash
npm test -- --run test/skill.test.ts
```

Expected: FAIL because the scaffold still contains placeholders and recipes/verifier/template are incomplete.

- [ ] **Step 4: Write concise procedural SKILL.md and one-level references**

Keep `SKILL.md` under 500 lines and use imperative language. Its workflow must be:

```text
decide fit -> install exact alpha -> create one runtime -> define module-scope effects -> declare DOM-first targets -> add one scroll/pointer pipeline -> choose lifecycle/offscreen policy -> run verifier/typecheck/build
```

Route detailed package symbols to `public-api.md`, ownership prohibitions to `architecture-rules.md`, five full implementations to `effect-recipes.md` and templates, expected failures to `troubleshooting.md`, and commands to `verification.md`. State that R3F, a second renderer/canvas, repository source paths, unstable effect arrays, per-component scroll/pointer listeners, and hidden fallback during loading/error are prohibited.

- [ ] **Step 5: Implement five complete consumer templates**

Use app-owned effect kinds and existing managed facades:

```text
viselora.surfacePulse          dom/element + ctx.object.surface/material + time
viselora.videoBackground      media/video + ctx.object.texture/video
viselora.imageHoverOverlay    media/image + pointer.hover + managed material layer
viselora.modelGlow            model/glb or WebGLModel + named scroll timeline + animation/emissive/light
viselora.imageSequence        media/image-sequence + stable progressKey
```

Every target declaration includes explicit fallback/lifecycle/offscreen intent. The React template contains exactly one `WebGLScrollRuntime`, a module-scope `runtimeEffects` array, one shared progress path, no R3F import, and no direct Three renderer construction.

- [ ] **Step 6: Implement `verify-consumer.mjs`**

The verifier accepts an optional consumer root, reads `package.json` plus JS/TS/JSX/TSX source files excluding `node_modules`, and exits nonzero with one line per violation. Check package versions, old/private imports, runtime root count, renderer/R3F creation, module-scope `runtimeEffects`, one scroll/pointer ownership path, and static evidence for all five recipe surfaces. It must not modify the consumer.

- [ ] **Step 7: Validate the skill and verify GREEN**

Run:

```bash
python /Users/ai/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/viselora-dom-webgl
node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite
npm test -- --run test/skill.test.ts
```

Expected: all three commands PASS with no placeholders or prohibited imports.

- [ ] **Step 8: Commit Task 2**

```bash
git add skills/viselora-dom-webgl test/skill.test.ts
git commit -m "feat: add Viselora consumer skill"
```

### Task 3: Lockstep release-version management

**Files:**
- Create: `scripts/release-version.mjs`
- Create: `scripts/set-release-version.mjs`
- Test: `test/release-version.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: two package manifests, adapter exact dependency, skill `Compatible package version` line, and npm lockfile workspace entries.
- Produces: `readReleaseVersions(root)`, `assertReleaseVersions(root, expected?)`, `setReleaseVersion(root, version)`, and CLI `node scripts/set-release-version.mjs <version>`.

- [ ] **Step 1: Write failing version tests against temporary repository fixtures**

Cover valid prerelease `0.1.0-alpha.0`, mismatched core/adapters/dependency/skill/lockfile states, invalid versions, and atomic updates. Assert accepted versions with:

```js
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+-alpha\.\d+$/;
```

The atomicity test makes one target file read-only or malformed and asserts all original files remain byte-for-byte unchanged after failure.

- [ ] **Step 2: Run version tests and verify RED**

Run `npm test -- --run test/release-version.test.ts`.

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement version reader/assertion/setter and CLI**

Parse JSON without `eval`; update both manifest versions, adapter exact core dependency, skill compatible version line, lockfile workspace versions/names/dependencies, app workspace dependency names, and lockfile `node_modules/@viselora/*` links. Prepare every new file body in memory, validate the complete next state, then write; on any write failure restore captured original bytes before rethrowing.

Expose root scripts:

```json
{
  "release:version": "node ./scripts/set-release-version.mjs",
  "verify:versions": "node ./scripts/set-release-version.mjs --check"
}
```

- [ ] **Step 4: Verify current version and GREEN**

Run:

```bash
node scripts/set-release-version.mjs --check
node scripts/set-release-version.mjs 0.1.0-alpha.0
npm test -- --run test/release-version.test.ts
git diff --exit-code package-lock.json packages/dom-webgl-runtime/package.json packages/dom-webgl-scroll-adapters/package.json skills/viselora-dom-webgl/SKILL.md
```

Expected: check reports both packages/skill at `0.1.0-alpha.0`, tests PASS, and the idempotent setter creates no diff.

- [ ] **Step 5: Commit Task 3**

```bash
git add package.json package-lock.json scripts/release-version.mjs scripts/set-release-version.mjs test/release-version.test.ts
git commit -m "build: enforce lockstep release versions"
```

### Task 4: `npm pack --json` tarball allowlist verification

**Files:**
- Create: `scripts/package-tarballs.mjs`
- Create: `scripts/verify-package-tarballs.mjs`
- Test: `test/package-tarballs.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: built package directories and npm 11 `npm pack --json` output.
- Produces: `packAndVerifyPackage(packageDir, destination)`, exact file allowlist diagnostics, SHA/integrity metadata, disposable `.tgz` paths outside the repository, and `npm run verify:tarballs`.

- [ ] **Step 1: Write failing allowlist tests**

Test exact acceptance of:

```text
package.json
README.md
LICENSE
dist/index.js
dist/index.js.map
dist/index.d.ts
dist/react.js
dist/react.js.map
dist/react.d.ts
```

Reject missing entries, `src/**`, `test/**`, docs, examples, temporary assets, undeclared chunks, and any unexpected file. Test parsing of a representative `npm pack --json` result including `filename`, `integrity`, `shasum`, and `files`.

- [ ] **Step 2: Run tarball tests and verify RED**

Run `npm test -- --run test/package-tarballs.test.ts`.

Expected: FAIL because pack utilities do not exist.

- [ ] **Step 3: Implement pack/allowlist utility and CLI**

Use `mkdtemp(path.join(os.tmpdir(), "viselora-pack-"))`, invoke `npm pack --json --pack-destination <temp>` in each package directory, parse exactly one result, compare sorted file paths against the allowlist, and remove the temp directory unless the caller explicitly requests returned tarballs for the external fixture/publisher.

Expose:

```json
{
  "pack:verify": "node ./scripts/verify-package-tarballs.mjs",
  "verify:tarballs": "npm run build && npm run pack:verify"
}
```

- [ ] **Step 4: Run real `npm pack --json` validation and verify GREEN**

Run:

```bash
npm test -- --run test/package-tarballs.test.ts
npm run verify:tarballs
find . -name '*.tgz' -not -path './node_modules/*'
```

Expected: tests PASS, both tarballs report the exact nine-file allowlist, and no `.tgz` remains inside the repository.

- [ ] **Step 5: Commit Task 4**

```bash
git add package.json scripts/package-tarballs.mjs scripts/verify-package-tarballs.mjs test/package-tarballs.test.ts
git commit -m "test: verify npm package tarballs"
```

### Task 5: Repository-external React/Vite tarball consumer fixture

**Files:**
- Create: `scripts/external-consumer-fixture.mjs`
- Create: `scripts/verify-external-consumer.mjs`
- Test: `test/external-consumer-fixture.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: verified core/adapters `.tgz` absolute paths from `packAndVerifyPackage`.
- Produces: a disposable fixture under `os.tmpdir()`, root/react import probes, SSR import probe, TypeScript check, one-runtime/one-canvas/one-target Vitest smoke, and Vite production build.

- [ ] **Step 1: Write failing fixture-generation tests**

Assert generated `package.json`, `tsconfig.json`, `index.html`, `src/App.tsx`, `src/effects.ts`, `scripts/verify-ssr.mjs`, and `test/runtime.test.tsx`. Assert the generated project contains absolute `.tgz` dependencies but no workspace dependency, package-source directory link, TS path alias, or monorepo import.

- [ ] **Step 2: Run fixture tests and verify RED**

Run `npm test -- --run test/external-consumer-fixture.test.ts`.

Expected: FAIL because fixture generation does not exist.

- [ ] **Step 3: Implement fixture generation and verification**

Generate a React/Vite consumer with all four public imports. Install tarballs by absolute path plus documented peers and fixture-only dev tools. The SSR script deletes/omits `window` and `document`, imports both root and `/react` entrypoints, and asserts exported functions exist.

The jsdom runtime test must mock only `three/src/renderers/WebGLRenderer.js` with a renderer accepting the runtime-created canvas and implementing `setClearAlpha`, `setPixelRatio`, `setSize`, viewport/scissor/render/animation-loop no-ops, and idempotent `dispose`. Mount exactly one `WebGLRuntime` and one `WebGLTarget`, assert one canvas and one fallback target exist, then unmount and assert the canvas is removed. Do not import package internals or pass internal test-only runtime options.

Expose:

```json
{
  "verify:consumer": "node ./scripts/verify-external-consumer.mjs"
}
```

The verifier runs, in order: pack, install, SSR import, typecheck, focused runtime smoke, production Vite build, then removes the temp fixture and tarballs in `finally`.

- [ ] **Step 4: Run generated fixture unit test and real external verification**

Run:

```bash
npm test -- --run test/external-consumer-fixture.test.ts
npm run verify:consumer
```

Expected: fixture test PASS; external install resolves both packages from `.tgz`; SSR/typecheck/runtime smoke/Vite build all exit 0; the log prints the temp path and cleanup confirmation.

- [ ] **Step 5: Commit Task 5**

```bash
git add package.json scripts/external-consumer-fixture.mjs scripts/verify-external-consumer.mjs test/external-consumer-fixture.test.ts
git commit -m "test: validate external Viselora consumers"
```

### Task 6: Capability-stable release-validation documentation

**Files:**
- Delete: `docs/project-freeze.md`
- Create: `docs/project-release-validation.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/consumer-standard-usage.md`
- Modify: `docs/new-project/example-page-background.md`
- Modify: `docs/new-project/example-page-mvp.md`
- Modify: other active docs returned by the old-name/freeze/R3F-mandate scans
- Test: `test/release-documentation.test.ts`

**Interfaces:**
- Consumes: approved design, real `@viselora/*` package manifests, public skill layout, and already verified runtime capability truth.
- Produces: npm-first active docs, a release-validation decision record, and a future separate package-plus-skill MVP handoff that the user will execute after publication.

- [ ] **Step 1: Write failing active-document truth tests**

Scan active docs (exclude `docs/archive/**` and committed historical plan/spec evidence) and assert:

```text
required: Viselora, @viselora/dom-webgl, @viselora/scroll-adapters, capability-stable, release-validation
forbidden: @project/dom-webgl-runtime, @project/dom-webgl-scroll-adapters, feature-frozen reference project, must migrate to R3F, new R3F-based project
```

Assert `docs/project-release-validation.md` exists, `docs/project-freeze.md` does not, and new-project docs explicitly say the formal MVP is created later in a separate repository using only public alpha packages plus the skill.

- [ ] **Step 2: Run documentation tests and verify RED**

Run `npm test -- --run test/release-documentation.test.ts`.

Expected: FAIL on existing freeze/R3F-only wording and old package names.

- [ ] **Step 3: Rewrite the project state and navigation**

Use this canonical state verbatim wherever a short status is required:

> Capability-stable, release-validation stage. Runtime capabilities are not expanding during the alpha release work; package hardening, public documentation, skill authoring, defect fixes, and external-consumer validation remain active.

`docs/project-release-validation.md` records why feature phases stay closed, why release work remains active, why R3F is neither required nor added, local/public release gates, and the prohibition on creating the formal MVP here.

- [ ] **Step 4: Make onboarding/usage npm-first without changing API semantics**

Replace placeholders/workspace framing with exact installs/imports:

```bash
npm install @viselora/dom-webgl@alpha
npm install @viselora/scroll-adapters@alpha gsap lenis
```

Keep current controlled object, managed scene/stage/model/physics, lifecycle, scroll, pointer, and boundary details. Remove statements that packages are unpublished workspace placeholders. Preserve warnings that Viselora is not raw Three/R3F and does not expose internals.

- [ ] **Step 5: Rewrite new-project docs as a later package-plus-skill experiment**

The later MVP must consume only public alpha packages and the public skill, implement the same five recipe families, keep one canvas/scroll/pointer source, and record first-pass/repair metrics. Remove R3F/Drei/scroll-rig/postprocessing dependencies and all language requiring an R3F rewrite. State that this repository does not create that MVP.

- [ ] **Step 6: Verify documentation GREEN**

Run:

```bash
npm test -- --run test/release-documentation.test.ts
rg -n '@project/dom-webgl-runtime|@project/dom-webgl-scroll-adapters|feature-frozen reference project|must migrate to R3F|new R3F-based project' README.md docs --glob '!docs/archive/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/specs/**'
git diff --check
```

Expected: tests PASS and the scan returns no active-doc violations.

- [ ] **Step 7: Commit Task 6**

```bash
git add README.md docs test/release-documentation.test.ts
git commit -m "docs: move Viselora into release validation"
```

### Task 7: CI verification and idempotent protected release workflow

**Files:**
- Create: `.github/workflows/verify.yml`
- Create: `.github/workflows/release.yml`
- Create: `scripts/release-publisher.mjs`
- Create: `scripts/publish-release.mjs`
- Test: `test/release-publisher.test.ts`
- Test: `test/workflows.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: version assertion, tarball pack/allowlist metadata, full local verification commands, npm registry CLI, and optional first-publish `NPM_TOKEN` Environment secret.
- Produces: PR/push verification CI and a manual protected publisher that processes core then adapters, skips integrity-identical existing versions, rejects mismatches, and verifies registry metadata/dist-tags after publication.

- [ ] **Step 1: Write failing publisher and workflow tests**

Use an injected command runner in `release-publisher.mjs` and cover:

```text
missing version -> publish core then adapters
matching existing version/integrity -> skip package
existing version with different integrity -> stop before publish
core success then adapters missing -> retry skips core and publishes adapters
registry metadata/exports/dependency/alpha dist-tag mismatch -> fail
no command contains npm unpublish, --force, or overwrite behavior
```

Workflow tests parse text/YAML enough to assert Node `24`, npm `11`, `npm-release`, `workflow_dispatch`, `contents: read`, `id-token: write`, provenance, alpha tag, core-before-adapters invocation, and the complete verify chain.

- [ ] **Step 2: Run CI/release tests and verify RED**

Run `npm test -- --run test/release-publisher.test.ts test/workflows.test.ts`.

Expected: FAIL because scripts/workflows do not exist.

- [ ] **Step 3: Implement idempotent release publisher**

Validate requested version equals the repository lockstep version. For each package in fixed order, obtain local `integrity` from verified `npm pack --json`; call `npm view <name>@<version> --json`; treat only registry not-found as absent. If present, require exact integrity plus expected exports/dependencies, then skip. If absent, call:

```bash
npm publish <absolute-tarball> --access public --tag alpha --provenance
```

After both packages, read `npm view` again and assert versions, exports, adapter exact dependency, integrity, and `dist-tags.alpha`. Always clean temp tarballs. Never call unpublish.

- [ ] **Step 4: Add verify and release workflows**

`verify.yml` triggers on pull requests and pushes and runs:

```text
checkout -> setup-node@v4 node 24 cache npm -> npm install -g npm@11 -> npm ci -> typecheck -> tests -> build -> check:imports -> verify:versions -> verify:tarballs -> verify:consumer -> verify:skill -> git diff --check
```

`release.yml` is `workflow_dispatch` with required version input, job `environment: npm-release`, permissions `contents: read` and `id-token: write`, Node 24/npm 11, full verification, then `npm run release:publish -- <version>`. Configure `registry-url: https://registry.npmjs.org` and pass `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` only as the temporary first-publish bootstrap; later Trusted Publishing uses OIDC after the secret is deleted.

- [ ] **Step 5: Add root orchestration scripts and verify GREEN**

Expose:

```json
{
  "verify:skill": "npm test -- --run test/skill.test.ts && node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite",
  "verify:release": "npm run typecheck && npm run test -- --run && npm run build && npm run check:imports && npm run verify:versions && npm run verify:tarballs && npm run verify:consumer && npm run verify:skill",
  "release:publish": "node ./scripts/publish-release.mjs"
}
```

The local Task 2 validation still runs the Skill Creator `quick_validate.py`
tool. CI uses the repository-owned `test/skill.test.ts` structural checks so it
does not depend on a machine-specific `/Users/ai/.codex` path.

Run:

```bash
npm test -- --run test/release-publisher.test.ts test/workflows.test.ts
npm run verify:versions
npm run verify:skill
```

Expected: all commands PASS and no npm publication occurs.

- [ ] **Step 6: Commit Task 7**

```bash
git add .github package.json package-lock.json scripts/release-publisher.mjs scripts/publish-release.mjs test/release-publisher.test.ts test/workflows.test.ts
git commit -m "ci: add protected Viselora release workflows"
```

### Task 8: Full local release validation, security audit, and committed handoff

**Files:**
- Modify only files required to fix verification/review findings.
- Do not create tarballs, temp fixtures, npm credentials, `.npmrc`, or the formal MVP in the repository.

**Interfaces:**
- Consumes: all prior task commits and the approved design completion criteria.
- Produces: fresh verification evidence, secret/private-file audit, final reviewer approval, a clean committed branch, and a publish-bootstrap report without running npm publish.

- [ ] **Step 1: Run the complete fresh verification chain**

Run separately and record exit codes/output:

```bash
npm run typecheck
npm run test -- --run
npm run build
npm run check:imports
npm run verify:versions
npm run verify:tarballs
npm run verify:consumer
npm run verify:skill
git diff --check
```

Expected: every command exits 0; Vitest reports zero failed tests; tarballs have exact allowlists; external fixture SSR/typecheck/runtime/build pass; skill structure/consumer verification pass.

- [ ] **Step 2: Audit secrets, private files, and generated artifacts**

Run:

```bash
git status --short
find . -name '*.tgz' -o -name '.npmrc' -o -name '.env' -o -name '.env.*'
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' '(npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|NODE_AUTH_TOKEN\s*=|NPM_TOKEN\s*=\s*[^$])' .
rg -n '@project/dom-webgl-runtime|@project/dom-webgl-scroll-adapters' . --glob '!.git/**' --glob '!node_modules/**' --glob '!.codegraph/**' --glob '!docs/archive/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/specs/**'
```

Expected: no committed/generated tarball, credential file, literal secret, active old import, or formal MVP artifact. Workflow references to `${{ secrets.NPM_TOKEN }}` are expected symbolic references, not secret values.

- [ ] **Step 3: Perform task and whole-branch review**

Generate the Superpowers review package from branch base `72d7e0ac` (or the actual `git merge-base main HEAD`) through HEAD. Review spec coverage line by line: package identity/build/tarballs, external fixture, skill/recipes/verifier, version lockstep, docs, workflows/idempotency, no runtime expansion, no publish. Fix all Critical/Important findings and re-run covering tests.

- [ ] **Step 4: Re-run verification after review fixes**

Repeat the complete Step 1 chain plus the Step 2 audit. Do not reuse pre-fix evidence.

- [ ] **Step 5: Commit any final review fixes and confirm repository state**

```bash
git add -A
git diff --cached --check
git commit -m "chore: complete Viselora alpha release validation"
git status --short --branch
git log --oneline --decorate main..HEAD
```

If there are no final fixes, do not create an empty commit. Expected: working tree clean, all intended user docs preserved in the branch history, and no publish performed.

- [ ] **Step 6: Prepare the local-completion handoff**

Report implemented/verified/committed separately, list key files and exact verification results, state `npm publish` was not run, and provide this configuration checklist:

```text
npm Organization: viselora; public org; owner account 2FA enabled
temporary token: granular, short expiry, publish access only to both new packages; store as npm-release Environment secret NPM_TOKEN
GitHub Environment: npm-release; required reviewers; deployment branch/tag protection; secret only during bootstrap
repository: agenticnoob/dom-webgl-workspace must be public before provenance publish
first run: release.yml version 0.1.0-alpha.0; verify core then adapters and alpha tags/provenance
Trusted Publisher for each package: owner agenticnoob; repository dom-webgl-workspace; workflow release.yml; environment npm-release; permission npm publish
post-bootstrap: delete NPM_TOKEN secret, revoke token, retain OIDC/id-token workflow, verify npm provenance and npm view dist-tags
```

Stop and wait for the user's explicit Organization/token/Environment readiness confirmation before any public release action.
