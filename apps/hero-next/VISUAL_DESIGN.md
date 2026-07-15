# Hero Next Visual Design

**状态：** 已确认，作为 `apps/hero-next` 当前颜色方向与后续视觉工作的约束。

## 目标

`hero-next` 使用严格的中性双色体系，减少视觉噪声，并让空间、材质和动效通过
WebGL 的光照、明暗与透明度关系建立层次，而不是继续增加设计色。

## 核心色板

| Token | 色值 | 角色 |
| --- | --- | --- |
| `light` | `#B8B8B8` | 画布背景、浅色空间基底 |
| `dark` | `#5F5F5F` | 烟雾、四面体基础色、emissive 及其他非灯光深色 |

这两个色值是 `hero-next` 唯一允许的非灯光设计色。大小写不同但数值相同的
十六进制写法视为同一个颜色。

## 颜色边界

- 背景 shader 的不透明基底使用 `light`。
- Ghost Cursor 烟雾和相关非灯光 fallback 使用 `dark`。
- 四面体的 material color 与 emissive 都使用 `dark`。
- 新增非灯光视觉对象时，只能从 `light` 和 `dark` 中选择颜色。
- CSS 继续只负责布局，不持有视觉颜色。
- 图片、视频或模型资产如果未来加入，必须在设计评审中确认其可见颜色是否符合
  此边界，不能默认引入第三种设计色。

## 灯光例外

实际灯光声明不受双色限制，包括：

- `WebGLLight` 声明的 ambient、directional 或其他受管灯光；
- effect 通过 managed lights facade 创建的 pointer light；
- 未来通过公开 package API 声明的其他真实场景灯光。

灯光颜色是照明输入，不计入视觉色板。当前 key、rim 和 pointer light 的颜色与
强度保持不变。本例外不适用于材质 emissive；emissive 仍必须使用 `dark`。

## WebGL 渲染解释

色板约束的是作者输入色，不要求最终屏幕像素只能出现两个 RGB 值。PBR 材质、
光照、法线方向、透明度、抗锯齿和色彩空间转换会产生连续的明暗、反射、混合与
边缘过渡。这些由现有两个材质色和例外灯光计算出的结果不视为新增设计色。

`#5F5F5F` 因此代表四面体的材质基色，而不是每个可见面的最终取样色。

## 实现方向

- 在 `apps/hero-next/src/heroPalette.ts` 集中定义 `light` 和 `dark`，作为应用源码
  的单一颜色来源。
- React scene declarations、app-owned effects 和 shader uniform 从该 palette 取值。
- 将背景 shader 当前近似 `#B8B8B8` 的 `vec3(0.72)` 改为显式 uniform，使设计
  Token 与 shader 输入保持一致。
- 测试验证背景、烟雾、四面体 material 与 emissive 的映射，并保留灯光颜色例外。
- `apps/hero-next/AGENTS.md` 与 active docs 同步此双色边界；历史归档不回写。

## 范围

本次只修改 `apps/hero-next` 及其 active documentation：

- 不修改 `packages/`；
- 不改变灯光颜色、强度、位置、距离或衰减；
- 不改变四面体几何、材质标量、相机、运动或交互；
- 不增加 CSS 视觉效果；
- 不把视觉 QA 结果作为自动化验证结论。

## 验收标准

- 所有非灯光作者输入色只来自 `#B8B8B8` 和 `#5F5F5F`。
- 背景使用 `light`，烟雾和四面体 material/emissive 使用 `dark`。
- 灯光保持现有颜色和行为。
- palette、shader、React 声明、测试和 active docs 一致。
- `hero-next` 测试、类型检查、production build、导入边界检查和
  `git diff --check` 通过。
