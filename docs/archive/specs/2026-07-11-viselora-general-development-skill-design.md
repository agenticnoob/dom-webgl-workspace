# Viselora General Development Skill Design

**Date:** 2026-07-11
**Status:** Approved design
**Compatible package version:** `0.1.0-alpha.0`

## Purpose

Upgrade `skills/viselora-dom-webgl/` from a five-recipe onboarding skill into a
general agent-facing development skill for building scroll-driven narrative
websites with the public Viselora npm packages.

The skill must help an agent move from a product or editorial brief to a
coherent story direction, local asset plan, public-API capability map,
implementation, and browser-backed validation. It must support optional
interaction without weakening Viselora's DOM-first ownership boundaries.

The skill is designed for external consumers that can access only:

- `@viselora/dom-webgl` and `@viselora/dom-webgl/react`;
- `@viselora/scroll-adapters` and `@viselora/scroll-adapters/react`;
- the installed `viselora-dom-webgl` skill;
- public package metadata, README files, and generated declarations;
- consumer-owned or publicly licensed static assets.

It must not depend on this repository's private source paths, internal tests,
example implementation files, or archived documentation.

## Evidence From External Consumer Validation

The design incorporates the 2026-07-11 external-consumer validation report.
The report confirmed that the existing skill helps agents preserve public
imports, one-runtime ownership, stable effects, fallback lifecycle, managed
pointer input, and shared scroll progress. It also exposed the following skill
and contract gaps:

- the verifier assumes all five original recipes instead of validating the
  capabilities selected by a specific project;
- the image-hover overlay recipe does not reliably preserve the source image
  without explicit source-texture sampling;
- the React template does not state the effective `@types/react` floor implied
  by published declarations;
- lifecycle guidance does not explain how to derive target state efficiently
  from `onDebugStateChange` without storing frame-frequency debug objects;
- troubleshooting stops too early when a model is `ready` and `active` but the
  final canvas remains blank;
- the surface-pulse recipe can update effect-owned pixels without producing a
  visible runtime-canvas change in `0.1.0-alpha.0`;
- GLB loading and lifecycle can succeed while final model pixels remain absent
  in `0.1.0-alpha.0`;
- image-sequence behavior was not externally validated and must not be treated
  as verified merely because the API exists.

The skill must represent these results as versioned capability truth. It must
not convert unresolved package defects into consumer workarounds that violate
the public boundary.

## Goals

1. Support end-to-end generation of scroll-driven narrative websites from a
   brief, not only reproduction of fixed effect recipes.
2. Make every public runtime value discoverable through human-written guidance
   and every public type discoverable through a generated API index.
3. Route agents to only the references relevant to the current task.
4. Make narrative structure, static assets, interaction, lifecycle, fallback,
   responsive behavior, and reduced motion first-class planning concerns.
5. Record which capabilities are verified, experimental, or blocked for each
   compatible package version.
6. Validate the capabilities a consumer actually selects instead of requiring
   a fixed showcase.
7. Detect drift between published declarations and the skill during repository
   verification.

## Non-Goals

- changing runtime behavior or fixing package defects;
- adding or changing public npm APIs;
- adding R3F, a second renderer, a second canvas, or raw Three.js escape hatches;
- shipping built-in visual effects from the runtime package;
- turning the skill into a site generator CLI or a runtime narrative DSL;
- requiring every website to use every Viselora capability;
- copying all declaration source into `SKILL.md`;
- deploying a consumer site or changing the external validation repository;
- bumping the npm package version as part of the skill redesign.

## Design Principles

### Progressive disclosure

Keep `SKILL.md` procedural and concise. Put narrative guidance, asset policy,
capability semantics, troubleshooting, and exhaustive API data in directly
linked reference files that the agent loads only when needed.

### Published declarations are the API source of truth

Generate the exhaustive API index from the four built `dist/*.d.ts` entrypoints,
not from internal implementation files. The generated output represents what
an external consumer can actually import.

### Human guidance explains capabilities, not aliases

Human-written references must explain when to use a capability, exact imports,
ownership, declaration stability, fallback behavior, constraints, minimal
examples, and validation. They do not need a separate prose section for every
helper type. All exported types remain searchable in the generated index.

### Narrative first, effects second

The agent must decide what the page communicates and how the story progresses
before selecting effects. Interaction and motion must support a story beat
rather than exist as decoration without a narrative role.

### Honest compatibility

An API's presence does not prove that its visible result works in the current
published version. The skill must distinguish verified, experimental, and
blocked behavior and provide public-boundary fallbacks when necessary.

## Skill Layout

