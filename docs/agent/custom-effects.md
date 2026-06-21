# Agent Contract: Custom Effects

Custom effect authoring is part of package usage.

Read `docs/agent/package-usage.md` first. That file is the authoritative
agent-facing contract for:

- package public imports;
- runtime setup;
- target declarations;
- custom `defineWebGLEffect(...)` definitions;
- source/target/resource handles;
- validation and common failure modes.

Current source handles expose reusable output primitives for element surfaces,
text/glyph layers, image textures, video playback, and GLB models. Concrete
effects remain consumer-owned.
