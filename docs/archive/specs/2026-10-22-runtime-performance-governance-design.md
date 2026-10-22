# Runtime 性能托管设计（草案）

**日期：** 2026-10-22

**状态：** 设计已确认（2026-10-22）。第 1 步（基准页）、第 2 步（`WebGLSection`、事件
过滤、React 19.2 下限）和第 3 步（预热：`compileAsync`、图片先解码、每帧最多上传 2 张、
`useSectionState().warmed`；几何缓冲区预上传未做）、第 4 步（自适应质量：像素预算、
降档/升档、`useRenderQuality()`）已完成。第 4 步与第 6.2 节的差异：升档改为"帧时间跟上
显示器刷新间隔"（60Hz 下固定的 14ms 阈值永远达不到）；降档后若 p90 改善不足 10% 则撤销
并冷却 10 秒（CPU 或上传瓶颈时不降分辨率）；p90 超过 44ms 时直接降到 `low`；默认 DPR
范围改为 0.5～2；第 14 节第 4 项经浏览器验证未复现（example 页面 79 帧和
切换标签后 78 帧中，Lenis 推进滚动均早于 WebGL 绘制），依赖 GSAP ticker 先于 R3F 注册
rAF，暂不修改。本文是设计输入，
不是当前运行真值；实现状态以 `docs/STATUS.md` 为准。仓库没有活动设计目录，实现后本文
保留在此作为记录。

## 1. 目标

照着 Viselora 的组件和约定写，一镜到底或开销较大的页面在**中端手机和集显笔记本上不低于
30fps**。agent 不需要自己写离屏启停、章节预热、分辨率降级这些代码。

已确认的决定：

- 默认自动启停，可以按区段关闭。
- 特效以可复制的 recipe 交付，代码归使用者所有，不发布组件包。
- 性能底线 30fps；参考设备为中端手机和集显笔记本。

### 边界

- runtime 管**什么时候画、画多少**：区段启停、预热、质量档位、开销统计。
- runtime 不管**画什么**：场景、材质、模型、动画仍然是原生 R3F/Three.js 代码。
  不恢复 0.1 的声明编译器、特效封装或资源缓存。
- 不新增 renderer、Canvas 或 requestAnimationFrame 循环；所有调度挂在现有 R3F
  帧循环和 `RuntimeFrame`（priority -100）上。
- 资源归属规则不变：共享 loader 资源不归区段释放。

## 2. 现状与依据

| 方面 | 0.2.0-alpha.2 现状 |
| --- | --- |
| 渲染器 | 一个 Canvas、一个 R3F 循环 |
| DOM 测量 | 每帧统一测量，先读后写 |
| 后台标签页、上下文丢失 | `frameloop` 切到 `never`，恢复 DOM fallback |
| 分辨率 | 默认 `dpr [1, 1.5]`，`antialias: false`，固定不变 |
| 离屏 | `offscreen` 只决定 DOM fallback；3D 照常绘制，`useFrame` 照常执行 |
| 章节进入 | shader 编译和纹理上传发生在第一次绘制时 |
| 开销可见性 | `RuntimeDebugState` 只有 ready/visible |

依据：

- 应用里约 15 处手写同一类代码：`if (!target.visible) return; mesh.visible = ...`
  （`apps/example/src/BasicVisuals.tsx`、hero-next 的 axioms/profile/projects/portal
  场景）。每个效果都在重复解决同一个问题。
- hero-next 使用 `dpr [1, 2]` 和 MSAA；本机 3072×1920 屏幕上等于全分辨率 2 倍绘制，
  没有任何降级。
- 0.1 时期的 profile（`docs/archive/reports/performance/profile-notes.md`）：
  图片序列窗口因纹理上传平均 38ms/帧；模型按 2.5 倍视口距离提前准备后，首次进入不再
  出现多秒长任务。这些能力随声明式 runtime 一起删除了，证据仍然有效。
- 三轮 A/B 评测只测正确性，没有帧时间、长帧、draw call 或内存指标。

## 3. 方案总览

| 编号 | 能力 | agent 需要做什么 |
| --- | --- | --- |
| A | 区段启停 `WebGLSection` | 把一章或一个效果包一层 |
| B | 预热 | 无，接近时自动进行 |
| C | 自适应质量 | 无；可选读取 `useRenderQuality()` 调整粒子数等 |
| D | 开销统计和预算警告（开发模式） | 无，看控制台或调试状态 |
| E | 一镜到底性能基准页 | 无，仓库内部用 |
| F | recipe 性能约定 | 照 recipe 写 |