```text
skills/viselora-dom-webgl/
  SKILL.md
  agents/
    openai.yaml
  references/
    quickstart.md
    narrative-design.md
    asset-pipeline.md
    public-api.md
    api-effects-rendering.md
    api-scenes-models.md
    api-scroll-interaction.md
    api-lifecycle-debug.md
    capability-status.md
    architecture-rules.md
    effect-recipes.md
    troubleshooting.md
    verification.md
    api-surface.generated.md
    api-coverage.json
  scripts/
    generate-api-surface.mjs
    check-api-coverage.mjs
    verify-consumer.mjs
  templates/
    react-vite/
    effects/
    story-plan.md
    asset-manifest.json
```

All reference files remain one link away from `SKILL.md`. Longer references
must include a table of contents.

## `SKILL.md` Responsibilities

`SKILL.md` must:

- trigger for new scroll narratives, existing-site enhancement, Viselora API
  selection, interaction, asset integration, debugging, and verification;
- define the end-to-end workflow from brief to browser evidence;
- require one runtime/canvas, one scroll source, and one pointer source;
- require stable module-scope effect definitions and runtime effect arrays;
- require stable target declarations after mount;
- preserve semantic DOM content and visible loading/error fallback;
- route narrative tasks to `narrative-design.md`;
- route asset tasks to `asset-pipeline.md`;
- route API selection to `public-api.md`, the relevant capability reference,
  and `capability-status.md`;
- route failures to `troubleshooting.md` and `api-lifecycle-debug.md`;
- route completion claims to `verification.md`;
- prohibit private imports, R3F, raw renderer ownership, component-owned render
  loops, and extra scroll or pointer pipelines.

`SKILL.md` must not contain the exhaustive export list or duplicate the detailed
content of its references.

## End-To-End Workflow

### 1. Establish the narrative brief

Collect or infer:

- audience;
- core message and desired outcome;
- tone and visual direction;
- expected page length;
- interaction density;
- available assets;
- accessibility, mobile, performance, and reduced-motion constraints.

When direction is ambiguous, propose two or three concrete narrative options
and recommend one before implementation.

### 2. Define story beats

Create four to eight story beats unless the brief clearly requires a smaller
or larger structure. For each beat, record:

- semantic DOM content and fallback;
- entrance, active, and exit states;
- visual media or scene responsibility;
- scroll progress and timing ownership;
- optional pointer, touch, camera, or model interaction;
- mobile and reduced-motion behavior;
- selected public Viselora capability;
- capability status for the compatible package version.

Suggested narrative patterns include chronology, journey, problem-to-solution,
layered product reveal, state transformation, comparison, and spatial
exploration. These are planning patterns, not runtime exports.

### 3. Plan and freeze assets

Inventory existing project assets first. When assets are missing, allow the
agent to generate them or search for public assets with clear licensing.

Before implementation, save every production asset locally and record:

- local path;
- story-beat purpose;
- source and author;
- license;
- modifications;
- dimensions, duration, frame count, or GLB metadata as applicable;
- poster, first-frame, semantic DOM, or text fallback;
- alt text or an equivalent description.

Do not use unstable production hotlinks. Do not use an asset with unknown
deployment rights. User-provided assets with unknown licenses may be used for
local validation only and must be flagged before public deployment.

### 4. Map beats to capabilities

For every dynamic beat, select the narrowest public capability that satisfies
the design. Record the entrypoint, primary component or effect API, fallback,
and capability status.

If a required capability is blocked in the compatible version, use a semantic
DOM/CSS fallback or another verified Viselora capability. Do not introduce raw
Three.js, R3F, another renderer, or a consumer render loop as a workaround.

### 5. Implement within managed ownership

Use one page-level `WebGLRuntime` or `WebGLScrollRuntime`. Keep DOM responsible
for document flow, content, accessibility, and fallback. Keep WebGL responsible
for managed visual enhancement.

Use shared scroll timelines, target pointer declarations, managed cameras,
managed scene objects, and managed resource lifecycle. Limit each story beat to
one primary interaction by default so interaction supports rather than obscures
the narrative.

### 6. Verify behavior and narrative quality

Run static checks, production build, architecture verification, and real-browser
tests. Verify each dynamic story beat by final-canvas pixels or another direct
behavioral assertion, not only by effect callbacks or debug state.

Review the complete desktop and mobile story for pacing, legibility, fallback,
interaction clarity, and reduced-motion continuity.

## Asset Contract

### Images

Record intrinsic dimensions, provide meaningful alt text, use a local optimized
format supported by the target browsers, and verify loading failure fallback.

### Video

Provide a local poster and semantic fallback. Handle autoplay rejection and
network failure. Choose `park` only when preserving warm playback state is worth
the retained resources; otherwise prefer `restore-dom`.

### GLB models

Record asset origin, animation clips, compression, loader requirements, and a
poster or textual fallback. Treat `ready` and `active` as resource/lifecycle
signals, not proof of visible output. Require a clipped pixel-change or visible
render assertion.

