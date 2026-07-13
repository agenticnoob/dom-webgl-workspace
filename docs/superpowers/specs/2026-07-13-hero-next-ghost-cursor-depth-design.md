# Hero Next Ghost Cursor 空间层次设计

**日期：** 2026-07-13
**状态：** 已确认设计，等待用户复核文档

## 目标

把 `apps/hero-next` 的旧灰白摄影棚画面整体替换为暗色 Ghost Cursor
空间：全屏烟雾位于镜面金属四面体的前后两侧，指针驱动烟雾轨迹和主体的轻微
视差倾斜。页面继续保持纯视觉首屏，不增加文案、导航、CTA 或装饰性 DOM。

本设计遵守 `apps/hero-next/AGENTS.md` 的 package-only 视觉边界。CSS 只负责
文档 reset、尺寸、定位、层叠、overflow 和 pointer routing；所有可见颜色、烟雾、
材质、灯光和动态都由当前公开 Viselora package 能力产生。

## 替代关系

本设计替代以下旧视觉方向：

- `2026-07-13-nextjs-tetrahedron-hero-design.md` 中的灰白磨砂 hero 视觉；
- `2026-07-13-hero-next-matte-studio-depth-design.md` 的 CSS 摄影棚方案；
- `2026-07-13-hero-next-matte-studio-depth.md` 的 CSS 实现计划。

`2026-07-13-hero-next-package-only-visual-boundary-design.md` 继续有效，并作为本设计
的硬约束。

## 已确认视觉方向

- Example 的 Ghost Cursor 成为全屏背景语言，但不保留边框、`Boo!` 文案或
  source texture 依赖。
- 中央主体继续使用现有 `/models/4.glb`，本轮不新增程序化 geometry，也不修改
  package 公共 API。
- 四面体采用黑银镜面金属：高 metalness、低 roughness、深色基底和紫白轮廓
  高光。
- 四面体保持“悬浮展品”比例，约占 viewport 短边的 32%–38%，位置居中略偏上。
- 大部分烟雾位于主体后方；少量低强度烟雾从主体前方掠过，但不能持续遮挡主体
  轮廓。
- 四面体持续极慢自转；指针靠近中央且正在移动时叠加轻微视差倾斜，停止后柔和
  回正。

## 单 Scene 架构

页面只声明一个显式 `hero.tetrahedron.scene`：

- projection 使用 `perspective-stage`；
- scene 内包含一个 camera、背景 Ghost Cursor target、GLB model、前景 Ghost
  Cursor target 和 managed lights；
- scene 只注册一个 render pass；
- runtime、canvas 和 renderer 都只有一个；
- 保留 runtime 的默认 scene 为空。

前后关系不使用 CSS `z-index` 或多个 render pass，而使用公开
`placement: { mode: "screen-depth" }` 把两个全屏 target 放到相机空间的不同
深度。初始值为：

- 前景薄烟 depth：`2`；
- 四面体中心到 camera 的距离：约 `3.2`；
- 背景烟雾 depth：`5`。

必须保持 `foregroundDepth < modelDistance < backgroundDepth`。浏览器调优只能在
前景 `1.6–2.4`、背景 `4.4–6` 范围内调整，不能改成 pass-order 或私有
`renderOrder` 方案。

两个 Ghost Cursor target 都是覆盖 viewport 的空 DOM surface，并继承同一个
scene。它们使用 `source: { kind: "dom", type: "element" }`、稳定声明对象和
`lifecycle.hideWhenReady: true`。DOM 本身不产生可见画面。

## Ghost Cursor Shader

从 `apps/example/src/ghostCursorSurface.ts` 移植 FBM、blob、pointer trail 和 uniform
坐标转换逻辑到 `hero-next` 本地模块。不得从 `apps/example` 建立运行时 import，
也不得把 Example 的 app-specific effect 注册到 package。

背景与前景共享纯函数和 uniform contract，但使用两个明确的 material program：

### 背景程序

