# Hero Next Package-Only Visual Boundary Design

**日期：** 2026-07-13
**状态：** 已确认并生效，作为 `apps/hero-next` 当前硬边界

## 目标

把 `apps/hero-next` 固定为严格的下游 dogfood 应用：CSS 只负责定位和布局，所有可见画面、材质、灯光、纹理、后处理与动态都必须通过当前 Viselora package 的公开能力实现。

## 已确认边界

- 约束只作用于 `apps/hero-next`，不扩展到其他应用。
- 本轮不修改 `packages/`。
- hero-next 可以使用 `defineWebGLEffect(...)` 与 `defineWebGLSceneObjectEffect(...)` 定义应用专属效果，但只能访问 package 管理的公开 context 和 capability facade。
- 禁止 CSS 画面、raw Three.js、React Three Fiber、private import、第二 renderer 或 runtime 内 app-specific 分支。
- 当前 package 缺能力时必须停止并向用户报告；未经单独授权不得修改 package，也不得在下游绕过。

## 约束载体

新增 `apps/hero-next/AGENTS.md`，作为该子树的强制 agent 入口。任何修改 `hero-next` 的 agent 必须先阅读它；文件内包含 CSS allowlist、禁止项、package freeze、能力缺口报告流程、当前迁移债务和验证命令。

该约束既保护未来实现，也明确指出当前 `app/globals.css` 中的渐变、颗粒和阴影属于待迁移的不合规旧实现。建立约束本身不顺带重写页面；下一次视觉实现应先删除这些 CSS 画面层。

## 当前公开能力真值

当前下游可以使用 managed scene、camera、plane、box、model、basic/standard material、ambient/directional/point light、transform、timeline、postprocess 与 app-owned public effect。

当前公开 API 不能直接提供 stage material gradient/texture mask/program、stage effect material facade、cast/receive shadow、曲面 stage primitive 或 scene fog。遇到这些需求时，hero-next 必须降级到现有能力或向用户报告 gap，不能以 CSS 补齐。

## 文档真值迁移

`2026-07-13-hero-next-matte-studio-depth-design.md` 与对应 implementation plan 记录的是已完成的历史 CSS 方案。它们需要标记为被本约束替代，避免后续 agent 把 CSS-owned artwork 当成当前方向。

## 验收标准

- `apps/hero-next/AGENTS.md` 明确要求修改前阅读，并覆盖整个子树。
- CSS 定位-only、package public API only、app-owned effect 允许范围和 package freeze 均无歧义。
- 缺能力时的报告与授权流程明确。
- 当前不合规 CSS 被记录为迁移债务，而不是被误称为已经合规。
- 旧 CSS 设计与计划标记为历史方案。
- 本次只提交约束和文档，不修改 hero 画面或 package。
