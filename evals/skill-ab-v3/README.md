# 第三轮评测：不列要求的 prompt、Claude 与 three 0.186

问题：第二轮（[`../skill-ab-v2/`](../skill-ab-v2/README.md)）发现弱 agent 用 Viselora 明显更好，但有三个局限：只测了 codex；
prompt 逐条列出了稳健性要求，对原生实现有利；three 锁在 0.184。本轮针对这三点：

1. 加入 Claude（opus 和较弱的 haiku），codex 保留 `low` 档作为对照；
2. 新增 **minimal** 公共前言，只描述页面要做什么，不提 context loss、reduced motion、SSR、清理、单一 canvas，保留第二轮的 **full** 前言作对照；
3. 脚手架改用 three 0.186。

评测日期：2026-10-22。被测对象：npm 上的 `@viselora/dom-webgl@0.2.0-alpha.2`、`@viselora/scroll-adapters@0.2.0-alpha.2`，
以及 main（226ea38）上的 [`skills/viselora-dom-webgl`](../../skills/viselora-dom-webgl/SKILL.md)。它与
`agenticnoob/viselora-skills@c866fec` 逐文件一致（已用 `diff -r` 核对）。

## 结论

1. **Claude 与 codex 的结论一致，强 Claude 模型也没有到天花板。** minimal 前言、任务 a/d 上，每格 n=4：
   - haiku：N 10.13，V 12.44，S 12.63，VS 13.00；
   - opus：N 11.14，V 12.15，S 13.00，VS 13.00；
   - codex-low（同样只看 a/d）：N 10.70，V/S/VS 12.94–13.00。

   N 对三个 Viselora 条件合并的置换检验：haiku p = 0.003，opus p = 0.015。第二轮里强 agent（codex xhigh，full 前言）
   四个条件全部 13/13；本轮 opus 不用 Viselora 时平均 11.14，4 次里没有一次满分。「强 agent 不需要 Viselora」
   这个结论只在 full 前言下成立，不能推广到不列要求的 prompt（codex xhigh 在 minimal 下没有测）。
2. **minimal 前言下，原生实现并没有比 full 前言掉分更多，但失败的方式变了。** codex-low N：full 11.03，minimal 11.67
   （p = 0.48）。Viselora 带来的提升：minimal 下 +1.01，full 下 +1.97，两者之差 −0.96，bootstrap 95% 区间 [−2.65, 0.68]，
   没有证据表明 minimal 会拉大差距。
   - full 前言写了「卸载时释放一切」。codex-low 在 N 条件下 10/10 手写 `THREE.WebGLRenderer`，其中 9/10 在清理里调用了
     `forceContextLoss()`，**4/10 在 StrictMode 下白屏**。这和第二轮是同一个错误，逐条列出要求反而诱发了它。
   - minimal 前言下没有一次调用 `forceContextLoss`，也没有一次白屏。分数丢在没被要求、默认也不会有的稳健性上：
     WebGL 不可用时整页空白（R3F `<Canvas>` 外面没有 error boundary，6/10；Claude 的任务 d 也是 4/4），任务 d 每张卡片一个 `<Canvas>`（2/2），
     context 丢失时 DOM fallback 没有恢复，fallback 用 `aria-hidden` 从读屏树里拿掉。
3. **minimal 前言下，skill 比只点名包更重要（本轮的新发现）。** 三个配置合并：N 11.21（n=18）、V 12.21（n=18）、
   S+VS 12.93（n=36）；V → S+VS 的 p = 0.002。第二轮在 full 前言下，S 和 V 的差别不显著（p ≥ 0.48）。
   V 条件（点名包、没有 skill）丢分的原因：
   - codex-low 任务 c 2/2 掉进 uniforms 陷阱，ready 了但没画出像素，标题被隐藏，整页空白；第二轮也出现过 1 次。
   - Claude 任务 a 4/4 的 idle 旋转不处理 reduced motion（skill 的 ModelTarget recipe 处理了）。
   - 21/28 次把版本写成 `^0.2.0-alpha.2`，`verify-consumer` 不通过。
   - 有 1 次自己写了 WebGL 探测，留下多余的 context。

   S/VS 的 56 次运行全部精确 pin 版本；只要用了 Viselora，就没有出现白屏。
