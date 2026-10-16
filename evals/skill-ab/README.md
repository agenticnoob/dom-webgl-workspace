# Skill A/B 评测：`viselora-dom-webgl`

问题：安装 [`skills/viselora-dom-webgl`](../../skills/viselora-dom-webgl/SKILL.md) 之后，
coding agent 搭建的「DOM + WebGL」页面质量是否更好？

评测日期：2026-10-16。被测包版本：`@viselora/dom-webgl@0.2.0-alpha.0`（npm 官方源）。

## 结论

**在这组评测里，skill 没有带来可测量的提升。** 24 次运行（2 个 agent × 3 个任务 ×
有/无 skill × 2 种 prompt）的自动评分平均：

- 无 skill（A）：9.82 / 10
- 有 skill（B）：9.83 / 10

10 个评分项里有 7 项，两个条件都是 100% 通过；其余差异都来自单个样本（每个格子 n=1）。

| 评分项 | skill 的影响 | 依据 |
| --- | --- | --- |
| 单一 Canvas、DOM fallback、卸载清理、只用公开入口、typecheck、build、实际渲染像素 | **没有区别** | A、B 都是 24/24 满分。`WebGLRuntime` 的 API 本身就占有唯一的 Canvas 和 renderer，`hideWhenReady` 和 `setTargetReady` 提供 fallback；agent 读 npm 包里的类型和 dist 代码就能正确使用（24 次中有 22 次读过 `node_modules/@viselora/dom-webgl/dist`）。 |
| SSR 安全 | **可能有帮助，只有 1 个样本** | 唯一失败的是 codex-c-A-min（精简 prompt、无 skill），在 `useState(() => window…)` 里直接访问 `window`。有 skill 的运行全部通过。 |
| DOM 文字对齐（任务 C 的 scroll_resize 和 task_effect） | **没有帮助，略有负面影响** | 3 个对齐失败的运行都直接使用了 `createDOMTextTexture`，其中 2 个是 skill 组（claude-c-B、claude-c-B-min）。这个 helper 有一个约 10–12px 的竖直偏移 bug（见下文），skill 推荐了它，但没有给出任何警告。自己用 DOM Range 绘制文字的运行全部对齐。 |
| 视觉效果（人工 0–3） | **没有区别** | 24 个页面都在 2–3 分之间。风格差异由 agent 决定（codex 的设计更完整），与有没有 skill 无关。 |
| 版本 pin（`verify-consumer` 规则，不计分） | **没有帮助** | claude 的 12 次运行都写成 `^0.2.0-alpha.0`，包括 6 次有 skill 的运行；codex 的 12 次都 pin 到精确版本（prompt 里写了版本号）。 |

因此，发起会话的假设「skill 主要提供约束和校验，可能帮助工程正确性，但不帮助视觉」
只有一半成立：

- **对视觉没有帮助：成立。**
- **对工程正确性有帮助：在本次设置下没有观察到。** 原因是天花板效应：两个强 agent
  不靠 skill 也能做到，而正确性主要来自包的 API 设计本身，不来自 skill 文档。
  只有 1 个 SSR 样本暗示，在 prompt 没有写明约束时，skill 可能有用。

## skill 缺少的内容

1. **可以直接复制的效果代码。** [`effect-recipes.md`](../../skills/viselora-dom-webgl/references/effect-recipes.md)
   只有 13 行描述性文字。每个 agent 都从零写了 185–566 行代码，三个任务最常见的模式都在被反复重新实现：
   - GLB 模型的加载、fit 到卡片、`setTargetReady`、加载错误时保留 fallback：任务 A 的 8 次运行全部各写各的；
   - 滚动进度到场景状态的映射：只有 codex B 组用了 `createScrollEffectProgressStore`，其余都是手写 `scrollY` 映射；
   - DOM 文字纹理 + 波浪 shader + 跟随 revision 重建纹理。
2. **text helper 的正确性和注意事项。** `createDOMTextTexture` 绘制的字形没有计入
   line-height 的 half-leading：在 72px 字号下，纹理里的墨迹顶部固定在 5px，而 DOM
   墨迹顶部随 line-height 移动（`1` → 9px，`normal` → 16px，`1.5` → 27px）。
   skill 推荐了这个 helper，但没有提到这个偏差；照 skill 做的 agent 会直接继承这个 bug。
   这是 `packages/` 的问题，本次没有修改，列为后续工作。
3. **`revision` 的用法示例。** 文档只用一句话说明要在 frame 中读取 `revision`。
   它是一个可变字段，变化时不会触发 React 重渲染。写对照实现时我自己就犯了这个错误：resize
   后纹理没有重建，被拉伸显示。一个 recipe 示例就能避免这个问题。
