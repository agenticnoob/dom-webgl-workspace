# 第二轮评测：Viselora + skill 是否比原生实现更好

问题：给 coding agent 一个「DOM + WebGL」页面需求时，用 `@viselora/dom-webgl` + skill
是否比 agent 自己用 three.js / R3F / drei 写更好？第一轮（[`../skill-ab/`](../skill-ab/README.md)）
只比较了「已经点名 Viselora 时有没有 skill」，没有回答这个问题。

评测日期：2026-10-18 至 10-19。被测对象：npm 上的 `@viselora/dom-webgl@0.2.0-alpha.1`、
`@viselora/scroll-adapters@0.2.0-alpha.1`，以及 main（702971f）上的
[`skills/viselora-dom-webgl`](../../skills/viselora-dom-webgl/SKILL.md)。

## 结论

1. **强 agent 不需要 Viselora。** codex（gpt-6.1-sol，reasoning `xhigh`）在 4 个条件 × 5 个任务 × 3 次重复的
   60 次运行里**全部 13/13**，包括不提 Viselora、也不装 skill 的 N 条件。它在 N 条件下几乎都用手写的
   `THREE.WebGLRenderer`（15 次中 14 次；R3F 和 drei 虽然已经装好，也没有用），同样做到了 context 丢失恢复、
   读屏可访问、reduced motion、反向滚动和 hand-off。第一轮的天花板效应在更难的任务和新增评分项上依然存在。
2. **弱 agent 用 Viselora 明显更好。** codex `low` 的平均分：N 11.26，S 12.94，V 12.67，VS 13.00（满分 13，每组 15 次）。
   N→S、N→V、N→VS 的差异都显著（置换检验 p = 0.015 / 0.034 / 0.007）。N 条件有 **5/15 次页面完全没有 WebGL**，
   S、VS 是 0/15（Fisher p = 0.042）。
3. **差距几乎全部来自同一类错误：renderer / context 的生命周期。** 这 5 次失败都是手写 three.js：在 effect
   清理里调用 `renderer.forceContextLoss()`，React StrictMode 重新执行 effect 时，在同一个 `<canvas>` 上拿回已经丢失的
   context，页面一片空白。去掉这 5 次，codex-low N 的平均分约 12.9，和 S（12.94）基本相同。
4. **skill 的可测量价值：被自动选用，约束了版本，并且避开了 uniforms 陷阱。**
   - S 条件（prompt 不提 Viselora）下，codex 读取 skill 并选用 Viselora 的比例是 **30/30**；
   - S/VS 的 60 次运行全部精确 pin 版本，`verify-consumer.mjs` 全部通过；V 条件（不装 skill）的 codex-low 有 11/15 写成 `^0.2.0-alpha.1`；
   - V 条件出现了唯一一次 Viselora 用户的白屏（codex-low-c-V-r3）：它修改了作为 prop 传入的 `uniforms` 对象（SKILL.md 规则 7 专门警告的陷阱），
     纹理始终没有进入材质，却报告了 ready，结果 DOM 标题被隐藏，页面上一个字都看不到。
   - 但 S 与 V、V 与 VS 之间的分数差异都不显著（p ≥ 0.48）。
5. **新增的 3 个稳健性项没有区分能力。** `a11y_tree` 和 `reduced_motion` 在 N 条件下也几乎全部满分。prompt 明确写了这两项要求，
   强弱两个配置都照做了。`context_loss` 的差异完全来自上面 5 次白屏，其余 N 运行都自己处理了 context 丢失。Viselora
   「丢失时自动恢复 DOM fallback」的设计在这里没有体现出优势，因为 agent 被要求这样做时都能自己写对。

**对项目定位的结论：Viselora 的价值主要在于「给能力较弱、或者没有被提醒的 agent 一个不会出生命周期错误的默认结构」**
（单一 Canvas / renderer 的所有权、StrictMode 安全的挂载与卸载、ready 与 fallback 的绑定），而不在于提供强 agent
写不出来的能力。skill 是让 agent 在不点名时也选用 Viselora 的有效入口（30/30），而且能纠正版本和 uniforms 这类细节。
对强 agent 来说，Viselora 带来的是**更少的代码**（codex-xhigh：S 平均 419 行，N 平均 573 行，少约 27%）和稍短的用时
（17.0 分钟对 19.7 分钟），而不是更高的分数。

