# Troubleshooting

- No WebGL: inspect Canvas availability, browser errors and semantic fallback.
- Target offset: compare target CSS viewport rect with the actual Canvas size,
  camera projection and viewport. Orthographic and perspective units differ.
- Ready but blank: inspect native material/geometry, visibility, depth, camera,
  texture upload and final Canvas pixels. Readiness alone is insufficient.
- Frozen demand scene: confirm external progress/pointer/resource changes call
  `invalidate`; avoid replacing R3F's renderer loop.
- Wrong speed: R3F delta is seconds; old effect code used milliseconds.
- Stale text: inspect target revision, font completion, locale and measured size.
- Broken remount: check observer cleanup, stale readiness identity, cloned model
  instances and shared texture disposal.

Reproduce the smallest actual failing path through public imports. Report the
cause and evidence without claiming browser verification from static tests.