### Image sequences

Record frame count, naming convention, dimensions, progress range, start frame,
first-frame fallback, and cache budget. Keep the capability experimental until
external behavior is verified for the compatible package version.

### Fonts

Prefer local, licensed files with system fallbacks. Do not let WebGL text or a
font-loading failure remove semantic DOM text.

## Interaction Contract

- Use shared scroll progress for pinning, scrubbing, and reversible narrative
  transitions.
- Use managed pointer declarations and effect context for hover, click, or drag.
- Do not add component-owned pointer listeners to duplicate managed input.
- Use managed camera controllers for camera motion.
- Use public animation, morph, material, light, and scene-object facades for
  models and scenes.
- Keep buttons, links, inputs, and forms as accessible DOM controls.
- Do not make meaning depend on hover; provide touch or scroll behavior on
  mobile.
- Freeze, shorten, or replace motion under reduced-motion preferences without
  removing content or navigation.
- Default to at most one primary interaction per story beat.

## Public API Documentation Model

### Capability map

`public-api.md` is the navigation layer. It lists the four public entrypoints
and routes capability families to the relevant human reference and generated
index. It must not imply that all exported APIs share the same validation
status.

### Human capability references

Each `api-*.md` reference must use the same section contract:

1. when to use the capability;
2. public entrypoint and primary exports;
3. exact declaration or props shape needed by consumers;
4. runtime ownership and reference-stability rules;
5. fallback and lifecycle behavior;
6. known version-specific limitations;
7. minimal public-import example;
8. direct verification requirements.

The reference grouping is:

- `api-effects-rendering.md`: runtime creation, targets, effect definitions,
  typed effect declarations, object facade, surfaces, materials, textures,
  postprocess, text, and effect scheduling;
- `api-scenes-models.md`: scenes, render passes, pass viewports, cameras,
  stages, lights, models, animation, morphs, rigs, sampling, placement, and
  scene-object effects;
- `api-scroll-interaction.md`: scroll adapters, React scroll components,
  progress stores, pointer state, picking, camera gestures, drag, and physics;
- `api-lifecycle-debug.md`: loading, resource status, fallback hiding,
  offscreen strategies, performance budgets, debug state, debug selectors,
  disposal, and SSR-safe usage.

### Generated API index

`generate-api-surface.mjs` parses these built declarations:

```text
packages/dom-webgl-runtime/dist/index.d.ts
packages/dom-webgl-runtime/dist/react.d.ts
packages/dom-webgl-scroll-adapters/dist/index.d.ts
packages/dom-webgl-scroll-adapters/dist/react.d.ts
```

It produces deterministic `api-surface.generated.md` content containing:

- compatible package version;
- entrypoint;
- symbol name;
- value or type classification;
- exported signature or declaration summary;
- re-export origin when available.

The generated file must contain a notice that it is overwritten by the script.
Manual capability explanations must not be generated into this file.

### Coverage manifest and drift guard

`api-coverage.json` maps every exported runtime value to a human reference and
section. It may group helper types by capability, but all types must appear in
the generated index.

`check-api-coverage.mjs` fails when:

- a public value export has no human-documentation mapping;
- a mapped export no longer exists;
- a public type is absent from the generated index;
- generated API output differs from current built declarations;
- the skill and two npm packages disagree on compatible version;
- a capability family lacks versioned status.

The root repository verification and CI must run the generator in check mode
after package build.

## Versioned Capability Status

`capability-status.md` is authoritative for what the skill may recommend for a
specific compatible package version.

Use these states:

- `verified`: external consumer behavior and direct browser evidence pass;
- `experimental`: public API exists, but external behavior is incomplete or
  has not completed the required validation matrix;
- `blocked`: a retained public-boundary reproduction indicates a package defect
  or unusable output for the documented path.

For `0.1.0-alpha.0`, initialize the matrix from external validation:

- verified: public/SSR imports, one runtime/canvas, unmount/remount, managed
  image hover with explicit source-texture sampling, managed video lifecycle,
  shared reversible scroll progress, resource/fallback handling, GLB loading
  lifecycle, and consumer-level reduced-motion signaling;
- experimental: image sequences and advanced capabilities not covered by the
  external report;
- blocked: the shipped managed surface-pulse visible-output path and default
  DOM-anchored GLB visible-output path represented by the retained pixel tests.

Future package releases must update this matrix from current evidence rather
than copying the previous version's state.

## Recipe Model

`effect-recipes.md` and `templates/effects/` remain optional implementation
examples. They do not define required project scope.

Each recipe must state:

- required public exports;
- compatible package version and capability status;
- required assets and fallback;
- ownership rules;
- mobile and reduced-motion behavior;
- verification evidence;
- known limitations.