- 输出不透明的深黑紫底色，初始基色沿用 Ghost Cursor 的 `#07050c`；
- 保留完整 FBM 烟雾、当前 pointer blob 和最多 36 个 trail samples；
- 初始烟雾色使用 `#b497cf`，允许在真实浏览器中向更冷或更灰方向小幅调节；
- 不采样或显示 DOM 文案，不绘制边框；
- 负责清晰建立页面的暗色基底，不能依赖 CSS fallback color。

### 前景程序

- 输出透明底，只输出烟雾 alpha；
- 最多使用 12 个 trail samples，不复制完整背景计算量；
- 亮度和 opacity 为背景烟雾的 15%–20%；
- pointer 离开或静止后快速衰减，不形成常驻的第二团主烟雾；
- 不输出不透明像素到烟雾范围之外。

两个 effect 各自拥有 trail state，复用相同的 pointer smoothing 和 decay helper。
不建立跨 effect 的可变全局 store。

## 四面体材质与灯光

现有 model effect 继续通过 `defineWebGLSceneObjectEffect(...)` 和 managed mesh
material facade 修改 GLB 材质：

- color 初始为深黑银色；
- metalness 初始为 `0.9–0.96`；
- roughness 初始为 `0.06–0.12`；
- emissive 只用于防止暗面完全丢失，不能把主体变成自发光物体；
- opacity 保持 `1`。

灯光使用一个低强度 ambient、一个中性偏冷 directional key light 和一个紫色
directional rim light。当前 package 不提供 environment map 或 cast/receive shadow
声明，因此设计不依赖真实环境反射、实时阴影或 CSS contact shadow。最终镜面感以
GLB 各面的方向光高光和轮廓分离为验收依据。

## 运动与交互

### 四面体

- 基础自转周期初始为 48 秒一圈，围绕多个轴产生缓慢变化；
- effect state 保存上一帧 pointer 坐标、上次显著移动时间、当前 tilt 和目标 tilt；
- 只有 pointer 位于 viewport 中央邻域且帧间移动超过最小阈值时，才更新视差目标；
- 最大倾斜限制在约 4°–6°；
- pointer 连续约 120ms 没有显著移动后，目标 tilt 回到零；
- 当前 tilt 使用基于 `delta` 的阻尼逼近目标，不能依赖 CSS transition；
- pointer tilt 叠加在基础自转上，不能覆盖或重置基础 rotation phase。

### 烟雾

- 两个 surface 都使用各自 target-local pointer；因为 target 覆盖同一 viewport，
  轨迹坐标必须视觉对齐；
- 背景烟雾保留慢速 FBM 漂移；
- 前景烟雾只跟随近期 pointer trail，并使用更快的 idle decay；
- 不新增 postprocess、粒子系统或第二 renderer。

## 响应式与 Reduced Motion

- 桌面端四面体约占短边的 32%–38%；现有宽度 `700px` breakpoint 可以继续作为
  初始响应式边界。
- 移动端缩小四面体并保持居中略偏上；保留慢速自转，不运行 hover-style 持续
  parallax，只在触摸期间产生短烟迹。
- `prefers-reduced-motion: reduce` 下：四面体使用固定构图；背景 shader 固定时间
  并保留一层低强度静态烟雾；不累积 pointer trail；前景烟雾完全透明。
- 任何尺寸下不得产生横向滚动或让全屏 surface 离开 viewport。

## 文件边界

- `apps/hero-next/src/HeroExperience.tsx`：只声明 scene、camera、两个 surface
  targets、model 和 lights。
- `apps/hero-next/src/heroGhostCursorProgram.ts`：背景/前景 shader program 与
  uniform 编译。
- `apps/hero-next/src/heroGhostCursorState.ts`：pointer smoothing、trail、idle decay
  的纯状态函数。
- `apps/hero-next/src/heroGhostEffects.ts`：两个 surface effect 的 public capability
  wiring。
- `apps/hero-next/src/heroEffect.ts`：model material、自转、pointer proximity、
  velocity detection 和 damping。
