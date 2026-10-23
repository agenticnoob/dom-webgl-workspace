# Capability Status

Compatible package version: 0.3.0-alpha.0

Status refers only to the evidence named in each row; it does not imply
universal browser or downstream acceptance. Publication status belongs to
[repository release truth](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/STATUS.md#release-truth).

| Capability id | Status | Evidence | Consumer guidance |
| --- | --- | --- | --- |
| react-runtime | verified | Host lifecycle tests and installed-tarball Chromium checks cover rendering, context recovery and remount; both apps passed local browser review | One React 19.2/R3F 9 host; verify actual Canvas output in the consumer |
| dom-target-lifecycle | verified | Focused registry tests cover batch reads, readiness identity, opacity fallback, nesting, offscreen entry and disposal | Read live state in native frame callbacks |
| dom-text | verified | Focused tests cover CSS typography, CJK/Latin wrapping, glyph commands, DPR and disposal | Own the native CanvasTexture lifetime |
| shared-scroll-progress | verified | Adapter tests, installed-consumer reversible progress and both apps' forward/reverse browser checks | Verify forward/reverse scroll and cleanup in the consumer |
| offscreen-sections | experimental | R3F test-renderer tests cover mount on approach, warm, Activity sleep, release and eager mounting; the one-take benchmark raised UHD 630 throughput from 5.3 to 35.1 fps and a Huawei P30 from 25 to 48 fps | Since 0.3.0-alpha.0; wrap each chapter or DOM-bound visual and keep lights outside |
| render-quality | experimental | Governor, budget and host tests; on the one-take benchmark the Radeon 5300M stayed at `high` while CPU-bound slowdowns were undone, and the UHD 630 raymarch chapter rose from 5.5 to 18.2 fps; on a phone viewport budgets do not lower the DPR | Since 0.3.0-alpha.0; scale optional work by `useRenderQuality().tier` |