4. **skill 被选用的比例：codex 20/20，opus 4/4，haiku 2/4。** haiku 在任务 d 上两次读了 skill 但没有用 Viselora，理由分别是
   「它的工作流要让 dev server 一直开着，而你要求不要这样做」和「任务不需要，alpha 版可能不在 registry 上」。
   第一条理由来自 SKILL.md 的 Verify 一节「start the dev server and leave it running」，它和常见的 agent 指令冲突。
5. **browser-check 仍然很少产出结果。** S/VS 共 56 次运行，`browser-check.mjs` 真正打印 PASS/FAIL 的有 **14/56（25%）**：
   codex 7/40，haiku 3/8，opus 4/8。在第一次运行它之前就装好 `playwright-core` 的只有 6/56，全部是 Claude；
   codex 0/40，它每次都是先撞上「Install a browser driver first」，再决定装不装。
   复核第二轮：第二轮报告的 15/60 统计的是「任何命令输出了 PASS/FAIL 行」，其中多数来自 codex 用全局 `ego-browser`
   skill 自己写的检查脚本；严格只算 `browser-check.mjs` 本身，第二轮是 4/60。
6. **alpha.2 + three 0.186 与第二轮一致。** codex-low full 前言下 N/V/S/VS：11.03 / 13 / 13 / 13，第二轮是 11.26 / 12.67 / 12.94 / 13，
   各条件差异都不显著（p ≥ 0.74）。three 0.186 没有带来新的失败；校准用例在新版本上的结果与第二轮一致。

**对项目定位的结论：** 本轮支持并加强了第二轮的定位，即「默认就不会错」，而不是「能做到」。

- 不逐条写要求时，三个 agent（包括 opus）原生实现的典型缺陷都是「没人提醒就不会做」的默认值：
  WebGL 不可用时的 error boundary、单一 canvas、读屏可见的 fallback、reduced motion、context 丢失时恢复 DOM、
  不泄漏的 WebGL 探测。Viselora + skill 把这些变成了默认行为（S/VS 在三个配置上 12.63–13.00）。
- 真正起作用的是 **skill**，不只是包本身：只点名包时，agent 仍会掉进 uniforms/ready 陷阱，忽略 reduced motion，用错版本范围。
- 第二轮「强 agent 不需要 Viselora」的结论应改为「**被逐条告知要求的**强 agent 不需要」。

建议（本轮没有改 `packages/` 和 `skills/`）：

- SKILL.md 的 Verify：把 `npm install --save-dev playwright-core` 和 browser-check 合成一条命令；dev server 改为「后台启动，检查完关掉」，
  去掉 leave it running，避免和「不要留下 dev server」冲突（haiku 因此放弃了 skill）。
- `setTargetReady(true)` 仍然由调用方声明，ready 并不代表画出了像素。alpha.2 在 JSDoc 里写明了约束，codex-low V 仍有 2/10 白屏。
  可以考虑在运行时检测「ready 了但材质没拿到纹理」，或者在 dev 模式下给出警告。

## 设计

- **条件**：与第二轮相同。N（不提 Viselora，不装 skill）、V（点名 0.2.0-alpha.2，[`prompts/_viselora.md`](prompts/_viselora.md)）、
  S（只装 skill）、VS（点名并装 skill）。skill 用 `npx skills add <本仓库> --skill viselora-dom-webgl -a codex|claude-code --copy -y` 安装。
- **脚手架**：第一轮的 Vite + React 19 + TS，预装 `three@0.186.1`、`@types/three@0.186.0`、`@react-three/fiber@9.8.2`、
  `@react-three/drei@10.7.9`（第二轮是 three 0.184）。
- **前言**：
  - full：第二轮的 [`_common.md`](../skill-ab-v2/prompts/_common.md)，原样保留；
  - minimal：[`prompts/_common-minimal.md`](prompts/_common-minimal.md)，只保留脚手架说明、`App` 导出、`data-testid`、
    typecheck/build，删掉读屏、context loss、reduced motion、SSR、卸载清理、单一 canvas 六条要求。
  - 任务 prompt（a–e）不变。其中 a、c 自带「WebGL 不可用时 fallback 可见」这类任务内要求。
- **评分**：与第二轮相同（[rubric](../skill-ab-v2/rubric.md)，`totalV2` 满分 13）。minimal 前言没有提到的项也照常计分，
  因为本轮要测的就是「不提醒时默认是否稳健」，而不是是否遵守指令。各项的明细见 [`analysis.json`](analysis.json)。
