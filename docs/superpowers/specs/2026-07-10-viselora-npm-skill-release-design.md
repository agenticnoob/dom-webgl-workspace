# Viselora npm Package And Skill Release Design

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan
**Brand:** Viselora
**npm scope:** `@viselora`
**License:** MIT

## Purpose

Publish the current DOM-first managed WebGL runtime as installable alpha npm
packages, publish an agent-facing skill from the same repository, and prepare a
clean handoff for a separate package-plus-skill MVP.

This work tests whether the existing constrained runtime and a focused skill can
help an agent produce effects with fewer decisions and less rework than a
free-form R3F stack. It does not expand the runtime capability surface or begin
an R3F migration.

## Project State

Replace the current "feature-frozen" conclusion with the following state:

> Capability-stable, release-validation stage. Current capabilities stop
> expanding while package hardening, public documentation, skill authoring,
> defect fixes, and external-consumer validation remain active.

The managed-render roadmap remains closed to new feature phases during this
work. Release validation is a separate workstream, not Phase 10 or a reopened
feature roadmap.

The uncommitted `docs/project-freeze.md` is replaced by
`docs/project-release-validation.md`. Existing R3F analysis may remain as
background, but active documentation must no longer state that the product has
been abandoned or that the next project must be an R3F rewrite.

## Release Artifacts

The first public release contains two packages at the same exact version:

- `@viselora/dom-webgl@0.1.0-alpha.0`
- `@viselora/scroll-adapters@0.1.0-alpha.0`

The repository also publishes an Agent Skills-compatible skill at:

```text
skills/viselora-dom-webgl/
```

The skill is versioned by the same Git tag as the npm packages:

```text
v0.1.0-alpha.0
```

The skill remains in this repository for the alpha. A separate skill repository
or plugin-marketplace release is out of scope.

## Package Responsibilities

### `@viselora/dom-webgl`

Owns the framework-agnostic runtime, effect authoring contracts, managed
rendering, resource and lifecycle management, and the React adapter subpath.

Public entrypoints:

```text
@viselora/dom-webgl
@viselora/dom-webgl/react
```

### `@viselora/scroll-adapters`

Owns Lenis, GSAP ticker, ScrollTrigger, progress-store integration, and the
React scroll components. It depends on the exact matching alpha version of
`@viselora/dom-webgl`.

Public entrypoints:

```text
@viselora/scroll-adapters
@viselora/scroll-adapters/react
```

The packages remain separate so the core runtime does not require GSAP, Lenis,
or React when consumers use only the framework-agnostic entrypoint.

## Package Build Contract

Both packages are ESM-only and publish generated JavaScript, declaration files,
and source maps under `dist`.

Expected runtime package output:

```text
dist/index.js
dist/index.js.map
dist/index.d.ts
dist/react.js
dist/react.js.map
dist/react.d.ts
```

The scroll adapters package uses the same output shape.

Use `tsup` to build the two entrypoints in each package. Keep external runtime
dependencies external to the bundle. Do not add a CommonJS build during the
alpha.

Each published package must:

- remove `private: true`
- use version `0.1.0-alpha.0`
- expose only generated `dist` files through `exports`
- set `publishConfig.access` to `public`
- include only `dist`, package README, LICENSE, and required package metadata
- declare a case-sensitive public `repository.url` matching the GitHub source
- declare appropriate `bugs`, `homepage`, `license`, and `keywords` metadata
- exclude tests, source files, examples, internal docs, and temporary assets

`@viselora/dom-webgl` keeps `three` as its runtime dependency. React is an
optional peer because only the `/react` entrypoint requires it.

`@viselora/scroll-adapters` depends exactly on
`@viselora/dom-webgl@0.1.0-alpha.0`. GSAP, Lenis, and React remain optional peers
because consumers may use only the framework-neutral adapter factories.

No release change may expose raw Three.js renderer, scene, camera, material,
loader, render target, or internal source paths.

The repository, both npm packages, and the same-repository public skill use the
MIT License. Package tarballs include the repository `LICENSE` text.

## Version Management