建议的方向：

- 把卖点从「能做到」改成「默认就不会错」：重点宣传生命周期、StrictMode/remount、context loss、fallback 与 ready 绑定，
  并面向中低能力模型和「没有逐条写出要求」的 prompt 做评测（本轮 prompt 逐条列出了要求，压缩了差异）。
- 修复安装门槛：npm `latest` 标签仍是 `0.1.0-alpha.0`（API 不同）；`three@latest` 已是 0.186，而 peer 范围
  `^0.184.0` 会让 `npm install three@latest @react-three/fiber@9 @viselora/dom-webgl@alpha` 直接 ERESOLVE。
  一个用最新 three 的现有项目装不上 Viselora。
- skill 的 `browser-check.mjs` 依赖 `playwright-core`，大约一半的 S/VS 运行因为没装驱动而没有得到结果；
  ModelTarget recipe 的 idle 旋转不处理 reduced motion（校准里 recipe-a 在 `reduced_motion` 失败）。

## 设计

- **条件**（四个条件使用同一个脚手架：v1 的 Vite + React 19 + TS 脚手架，另外预装
  `three@~0.184.0`、`@react-three/fiber@^9.8.1`、`@react-three/drei@^10.7.9`）：
  - **N**：prompt 不提 Viselora，不装 skill；
  - **V**：prompt 点名 `@viselora/dom-webgl` 0.2.0-alpha.1（[`prompts/_viselora.md`](prompts/_viselora.md)），不装 skill；
  - **S**：prompt 不提 Viselora，用 `npx skills add <本仓库> --skill viselora-dom-webgl -a codex --copy -y` 安装 skill；
  - **VS**：点名 Viselora，并且安装 skill。
  - three 锁在 0.184，是因为 Viselora 的 peer 范围是 `^0.184.0`；如果用 `three@latest`，V 条件会先卡在依赖冲突上。
- **公共 prompt**（[`prompts/_common.md`](prompts/_common.md)）：在产品层面列出要求，包括读屏用户可用、context 丢失时可读、
  reduced motion、SSR、卸载清理、单一 canvas、typecheck/build，但不提示实现方式。
- **任务**：第一轮的 a（模型跟随卡片）、b（滚动叙事）、c（DOM 文字波浪），加上两个新任务：
  - [d：4 张交互式 3D 卡片](prompts/d-feature-cards.md)，物体跟随卡片，鼠标悬停和键盘焦点都会触发反应；
  - [e：4 章节可反向滚动叙事](prompts/e-story-handoff.md)，结束时把页面交还给语义 DOM（outro 上不能画 3D，链接可点击）。
- **模型**：只用 codex（codex-cli 0.160.0，`gpt-6.1-sol`，`--dangerously-bypass-approvals-and-sandbox`），
  分强、弱两档：reasoning `xhigh` 和 `low`。原计划还包括 Claude（opus / sonnet），后来按用户要求改为只用 codex。
- **规模**：2 档 × 4 个条件 × 5 个任务 × 3 次重复 = **120 次运行**，全部有效，没有限流或认证失败。
  生成的项目在 `$TMPDIR/viselora-skill-ab-v2/runs/`，没有放进仓库。

## 评分

评分标准见 [rubric.md](rubric.md)。核心 10 项沿用第一轮的 [`grade.mjs`](../skill-ab/scripts/grade.mjs)，第二轮在其中新增
任务 d/e 的检查和 3 个稳健性项（`context_loss`、`a11y_tree`、`reduced_motion`），总分 `totalV2` 满分 13。
`verify-consumer.mjs` 的精确版本规则不计分，只单独记录。

### 本轮发现并修复的评分器偏差

评测过程中发现 4 个评分器问题，修复后对受影响的运行重新评分：