- **Agent**：
  - codex-low：codex-cli 0.163.0，`gpt-6.1-sol`，reasoning `low`（第二轮是 0.160.0）；
  - haiku：Claude Code 2.1.287，`claude -p --model claude-haiku-5-5 --effort high`；
  - opus：同上，`--model claude-opus-5-5 --effort high`。
  - codex xhigh 不跑：第二轮在 full 前言下已经到天花板。
- **规模**（运行前已向用户确认）：
  - codex-low：2 种前言 × 4 个条件 × 任务 a–e × n=2 = 80 次；
  - haiku、opus：只用 minimal 前言 × 4 个条件 × 任务 a、d（第二轮原生实现掉分最多的两个任务）× n=2 = 各 16 次；
  - 共 **112 次**，全部有效，没有超时、非零退出或限流失败。

  全排列需要 240 次，其中 Claude 160 次，按 list 价约 $170，超过 Pro 订阅一周的额度，所以 Claude 只跑了 minimal 前言和两个任务。
- **环境隔离**：
  - claude 子进程使用 `--setting-sources project,local --strict-mcp-config`，不加载操作者的用户级 CLAUDE.md、skills 和 hooks；
    项目里安装的 skill 仍然可见（已用 init 事件核对）。
  - codex 与第二轮保持一致，没有隔离，会加载 `~/.codex/AGENTS.md` 和全局 skills。S/VS 的 40 次 codex 运行里，
    有 34 次用全局 `ego-browser` skill 做了浏览器检查（N 0/20，V 6/20）。两个 agent 的环境因此不完全对等。
- 生成的项目在 `$TMPDIR/viselora-skill-ab-v3/runs/`，没有放进仓库。

### 脚手架的扩展

只扩展第二轮的脚本，没有重写；不带新参数时行为与第二轮相同：

- [`run-eval.mjs`](../skill-ab-v2/scripts/run-eval.mjs)：
  - 新增 `--prompt-dir`、`--prompts full,minimal`、`--three`、`haiku` 配置；
  - claude 子进程只加载项目设置；
  - 读取订阅的 rate-limit 事件：5 小时窗口用到 85% 时暂停到重置时间，周额度超过 `--claude-weekly-cap` 时不再启动新的 claude 运行（本轮设 0.6），遇到限流的运行自动重排。
- [`report.mjs`](../skill-ab-v2/scripts/report.mjs)：
  - run 的 `config` 变为 `<config>/<prompt>`，所有比较都在同一种前言内进行；
  - 记录 browser-check 的调用、输出、driver 缺失提示、`playwright-core` 是否安装以及是否在首次调用前安装、`ego-browser` 的使用；
  - 统计函数移到 [`stats.mjs`](../skill-ab-v2/scripts/stats.mjs)，用第二轮的数据核对过，结果不变。
- [`run-controls.mjs`](../skill-ab-v2/scripts/run-controls.mjs)：新增 `--viselora-version`。
- 本轮新增：
  - [`scripts/analyze.mjs`](scripts/analyze.mjs)：前言效应、交互项、skill 过程、与第二轮的对比、WebGL 探测的敏感性分析；
  - [`scripts/regrade-low.mjs`](scripts/regrade-low.mjs)：对低于满分的运行做评分可重复性检查。

### 校准与评分可重复性

- 在第三轮 base（three 0.186，alpha.2）上运行第二轮的 17 个校准用例：第一遍 16/17 符合预期。不符合的是 `control-c`，
  它这一遍测到波浪没有动（`animated: 0`）。单独重跑一次后符合预期（波浪在动，`reduced_motion` 按预期失败）。
  第一遍运行时，机器上同时有 2 个 agent 在生成。
- 34 次低于 13 分的运行重新评了一遍：33 次两遍完全一致。haiku-minimal-a-N-r2 的 `reduced_motion` 第一遍通过、第二遍失败，
  于是评了第三遍，取中位数（8.77）。记录见 [`regrade-low.json`](regrade-low.json)。
- 生成阶段边生成边评分时，机器负载到了 77。那一轮的 6 个评分作废，生成结束后全部 112 次在较低负载下重新评分。

## 结果

### 各条件得分（`totalV2`，满分 13）

