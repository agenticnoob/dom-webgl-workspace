# Hero Next Visual Design

**状态：** 设计已确认，尚未实现。作为 `apps/hero-next` 当前颜色方向、几何转场和
后续视觉工作的约束。

## 目标

`hero-next` 使用严格的中性双色体系。首屏以浅色为空间背景、深色为四面体前景；
后续滚动通过四面体自身的旋转、靠近和全屏覆盖完成几何擦除转场，进入深色背景、
浅色前景的反转状态。

画面层次来自 WebGL 几何、光照、材质和运动，而不是增加设计色或 CSS 视觉处理。

## 核心色板

| Token | 色值 | 语义 |
| --- | --- | --- |
| `light` | `#B8B8B8` | 浅色角色 |
| `dark` | `#5F5F5F` | 深色角色 |

这两个色值是 `hero-next` 唯一允许的非灯光作者输入色。大小写不同但数值相同的
十六进制写法视为同一个颜色。

颜色不能直接绑定到某个永久对象，而要通过语义角色消费：

| Scheme | Background | Foreground |
| --- | --- | --- |
| `initial` | `light` | `dark` |
| `inverted` | `dark` | `light` |

`background` 控制空间基底；`foreground` 控制 Ghost Cursor 烟雾、四面体
material color、emissive 以及其他非灯光前景。

## 几何覆盖转场

颜色反转不是直接在可见画面上 crossfade。滚动进度驱动四面体完成一次可逆的
几何擦除：

1. 四面体从当前姿态平滑旋转，让其中一个三角面朝向相机。
2. 四面体沿 Z 轴靠近相机，同时响应式放大。
3. 朝向相机的深色面以 overscan 覆盖整个视口，材质 opacity 在覆盖前达到 `1`。
4. 只有当视口被完全遮挡时，底层 background/foreground scheme 才切换到
   `inverted`。覆盖用的四面体暂时保持 `dark`，避免整屏闪成浅色。
5. 四面体继续穿过相机并离开视口，露出新的深色背景与浅色 Ghost Cursor 前景。
6. 四面体确认不可见后，才把自身材质重置为 `light`，供后续章节再次使用。

反向滚动必须严格逆序执行：四面体重新覆盖视口，在遮挡状态下恢复初始颜色角色，
然后退回浅色背景上的深色首屏姿态。

平滑过渡由旋转、位置、缩放、opacity 和 easing 共同完成。背景 scheme 交换发生在
全屏遮挡窗口内，四面体材质交换发生在它离开视锥后；两者都不依靠可见的全屏
颜色渐变。

## 配置模型

颜色和转场使用一个 app-owned、静态且稳定的配置对象：

```ts
const heroTransitionConfig = {
  progressKey: "hero.transition.tetrahedron-cover",
  colors: {
    light: "#B8B8B8",
    dark: "#5F5F5F",
  },
  schemes: {
    initial: { background: "light", foreground: "dark" },
    inverted: { background: "dark", foreground: "light" },
  },
  phases: {
    orientEnd: 0.32,
    approachEnd: 0.68,
    coverEnd: 0.78,
    backgroundSwapPoint: 0.8,
    foregroundResetPoint: 0.94,
    exitEnd: 1,
  },
  motion: {
    coverOverscan: 1.08,
    coverOpacity: 1,
    easing: "smoothstep",
  },
} as const;
```

这些数值是实现起点。浏览器视觉 QA 可以调整 phase 边界、目标姿态、Z 位移、
覆盖缩放和 overscan，但不能改变语义角色、遮挡后换色顺序或双色边界。

## 模块边界

### Transition config

只声明 Token、scheme、progress key、阶段边界和 motion 参数。不依赖 React、shader、
DOM 或具体 effect。

### Transition resolver

纯函数 `resolveHeroTransition(progress, viewport, config)` 负责：

- 将 progress 限制到 `0..1`；
- 应用统一 easing；
- 根据视口比例计算保证覆盖的 scale 与 overscan；
- 计算 rotation、position、scale、opacity、visibility 和当前 scheme；
- 返回 background、foreground 与 transition occluder 的已解析颜色；
- 对同一 progress 产生确定且可逆的结果。