- `apps/hero-next/app/globals.css`：仅保留 AGENTS allowlist 内的布局 CSS。
- `apps/hero-next/test/`：镜像以上职责验证声明、shader contract、状态算法、model
  motion、CSS 边界和 workspace shell。

每个模块只承担一个职责。Ghost Cursor 的 shader 数学、状态推进和 runtime wiring
必须分开，避免把移植后的 400+ 行 Example 文件原样复制成单个 hero 文件。

## 异常与资源生命周期

- effect 在 surface capability 尚未 ready 时安全 no-op；
- material layer 只创建一次，并在 effect dispose 时释放；
- GSAP tween、订阅或其他 disposable 必须注册到 `ctx.resources`，但优先使用
  `ctx.time` / `ctx.delta` 的纯帧状态，避免为阻尼新增计时器；
- GLB 加载失败时由 runtime 报告 resource error；不得用 CSS、raw Three.js 或
  私有 import 绘制替代主体；
- 声明对象和 runtime-level effects registry 保持引用稳定，避免 React 重建
  runtime。

## 性能边界

- 一个 runtime、一个 canvas、一个 scene、一个 camera、一个 render pass；
- 背景最多 36 个 trail samples，前景最多 12 个；
- 前景 shader 不运行完整背景合成；
- 不增加 bloom、blur、grain 或其他 canvas-scoped postprocess；
- 不创建第二套 pointer、scroll、GSAP ticker 或 renderer；
- 浏览器验证时必须检查桌面和移动 viewport 的帧稳定性，若性能不足，先降低前景
  samples 或 smoke opacity，不能通过降低主体清晰度掩盖问题。

## 测试与验证

自动化测试必须覆盖：

- 页面只声明一个显式 scene、一个 camera、一个 model 和两个 Ghost Cursor target；
- 两个 target 使用同一 scene，并满足有序的 `screen-depth` placement；
- 页面不出现 `Boo!`、标题、段落、导航、按钮或链接；
- 背景 program 输出不透明暗色基底并使用 36-sample 上限；
- 前景 program 保持透明、使用 12-sample 上限且不输出 full-screen base；
- pointer/trail 坐标归一化、idle decay 和 reduced-motion 分支；
- 四面体 48 秒基础自转、最大 tilt、120ms idle return 和阻尼行为；
- CSS 不包含颜色、background、gradient、pseudo-element、filter、opacity、blend、
  transform 或 animation 视觉声明；
- app 不导入 `three`、package `src/` 或 `apps/example` 模块。

实现后的命令验证顺序：

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

真实浏览器必须使用 package runtime、现有 GLB 和 Draco decoder，在至少
`1440x1000` 与 `390x844` 验证：

- 背景烟雾、四面体和前景薄烟形成明确三层关系；
- 四面体保持悬浮展品尺寸，镜面高光可读且不过曝；
- pointer trail 连续，模型 tilt 克制，停止后回正；
- 前景烟雾不会长期遮挡主体；
- reduced-motion、移动端、console 和横向 overflow 无异常。

## 范围外

- 程序化 tetrahedron geometry 或新的 package primitive；
- 修改 `packages/`、package version、exports 或 runtime 行为；
- raw Three.js、React Three Fiber、private import 或 app-specific runtime 分支；
- CSS 画面、第二 canvas、第二 renderer、多 scene 或多 pass；
- 文案、导航、CTA、品牌元素和后续页面章节；
- 部署、发布、push 或 PR。

## 验收标准

- 页面第一眼读作暗色交互烟雾空间，而不是旧灰白摄影棚；
- 一个 scene 内通过真实 screen depth 同时表现后景烟雾、中央镜面四面体和前景
  薄烟；
- Ghost Cursor 的 pointer trail 仍保留 Example 的连续、柔软、带 FBM 形变的特征；
- 四面体是唯一主体，尺寸克制、各面可辨，并具有慢速自转与短暂 pointer parallax；
- 所有可见输出来自 package public API 和 app-owned managed effects；
- 自动化验证和真实浏览器验收全部通过。