1. **drei `<View>` 的残影**：评分器为了读取像素而强制 `preserveDrawingBuffer`，scissor 视口外的旧像素因此不会被清掉，
   不用 Viselora 的 drei 参考实现被误判。现在每帧第一次向默认 framebuffer 绘制前，评分器先模拟浏览器的整块清屏。
2. **`scroll-behavior: smooth`**：120 次运行里有 62 次在 CSS 中启用了平滑滚动，评分器的 `scrollTo` 变成了动画，
   测量时页面还没滚到位。修复后这 62 次重新评分，其中 9 次分数改变（多数是 codex-xhigh N 的反向滚动「失败」消失）。
3. **悬停路径**：鼠标分 6 步移向卡片 2 时，会穿过一行布局里的卡片 1，被误判为「其他卡片也有反应」。现在直接跳到目标位置；任务 d 的 30 次运行全部重新评分。
4. **读屏文字匹配**：`textContent` 会把相邻元素的文字粘在一起，例如 "previewHero"，现在改为按文本节点拼接。

**评分器的可重复性**：26 次运行在第一遍（机器负载高达 130）和最终评分中都被完整评过；其中 23 次的分数完全一致，
另外 3 次在第一遍里 browser 阶段崩溃，原因是我中途终止了它们的 Chrome 和 Vite 进程。
codex-xhigh-a-VS-r3 第一次评分时 reduced-motion 检查读到 0 个像素，单独复现时一切正常，重新评分后满分，判断为高负载下 GLB 加载过慢。

### 校准（最终版评分器）

16 个用例全部符合预期（2026-10-19，最终版评分器，[`scripts/run-controls.mjs`](scripts/run-controls.mjs)）：

| 样本 | core / v2 | 失败项 |
| --- | --- | --- |
| 空脚手架（任务 d） | 3 / 3 | 除 typecheck、build、imports 外全部 |
| 第一轮对照 a、c；recipe-a（ModelTarget） | 10 / 12 | `reduced_motion`（idle 旋转、波浪不处理 reduced motion） |
| 第一轮对照 b；recipe-b、recipe-c | 10 / 13 | 无 |
| `control-d`、`control-e`（Viselora） | 10 / 13 | 无 |
| `native-d`（不用 Viselora：drei `<View>` + error boundary） | 10 / 13 | 无 |
| D：物体停在第一帧的位置 | 9.67 / 12.67 | `scroll_resize` |
| D：没有键盘响应 | 9.75 / 12.75 | `task_effect` |
| D：完全没有交互 | 9.25 / 12.25 | `task_effect` |
| E：场景停在 outro 上 | 9.75 / 12.75 | `task_effect` |
| A：fallback 被 `aria-hidden` | 10 / 11 | `a11y_tree`、`reduced_motion` |
| A：fallback 用手写 opacity 隐藏 | 10 / 11.67 | `context_loss`、`reduced_motion` |

`native-d` 第一版没有 error boundary，WebGL 不可用时整页白屏（`dom_fallback` 0.5），评分器判断正确；
参考实现补上 error boundary 后满分。

## 结果

### 各条件得分（`totalV2`，满分 13）

| 配置 | N | S | V | VS |
| --- | --- | --- | --- | --- |
| codex-low（每格 n=15） | **11.26** | 12.94 | 12.67 | **13.00** |
| codex-xhigh（每格 n=15） | 13.00 | 13.00 | 13.00 | 13.00 |
| 合计（n=30） | 12.13 | 12.97 | 12.83 | 13.00 |

核心 10 项（与第一轮可比）：codex-low N 8.60、S 9.94、V 9.76、VS 10.00；codex-xhigh 四个条件都是 10。

### 按任务（两档合计，`totalV2`，每格 n=6）

| 任务 | N | S | V | VS |
| --- | --- | --- | --- | --- |
| a 模型跟随卡片 | 11.33 | 13 | 13 | 13 |
| b 滚动叙事 | 12.17 | 13 | 13 | 13 |
| c 文字波浪 | 12.89 | 12.86 | 12.17 | 13 |
| d 交互卡片 | 11.27 | 13 | 13 | 13 |
| e 叙事 + hand-off | 13 | 13 | 13 | 13 |

