# Capability Status

Compatible package version: 0.2.0-alpha.1

Status refers only to the evidence named in each row; it does not imply
universal browser or downstream acceptance. Publication status belongs to
[repository release truth](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/STATUS.md#release-truth).

| Capability id | Status | Evidence | Consumer guidance |
| --- | --- | --- | --- |
| react-runtime | verified | Host lifecycle tests and installed-tarball Chromium checks cover rendering, context recovery and remount; both apps passed local browser review | One React 19/R3F 9 host; verify actual Canvas output in the consumer |
| dom-target-lifecycle | verified | Focused registry tests cover batch reads, readiness identity, opacity fallback, nesting, offscreen entry and disposal | Read live state in native frame callbacks |
| dom-text | verified | Focused tests cover CSS typography, CJK/Latin wrapping, glyph commands, DPR and disposal | Own the native CanvasTexture lifetime |
| shared-scroll-progress | verified | Adapter tests, installed-consumer reversible progress and both apps' forward/reverse browser checks | Verify forward/reverse scroll and cleanup in the consumer |
