# 第二轮评分标准

第二轮沿用第一轮的评分器 [`../skill-ab/scripts/grade.mjs`](../skill-ab/scripts/grade.mjs)
和注入脚本 [`instrument.js`](../skill-ab/scripts/instrument.js)，在它们的基础上扩展。
10 个核心项的定义见 [第一轮 rubric](../skill-ab/rubric.md)，`total`（满分 10）的含义没有变；
第二轮新增 3 个稳健性项，`totalV2 = total + 3 个稳健性项`，满分 13。

## 新任务的核心项

### 任务 D：交互式 3D 卡片（`feature-card-1` … `feature-card-4`）

| 评分项 | 自动判定 |
| --- | --- |
| `single_canvas` | 首屏、滚动/反向滚动后、resize 后，各检查点都恰好 1 个 canvas 和 1 个存活的 WebGL context。 |
| `dom_fallback` | 正常模式下 4 张卡片都可见；WebGL 不可用时 4 张卡片都可见、有文字，页面不白屏。 |
| `scroll_resize` | 三个检查点：卡片 1 的底边放到视口底部上方 60px（相对首屏位置滚动约 300px）；滚到底再回到首屏位置；视口改为 820×1000 后把卡片 3 的顶边放到 60px。每个检查点上，完全在视口内的每张卡片都要“有物体跟随”：卡片矩形内 ≥ 300 个前景格（2px 格），前景密度 < 85%（排除整块背景），卡片外扩 10% 范围内前景的质心落在卡片内。 |
| `pixels` | 首屏检查点前景 ≥ 150 格。 |
| `task_effect` | 4 个子项各 0.25：(1) 首屏至少 2 张卡片有物体跟随，并且物体真的出现在屏幕上（截图里显示/隐藏 canvas 的差异 ≥ 卡片面积 1%，排除被不透明卡片挡住的情况）；(2) 鼠标从页面左上角直接跳到卡片 2 中心（不经过其他卡片）：卡片 2 区域变化 ≥ max(1%, 3×静止噪声)，同时其他完全可见卡片的变化 ≤ max(0.5%, 卡片 2 变化 × 25%)；(3) 鼠标移开 1.8 秒后卡片 2 回到静止画面（差异 ≤ 同一阈值）；(4) 键盘：按 Tab 能把焦点移进卡片 3，在焦点进入卡片 3 的那一次 Tab 前后，卡片 3 区域变化 ≥ 同一阈值。 |

### 任务 E：可反向的四章节叙事，最后交还给 DOM（`chapter-1` … `chapter-4`、`outro`）

| 评分项 | 自动判定 |
| --- | --- |
| `single_canvas` | 同任务 B。 |
| `dom_fallback` | 正常模式和 WebGL 不可用时，4 个章节和 outro 都可见。 |
| `scroll_resize` | 从 outro 回到章节 4、回到章节 2，以及在章节 3 做 resize 往返后，画面与下滚时同一位置的差异 ≤ max(1%, 相邻章节差异 × 20%)（同任务 B 的规则）。 |
| `pixels` | 任一章节前景 ≥ 150 格。 |
| `task_effect` | 4 个子项各 0.25：章节 1→2、2→3、3→4 的画面差异都 ≥ 5%；交还（hand-off）在两个位置检查：outro 顶边位于视口中线（章节 4 的结尾仍在屏幕上），以及 outro 居中。两个位置都要满足：outro 可见；视口内的标题和链接是 `elementFromPoint` 命中的最上层元素，即可以点击（居中时链接必须在视口内）；outro 可见部分里“真正出现在屏幕上的 WebGL 内容”≤ 3%。最后一项按格计算：显示/隐藏 canvas 时截图有差异，并且该格在 canvas 上不是背景色。 |

## 新增的 3 个稳健性项（所有任务）

每个任务都有一个“关注位置”（A 卡片、B/E 章节 2、C 页面顶部、D 卡片 2）和一组“被替换的 DOM”
（A `model-fallback`、B/E 章节 2、C `wave-text`、D 四张卡片）。

