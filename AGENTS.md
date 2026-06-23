# Agent Rules

**Generated:** 2026-06-23
**Commit:** `bf0eaa5`
**Branch:** `codex/effect-authoring-examples`

- 默认中文交流，技术结论保持简洁、直接、可验证。
- 本项目是开源 DOM WebGL runtime。`apps/demo` 只是公共 API 的示例消费者和验证面，不能在 runtime/package 源码里写硬编码的分支。

## WHERE TO LOOK

| 任务 | 位置 | 说明 |
|------|------|------|
| 运行时创建/管线 | `lib/renderer/runtime.ts` | 核心 918 行，`createWebGLRuntime` + `syncFrame` |
| Three.js 渲染器 | `lib/renderer/threeRenderer.ts` | canvas/场景/相机/灯光 |
| 特效系统 | `lib/effects/effectAuthoring.ts` | `defineWebGLEffect` 公共 API |
| 特效控制器 | `lib/effects/effectController.ts` | 每帧特效调度 |
| 滚动/场景门 | `lib/input/scrollController.ts` | 页面滚动 + gate 门控 |
| 指针输入 | `lib/input/pointerController.ts` | PointerEvents 统一处理 |
| React 适配器 | `lib/react/WebGLRuntime.tsx` | React 运行时组件 |
| React Target | `lib/react/WebGLTarget.tsx` | React 目标声明组件 |
| 资源管理 | `lib/resources/resourceManager.ts` | 图片/视频/GLB 加载缓存 |
| 离屏策略 | `lib/renderer/offscreenPolicy.ts` | park/restore-dom |
| 视口生命周期 | `lib/renderer/viewportLifecycle.ts` | 活跃/预加载/卸载状态 |
| 布局测量 | `lib/renderer/layoutPass.ts` | DOM rect 批量读取 |
| 导入边界守卫 | `scripts/assert-demo-public-imports.mjs` | demo/example 导入检查 |
| 公开类型守卫 | `publicExports.test.ts` | 程序化 TS 类型检查 |

## 项目结构

npm workspaces 单仓，非 pnpm：

```
packages/
  dom-webgl-runtime/      # 核心运行时：Three.js WebGL runtime + React 适配器
  dom-webgl-scroll-adapters/  # 可选：Lenis + GSAP + ScrollTrigger 胶水
apps/
  demo/                   # 公共 API 验证面（示例消费者，非特权 runtime 输入）
  example/                # 下游消费者示例（React-only，effect authoring 教学）
```

- `apps/demo` 只能通过 `@project/dom-webgl-runtime` / `@project/dom-webgl-runtime/react` 公共入口导入，禁止 `packages/dom-webgl-runtime/src/*` 路径导入。运行时源码不得硬编码 demo 的 key、资产路径、DOM 结构、布局或文案。
- `apps/example` 不得导入 `apps/demo` 源码或 runtime 内部模块。
- 边界守卫：`packages/dom-webgl-runtime/src/open-source-boundary.test.ts`（demo 字面量检查）、`scripts/assert-demo-public-imports.mjs`（导入边界）、`publicExports.test.ts`（程序化 TS 类型检查确保内部类型不泄漏）。

## 关键命令（按顺序）