| 配置 / 前言 | 任务 | 每格 n | N | V | S | VS |
| --- | --- | --- | --- | --- | --- | --- |
| codex-low / minimal | a–e | 10 | **11.67** | 12.13 | 12.92 | 12.98 |
| codex-low / full | a–e | 10 | **11.03** | 13.00 | 13.00 | 13.00 |
| haiku / minimal | a, d | 4 | **10.13** | 12.44 | 12.63 | 13.00 |
| opus / minimal | a, d | 4 | **11.14** | 12.15 | 13.00 | 13.00 |
| （对照）codex-low / minimal，只看 a、d | a, d | 4 | 10.70 | 13.00 | 13.00 | 12.94 |

页面完全没有 WebGL 像素的次数：codex-low full N 4/10，codex-low minimal V 2/10，其余各格都是 0。

### 显著性（同一配置、同一前言内，每次运行一个样本，置换检验 20,000 次）

| 配置 / 前言 | N → V | N → S | N → VS | N → V+S+VS |
| --- | --- | --- | --- | --- |
| codex-low / minimal | 0.49 | **<0.001** | **<0.001** | **0.016** |
| codex-low / full | **0.031** | **0.031** | **0.031** | **<0.001**（无 WebGL：4/10 对 0/30，Fisher p = 0.002） |
| haiku / minimal | 0.083 | 0.086 | **0.026** | **0.003** |
| opus / minimal | 0.27 | **0.026** | **0.026** | **0.015** |

合并三个配置的 minimal 运行：N 11.21 → V 12.21（p = 0.044）→ S+VS 12.93（V → S+VS p = 0.002）。
Claude 两个配置合并：N 10.63，V 12.29，S 12.81，VS 13.00；V → VS p = 0.026。
Claude 每格只有 4 次，单个条件的比较功效有限，合并比较更可靠。

### minimal 和 full 的对比（codex-low，每格 n=10）

| 条件 | full | minimal | p | context_loss | a11y_tree | reduced_motion |
| --- | --- | --- | --- | --- | --- | --- |
| N | 11.03 | 11.67 | 0.48 | 0.67 → 0.80 | 1 → 0.90 | 0.90 → 1 |
| V | 13.00 | 12.13 | 0.47 | 1 → 0.93 | 1 → 1 | 1 → 0.80 |
| S | 13.00 | 12.92 | 1 | 1 → 1 | 1 → 1 | 1 → 1 |
| VS | 13.00 | 12.98 | 1 | 1 → 1 | 1 → 1 | 1 → 1 |

N 条件逐项（1 = 通过）：

| 配置 / 前言 | single canvas | dom fallback | ssr | cleanup | scroll/resize | pixels | task effect | context loss | a11y | reduced motion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| codex-low / full | 0.70 | 1 | 1 | 0.96 | 0.60 | 0.60 | 0.60 | 0.67 | 1 | 0.90 |
| codex-low / minimal | 0.70 | **0.70** | 1 | 0.84 | 0.80 | 1 | 0.93 | 0.80 | 0.90 | 1 |
| haiku / minimal | **0.25** | 0.75 | 0.75 | 0.75 | 0.75 | 1 | 0.75 | 0.75 | 0.88 | **0.50** |
| opus / minimal | **0.50** | 0.75 | 1 | 0.80 | 1 | 1 | 1 | 0.84 | 0.75 | **0.50** |

full 前言下，N 的扣分集中在白屏带来的 pixels、scroll/resize、task effect；minimal 下，扣分分散在没有被要求的稳健性项上。
codex-low 在 minimal N 里 `reduced_motion` 全部通过：前言没有要求，但其中 5/10 次（任务 a、c 各 2 次，d 1 次）仍然主动处理了
`prefers-reduced-motion`，其余几次本来就没有持续动画。

**WebGL 探测的敏感性。** Claude 的任务 a 在 N 条件下 4/4、V 条件下 1/4 自己写了
`document.createElement("canvas").getContext("webgl2")` 来判断能否使用 WebGL。探测用的 context 没有释放，
StrictMode 下还会多建一个，于是 `single_canvas` 记 0，`cleanup` 记 0.6。haiku 有 1 次在渲染期间探测，SSR 也因此失败。
如果原谅这些多余的探测 context，haiku N 从 10.13 升到 10.83，opus N 从 11.14 升到 11.84，opus V 从 12.15 升到 12.50，
仍然明显低于 S/VS（13.00）。这些泄漏是真实存在的，但比「多个渲染 canvas」轻。

