You are working in an existing Vite + React 19 + TypeScript project (the
current directory). `three`, `@react-three/fiber` and `@react-three/drei` are
already installed. Build the page described below. Install any other npm
packages you need.

Requirements that apply to every page:

- `src/App.tsx` must export the page root component as `App` (named or default
  export). `src/main.tsx` mounts it; do not move page content into `main.tsx`.
- Keep every `data-testid` listed below on the element described.
- Semantic HTML is the source of truth. The DOM content must stay readable, also
  for screen-reader users, while WebGL is loading, if loading fails, if WebGL is
  unavailable and if the WebGL context is lost while the page is open.
- Respect `prefers-reduced-motion`: no continuous animation for users who ask
  for reduced motion.
- The page component must be safe to render on a server (it may later move into
  a Next.js app).
- Unmounting `<App />` must release everything it created; mounting it again
  must work.
- Use a single WebGL canvas for the whole page.
- `npx tsc --noEmit -p tsconfig.json` and `npm run build` must pass.

Work autonomously and do not ask questions. Do not start a long-running dev
server and leave it running. When finished, reply with a short summary.
