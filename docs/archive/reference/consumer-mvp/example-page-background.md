# Later Project Background: Viselora Package And Skill Consumer

**Date:** 2026-07-10
**Status:** Deferred until after the public alpha

## Premise

After the Viselora packages and public skill are released, create a polished
consumer project in a separate repository. Its purpose is to test the same
experience a new npm user and an agent receive: install only public artifacts,
follow the skill, author application effects, and build a real DOM-first page.

This repository does not create the formal MVP. It prepares and validates the
packages, skill, recipes, templates, release automation, and external fixture.

## Inputs

The later repository starts from public artifacts, never workspace source paths:

```bash
npm install @viselora/dom-webgl@alpha @viselora/scroll-adapters@alpha
```

The implementing agent must follow the published `viselora-dom-webgl` skill and
its consumer verification script. The source workspace may be consulted as
historical evidence, not imported as application code.

## Product Boundary

The page remains ordinary accessible DOM enhanced by Viselora. Viselora owns one
runtime and one canvas; the application owns copy, layout, assets, and concrete
effect definitions. The application uses one scroll source and one pointer
source, keeps effect arrays stable, and implements fallback, offscreen, cleanup,
and disposal behavior.

React Three Fiber is neither required nor part of the validation target. The
consumer must not create a second renderer, second canvas, private-package
imports, or raw Three.js ownership.

## Effect Coverage

The first independent consumer should exercise the five public recipe families:

- surface pulse;
- video background texture;
- image hover overlay or Ghost Cursor;
- pinned model animation with emissive glow;
- scroll-controlled image sequence.

These are application-authored effects built from the stable public facade.
They are not new runtime features or bundled visual presets.

## Success Signal

The experiment succeeds when a clean agent can use the npm packages and skill
to produce a production build with one canvas and the five recipe families,
without reading runtime internals or modifying this repository.