## 4. A：区段启停

### 4.1 用法

```tsx
<WebGLRuntime scene={<Scene />}>...</WebGLRuntime>

function Scene() {
  return (
    <>
      <CameraRail />            {/* 摄像机、灯光、全局背景放在区段外，始终运行 */}
      <ambientLight />
      <WebGLSection target="chapter-2">          {/* 按 DOM 区块 */}
        <ParticleField />
      </WebGLSection>
      <WebGLSection progress={{ key: "story", from: 0.4, to: 0.6 }}>  {/* 按滚动进度 */}
        <ModelChapter />
      </WebGLSection>
    </>
  );
}
```

- `target` 引用一个已由 `WebGLTarget` 注册的 DOM 元素，适合贴在 HTML 块上的效果。
- `progress` 引用一个进度信号区间，适合摄像机沿路径穿过的一镜到底场景。
- 两者二选一，类型上用判别联合约束。不包区段的物体始终运行，这就是"可关闭"的方式；
  也可以写 `<WebGLSection always>` 显式标明。

### 4.2 三个阶段

| 阶段 | 条件（默认值） | 绘制 | 普通 `useFrame` | 资源 |
| --- | --- | --- | --- | --- |
| `active` | DOM 区块进入视口外扩 0.5 屏；或进度在区间内 | 绘制 | 执行 | 保留 |
| `warm` | 距离 1.5 屏以内；或进度距区间 0.15 以内 | 不绘制 | 执行 | 保留，进行预热 |
| `sleep` | 更远 | 不绘制 | 停止 | 组件 effect 已清理 |

- DOM 外扩 0.5 屏是因为 3D 物体常常超出它对应的 DOM 盒子，按盒子边缘裁剪会提前消失。
- 阶段切换带滞回（hysteresis），边界附近来回滚动不会反复切换。阶段只在跨越边界时
  变化，每次变化触发一次 React 更新，不会每帧更新。
- 默认值是起点，按基准页（E）结果调整。

### 4.3 实现方式

- **sleep**：子树包在 React 19.2 的 `<Activity mode="hidden">` 里。已核对 R3F 9.8.1：
  `hideInstance` 会把 Object3D 设为 `visible = false`（attach 的子对象会 detach），
  React 同时断开子树里的 effect；`useFrame` 依赖 layout effect 订阅，因此**普通
  `useFrame` 自动停止**，React state、ref、`useMemo` 保留。恢复时动画从原状态继续。
  这一步只用 React/R3F 公共行为，不碰 R3F 内部 store。
- **warm / active**：`Activity` 可见，区段外层 `<group>` 的 `visible` 控制是否绘制。
  three 渲染时跳过不可见对象的整棵子树。
- **首次接近才挂载**：区段在第一次进入 `warm` 之前不挂载子树，避免 React 在 hidden
  `Activity` 里低优先级预渲染时，页面一打开就加载所有章节的模型和纹理。可用
  `mount="eager"` 改为一开始就挂载（例如首屏章节）。
- **指针事件**：不可见物体仍可能被射线命中。runtime 拥有 Canvas，在 R3F `events.filter`
  里丢弃祖先不可见的命中；与使用者传入的 `canvas.events` 合并。需验证。
- **DOM fallback**：区段阶段与 `offscreen`、`hideWhenReady` 互相独立，语义不变。
  `target` 模式下目标可见时区段一定是 `active`，不会出现"HTML 已隐藏、3D 没画"。
  `progress` 模式可能配错，开发模式下检测"目标可见且已隐藏 fallback、所在区段不是
  `active`"并警告。

### 4.4 带来的约束

- **React 下限要提到 19.2**（`Activity` 在 19.2 稳定导出）。当前 peer 范围是
  `>=19.0.0 <19.4.0`，仓库安装的是 19.2.7。
- sleep 会执行组件的 effect 清理。在清理里 `dispose()` 自有纹理的组件，GPU 资源会被
  释放，唤醒时由 three 重新上传。这对手机内存是好事；重新上传发生在 `warm` 阶段，由
  预热（B）提前完成。共享的 `useLoader` 资源仍然不能在组件里释放（现有规则）。