resolver 不读取 DOM、不持有全局可变状态，也不调用 renderer。

### Background effect

只读取 resolver 的 `background` 与 `foreground`。背景 shader 使用显式
`iBackgroundColor` 和 `iForegroundColor` uniform，不持有固定色值或转场阶段知识。

### Tetrahedron effect

只读取 resolver 的 transform、opacity、visibility 和 tetrahedron color。覆盖期间
tetrahedron color 固定为初始 `dark`，离开视锥后才重置为 inverted foreground。
effect 将 scroll transition 与现有呼吸、浮动、pointer tilt 组合，并通过 managed
material facade 更新 material color 与 emissive。它不解析颜色 Token，也不控制背景。

### Scroll section

后续页面章节通过 `WebGLScrollTimeline` 提供配置中的具名 progress signal。缺少该
signal 时 package 返回 `0`，hero 稳定保持初始 scheme，不需要额外 store。

### Lights

实际灯光声明不接入颜色 resolver，包括：

- `WebGLLight` 声明的受管灯光；
- effect 通过 managed lights facade 创建的 pointer light；
- 未来通过公开 package API 创建的其他真实场景灯光。

灯光颜色是照明输入，不计入视觉色板。此例外不适用于 material emissive。

## 数据流与设计原则

```text
WebGLScrollTimeline progress
            +
heroTransitionConfig
            |
            v
resolveHeroTransition() ----> background/foreground ----> background effect
            |
            +-------------> transform/opacity/occluder --> tetrahedron effect
```

- **高内聚：** 色彩角色、转场阶段和 motion 参数集中在配置与 resolver。
- **低耦合：** 背景和四面体不互相引用，只消费同一纯函数结果。
- **单一职责：** config 描述、resolver 计算、effect 渲染、scroll section 供给进度。
- **依赖倒置：** effect 依赖语义化结果，不依赖具体 hex、章节 DOM 或其他 effect。
- **开闭原则：** 后续新增反转章节或调节阶段，只扩展配置，不复制插值逻辑。

不引入全局 mutable theme store、事件总线或 React context 作为第二状态源。

## Reduced Motion

`prefers-reduced-motion` 下不执行大幅旋转、快速 Z 轴靠近或穿越相机。滚动仍必须能
进入 inverted scheme，因此使用短区间的低运动量 opacity 与颜色角色过渡作为降级，
并保持背景与前景同步。该过渡产生的中间色是两个 Token 的计算结果，不是第三个
作者输入色。

## WebGL 渲染解释

色板约束的是作者输入色，不要求最终屏幕像素只能出现两个 RGB 值。PBR 材质、
例外灯光、法线方向、透明度、抗锯齿和色彩空间转换会产生连续的明暗、反射、混合
与边缘过渡。这些计算结果不视为新增设计色。

`#5F5F5F` 和 `#B8B8B8` 代表语义材质输入，不代表每个可见面的最终取样色。

## 范围

本设计的实现范围限定在 `apps/hero-next` 及其 active documentation：

- 不修改 `packages/`；
- 不改变灯光颜色、强度、位置、距离或衰减；
- 不增加 CSS 视觉效果；
- 不增加全局可变主题状态；
- 不修改历史归档文档；
- 不把自动化验证描述为浏览器视觉验收。

## 测试与验收

- progress `0` 为浅背景、深前景；progress `1` 为深背景、浅前景。
- 阶段边界连续，旋转、靠近、缩放和 opacity 使用统一 easing。
- cover 阶段在目标视口比例下达到配置的 overscan，背景换色只发生在完整遮挡后。
- 四面体遮挡时保持深色，只有穿过相机并不可见后才重置为浅色。
- 正向与反向滚动使用同一 resolver，结果确定且可逆。
- 缺失、非有限或越界 progress 安全降级或 clamp。
- reduced-motion 不执行大幅相机方向运动，但能完成 scheme 反转。
- 背景、烟雾、四面体 material 与 emissive 使用统一语义结果。
- 灯光保持现有颜色和行为。
- `hero-next` 测试、类型检查、production build、导入边界检查和
  `git diff --check` 通过。
