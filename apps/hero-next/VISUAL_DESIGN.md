# Hero Next Visual Design

**状态：** hold-driven radial transition、managed lit-material shader extension 与
四面体逐像素扩散已实现，并通过 focused automated tests 与 production Chromium
acceptance。背景、Ghost Cursor 与四面体共享同一 screen-space
圆形边界、`1.5px` feather，v1 不加入 edge noise。

## 目标

`hero-next` 使用严格的中性双色体系。初始状态是浅色空间背景、深色四面体与
Ghost Cursor；在真实四面体 mesh 上持续按压约一秒后，一个从命中点扩张的精确圆形
区域把背景、Ghost Cursor 与四面体表面的语义角色一起反转为深色背景、浅色前景。
下一次有效长按执行相反方向。

画面只由 WebGL 几何、shader、材质、灯光和 effect motion 产生。CSS 仅负责布局、
尺寸、stacking、overflow 和 pointer routing。

## 核心色板

| Token | 色值 | 语义 |
| --- | --- | --- |
| `light` | `#B8B8B8` | 浅色角色 |
| `dark` | `#5F5F5F` | 深色角色 |

这两个色值是唯一允许的非灯光作者输入色。

| Scheme | Background | Foreground |
| --- | --- | --- |
| `initial` | `light` | `dark` |
| `inverted` | `dark` | `light` |

`foreground` 同步驱动 Ghost Cursor 与四面体 fragment shader 的 committed/target
color 和 emissive。Hero 继续使用真实 runtime-owned `MeshStandardMaterial`；受控
`ctx.object.material.shader` 只扩展其编译草稿，不替换材质或接管生命周期。key、rim、
pointer light 是明确的照明例外，不通过语义色板 resolver。

## 长按圆形转场

1. 只有 `hitTest: "mesh"` 命中的 primary pointer press 能开始。
2. 命中帧的 runtime pointer 坐标成为本次 attempt 的归一化圆心。
3. `coverage` 以 `1 / 1000 ms` 前进；四面体产生小幅 deterministic shake，三个
   视觉层沿同一个 radial radius 逐像素混合 committed/target 语义色。
4. 圆的完整半径由圆心到最远 viewport 角的像素距离、`1.02` overscan 和 `1.5px`
   edge feather 决定。
5. 只有圆覆盖最远角并达到 `coverage=1` 时才 commit；持续按住不会连续 toggle。
6. 提前松开立即以全程 `300ms` 的恒定速度收回。50% coverage 最多 150ms 收完。
7. 收回完成前再次真实命中四面体，会保留原圆心、target scheme 与当前半径并续接。
8. commit 后必须 release，下一次有效长按才会执行反向 scheme。

shader 在 viewport 像素空间计算圆形距离，因此宽屏与高屏都保持精确圆形，不使用
椭圆补偿、CSS mask 或宽范围 color crossfade。背景、Ghost Cursor 与四面体使用同一
圆心、radius 和 `1.5px` feather；v1 没有 edge noise。

## 四面体空间扩散

四面体保持 `kind: "standard"`，通过 package 的 managed lit-material shader
extension 在 Three Standard fragment shader 内逐像素混合 committed/target color 与
emissive，随后继续走原有 PBR lighting。runtime 管理 program cache、viewport、DPR 与
cleanup；Hero 不接触 raw Three material/shader、renderer、scene、camera、WebGL
context、`needsUpdate` 或 disposal。提前松手沿同一圆反向收回，re-press resume、
far-corner commit、`awaiting-release` 和双向 toggle 均复用原状态机。

## 配置真值

```ts
const heroTransitionConfig = {
  signalKeys: {
    committedScheme: "hero.transition.hold.committed-scheme",
    targetScheme: "hero.transition.hold.target-scheme",
    coverage: "hero.transition.hold.coverage",
    originX: "hero.transition.hold.origin-x",
    originY: "hero.transition.hold.origin-y",
    phase: "hero.transition.hold.phase",
  },
  timing: { expandMs: 1000, retractMs: 300, maxFrameDeltaMs: 64 },
  radial: { overscan: 1.02, edgeFeatherPx: 1.5 },
  shake: {
    positionAmplitude: 0.008,
    rotationAmplitude: 0.018,
    frequenciesHz: [11, 13, 17],
  },
  colors: { light: "#B8B8B8", dark: "#5F5F5F" },
  geometry: { radius: 0.52 },
  motion: {
    baseScale: 1.12,
    mobileScaleFactor: 0.6,
    mobileBreakpoint: 700,
    desktopYOffset: 0.365,
    mobileYOffset: 0.555,
    baseRotation: [-0.6, 0.82, 0.08],
    reducedRotation: [-0.6, 0.85, 0.08],
    initialOpacity: 0.92,
    emissiveIntensity: 0.06,
  },
} as const;
```

## 模块与状态边界

