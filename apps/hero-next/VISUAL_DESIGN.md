# Hero Next Visual Design

**状态：** hold-driven radial transition 与真实 mesh material facade 已实现；focused
automated tests 和 desktop production browser regression 已通过，移动端完整交互与
`prefers-reduced-motion` browser acceptance 仍待补齐。背景与 Ghost Cursor 当前按
像素空间圆形扩散，四面体仍在 attempt 开始时整材质硬切；四面体逐像素扩散尚未实现。

## 目标

`hero-next` 使用严格的中性双色体系。初始状态是浅色空间背景、深色四面体与
Ghost Cursor；在真实四面体 mesh 上持续按压约一秒后，一个从命中点扩张的精确圆形
区域把背景与 Ghost Cursor 的语义角色反转为深色背景、浅色前景。当前四面体在
attempt 开始时直接切到 target foreground。下一次有效长按执行相反方向。

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
和 emissive；真实 scene-native `WebGLMesh` runtime 现在注入受控
`ctx.object.material`，所以 production 会把这两项写入真实 runtime-owned standard
material。key、rim、pointer light 是明确的照明例外，不通过语义色板 resolver。

## 长按圆形转场

1. 只有 `hitTest: "mesh"` 命中的 primary pointer press 能开始。
2. 命中帧的 runtime pointer 坐标成为本次 attempt 的归一化圆心。
3. `coverage` 以 `1 / 1000 ms` 前进；四面体产生小幅 deterministic shake。effect
   通过真实 runtime mesh material facade 立即切到 target foreground。
4. 圆的完整半径由圆心到最远 viewport 角的像素距离、`1.02` overscan 和 `1.5px`
   edge feather 决定。
5. 只有圆覆盖最远角并达到 `coverage=1` 时才 commit；持续按住不会连续 toggle。
6. 提前松开立即以全程 `300ms` 的恒定速度收回。50% coverage 最多 150ms 收完。
7. 收回完成前再次真实命中四面体，会保留原圆心、target scheme 与当前半径并续接。
8. commit 后必须 release，下一次有效长按才会执行反向 scheme。

shader 在 viewport 像素空间计算圆形距离，因此宽屏与高屏都保持精确圆形，不使用
椭圆补偿、CSS mask 或宽范围 color crossfade。

## 待设计：四面体空间扩散

已确认的下一视觉方向是让四面体也沿同一个命中圆心与 radial radius 逐像素扩散，
而不是整材质切色。目标行为是在可见四面体表面使用 screen-space distance 混合
committed/target material color 与 emissive，保留现有标准或物理材质光照，并让提前
松手沿同一路径反向收回。羽化宽度与是否加入轻微噪声需要在新设计中确定。

这项行为当前没有实现。现有 managed mesh material facade 只有受控标量写入，没有
mesh material mask、program 或 layer host；下一轮必须先设计最小通用 package public
capability，不能用 CSS、raw Three.js、私有导入、第二 renderer 或重复 mesh 绕过。

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
包现在提供显式 `kind: "physical"` 能力，但本次没有把 hero descriptor 改为 physical，
也没有替 hero 选择或验收折射参数。

固定照明真值：key `#f2f2f2` / `4.8` / `[1.2,1.2,2]`，rim `#b8b8b8` /
`2.2` / `[1.8,-1.4,2]`，pointer `#f0f0f0` / active `10` / reduced `0.45` /
`distance 1.8` / `decay 3` / base position `[0,0.365,0.8]`。

## 当前验证真值

- **Implemented:** hold state machine、稳定信号注入、真实 mesh press、pixel-space radial
  shader、ambient/shake composition、release gate，以及真实 `WebGLMesh` runtime facade
  上的 phase-wide semantic material/emissive 同步。逐像素 radial mask 当前只作用于
  背景与 Ghost Cursor，四面体仍是整材质硬切。
- **Automated-verified:** focused hero app suite 为 11 files / 45 tests 通过；workspace
  typecheck、production build、public import boundary 和 `git diff --check` 全部通过。
- **Browser-verified:** production runtime 在 1200×835 下保持单 canvas、console
  0 errors / 0 warnings。实际指针验收确认了 outside-primary 与 mesh-secondary 不触发，
  25% / 50% / 约 90% 提前释放收回，retraction 中续接，约一秒 commit，持续按住的
  release gate，以及释放后第二次长按反向 toggle；radial mask 保持正圆。390×844
  仅确认了 production 初始帧、单 canvas 与 clean console；移动端完整交互和
  `prefers-reduced-motion` 浏览器验收仍待补齐。不得把自动化覆盖当成这两项浏览器证据。
- **Runtime evidence:** package `runtimePipeline.test.ts` 使用真实
  `createPipelineRuntime`、默认 managed mesh factory 与真实 Three material，证明 facade
  写入落到 runtime-owned material；packed-tarball Chromium physical fixture 在目标区域
  记录 `58,225` changed pixels，errors/warnings 为 0，canvas 生命周期为 `1 -> 0 -> 1`。
  hero production 复测的背景采样为 `184 -> 95 -> 184`，代表性四面体面部采样在 inverted
  变亮后返回暗值，且全程单 canvas、console 0 errors / 0 warnings。

## 范围

- 不修改 `docs/archive/`；
- 不改变 key、rim、pointer-light 行为；
- 不用 CSS 绘制圆形、颜色、mask、shake 或 animation；
- 不移除 `WebGLScrollRuntime`、Lenis、GSAP 或 ScrollTrigger；
- 不把自动化结果描述为浏览器视觉验收。
- 不把已批准的四面体空间扩散方向描述为已设计、已实现或已验证。
