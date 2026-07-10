# Verification

Compatible package version: 0.1.0-alpha.0

Run verification in this order from the consumer root:

```bash
node /absolute/path/to/viselora-dom-webgl/scripts/verify-consumer.mjs .
npm run typecheck
npm run build
```

The deterministic verifier reads `package.json` and JavaScript/TypeScript source files without modifying them. It rejects:

- missing or non-exact Viselora package versions
- private, repository-source, or old package imports
- zero or multiple runtime roots
- direct Three renderer or R3F canvas ownership
- component-scoped `runtimeEffects`
- multiple/manual scroll or pointer ownership paths
- missing surface-pulse, video, hover-overlay, pinned-model-glow, or image-sequence evidence

For this skill repository, also run:

```bash
python /Users/ai/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/viselora-dom-webgl
node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite
npm test -- --run test/skill.test.ts
```