- `heroTransitionConfig.ts`：静态色板、信号、时长、radial、shake 与 ambient 常量。
- `heroHoldTransition.ts`：唯一纯状态机、语义 resolver、radial geometry 和 shake。
- `heroTransitionSignals.ts`：六个 `[0,1]` progress-store 数值的 writer/reader 边界。
- `HeroExperience.tsx`：保留 `WebGLScrollRuntime` 与 smooth-scroll stack；内部
  `HeroScene` 通过 `useScrollEffectProgressStore()` 稳定注入 writer。
- `heroEffect.ts`：拥有唯一 live state，读取真实 mesh press，发布信号、更新 managed
  shader uniforms 并组合 motion。由于 public scene-object context 没有 layout，使用经确认的 SSR-safe
  `window.innerWidth/innerHeight` viewport source。
- `heroTetrahedronShader.ts`：稳定注册 Standard fragment extension，复用状态机的
  committed/target、origin、coverage、radius 与 `1.5px` feather。
- `heroGhostEffects.ts`：只读信号并解析 shader inputs，不拥有 gesture state。
- `heroGhostCursorProgram.ts`：只构造显式 uniforms 与像素空间 radial shader。

两个 effect 不互相引用；没有 React frame state、全局 theme store、DOM event bus、
第二套 transition state、第二个 runtime 或第二张 canvas。

## Motion 与 Reduced Motion

Idle 保留六秒 `±1.2%` breathing、八秒 `±0.018` Y float 和 damped pointer tilt。
active attempt 中 ambient 权重随 coverage 淡出；shake 只在非 reduced-motion 的
forward expansion 中存在，release、retraction 和 commit 立即为零。

`prefers-reduced-motion: reduce` 下仍保留约一秒长按、圆形扩张/收回、续接、commit、
release gate 与双向 toggle，但关闭 shake 和额外快速 transform。

## WebGL 渲染解释

色板约束作者输入色，不要求最终屏幕像素只有两个 RGB 值。PBR、灯光、法线、
`opacity: 0.92`、抗锯齿、色彩空间和 radial feather 会产生计算出的中间像素。
`opacity: 0.92` 仍是普通 alpha 实验，不是 physical transmission、thickness 或 IOR。
包现在提供显式 `kind: "physical"` 能力，但本次没有把 hero descriptor 改为 physical，
也没有替 hero 选择或验收折射参数。

固定照明真值：key `#f2f2f2` / `4.8` / `[1.2,1.2,2]`，rim `#b8b8b8` /
`2.2` / `[1.8,-1.4,2]`，pointer `#f0f0f0` / active `10` / reduced `0.45` /
`distance 1.8` / `decay 3` / base position `[0,0.365,0.8]`。

## 当前验证真值

- **Implemented:** hold state machine、稳定信号注入、真实 mesh press、共享 pixel-space
  radial geometry、ambient/shake composition、release gate，以及 Standard material 内
  逐像素 committed/target color 与 emissive 混合。
- **Automated-verified:** focused hero app suite 为 12 files / 53 tests 通过；package
  integration 使用真实 pipeline/default mesh factory/Three lit materials，external
  packed-tarball Chromium fixture 证明 managed shader 中间帧同时包含两端像素。
- **Browser-verified:** production Chromium 在 1200×835 下完成 initial、正向 mixed
  intermediate、committed target、反向 mixed intermediate、initial-return、提前松手
  收回、re-press resume 和 reduced-motion diffusion。背景采样为 `184 -> 95 -> 184`；
  正/反向 mesh ROI 均同时包含两端像素。提前松手的 origin-row radius-like 从
  `206.5px` 收到 `95.0px`，re-press 后为 `382.5px`，高于 fresh 110ms press 的
  `102.5px`。reduced-motion 连续帧保持颜色扩散且三处顶点位移均为 `0px`。所有状态
  单 canvas，console/page/WebGL shader errors 与 warnings 为 0。390×844 的旧证据仍只
  覆盖 initial frame；本任务未扩展为完整移动端交互验收。
- **Runtime evidence:** package `runtimePipeline.test.ts` 使用真实
  `createPipelineRuntime`、默认 managed mesh factory 与真实 Three material，证明 shader
  extension 落到 runtime-owned lit material；packed-tarball Chromium radial fixture
  记录 endpoint changed `55,261`、start-like `7,267`、target-like `47,994` 像素，
  errors/warnings 为 0，canvas 生命周期为 `1 -> 0 -> 1`。
  hero production 复测的背景采样为 `184 -> 95 -> 184`，代表性四面体面部采样在 inverted
  变亮后返回暗值，且全程单 canvas、console 0 errors / 0 warnings。

## 范围

- 不修改 `docs/archive/`；
- 不改变 key、rim、pointer-light 行为；
- 不用 CSS 绘制圆形、颜色、mask、shake 或 animation；
- 不移除 `WebGLScrollRuntime`、Lenis、GSAP 或 ScrollTrigger；
- 不把自动化结果描述为浏览器视觉验收。
- 不把 package managed shader 能力描述成 Hero 专用分支或 raw Three escape hatch。