Update the hover recipe to sample the source texture explicitly and use the
validated source-replacement path. Mark surface pulse and default DOM-anchored
model rendering as blocked for `0.1.0-alpha.0` until their retained public
reproductions pass. Do not present an experimental or blocked recipe as a
copy-and-ship default.

## Verifier Redesign

Replace the five-recipe requirement with selected-capability verification.

The consumer supplies a small project capability manifest describing only the
capabilities it intends to use. The verifier validates:

- compatible package versions;
- public import paths;
- one runtime/canvas owner;
- stable effect definitions and runtime arrays;
- absence of R3F, raw renderer creation, private imports, and duplicate input
  pipelines;
- required fallback and lifecycle declarations for selected resource types;
- asset-manifest entries for selected local media;
- capability status and any required acknowledgement for experimental paths;
- presence of the checks required by each selected capability.

The verifier must reject blocked capabilities unless the project is explicitly
a retained defect reproduction. It must not require unrelated recipes or
assets.

## Error Handling And Diagnostic Routing

Classify failures before changing architecture:

1. API/type failures: check package versions, public entrypoints, generated API
   index, peer dependencies, and the documented React type floor.
2. Asset failures: check local URL, format, browser decoding, loader config,
   decoder assets, poster, and semantic fallback.
3. Lifecycle failures: check loading, ready, error, offscreen, fallback hiding,
   `park`/`restore-dom`, and disposal.
4. Visible-output failures: distinguish changing effect state from changing
   final-canvas pixels; check source sampling, scene/camera/light ownership,
   viewport, placement, and direct pixel evidence.
5. Package-defect candidates: when public declarations are correct, resources
   are ready, lifecycle is active, the console is clean, and output still does
   not change, preserve fallback and produce a minimal public-boundary
   reproduction instead of adding private escape hatches.

Document an efficient debug selector pattern that derives only the target
fields needed by React UI. Do not recommend storing every full debug-state
update in component state.

## Verification Matrix

### Skill integrity

- validate skill structure and frontmatter;
- validate all direct reference links;
- build both packages;
- regenerate and check the public API surface;
- check value-export documentation coverage;
- check compatible package versions;
- typecheck and production-build the React/Vite template;
- test selected-capability verifier behavior, including blocked and unrelated
  capability cases.

### Generated consumer

- import all selected public entrypoints in browser and SSR environments;
- confirm exactly one canvas while mounted;
- confirm unmount/remount canvas count `1 -> 0 -> 1`;
- test slow, fast, forward, and reverse scroll;
- test pointer and touch alternatives;
- test desktop and mobile layouts without horizontal overflow;
- test reduced-motion continuity;
- test loading, network failure, fallback, and offscreen re-entry for selected
  assets;
- test autoplay rejection for selected video capabilities;
- assert final-canvas pixel change for every dynamic WebGL story beat;
- keep the console clean outside deliberate failure cases;
- run strict typecheck and production build.

### Narrative review

- confirm every story beat advances the core message;
- confirm motion and interaction have a defined narrative purpose;
- confirm text remains legible and semantic without WebGL;
- confirm pacing works under desktop, mobile, and reduced-motion paths;
- confirm all production assets have local files and deployment-compatible
  licensing records.

## Implementation Scope

The implementation may modify:

- `skills/viselora-dom-webgl/SKILL.md`;
- the skill's references, templates, and verifier;
- new API generation and coverage scripts under the skill;
- root verification scripts and CI wiring needed to enforce skill/API sync;
- active documentation that describes the skill and consumer workflow.

The implementation must not modify:

- runtime behavior or public API;
- the surface or model defect candidates;
- npm package versions;
- the external consumer repository.

Package defects and package README issues found by the report remain separate
follow-up work. The skill must document them accurately without claiming to fix
them.

## Completion Criteria

The redesign is complete when:

- `SKILL.md` routes narrative, asset, API, troubleshooting, and verification
  tasks without becoming an exhaustive reference;
- all public value exports map to human-written capability guidance;
- all public type exports appear in the generated API index;
- repository checks fail on public-API or compatible-version drift;
- the verifier accepts a valid subset of capabilities and does not require the
  original five recipes;
- the verifier rejects private imports, duplicate owners, and blocked
  capabilities outside retained reproductions;
- story and asset templates produce an actionable brief, story-beat plan, and
  license-aware local asset manifest;
- the external report's hover, React types, debug-state, blank-output, and fixed
  recipe-scope findings are addressed in skill guidance;
- current package defect candidates remain clearly marked and reproducible;
- template typecheck, production build, skill checks, and repository validation
  pass;
- active documentation reflects the general development skill without implying
  a runtime capability expansion.