```bash
npm run check            # typecheck + test (--run)
npm run build            # npm run build --workspaces --if-present
npm run check:imports    # 导入边界检查脚本
# 完整验证顺序：
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

- 测试：`npm test`（vitest交互模式）/ `npm run test -- --run`（单次运行）
- 单包测试：`npm test -- --run packages/dom-webgl-runtime/src/lib/.../xxx.test.ts`
- 类型检查：`npm run typecheck`（根 tsconfig.base.json）/ `npm run typecheck -w @project/dom-webgl-runtime`（单包）
- 运行 demo：`npm run dev -w @project/dom-webgl-demo`
- 运行 example：`npm run dev -w @project/dom-webgl-example`

测试配置：vitest + jsdom 环境，30s 超时，`globals: true`（describe/test/expect 全局可用）。无 ESLint/Prettier/Biome — 仅依赖 TS strict 模式。

## 架构要点

DOM-first WebGL runtime：普通 DOM 元素通过声明进入 WebGL 管线。流水线：
`DOM element → target descriptor → source descriptor → layout/content → renderRole → renderable → scene object → renderer`

- 每个 runtime 实例只有一个 Three.js canvas，固定视口、`pointer-events: none`、透明背景、插入在容器第一个子元素位置。React 适配器拥有 DOM content layer（在 canvas 之上），子元素无需手动 z-index。
- DOM rect 在一个批量 layout pass 中读取，然后投影到场景坐标系。
- renderRole 的默认推断：`snapshot/element → surface`，`snapshot/text → content`，`image/video → media`，`model/glb → model`。
- 光追、多 canvas、shader 编写 API、核心内置粒子系统、Three.js renderOrder/transparent/depthWrite 不在公共 API 范围内。
- 模块加载时不触碰 `window`/`document`，SSR 安全。浏览器 API 在运行时使用前才执行。

## Effect 模型

效果通过 `defineWebGLEffect(...)` 公共 API 定义，通过 runtime-level `effects` 传递给运行时：

```ts
import { defineWebGLEffect } from "@project/dom-webgl-runtime";

const myEffect = defineWebGLEffect({
  kind: "app.myEffect",
  update(ctx, _state, params) {
    ctx.target?.setOpacity(params.opacity ?? 1);
  },
});