### 与第二轮的对比（codex-low，full 前言）

| 条件 | 第二轮（alpha.1，three 0.184，n=15） | 第三轮（alpha.2，three 0.186，n=10） | p |
| --- | --- | --- | --- |
| N | 11.26（白屏 5/15） | 11.03（白屏 4/10） | 0.97 |
| V | 12.67（白屏 1/15） | 13.00 | 0.74 |
| S | 12.94 | 13.00 | 1 |
| VS | 13.00 | 13.00 | 1 |

## skill 的使用（S / VS，共 56 次）

| 配置 / 前言 | n | 读了 skill | 用了 Viselora | verify-consumer 通过 | 调用 browser-check | 打印 PASS/FAIL | 装了 playwright-core | 首次调用前就装好 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| codex-low / minimal | 20 | 20 | 20 | 20 | 8 | 5 | 5 | 0 |
| codex-low / full | 20 | 20 | 20 | 20 | 4 | 2 | 2 | 0 |
| haiku / minimal | 8 | 8 | 6 | 6 | 3 | 3 | 5 | 2 |
| opus / minimal | 8 | 8 | 8 | 8 | 6 | 4 | 8 | 4 |
| 合计 | 56 | 56 | 54 | 54 | 21 | **14（25%）** | 20 | 6 |

- 只要调用了 browser-check，codex 每次第一次都失败在「Install a browser driver first」（12/12）。
  它更常用全局的 `ego-browser` 自己检查（34/40）。
- Claude 没有 `ego-browser`：opus 8/8 装了 `playwright-core`（其中 2 次装了但没有调用 browser-check），haiku 5/8。
- 没有装 skill 的 V 条件：21/28 次写成 `^0.2.0-alpha.2`，`verify-consumer` 只通过 7/28。S/VS 的 54 次 Viselora 运行全部精确 pin。

## 典型失败

1. **full 前言诱发的 StrictMode 白屏（codex-low full N，4/10）。** 与第二轮相同：手写 `THREE.WebGLRenderer`，绑在 JSX 的 `<canvas ref>` 上，
   cleanup 里调用 `renderer.forceContextLoss()`；StrictMode 再次挂载时拿到的是已经丢失的 context。
   minimal 前言下 0/10 调用 `forceContextLoss`，0/10 白屏。
2. **WebGL 不可用时整页空白（minimal N：codex 6/10，任务 b/d/e 各 2 次；Claude 任务 d 4/4）。** R3F `<Canvas>` 在创建 renderer 失败时抛出异常；
   外面没有 error boundary，整个 React 树被卸载，`bodyTextLength` 为 0。Viselora 的 `WebGLRuntime` 自带这个边界。
3. **每张卡片一个 `<Canvas>`（任务 d：codex minimal N 2/2，haiku 1/2）。** 4 个 canvas、4 个 WebGL context；
   scroll/resize 和 remount 的检查也一起失败。opus 在 N 条件下改用 drei `<View>`（4/4），保持了单一 canvas。
4. **WebGL 探测泄漏 context（Claude 任务 a：N 4/4，V 1/4）。** 见上面的敏感性分析。
5. **fallback 从读屏树里消失（opus a-N 2/2，codex-low a-N 2 次，haiku a-N 1 次）。** 模型 ready 后给 fallback 加
   `aria-hidden`，或者设为 `visibility: hidden`。
6. **reduced motion（Claude 任务 a：N 4/4，V 4/4）。** idle 旋转不看 `prefers-reduced-motion`。装了 skill 的 S/VS 用了 ModelTarget recipe，8/8 通过。
7. **uniforms 陷阱（codex-low minimal c-V 2/2）。** 把 `useMemo` 得到的 uniforms 对象作为 prop 传给 `<shaderMaterial>`，之后修改其中的 `.value`。
   纹理没有进入材质，组件却调用了 `setTargetReady(true)`，`hideWhenReady` 把标题隐藏，整页没有任何文字。装了 skill 的 c-S/c-VS 都没有犯这个错误。
8. **haiku 放弃 skill（d-S 2/2）。** 一次是因为 skill 要求让 dev server 一直开着，另一次认为任务不需要它。
   放弃 skill 的 d-S-r1 得 12 分（WebGL 不可用时白屏，`task_effect` 0.5）。

## 成本与用时