4. **最关键的约束应该写在 SKILL.md 正文里。** claude 的 B 组 6 次运行里，有 4 次只看了
   `Skill` 工具注入的 SKILL.md，没有打开任何 references。精确版本 pin、
   `verify-consumer.mjs`、text helper 的注意事项都在 references 里，所以这些运行根本没看到。
   codex 的 B 组会读 8–11 个 skill 文件，6 次中有 5 次运行了 `verify-consumer.mjs`。
5. **可运行的浏览器验证。** skill 要求「比较真实浏览器像素、正反向滚动、resize、remount」，
   但只提供静态的 `verify-consumer.mjs`。本目录的 `scripts/instrument.js` 和
   `scripts/grade.mjs` 可以作为参考，改造成 skill 自带的浏览器检查脚本。

## 设计

- **任务**（[`prompts/`](prompts/)）：
  - (a) 3D 模型跟随 DOM 卡片，模型加载期间保留 DOM fallback；
  - (b) 滚动驱动的 3D 叙事，正向和反向滚动都要正确；
  - (c) 用 DOM 文字纹理做波浪效果。
- **两种公共前言**：
  - `full`（[`_common.md`](prompts/_common.md)）明确列出 SSR、清理、单一 Canvas、typecheck/build 等要求；
  - `minimal`（[`_common-minimal.md`](prompts/_common-minimal.md)）只描述要做的功能。
    增加这一组是因为 `full` 已经把 rubric 写进了 prompt，会抵消 skill「提供约束」的价值。
- **两种条件**：
  - A：空的 Vite + React 19 + TS 脚手架（[`scaffold/`](scaffold/)，附带 `public/models/hero.glb`）；
  - B：同一个脚手架，执行过
    `npx skills add <repo> --skill viselora-dom-webgl -a claude-code --copy -y`。
    codex 运行使用 `-a codex`，skill 安装到 `.agents/skills/`。
- **两种条件的 prompt 都点名使用 Viselora**，所以本评测衡量的是「已经决定用 Viselora
  时，skill 文档有没有额外价值」。它不衡量「Viselora vs 原生 R3F」，也不衡量 skill 在没被点名时会不会被触发。
- **Agent**：
  - `claude -p`：Claude Code 2.1.287，`claude-opus-5-5`，`--dangerously-skip-permissions --strict-mcp-config`；
  - `codex exec`：codex-cli 0.160.0，`gpt-6.1-sol`，reasoning `xhigh`，`--dangerously-bypass-approvals-and-sandbox`。
  - 两者都会加载用户级的全局 skill 和配置，A、B 组完全相同。
  - 所有 B 组运行都实际使用了 skill：claude 每次都调用了 `Skill(viselora-dom-webgl)`，codex 每次都读了 SKILL.md。
- 每个组合跑 1 次，共 24 次。所有生成的项目都在 `$TMPDIR/viselora-skill-ab/`，没有放进仓库。

## 评分

评分标准见 [rubric.md](rubric.md)，全部由 [`scripts/grade.mjs`](scripts/grade.mjs) 自动评分，包括：

- 静态检查：`verify-consumer.mjs` 和 import 扫描；
- `tsc` 和 `vite build`；
- 在纯 Node 中执行 SSR `renderToString`；
- 用 Playwright 驱动系统 Chrome（SwiftShader）做浏览器检查：读取 WebGL 像素，模拟 GLB 加载挂起、404 和 WebGL 不可用，
  做正反向滚动和 resize，并在挂载/卸载/重新挂载时统计 context、监听器和 rAF。

校准（[`scripts/run-controls.mjs`](scripts/run-controls.mjs)，最终版评分器跑出 8/8 全部符合预期）：

| 样本 | 得分 | 失败项 |
| --- | --- | --- |
| 空脚手架 | 3 | 只拿到 typecheck、build、imports |
| 对照 A、B、C（[`controls/`](controls/)，手写的参考实现） | 10 / 10 / 10 | 无 |
| 模型停在视口中心，不跟随卡片 | 8.33 | scroll_resize、task_effect |
| 场景带基于时间的旋转 | 9 | scroll_resize |
| WebGL 文字右移 40px | 8.5 | scroll_resize、task_effect |
| 纹理只捕获一次，resize 后不重建 | 9.33 | scroll_resize |

评分器在看到第一批 codex 结果后修改过一次。原来任务 C 的对齐检查用的是全画布质心，codex-c-A
额外加了一个装饰性的水波背景，导致误判。现在改为把 DOM 字形与 WebGL 像素做互相关，并在全部
24 次运行上用最终版本重新评分。headless Chrome 在负载下偶尔会断开连接，所以浏览器检查阶段最多重试
3 次；claude-b-A-min 和 codex-a-B 分别重试后通过，记录在各自的 `grade.json` 里。

## 结果