createWebGLRuntime({ container, effects: [myEffect] });
```

核心规则：
- **useEffect array-form only**：`effects: [{ kind: "app.effect", opacity: 0.75 }]`。禁止使用旧的 `effects.material` / `effects.motion` 对象形式（已从编译器和类型中移除）。
- 核心不注册默认视觉效果。所有具体效果由应用/消费者提供。包不导出 `effects` 子路径。
- Effect context 暴露每个 source kind 的低阶输出 handle：`snapshot/element` 的 canvas 表面、`snapshot/text` 的文字层、`image`/`video` 的纹理层、`model/glb` 的模型 handle。
- Effect 不能扫描 DOM、创建独立渲染器、拥有独立资源管线。
- `ctx.target.setPosition(...)` 写的是场景空间坐标，不是 DOM `left`/`top`。
- source 声明严格：`kind: "image"` 只用于实际 `<img>`，`kind: "video"` 只用于实际 `<video>`，非媒体元素声明这些会抛错。

## React 使用要点

- `@project/dom-webgl-runtime/react` 导出 `WebGLRuntime`、`WebGLTarget`、`useWebGLRuntime`。
- **target 声明挂载后必须稳定**：同一 `WebGLTarget` key 的 `webgl` 对象不能动态改变 `source`/`effects`/`scroll`/`pointer`/`lifecycle`。需要不同的声明时，换 key 或 remount。
- runtime-level `effects` 数组必须保持引用稳定（通常模块级 `const`），否则 React 会重建 runtime。
- 可选的 smooth-scroll：只传 `smoothScroll.scrollAdapter` 给 `<WebGLRuntime scrollAdapter={...} />`，不要在渲染中构造 Lenis/GSAP。

## Scroll 和 Scene Gate

- 默认使用浏览器原生滚动。可选适配器：`@project/dom-webgl-scroll-adapters` 提供 `createLenisGsapScrollStack(...)` 组合 Lenis + GSAP ticker + ScrollTrigger。
- 应用拥有 Lenis 实例生命周期，传给适配器时用 `manageLenis: false`，并从应用 cleanup 中销毁 Lenis。
- Scene gate 声明：`scroll: { type: "gate", start: "top top", duration: 1, release: "both-directions-complete" }`。
- Gate 激活时锁定页面滚动，把 scroll delta 映射为 `sceneProgress` (0→1)，完成后释放。
- `release: "forward-complete"`（默认）不拦截回滚；`release: "both-directions-complete"` 支持从下方反向进入。

## 生命周期和可见性

- 声明为 WebGL 目标的元素默认 `hideWhenReady: true` + `hideMode: "self"`（隐藏自身 fallback DOM）。
- `hideWhenReady: false` 保持 DOM fallback 可见。`hideMode: "subtree"` 隐藏目标及其后代。
- Loading/error 状态的 renderable 保持 fallback DOM 可见。
- 卸载 target 或 dispose runtime 时恢复 fallback 可见性。
- Offscreen 策略：`restore-dom`（默认，恢复 fallback 并释放 WebGL 资源）/ `park`（暂停 effect，保留 WebGL 资源）。

## 编码惯例（易踩坑点）

- **`disposed` 守卫**：所有有生命周期的方法/模块都采用 `let disposed = false` → `if (disposed) return;` → `disposed = true;` 模式。双重 dispose 必须安全。
- **无 class**：全部用 `create*()` 工厂函数返回对象字面量，用 `type` 而非 `interface` 声明返回类型。
- **穷举 switch**：有区分联合类型上用 switch 穷举，不用 `default`。少写分支编译器报错。
- **`satisfies` 替代 `as`**：类型验证用 `satisfies Type`，不用 `as Type`（as 会强制转换可能隐藏错误）。测试中尤其普遍。
- **`@ts-expect-error` 用于类型边界测试**：证明某个模式**被正确拒绝**。`publicExports.test.ts` 里有 20+ 处使用。禁止 `@ts-ignore` 和 `as any`。
- **`async/await` 在 runtime core 里不使用**：运行时核心用 `.then()/.catch()` + `isPromiseLike()` 守卫。只有 image/video/model 的 native load 允许 async。
- **`node:*` 只能在测试和脚本文件中使用**：运行时源码不能 import Node API——SSR 安全要求。

## 测试习惯

- **DI 优先**：测试直接调真实实现函数，通过 typed options 注入 stub。不用 `vi.mock()` mock 被测试模块自身。只有 Three.js 构造函数才需要用 `vi.doMock` + 动态 `import()`。
- **Deferred Promise 控制异步**：用 `let resolve: () => void; await new Promise(r => { resolve = r; })` 精确控制异步完成时序。不用 `vi.useFakeTimers()`。
- **无 snapshot 测试**：全部显式 `.toEqual()` / `.toMatchObject()`。没有 `.toMatchSnapshot()` 调用。
- **无共享 test-utils**：每个测试文件自包含 helper 函数（`createSceneAdapter()`、`createFrameInput()` 等），底部定义。不存在共享 `test-utils.ts`。
- **React 测试用 `createElement`**：不用 JSX。SSR 测试用 `renderToStaticMarkup`。用 `createRoot` + `act` 挂载/卸载。
- **Three.js 在 jsdom 中**：导入 `three/src/...` 源码路径（非 barrel），不创建真实 GPU context。通过 `rendererHostFactory` 注入 stub。

## 空目录陷阱（已移除但残留）

- `packages/dom-webgl-runtime/src/lib/effects/presets/` — 空目录
- `packages/dom-webgl-runtime/src/lib/effects/motions/` — 空目录

Agent 遍历文件树时别被误导——核心不注册默认 effect。这两个目录是 Phase 5/7 遗留。

## 关键文档

- `docs/agent/package-usage.md` — 下游集成和 effect authoring 的 agent 入口
- `docs/examples/effect-authoring.md` — React-only 消费者教程
- `docs/00-goal.md` — 完整架构原则和非目标清单
- `README.md` — 状态、行为描述、示例代码、验证命令
- `docs/agent/effect-authoring-example-report.md` — 已知摩擦点

## 调试资源

- `WebGLDebugState` 公开 `targetCount`、`renderableCount`、`currentScrollMode`、`activeGateKey`、`sceneProgress`、各 target 状态。
- `onDebugStateChange` 回调可在运行时监听状态变化。

## 高风险操作

- 删除、覆盖、强推、生产部署、密钥/权限修改必须先确认。
- 修改 runtime 行为时优先保持声明驱动和包级通用能力；demo 需要的能力必须先抽象成公共 API、内部通用管线或测试夹具。
- 排查硬编码时同时检查 `packages/dom-webgl-runtime/src` 的非测试实现、`apps/demo` 的公共 API 使用边界、README 和 `docs/EXECUTION_STATE.md`。
- 能验证就跑 test/typecheck/build 或最小可行验证。