### 显著性

在同一档配置内，把每次运行当作一个样本，做均值差的置换检验（20,000 次，固定种子），并对「页面没有任何 WebGL 像素」的次数做 Fisher 精确检验：

| 配置 | 比较 | 均值 A → B | p（置换） | 无 WebGL 的次数 | p（Fisher） |
| --- | --- | --- | --- | --- | --- |
| codex-low | N → S | 11.26 → 12.94 | **0.015** | 5 → 0 | **0.042** |
| codex-low | N → V | 11.26 → 12.67 | **0.034** | 5 → 1 | 0.17 |
| codex-low | N → VS | 11.26 → 13.00 | **0.007** | 5 → 0 | **0.042** |
| codex-low | S → V / S → VS / V → VS | 12.94 / 12.67 / 13.00 | 0.74 / 1 / 0.48 | 0 / 1 / 0 | 1 |
| codex-xhigh | 任意两个条件 | 都是 13.00 | 1 | 0 | 1 |

按「配置 × 任务」单元配对的符号翻转检验（10 个单元）全部不显著（N→S p = 0.25）。原因是 xhigh 的 5 个单元差异都是 0，
低分只集中在 codex-low 的 3 个任务上，配对检验的功效太低。因此结论只针对弱配置成立。
完整表格（逐次运行的分数、各评分项、配对检验）见 [`results.json`](results.json)，由 `report.mjs` 生成。

## 典型失败

1. **StrictMode 下复用已丢失的 context（codex-low N，5/15：a-r1、a-r2、b-r3、d-r1、d-r3）。** 手写
   `new THREE.WebGLRenderer({ canvas })`，在 cleanup 里调用 `renderer.dispose(); renderer.forceContextLoss()`。
   开发模式下 StrictMode 先挂载、卸载、再挂载，第二次在同一个 canvas 上拿到的已经是丢失的 context，铺满视口的 canvas 渲染成一片空白，盖住页面。
   抽查的 a-N-r1 在生产构建（没有 StrictMode）下正常渲染，开发构建空白；其余 4 次没有逐一检查生产构建。
   React 19 要求 effect 能承受「挂载→卸载→再挂载」，所以按缺陷计分；但真实用户在生产环境里不一定会遇到。
   Viselora 把 Canvas 交给 R3F 管理，这个错误在 Viselora 条件下不会出现。
2. **uniforms 作为 prop 传入后再修改（codex-low-c-V-r3）。** 修改 `useRef` 里 uniforms 对象的 `.value`。R3F 9 会把 prop
   的值复制进材质，所以纹理始终没有进入材质；组件仍然调用 `setTargetReady(true)`，`hideWhenReady` 把 DOM 标题隐藏了，
   页面上什么都看不到。这是 SKILL.md 规则 7 描述的陷阱；装了 skill 的 30 次 codex-low 运行都没有犯这个错误。
   这也暴露出 Viselora 的一个设计弱点：**ready 是由调用方声明的，不代表真的画出了像素**，声明错误时 fallback 会被藏掉。
3. **任务 c 文字对齐处于阈值边缘（N、S、V 各 1 次，共 3 次）。** 最佳偏移 8–10px 或重合度约 0.6，波浪位移本身会让字形偏离 DOM 位置。与条件无关。
4. **卸载后 context 未释放（codex-low-d-N-r2）。** 重新挂载后没有恢复渲染，`cleanup` 得 0.6。

## 成本与用时

| 配置 / 条件 | 平均用时（分钟） | 平均输入 token（其中缓存） | 平均输出 token | 平均源码行数 |
| --- | --- | --- | --- | --- |
| codex-low N | 2.8 | 0.34M（0.30M） | 5.9k | 173 |
| codex-low S | 3.5 | 0.86M（0.82M） | 6.5k | 212 |
| codex-low V | 3.5 | 0.75M（0.71M） | 6.0k | 190 |
| codex-low VS | 3.7 | 0.91M（0.86M） | 6.6k | 201 |
| codex-xhigh N | 19.7 | 3.79M（3.66M） | 46.2k | 573 |
| codex-xhigh S | 17.0 | 4.10M（3.98M） | 40.4k | 419 |
| codex-xhigh V | 19.0 | 4.30M（4.17M） | 43.9k | 499 |
| codex-xhigh VS | 17.7 | 3.32M（3.20M） | 40.5k | 482 |