- 灯光放在区段外。three 编译程序时按场景中可见的灯光生成 shader，灯光放在会休眠的
  区段里会导致唤醒后重新编译。

### 4.5 曾考虑的另一种做法

在区段里提供一个替换过 `internal.subscribe` 的 R3F store context，让普通 `useFrame`
在 warm 阶段也停止。技术上可行（`context` 是 R3F 的公开导出），但依赖 store 内部字段
和可调用 store 的形状，R3F 小版本升级就可能失效。未采用；warm 阶段只有 1~2 屏范围内
的区段执行 `useFrame`，CPU 开销有限。

## 5. B：预热

区段从 `sleep` 进入 `warm`，或在 `warm` 期间子树内容变化时：

1. `gl.compileAsync(sectionGroup, camera, scene)`。已核对 three 0.184：`compile`
   用 `scene.traverse` 遍历全部网格（包含不可见的），灯光取目标场景中可见的灯光；
   `compileAsync` 在支持 `KHR_parallel_shader_compile` 时不阻塞主线程。
2. 遍历子树材质上的纹理，对已加载、尚未上传的纹理调用 `gl.initTexture()`。每帧最多
   上传固定数量（初定 2 张），把上传摊到多帧，避免预热本身制造长帧。
3. 几何缓冲区的上传目前没有公开 API。如果基准页显示大 GLB 首次绘制仍有卡顿，再考虑
   在 warm 阶段把区段渲染一次到 1×1 render target；这一步先不做。

`useSectionState()` 返回 `{ phase, warmed }`。需要自己提前加载资源的效果（例如图片
序列）可以在 `warm` 时开始加载，在 `warmed` 之后再 `setTargetReady(true)`。

## 6. C：自适应质量

### 6.1 质量档位

| 档位 | 绘图缓冲区像素预算（初值） | 给 recipe 的含义 |
| --- | --- | --- |
| `high` | 4.0MP | 完整效果 |
| `medium` | 2.0MP | 粒子、采样数等减半 |
| `low` | 1.0MP | 关闭可选的高开销层 |

DPR 由预算反推：`min(设备 DPR, 使用者 canvas.dpr 上限, sqrt(预算 / CSS 像素面积))`。
同样的 DPR 在 5K 屏上的像素是笔记本的两倍多，按像素预算才能让大屏和手机都得到合适的
分辨率（见第 14 节）。

- 初始档位：粗指针加小屏（手机）为 `medium`，`Save-Data` 为 `low`，其余为 `high`。
  不查询 GPU 型号，不依赖网络。
- `useRenderQuality()` 返回 `{ tier, dpr, reducedMotion }`。`reducedMotion` 来自
  `prefers-reduced-motion`，只作为信号提供，不改变档位。

### 6.2 自动升降

- 在 `RuntimeFrame` 里统计帧时间，滑动窗口约 2 秒。
- **降档**：p90 帧时间持续 2 秒高于 22ms（约 45fps）。触发线高于 30fps 底线，留出余量。
- **升档**：p90 持续 5 秒低于 14ms；降档后最多回升 3 次，避免来回抖动。
- 忽略超过 250ms 的单帧间隔（切标签、断点调试），`frameloop="demand"` 下只统计连续
  渲染的帧。
- 降档调用 R3F 的 `setDpr`，同步更新 `performance.current`，让依赖它的 drei 组件
  仍然可用。改变 DPR 会重设绘图缓冲区，产生一次小卡顿，因此限制频率。
- 已是 `low` 仍低于 30fps 时，开发模式警告并附上开销统计（D）。
- 关闭：`quality={{ adaptive: false }}`，或固定 `quality={{ tier: "high" }}`。

MSAA 是创建上下文时的属性，不能在运行中切换，档位不控制 `antialias`。

## 7. D：开销统计与预算（开发模式）

- 在 `RuntimeFrame` 中读取上一帧的 `gl.info`：draw calls、三角形数、程序数、
  纹理数、几何体数。`RuntimeDebugState` 新增 `frame`（fps、p90、上述计数、当前档位）
  和 `sections`（每个区段的阶段）。