### 按条件汇总（每格 n=3，即 3 个任务）

| agent / prompt / 条件 | single canvas | dom fallback | ssr safe | cleanup | scroll resize | public imports | typecheck | build | pixels | task effect | 平均总分 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| claude full A | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **10** |
| claude full B | 1 | 1 | 1 | 1 | 0.78 | 1 | 1 | 1 | 1 | 0.83 | **9.61** |
| claude minimal A | 1 | 1 | 1 | 1 | 0.78 | 1 | 1 | 1 | 1 | 0.83 | **9.61** |
| claude minimal B | 1 | 1 | 1 | 1 | 0.89 | 1 | 1 | 1 | 1 | 0.83 | **9.72** |
| codex full A | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **10** |
| codex full B | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **10** |
| codex minimal A | 1 | 1 | 0.67 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **9.67** |
| codex minimal B | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **10** |

### 每个任务、每个条件的得分

| 任务 | claude full A / B | claude minimal A / B | codex full A / B | codex minimal A / B |
| --- | --- | --- | --- | --- |
| (a) 模型跟随卡片 | 10 / 10 | 10 / 10 | 10 / 10 | 10 / 10 |
| (b) 滚动叙事 | 10 / 10 | 10 / 10 | 10 / 10 | 10 / 10 |
| (c) 文字波浪 | 10 / **8.83** | **8.83** / **9.17** | 10 / 10 | **9** / 10 |

`verify-consumer.mjs`（不计分）：claude 的 12 次运行全部失败，原因都是 `^` 版本范围；codex 的 12 次全部通过。

人工视觉评分（0–3，单人主观评分）：全部页面都在 2–3 分；codex 的排版和场景整体更精致，
同一个 agent 的 A、B 组看不出系统性差异。截图保存在各运行目录的 `.eval-shots/` 中，没有提交进仓库。

### 过程指标

| 组 | 平均用时 | 成本或 token |
| --- | --- | --- |
| claude full A / B | 9.9 / 4.2 min | $3.23 / $2.43（3 次合计） |
| claude minimal A / B | 4.6 / 2.5 min | $1.65 / $1.72 |
| codex full A / B | 14.1 / 16.8 min | 10.6M / 9.1M 输入 token |
| codex minimal A / B | 16.2 / 20.6 min | 10.5M / 10.2M 输入 token |

claude 的 full B 组更快、更便宜，但 n=3，而且 minimal 组没有出现同样的差异，不能据此下结论。
逐次运行的数据（分数、违规项、使用的 API、读过的 skill 文件）见 [`results.json`](results.json)。

## 典型失败案例

1. **claude-c-B（有 skill）：WebGL 文字比 DOM 高约 12px。** 按 skill 的提示使用了
   `createDOMTextTexture`，并把平面放在 DOM 矩形上。最佳对齐偏移为 y=−12px（容差 ±6px），
   因此 task_effect 0.5、scroll_resize 0.33。claude-c-A-min（无 skill，同样用这个 helper）
   和 claude-c-B-min 也是同样的结果。codex-c-B-min 同时用了这个 helper 和自己的 Range 测量，结果对齐。
2. **codex-c-A-min（无 skill、精简 prompt）：SSR 失败。** 组件里写了
   `useState(() => window.matchMedia(...))`，服务端渲染时抛出 `ReferenceError: window is not defined`。
   这是唯一一个可以算作 skill 有用的样本。
3. **claude 全部运行：版本范围。** `package.json` 中写的是 `^0.2.0-alpha.0`，
   而 skill 的 `verify-consumer.mjs` 要求精确版本。claude 的 B 组没有读到这条规则，因为它在 references 里。

## 局限

- 每个格子只有 1 个样本，单个失败就能改变组平均值；两个 agent 都是能力很强的前沿模型。
- 评分只覆盖可以自动化的正确性和效果代理指标。视觉评分来自单人主观判断。
- 检查运行在 Vite dev server 上（StrictMode）和 SwiftShader 上，没有覆盖生产构建的运行时、真实 GPU 和移动设备。
- prompt 直接点名 Viselora 和版本，减弱了 skill「告诉 agent 用什么」的作用。

## 复现

```bash
node evals/skill-ab/scripts/run-eval.mjs --concurrency 6
node evals/skill-ab/scripts/run-eval.mjs --variant minimal --concurrency 6
node evals/skill-ab/scripts/report.mjs
node evals/skill-ab/scripts/run-controls.mjs
```

`run-eval.mjs` 会在 `$TMPDIR/viselora-skill-ab/` 下准备脚手架和 `playwright-core`，并跳过已经完成的运行。
`report.mjs` 只给尚未评分的运行打分，加 `--regrade` 会全部重新评分。
需要本机已登录 `claude` 和 `codex` CLI，并安装了 Google Chrome。