- 120 次运行合计约 21.7 agent 小时、2.76 亿输入 token（大部分命中缓存）、294 万输出 token，全部走 ChatGPT 订阅额度；
  按并发 8 跑，生成阶段约 5 小时（2026-10-18 14:59–20:01 UTC），评分和两次局部重评另外花了数小时。
- 用时是在高负载下测得的：生成期间同时在评分，负载平均一度超过 100。只适合比较同一档配置内的条件，不宜看绝对值。
- codex-low 用 skill 后的输入 token 是 N 的约 2.5 倍（读 SKILL.md 和 recipe），每次运行多花 0.7 分钟左右；codex-xhigh 用 skill 后反而更快、代码更少。

## skill 的使用情况（S / VS，共 60 次）

- 60/60 次读取了 SKILL.md 并选用 Viselora；最常打开的文件依次是 `references/quickstart.md`（36 次）、`recipes/ModelTarget.tsx`（29 次）、
  `recipes/ScrollStory.tsx`（27 次）、`recipes/TextWave.tsx`（14 次）、`references/verification.md`（13 次）。
- `verify-consumer.mjs`：60/60 次运行过，60/60 次通过（没有装 skill 的 V 条件：codex-xhigh 15/15 通过，codex-low 4/15 通过，其余 11 次失败在 `^` 版本范围上）。
- `browser-check.mjs`：transcript 中都提到了它，但真正输出 PASS/FAIL 的只有 15/60 次（codex-xhigh VS 9 次、codex-xhigh S 4 次、codex-low 各 1 次）。
  31 次遇到「先安装浏览器驱动」的提示（`playwright-core` 不在依赖里）；只有少数运行先装了 `playwright-core` 再运行。

## 局限与未验证

- **只用了 codex 一个 agent。** 结论能否推广到 Claude 等其他 agent 没有验证。早期用 Claude 试跑了 3 次（opus-d-N、opus-d-V、sonnet-e-S），
  不计入结果：sonnet 在 S 条件下同样自动选用了 Viselora，得 13/13；opus 在 N 条件下用了 R3F + drei `<View>`，`context_loss` 恢复失败，
  得 12.67；opus-V 得 13/13，但写成了 `^0.2.0-alpha.1`。
- prompt 逐条列出了稳健性要求，这对 N 条件有利。如果 prompt 不提 context loss 和 reduced motion，差异可能更大，这一点没有测。
- 检查运行在 Vite dev server（StrictMode）和 SwiftShader 上；没有覆盖真实 GPU、移动设备，也没有做人工视觉评分。截图保存在各运行目录的 `.eval-shots/` 中，可以人工查看。
- 失败模式 1 在抽查的生产构建里没有出现，所以 codex-low N 的扣分里有一部分属于「开发环境缺陷」。
- 每格 15 次，弱配置的显著性依赖 5 次同类失败；codex-xhigh 处于天花板，测不出差异。

## 复现

```bash
node evals/skill-ab-v2/scripts/run-eval.mjs --prepare-only
node evals/skill-ab-v2/scripts/run-controls.mjs
node evals/skill-ab-v2/scripts/run-eval.mjs --concurrency 8
node evals/skill-ab-v2/scripts/report.mjs --concurrency 4 --md "$TMPDIR/viselora-skill-ab-v2/report.md" --out evals/skill-ab-v2/results.json
```

`run-eval.mjs` 默认运行 codex-xhigh、codex-low × N、V、S、VS × a–e × 3 次重复，跳过已经完成的运行；
`--configs opus,sonnet` 可以加入 Claude 配置。需要设置 `npm_config_registry=https://registry.npmjs.org/`
（脚本会自动设置）、已登录的 `codex` CLI 和 Google Chrome。