Do not add Changesets for the first alpha. Add one repository script:

```text
scripts/set-release-version.mjs <version>
```

The script updates as one operation:

- both package versions
- the scroll adapters dependency on the core package
- the skill's declared compatible package version
- the npm lockfile

CI rejects mismatched versions. The two packages use lockstep versions for the
alpha series.

## External Tarball Consumer Test

Before any npm publish, build each package and run `npm pack --json`. A test
script creates an isolated React/Vite fixture under the operating system's
temporary directory, outside the repository and npm workspace.

The fixture installs the two generated `.tgz` files by absolute path. It must
not use `workspace:`, `file:` links to package source directories, TypeScript
path aliases, or imports from the monorepo.

The fixture verifies:

- root and `/react` entrypoints resolve from both packages
- generated JavaScript can be imported
- generated declarations pass TypeScript checking
- required dependencies and optional peers resolve as documented
- a minimal runtime creates one canvas and one `WebGLTarget`
- a production Vite build succeeds
- SSR-safe module import does not access browser globals at module load time

The fixture is disposable release infrastructure. It is not the user's later
MVP repository.

## Skill Design

The skill layout is:

```text
skills/viselora-dom-webgl/
  SKILL.md
  references/
    quickstart.md
    public-api.md
    architecture-rules.md
    effect-recipes.md
    troubleshooting.md
    verification.md
  templates/
    react-vite/
    effects/
  scripts/
    verify-consumer.mjs
```

`SKILL.md` is procedural rather than a copy of the package reference. It tells
an agent how to decide whether Viselora fits the task, install dependencies,
create one runtime, define stable effects, add DOM-first declarations, and
verify the result.

The skill enforces these rules:

- one page-level runtime and canvas
- one scroll source
- one pointer source
- public npm entrypoints only
- no repository-source or private-path imports
- stable module-scope runtime effects
- stable target declarations after mount
- visible DOM fallback during loading and error states
- explicit offscreen and disposal behavior
- no R3F Canvas or second Three.js renderer

The skill contains complete consumer-side recipes for:

- surface pulse
- video background texture
- image hover overlay and Ghost Cursor
- pinned model animation with emissive glow
- scroll-controlled image sequence

Recipes are consumer-owned effect examples. They do not become built-in runtime
exports during this release.

`verify-consumer.mjs` checks package versions, old `@project/*` imports, private
paths, multiple runtime creation, effects constructed during React rendering,
additional Three.js renderers or R3F canvases, and the declaration surfaces
required by the five MVP effects.

## Documentation Changes

Update active documentation as one coordinated release change:

- root `README.md`: capability-stable release-validation state, installation,
  quickstart, alpha warning, public package links, and skill installation
- `docs/STATUS.md`: current implementation truth and release-validation focus
- `docs/README.md`: active document navigation
- `docs/roadmap/managed-render-system.md`: keep feature phases closed and add a
  separate release-validation workstream
- `docs/agent/package-onboarding.md`: npm-first zero-to-one setup
- `docs/agent/package-usage.md`: new public import names and package boundary
- `docs/consumer-standard-usage.md`: alpha install and canonical usage
- package-level READMEs: package-specific entrypoints, peers, and examples
- `docs/new-project/*`: package-plus-skill MVP background and acceptance criteria

All active examples and boundary checks migrate from `@project/*` imports to
`@viselora/*`. No compatibility alias is retained because the old names were
never publicly released.

## Continuous Integration

Add:

```text
.github/workflows/verify.yml
.github/workflows/release.yml
```

`verify.yml` runs on pull requests and pushes. It performs source tests,
typecheck, package builds, import-boundary checks, tarball allowlist checks,
external fixture installation, fixture typecheck, fixture production build, and
skill verification.

`release.yml` is a direct, manually triggered workflow protected by the
`npm-release` GitHub Environment. It uses a GitHub-hosted Ubuntu runner, Node 24,
a compatible npm 11 release, `contents: read`, and `id-token: write`.

Release sequence:

1. Validate the requested version and clean release inputs.
2. Run the complete verification chain again.
3. Build and pack both packages.
4. Confirm whether the exact versions already exist on npm.
5. Publish `@viselora/dom-webgl` with the `alpha` dist-tag.
6. Publish `@viselora/scroll-adapters` with the `alpha` dist-tag.
7. Read both packages back with `npm view` and verify versions, exports,
   dependencies, integrity, and dist-tags.

The workflow never runs `npm unpublish` and never overwrites an existing
version.

## First-Publish Bootstrap

npm requires a package to exist before a Trusted Publisher can be configured.
The first alpha therefore uses one temporary granular npm token in the
`npm-release` GitHub Environment.

Bootstrap procedure:

1. The user creates the npm Organization `viselora` and enables account 2FA.
2. The user creates a short-lived granular token with only the required publish
   authority.
3. The token is temporarily stored in the protected `npm-release` Environment.
4. `release.yml` publishes both `0.1.0-alpha.0` packages from GitHub Actions with
   provenance.
5. The user configures a Trusted Publisher for each package with:
   - GitHub owner: `agenticnoob`
   - repository: `dom-webgl-workspace`
   - workflow filename: `release.yml`
   - environment: `npm-release`
   - allowed action: `npm publish`
6. The GitHub secret is deleted and the temporary npm token is revoked.
7. All subsequent publishes use OIDC Trusted Publishing.

The public repository and each package's exact `repository.url` must remain
consistent so provenance can be generated and verified.

## Release Failure Handling

Release retries are idempotent for infrastructure failures. If the core package
already exists at the exact version and its registry integrity matches the local
tarball, a retry skips core and continues with the adapters package.

If published content is functionally wrong, do not replace or automatically
unpublish it. Fix the repository and publish the next alpha version.

Stop publication when:

- local and registry integrity differ
- package metadata or versions disagree
- the external fixture fails
- the trusted workflow identity does not match npm configuration
- the repository is not public or provenance prerequisites are missing

## Separate MVP Handoff

After the alpha and skill are public, the user creates a new repository. The MVP
may consume only:

- `@viselora/dom-webgl@alpha`
- `@viselora/scroll-adapters@alpha`
- the `viselora-dom-webgl` skill
- public documentation and public static assets

The MVP may not read this repository's source, use workspace or local-file
dependencies, copy `apps/example` implementation files, import private paths,
add R3F, or create a second renderer.

The MVP must implement:

- surface pulse
- video background texture
- image hover overlay or Ghost Cursor
- pinned model animation with emissive glow
- scroll-controlled image sequence
- one canvas, one scroll source, and one pointer source
- fallback, offscreen, loading, error, and disposal behavior

Record the original agent prompt, skill activation, first-pass typecheck/build
result, number of repair iterations, public API escape attempts, recipe reuse,
final screenshots, browser behavior, and relevant performance observations.

The experiment succeeds when package plus skill produces the five effects with
less decision-making and rework than the prior free-form R3F attempt while
remaining within the public API boundary and approaching the current example's
visual quality.

## Out Of Scope

- new runtime capabilities or roadmap phases
- built-in visual effect exports
- R3F integration or migration
- CommonJS output
- a package CLI or project generator
- Changesets or semantic-release
- an independent skill repository
- plugin-marketplace publication
- creating the user's formal MVP repository
- physics expansion

## Completion Criteria

Local release preparation is complete only when:

- active docs no longer describe the project as completely frozen or abandoned
- both package tarballs contain only the approved files
- source, package, tarball, and external-consumer checks pass
- the skill passes its structural and consumer verification
- the implementation and documentation are committed without secrets, tokens,
  private configuration, temporary fixtures, or generated tarballs
- no npm publication has occurred before the user confirms the Organization,
  temporary token, GitHub Environment, and repository visibility are ready

The public alpha release is complete only when:

- the first alpha packages are publicly installable with the `alpha` dist-tag
- npm displays valid provenance for both packages
- the temporary npm token and GitHub secret are removed after Trusted Publisher
  configuration
- the separate MVP handoff contains all five effects and isolation rules