| 评分项 | 自动判定 |
| --- | --- |
| `context_loss` WebGL context 丢失与恢复 | 页面稳定后，对最大的 WebGL canvas 调用 `WEBGL_lose_context.loseContext()`。三个子项各 1/3：丢失期间被替换的 DOM 可见（祖先累计 opacity > 0.05，不是 display:none / visibility:hidden）；`restoreContext()` 3 秒后画面重新出现（前景 ≥ 150 格）；整个过程没有未捕获的异常（只计 `pageerror`，不计 console.error）。没有 WebGL canvas 时记 0。 |
| `a11y_tree` 读屏可访问性 | WebGL 版本显示后（正常模式），对每个任务的 `data-testid` 元素：元素仍在渲染树中（不是 display:none / visibility:hidden，尺寸非零），没有 `aria-hidden`，并且元素文字中 ≥ 80% 的词（长度 ≥ 4）出现在 Chrome 的 ARIA 快照（Playwright `ariaSnapshot()`）里。按元素取平均。用 opacity 隐藏视觉 fallback 可以通过；用 display:none、`aria-hidden` 或卸载 fallback 都会失败。 |
| `reduced_motion` | 浏览器上下文设置 `prefers-reduced-motion: reduce`，在关注位置静止（鼠标移出页面）后，相隔 1 秒的两帧中 ≤ 0.2% 的格发生变化，并且内容仍在（WebGL 前景 ≥ 150 格，或被替换的 DOM 可见）。B、E 本来就要求没有基于时间的动画，所以这一项主要区分 A（idle 旋转）、C（波浪）和 D（交互过渡）。 |

## 只记录、不计分

- `verify-consumer.mjs` 的完整结果，包括精确版本规则（`^`/`~` 会被它拒绝）。
- 是否使用 Viselora、`package.json` 里写的版本范围和实际安装的版本、three 版本、用到的 API（含 drei 的 `View`、`Html`、`ScrollControls` 等）、源码行数。
- S / VS 条件：skill 是否被读取（transcript 中出现 `skills/viselora-dom-webgl/SKILL.md`）、读了哪些 skill 文件、是否运行了 `verify-consumer.mjs` / `browser-check.mjs`。
- 用时、codex 输入/输出 token。

## 评分器的修正

- **逐帧清屏模拟**（`instrument.js`）：为了读取像素，评分器强制 `preserveDrawingBuffer: true`。
  只清除部分画布的页面（例如 drei `<View>` 的 scissor 视口）因此会留下上一帧的残影，而真实浏览器在每次
  呈现后会清空缓冲区。现在每个动画帧里第一次向默认 framebuffer 绘制前，评分器先整块清屏，等价于浏览器行为。
  页面自己申请了 `preserveDrawingBuffer` 时不做模拟；context 丢失期间也不做。
  这个修正对每帧整块清屏的页面没有影响（第一轮的 3 个对照仍是 10/10，见 README 的校准表）。
- **即时滚动**：页面 CSS 里的 `scroll-behavior: smooth` 会把评分器的 `scrollTo` 变成时长不定的动画，`instrument.js`
  现在强制 `scroll-behavior: auto`。它只影响程序触发的滚动，不影响滚轮和触摸。
- **悬停路径**：鼠标改为直接跳到目标卡片，避免经过同一行的相邻卡片时触发它们。
- **读屏文字**：比较 ARIA 快照时，元素文字按文本节点用空格拼接，不再用 `textContent`（否则相邻元素的词会粘在一起）。
- `context_loss` 依赖 `instrument.js` 新增的 `__evalLoseContext()` / `__evalRestoreContext()`。

## 校准

[`scripts/run-controls.mjs`](scripts/run-controls.mjs) 在第二轮的 base（three 0.184 + R3F 9 + drei 10）上
构建对照页面和故意出错的变体，用同一个评分器打分，检查失败项是否符合预期，包括：

- 第一轮对照 a/b/c 和 recipe a/b/c（核心项预期满分；不处理 reduced motion 的会在 `reduced_motion` 失败）；
- 第二轮对照：`control-d`、`control-e`（Viselora），`native-d`（不用 Viselora，drei `<View>` + error boundary），都预期 13/13；
- 出错变体：D 的物体停在第一帧的位置、D 没有键盘响应、D 完全没有交互、E 没有交还（场景停在 outro 上）、
  A 的 fallback 被 `aria-hidden`、A 的 fallback 用手写 opacity 隐藏（context 丢失时没人恢复）。