- 每个档位有默认预算（初值待基准页确定，例如 `medium`：100 draw calls、30 万三角形）。
- 开发模式警告，同一原因只报一次：
  - 区段进入 `active` 的那几帧里程序数增加，说明预热漏了；
  - `active` 期间纹理数增加，说明有纹理在绘制时才上传；
  - 已是最低档仍低于 30fps；
  - **ready 却没画出东西**：`setTargetReady(true)` 之后，在下一次渲染结束
    （`scene.onAfterRender`，three 0.184 中已确认会调用）时读取目标区域的少量像素，
    全部透明就警告。每个目标只检查一次。
- 警告只在 `process.env.NODE_ENV !== "production"` 时启用；帧时间统计和质量控制在
  生产环境也运行。

## 8. E：一镜到底基准页

先做基准页，用当前 0.2.0-alpha.2 测出基线，再逐项实现 A~D，每一步对比。

- 位置：`apps/example` 下的独立页面。
- 内容：6 个章节，每章单独开销都不小，同时运行时在集显上明显低于 30fps：
  1. 带物理材质（transmission）的 GLB 模型；
  2. 10 万点自定义 shader 粒子；
  3. DOM 文字纹理波浪；
  4. 现有 454 帧图片序列；
  5. 多张带纹理和视频的卡片；
  6. 全屏的高开销片元 shader。
- 测量脚本（Playwright）：匀速滚完全程，记录每帧间隔、超过 50ms 的长帧、每章进入时的
  程序编译数和 `gl.info`。
  - 集显笔记本：本机 Intel UHD 630，有头模式使用真实 GPU。已验证页面参数
    `gpu=low-power`（WebGL `powerPreference: "low-power"`）会选中 UHD 630，
    `high-performance` 选中 Radeon 5300M，结果里的 `renderer` 字段记录实际 GPU。
  - 手机代理：Chromium CPU 降速 4 倍（CDP `Emulation.setCPUThrottlingRate`）。这只是
    近似，最终以真机为准。
  - 真机：页面上带帧率、p95 显示，由你在手机上打开查看。
- 对比组：当前行为、开启区段、开启区段加自适应质量。
- 初定验收：
  - 集显笔记本原生分辨率滚完全程，p95 帧时间 ≤ 33.3ms；
  - 章节进入时程序编译数为 0；
  - 进入章节时没有超过 100ms 的帧；
  - CPU 降速 4 倍时，自适应稳定后（3 秒内）p95 ≤ 33.3ms。

### 8.1 基线结果（2026-10-22，未托管页面）

已实现为 `apps/example/bench.html` 和 `scripts/bench-one-take.mjs`，用法和完整数据见
`apps/example/docs/benchmark.md`。本机 MacBook Pro 16 英寸 2019，1440×900，
设备像素比 2，每组 60 秒、各跑一次：

| GPU | 画布 DPR | CPU | 全程 fps | p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Intel UHD 630（集显） | 2 | 1× | 5.3 | 373.4 |
| Intel UHD 630 | 2 | 4× | 5.1 | 328.3 |
| Intel UHD 630 | 1 | 1× | 19.4 | 83.0 |
| Radeon Pro 5300M（独显） | 2 | 1× | 29.6 | 42.8 |

对设计的影响：

1. **集显完全受 GPU 限制**：CPU 降速 4 倍几乎不影响结果，降 DPR 从 5.3 提到 19.4fps。
   自适应 DPR（C）是集显上最大的杠杆。
2. **只降 DPR 不够**：DPR 1 时最快的章节（全屏光线步进单独绘制）也只有 21.3fps。
   `low` 档 DPR 下限可能要到 0.75；全屏类 recipe 必须提供内部分辨率或步数档位，
   由 `useRenderQuality()` 驱动。
3. **零强度的全屏层全程付费**：光线步进在其他章节强度为 0 也照常绘制，这是区段启停（A）
   要消除的典型浪费。
4. **未托管页面不会在滚动中编译**：所有章节加载时就挂载、编译，程序新增数为 0。改为
   "首次接近才挂载"后，编译会移到滚动过程中，预热（B）是必需的，基准的"新程序"列会暴露漏网。
5. **集显上 Long Task 有 97~210 个**，主线程被阻塞的原因（每帧上传 1600×900 序列帧和
   2560×1440 视频、GPU 同步）还没有拆分定位，接入区段后再分章节对比。

## 9. F：recipe 性能约定

每个 recipe 是一个可复制的独立目录，必须：

