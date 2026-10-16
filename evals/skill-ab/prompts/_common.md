You are working in an existing, nearly empty Vite + React 19 + TypeScript
project (the current directory). Build the page described below.

Use the npm package `@viselora/dom-webgl` (version `0.2.0-alpha.0`, npm tag
`alpha`) to coordinate the DOM with a WebGL scene rendered by React Three Fiber
and Three.js. `@viselora/scroll-adapters` (same version) is optional. Install
any packages you need with npm.

Requirements that apply to every page:

- `src/App.tsx` must export the page root component as `App` (named or default
  export). `src/main.tsx` mounts it; do not move page content into `main.tsx`.
- Keep every `data-testid` listed below on the element described.
- Semantic HTML is the source of truth. The DOM content must stay readable
  while WebGL is loading, if loading fails, and if WebGL is unavailable.
- The page component must be safe to render on a server (it may later move into
  a Next.js app): rendering `<App />` to HTML must not touch browser globals.
- Unmounting `<App />` must release everything it created (renderer, GPU
  resources, listeners, animation loops); mounting it again must work.
- Use a single WebGL canvas for the whole page.
- `npx tsc --noEmit -p tsconfig.json` and `npm run build` must pass.

Work autonomously and do not ask questions. Do not start a long-running dev
server and leave it running. When finished, reply with a short summary.
