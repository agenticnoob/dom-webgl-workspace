# Agent Rules

- 默认中文交流，技术结论保持简洁、直接、可验证。
- 本项目目标是实现可复用的开源 DOM WebGL runtime。`apps/demo` 只是公共 API 的示例消费者和验证面，不能为了 demo 的 key、资产路径、DOM 结构、布局或文案在 runtime/package 源码里写硬编码分支。
- 修改 runtime 行为时优先保持声明驱动和包级通用能力；demo 需要的能力必须先抽象成公共 API、内部通用管线或测试夹具，再由 demo 通过公共入口消费。
- 排查硬编码时同时检查 `packages/dom-webgl-runtime/src` 的非测试实现、`apps/demo` 的公共 API 使用边界、README 和 `docs/EXECUTION_STATE.md`。
- 高风险操作（删除、覆盖、强推、生产部署、密钥/权限修改）必须先确认；能验证就跑 test/typecheck/build 或最小可行验证。