- 自己包在 `WebGLSection` 里，或在文件头说明为什么要始终运行；
- 用 `useRenderQuality()` 调整可伸缩参数（数量、分段数、采样数），并处理 `reducedMotion`；
- 用 `useMemo`/`useLoader` 创建资源，只释放自己拥有的资源；
- 在文件头写明 `medium` 档下的预算（draw calls、三角形、纹理数）；
- 配演示页、`browser-check` 检查和基准页条目。

第一批候选从 `apps/example/src/recipes`（paper-reader、perspective-timeline、
model-story、project-room、spatial、pointer-preview）以及图片序列、文字特效中挑选，
种类待定。

## 10. 公共 API 变化

- `@viselora/dom-webgl/react` 新增：`WebGLSection`、`useSectionState()`、
  `useRenderQuality()`。
- `WebGLRuntime` 新增 `quality?: { adaptive?: boolean; tier?: "high" | "medium" | "low"; budgets?: ... }`。
- `RuntimeDebugState` 新增 `frame`、`sections` 字段。
- peer `react` 改为 `>=19.2.0 <19.4.0`，`react-dom` 同步。
- `WebGLTarget`、`useDOMTarget`、`setTargetReady` 的语义不变。
- 估计 runtime 源码增加 400~600 行（当前 1,168 行）。属于破坏性 peer 变更，版本号
  建议升到 `0.3.0-alpha.0`，发布需要单独授权。

## 11. 风险与待验证

- `Activity` hidden 子树的预渲染时机、Suspense 加载行为，以及 R3F detach 被 attach
  的材质后恢复是否完整，需要用 R3F test-renderer 和浏览器各验证一次。
- 不可见物体的射线命中过滤（`events.filter`）需验证，且不能覆盖使用者的事件配置。
- `compileAsync` 在灯光位于区段内时的行为；约定灯光放区段外，开发模式检测并警告。
- 120Hz 屏幕和 `frameloop="demand"` 下帧时间统计的准确性。
- `process.env.NODE_ENV` 在不同打包工具中的替换情况，需在 Vite 和 Next 下各确认一次。
- 本设计符合 `AGENTS.md`："不重新引入声明编译器""不新增 renderer 循环"。

## 12. 实施顺序

每一步单独提交，跑完整校验后再进行下一步。

1. 基准页和测量脚本，记录 0.2.0-alpha.2 基线。
2. `WebGLSection`（三阶段、首次接近才挂载、事件过滤）和单元测试；阶段判定写成纯函数，
   单独测试。
3. 预热。
4. 自适应质量和 `useRenderQuality()`。
5. 开销统计、预算警告、ready 无像素检测。
6. 迁移 `apps/example` 和 hero-next：去掉手写的 `target.visible` 判断，改用区段；更新
   ARCHITECTURE、guides、skill 和 STATUS。
7. 第一批 recipe。
8. 发布 `0.3.0-alpha.0`（需要授权）。

## 13. 已确认（2026-10-22）

1. React 下限提到 19.2。
2. 区段默认"首次接近才挂载"，`mount="eager"` 可改为提前挂载。
3. 降档触发线 45fps。
4. 真机：华为 P30（麒麟 980，Mali-G76，2019 年发布），作为中端老机型基准。
5. 第一批特效参考 Awwwards 获奖站点另行设计，见
   [第一批特效 recipe 设计](./2026-10-22-effect-recipes-design.md)。

## 14. 调研后的补充（2026-10-22 已确认）

来源与依据见特效设计第 4、7 节。

1. **质量档位按像素预算**：第 6.1 节已改。
2. **区段内的灯光**：区段隐藏会改变灯光数量，使所有受光材质重新编译。开发模式下发现区段
   子树里有灯光时警告，提示移到区段外或改用强度开关。
3. **测量分级**：目标多时，视口附近的目标每帧测量，远处的错峰低频测量，滚动期间用滚动
   增量修正缓存矩形。对外语义不变：`visible` 和 `rect` 对视口附近的目标始终是当帧结果。
4. **滚动同帧**：先在浏览器里验证 GSAP ticker 驱动的 Lenis 是否让 WebGL 比 DOM 慢一帧；
   确认后改为在 R3F 帧前回调里推进 Lenis。
5. **远处释放**：`WebGLSection` 增加 `retain="release"`，离开 warm 范围足够远后卸载子树；
   默认 `retain="keep"`，保持第 4 节的 Activity 行为。