| 配置 | 次数 | 平均用时（分钟） | 每次成本 / token | 合计 |
| --- | --- | --- | --- | --- |
| codex-low | 80 | 3.5（N 2.6–3.0，S/VS 3.6–3.9） | 输入 0.24–0.96M（93% 命中缓存），输出 5–7k | 53.1M 输入，0.46M 输出，ChatGPT 订阅 |
| haiku | 16 | 3.8 | $1.12（list 价） | $17.97 |
| opus | 16 | 3.9 | $0.56（list 价） | $9.03 |

- 用了 skill 的 codex-low 输入 token 是 N 的 3–4 倍（读 SKILL.md 和 recipe）。
- 在这个任务上，haiku 的 list 成本是 opus 的 2 倍：它的输出 token 更多，轮数也更多。
- Claude 订阅（Pro）：周额度从 14% 升到 23%，其中包括编排本轮评测的会话自己的用量。5 小时窗口用到 85% 一次，
  生成脚本自动暂停了 2.6 小时（04:20–07:01 JST）。
- 墙钟时间：生成 03:37–07:17 JST（codex 04:01–05:14）；评分 05:17–07:46；可重复性复评 07:48–08:37。

## 局限与未验证

- **Claude 只测了 minimal 前言和任务 a、d，每格 n=4。** 没有测 Claude 在 full 前言下的表现，
  所以不知道 full 前言是否同样会诱发 Claude 写出 `forceContextLoss` 白屏。Claude 的单格比较功效有限。
- **codex xhigh 在 minimal 前言下没有测。** 第二轮的天花板来自 full 前言；opus 在 minimal 下没有到天花板，
  所以 xhigh 在 minimal 下的表现是未知的。
- **环境不对等**：codex 加载了操作者的全局 AGENTS.md 和 skills（包括 `ego-browser`），claude 是隔离的。
  这会影响 codex 的验证行为，对分数的影响没有单独测量。
- minimal 前言没有提到的项也计分，所以这个分数衡量的是「默认是否稳健」，而不是「是否遵守指令」。
  其中 `single_canvas` 和 `cleanup` 对 WebGL 探测比较严格，见敏感性分析。
- 与第二轮相比，同时换了 three、Viselora 版本和 codex-cli 版本（0.160 → 0.163），无法分开归因；不过各条件的分数没有显著变化。
- 检查运行在 Vite dev server（StrictMode）和 SwiftShader 上；没有覆盖真实 GPU、移动设备、生产构建，也没有人工视觉评分。
  截图在各运行目录的 `.eval-shots/` 中。
- 校准中有 1 次、复评中有 1 次与动画相关的判定不稳定（`control-c` 的 `animated`、haiku-a-N-r2 的 `reduced_motion`）。
  动画类判定在高负载下可能不稳定。

## 复现

```bash
R="$TMPDIR/viselora-skill-ab-v3"
node evals/skill-ab-v2/scripts/run-eval.mjs --root "$R" --prompt-dir evals/skill-ab-v3/prompts --prompts minimal,full --three 0.186 --prepare-only
node evals/skill-ab-v2/scripts/run-controls.mjs --root "$R" --viselora-version 0.2.0-alpha.2
node evals/skill-ab-v2/scripts/run-eval.mjs --root "$R" --prompt-dir evals/skill-ab-v3/prompts --prompts minimal,full --three 0.186 \
  --configs codex-low --reps 1,2 --concurrency 4
node evals/skill-ab-v2/scripts/run-eval.mjs --root "$R" --prompt-dir evals/skill-ab-v3/prompts --prompts minimal --three 0.186 \
  --configs haiku,opus --tasks a,d --reps 1,2 --concurrency 2 --claude-concurrency 2 --claude-weekly-cap 0.6
node evals/skill-ab-v2/scripts/report.mjs --root "$R" --concurrency 3 --out evals/skill-ab-v3/results.json
node evals/skill-ab-v3/scripts/regrade-low.mjs --root "$R"
node evals/skill-ab-v2/scripts/report.mjs --root "$R" --out evals/skill-ab-v3/results.json
node evals/skill-ab-v3/scripts/analyze.mjs --root "$R"
```

需要已登录的 `codex` 和 `claude` CLI，以及 Google Chrome。脚本会自动设置 `npm_config_registry=https://registry.npmjs.org/`。
逐次运行的分数、各评分项和过程指标在 [`results.json`](results.json)，分析表格在 [`analysis.json`](analysis.json)。
