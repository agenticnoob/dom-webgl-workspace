# Hero Next Visual Design

**状态：** hold-driven radial transition 已实现；focused automated tests 已通过，
production browser verification pending。

## 目标

`hero-next` 使用严格的中性双色体系。初始状态是浅色空间背景、深色四面体与
Ghost Cursor；在真实四面体 mesh 上持续按压约一秒后，一个从命中点扩张的精确圆形
区域把语义角色反转为深色背景、浅色前景。下一次有效长按执行相反方向。

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

`foreground` 已同步驱动 Ghost Cursor。四面体 effect 也请求同一语义 material color
和 emissive，但真实 scene-native `WebGLMesh` runtime 当前不提供
`ctx.object.material`，所以 production 会跳过这两项条件写入；动态材质同步仍是公共
能力缺口。key、rim、pointer light 是明确的照明例外，不通过语义色板 resolver。

## 长按圆形转场

1. 只有 `hitTest: "mesh"` 命中的 primary pointer press 能开始。
2. 命中帧的 runtime pointer 坐标成为本次 attempt 的归一化圆心。
3. `coverage` 以 `1 / 1000 ms` 前进；四面体产生小幅 deterministic shake。effect
   请求立即切到 target foreground，但真实 runtime 的 mesh material facade 断链使该
   写入尚未生效。
4. 圆的完整半径由圆心到最远 viewport 角的像素距离、`1.02` overscan 和 `1.5px`
   edge feather 决定。
5. 只有圆覆盖最远角并达到 `coverage=1` 时才 commit；持续按住不会连续 toggle。
6. 提前松开立即以全程 `300ms` 的恒定速度收回。50% coverage 最多 150ms 收完。
7. 收回完成前再次真实命中四面体，会保留原圆心、target scheme 与当前半径并续接。
8. commit 后必须 release，下一次有效长按才会执行反向 scheme。

shader 在 viewport 像素空间计算圆形距离，因此宽屏与高屏都保持精确圆形，不使用
椭圆补偿、CSS mask 或宽范围 color crossfade。

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
- `heroEffect.ts`：拥有唯一 live state，读取真实 mesh press，发布信号并组合材质与
  motion。由于 public scene-object context 没有 layout，使用经确认的 SSR-safe
  `window.innerWidth/innerHeight` viewport source。
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

固定照明真值：key `#f2f2f2` / `4.8` / `[1.2,1.2,2]`，rim `#b8b8b8` /
`2.2` / `[1.8,-1.4,2]`，pointer `#f0f0f0` / active `10` / reduced `0.45` /
`distance 1.8` / `decay 3` / base position `[0,0.365,0.8]`。

## 当前验证真值

- **Implemented:** hold state machine、稳定信号注入、真实 mesh press、pixel-space radial
  shader、ambient/shake composition 和 release gate。semantic material/emissive adapter
  已编写，但真实 `WebGLMesh` runtime facade 尚未接通，不能列为 production 已实现。
- **Automated-verified:** focused hero app suite 为 11 files / 45 tests 通过；workspace
  typecheck、production build、public import boundary 和 `git diff --check` 全部通过。
- **Browser-verified:** production runtime 在 1200×835 下保持单 canvas、console
  0 errors / 0 warnings。实际指针验收确认了 outside-primary 与 mesh-secondary 不触发，
  25% / 50% / 约 90% 提前释放收回，retraction 中续接，约一秒 commit，持续按住的
  release gate，以及释放后第二次长按反向 toggle；radial mask 保持正圆。390×844
  仅确认了 production 初始帧、单 canvas 与 clean console；移动端完整交互和
  `prefers-reduced-motion` 浏览器验收仍待补齐。不得把自动化覆盖当成这两项浏览器证据。
- **Open runtime gap:** focused effect tests 注入了 mock material facade，因此只证明
  adapter 意图；真实 runtime 中四面体仍保留 declaration-owned 初始 material/emissive。

## 范围

- 不修改 `packages/` 或 `docs/archive/`；
- 不改变 key、rim、pointer-light 行为；
- 不用 CSS 绘制圆形、颜色、mask、shake 或 animation；
- 不移除 `WebGLScrollRuntime`、Lenis、GSAP 或 ScrollTrigger；
- 不把自动化结果描述为浏览器视觉验收。
