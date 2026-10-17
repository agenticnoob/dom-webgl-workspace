# Skill A/B 评分标准

每个生成项目共 10 项，每项 0–1 分（部分项按子检查通过比例给分），满分 10。
全部由 [`scripts/grade.mjs`](scripts/grade.mjs) 自动评分。浏览器检查使用 Playwright
驱动系统 Chrome（headless、SwiftShader WebGL、DPR 1、默认视口 1280×800），
被测页面运行在项目自己的 Vite dev server 上（`main.tsx` 中含 StrictMode）。

页面注入脚本 [`scripts/instrument.js`](scripts/instrument.js)：统计 WebGL context 的
创建/丢失、`window`/`document` 监听器、ResizeObserver/IntersectionObserver、
`requestAnimationFrame` 调用次数；对 WebGL context 强制 `preserveDrawingBuffer`，
用于直接读取 canvas 像素（只读 WebGL 画布，不受上层 DOM 遮挡影响）；还可以模拟
WebGL 不可用的情况（`getContext("webgl*")` 返回 `null`）。

像素分析：把最大的已连接 WebGL canvas 降采样到 2px 网格，出现次数最多的颜色视为背景，
与背景差异超过阈值的格子组成“前景掩码”，据此计算格子数、质心和包围盒。“状态差异”
指两次采样之间颜色变化超过阈值的格子占比。

| # | 评分项 | 自动判定 |
| --- | --- | --- |
| 1 | `single_canvas` 单一 Canvas/renderer | 在每个检查点（首屏、滚动后、resize 后），DOM 中都恰好有 1 个 `<canvas>`，且存活的 WebGL context 恰好 1 个。卸载测试挂载后如果 canvas 数不是 1，本项最多 0.5 分。 |
| 2 | `dom_fallback` 加载中/失败时 DOM 可见 | **A**：GLB 请求一直挂起、GLB 返回 404、WebGL 不可用三种情况下，`model-fallback` 和 `product-card` 都可见（display/visibility 正常，祖先累计 opacity > 0.05，尺寸非零），页面也没有白屏。**B**：正常模式和 WebGL 不可用时，三个 chapter 都可见。**C**：正常模式下 `wave-text` 保留在 DOM 中、文本完整、没有 `aria-hidden`（允许 opacity 为 0）；WebGL 不可用时它可见。 |
| 3 | `ssr_safe` SSR 安全 | 在纯 Node（无 DOM 全局对象）中，用项目自己的 Vite `ssrLoadModule("/src/App.tsx")` 加载组件，再用 `renderToString(<App />)` 渲染。不抛错，且 HTML 包含任务要求的所有 `data-testid`。 |
| 4 | `cleanup` 卸载/重挂清理 | 评分器写入 `eval-harness.html`，用 `createRoot` 挂载 `App`（不含 StrictMode），之后卸载→挂载循环 3 次，最后卸载。五个子检查：canvas 已移除；存活 WebGL context 为 0；window/document 监听器和 observer 回到基线；卸载后 1 秒内 rAF 调用 ≤ 2；再次挂载后恰好 1 个 canvas、1 个 context，且没有新错误。如果挂载后从未创建 canvas，本项记 0（不给“空清理”分）。 |
| 5 | `scroll_resize` 反向滚动与 resize | **A**：下滚 200px、滚到底部再回到卡片、视口改为 820×1000 这三种情况下，模型像素质心都落在卡片矩形内（四周各外扩 10%）。**B**：从 chapter 3 回到 chapter 2、回到 chapter 1，以及 resize 往返后回到 chapter 2，画面与下滚时的同一位置相比差异 ≤ max(1%, 章节间差异 × 20%)；章节间差异本身必须 ≥ 5%，否则这一项检查没有意义，记为不通过。**C**：下滚 120px、视口改为 700×900（需要重新折行）、滚到底再回顶部这三种情况下，WebGL 文字都与 DOM 文字对齐（定义见下方“文字对齐”）。 |
| 6 | `public_imports` 只用公开入口 | `verify-consumer.mjs` 没有报告 import 违规，且 `src/` 中没有 `@viselora/*` 私有子路径、`node_modules/` 或 `packages/*/src` 的 import。 |
| 7 | `typecheck` | `tsc --noEmit -p tsconfig.json` 退出码为 0（如果项目改成 solution 风格的 tsconfig，则用 `tsc -b`）。 |
| 8 | `build` | `vite build` 退出码为 0。 |
| 9 | `pixels` 实际渲染像素 | 正常模式下，相关位置（A 为卡片居中处，B 为任意章节，C 为首屏）的 WebGL 前景掩码 ≥ 150 格（约 600 px²）。 |
| 10 | `task_effect` 任务效果代理 | **A**：卡片居中时有像素，且质心在卡片内。**B**：章节 1→2、2→3 的画面差异都 ≥ 5%（每个 0.5 分）。**C**：首屏 WebGL 文字与 DOM 文字对齐（0.5 分）；间隔 500ms 的两帧中，标题区域有 ≥ 0.5% 的格子发生变化，即波浪在动（0.5 分）。 |

**文字对齐（任务 C）**：先隐藏 canvas，在标题位置叠加一个洋红色的标题克隆，截图后与不加
克隆的截图相减，得到 DOM 字形掩码；不直接改原标题，因为运行时可能每帧都在写它的 opacity。
然后在标题框外扩 64px 的范围内，用该区域的主色作为背景，计算 WebGL 前景掩码，再把两者在
x ±64px、y ±32px 范围内做互相关。判定为对齐需要同时满足：DOM 字形 ≥ 50 格；最佳偏移在
±6px 以内；最佳偏移处有 ≥ 60% 的字形格被 WebGL 前景覆盖；区域内 WebGL 前景密度 < 60%
（排除整块铺满的背景）。装饰性的 WebGL 背景只要不铺满标题区域，就不影响这项判定。

## 只记录、不计分的指标

- `verify-consumer.mjs` 完整结果，包括版本 pin 和 Canvas/renderer 静态规则。
- 用到的 Viselora 和加载 API、源码行数。
- agent 的耗时、成本（claude）或 token（codex），以及 B 条件下是否调用了 skill、读了哪些 skill 文件。
- 人工视觉评分 0–3（看 `.eval-shots/` 截图）：0 = 白屏或明显错误；1 = 能跑但画面粗糙或错位；
  2 = 符合需求；3 = 符合需求且有设计感。这一项是主观评分，单独报告，不计入自动总分。

## 稳定性

headless Chrome 在负载下偶尔会断开连接。浏览器阶段最多用新的浏览器实例重试 3 次，
重试记录写在 `grade.json` 的 `notes` 中。如果页面每次都让浏览器崩溃，浏览器相关的 6 项都记 0。

## 校准

[`scripts/run-controls.mjs`](scripts/run-controls.mjs) 会构建以下样本并评分，然后比较失败项是否符合预期：

- 空脚手架：预期 3/10；
- [`controls/`](controls/) 中三个手写的参考实现：预期 10/10；
- 四个故意出错的变体：模型不跟随卡片、带基于时间的动画、文字右移 40px、resize 后纹理不重建。
  每个变体都应该只在对应的评分项上失败。

修改阈值或检查逻辑后，必须重新运行校准，并对所有运行结果加 `--regrade` 重新评分。
