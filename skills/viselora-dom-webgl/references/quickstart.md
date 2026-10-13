# Quickstart

Use React 19, React DOM 19, R3F 9 and Three.js 0.184. This skill targets the 0.2
alpha API; keep both Viselora packages on the compatible version named in
[the skill](../SKILL.md). The 0.1.x API is incompatible.

Copy [the React/Vite template](../templates/react-vite/) for a small runnable
example of a native mesh following a DOM target. It keeps DOM text visible,
uses one host, and renders on demand without decorative animation.
Replace copy and scene components within the consumer's scope.

```bash
npm install
npm run typecheck
npm run build
```

The template pins the compatible Viselora versions. For an existing application:

```bash
npm install @viselora/dom-webgl@0.2.0-alpha.0 @viselora/scroll-adapters@0.2.0-alpha.0 react@19 react-dom@19 @react-three/fiber@9 three@0.184
```

Use locally packed tarballs instead when validating an unpublished candidate.

For Next.js, place the host and native scene in a Client Component. Public
imports are SSR-safe. Create textures/loaders after mount, never at module scope.
