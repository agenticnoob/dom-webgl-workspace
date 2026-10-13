# Ownership rules

Keep one R3F host with native scene children. Viselora coordinates DOM layout,
progress, fallback and availability. Do not rebuild loaders, material controls,
scene registries or a renderer loop inside the runtime.

Use public package entrypoints. Keep application assets, copy, shader programs
and scene behavior in the application. Use refs and frame callbacks for fast
visual changes; use React state for actual UI changes.

DOM remains readable before readiness and after rendering failure. Do not
blank a page while a model loads. Custom textures and cloned/shared loader
assets have explicit owners. Cleanup must survive StrictMode and route changes.
