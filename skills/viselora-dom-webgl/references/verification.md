# Verification

Run `scripts/verify-consumer.mjs <consumer-root>` for static dependency/import
checks. It permits native Three.js/R3F APIs while rejecting private Viselora
source paths and a second renderer/Canvas owner. It is not a browser test.

Run consumer typecheck and production build. Use installed matching tarballs
when verifying the package boundary, rather than workspace source aliases.

`scripts/browser-check.mjs <url>` drives a headless Chrome through
`playwright-core` (install it with `npm install --save-dev playwright-core`;
it exits with code 2 until then). `--serve "<dev command>"` starts the server
in the background, waits for the URL and stops it afterwards; otherwise the
page must already be served. It checks: one Canvas and WebGL context, drawn
pixels, `--follow <selector>` placement after scroll/reverse/resize,
`--deterministic` scroll restoration, and `--fallback <selector>` visibility
without WebGL and while `--block <glob>` requests hang or fail. It does not
cover remount cleanup, real GPUs, touch input or visual quality.

In the real browser check one Canvas, visible DOM while loading/error,
forward/reverse scroll, texture/model readiness, resize, desktop/touch input,
reduced-motion content continuity and unmount/remount cleanup. Compare retained
visual checkpoints before claiming effect preservation.

Report implemented, automated, browser-verified, committed and pushed states
and registry-published states separately. A successful build or workflow dispatch
does not establish publication; read back package versions and distribution tags.
