# Quickstart

Compatible package version: 0.1.0-alpha.0

## Install

Pin the public prerelease packages exactly:

```bash
npm install --save-exact @viselora/dom-webgl@0.1.0-alpha.0 @viselora/scroll-adapters@0.1.0-alpha.0
npm install react react-dom gsap
npm install --save-dev typescript vite @types/react@^19.2.0 @types/react-dom@^19.2.0
```

The published scroll React declarations require `@types/react >=19.2.0`.
Use strict TypeScript with `skipLibCheck: false`; otherwise declaration drift can
be hidden. Keep the consumer-local `typescript` dependency because the verifier
uses its compiler API.

## Start from planning artifacts

Copy and complete, in order:

1. `templates/story-plan.md`
2. `templates/asset-manifest.json`
3. `templates/react-vite/viselora.capabilities.json`

Then copy `templates/react-vite/` or adapt an existing React/Vite site. Keep one
runtime/canvas, one scroll source, one pointer source, module-scope effects, and
stable mounted target declarations.

## Verify

```bash
node /absolute/path/to/viselora-dom-webgl/scripts/verify-consumer.mjs .
npm run typecheck
npm run build
```

The verifier proves static architecture, declarations, assets and planned
evidence. Complete the browser and narrative matrix in
[verification.md](verification.md) before claiming the consumer experience is
verified.
