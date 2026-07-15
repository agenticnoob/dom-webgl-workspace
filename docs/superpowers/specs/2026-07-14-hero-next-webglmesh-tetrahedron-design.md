# Hero Next WebGLMesh 正四面体替换设计

**日期：** 2026-07-14
**状态：** 已实现；自动化验证通过，Alpha 透明实验未通过用户视觉 QA

## 目标

把 `apps/hero-next` 当前由 `/models/4.glb` 提供的中央四面体替换为公开
`WebGLMesh` API 绘制的正四面体。替换只改变主体的几何来源，不重做现有
Ghost Cursor 空间、单 scene 架构、相机、灯光、材质观感、呼吸浮动、鼠标视差或
响应式构图。

实现继续遵守 `apps/hero-next/AGENTS.md` 的 package-only 视觉边界：CSS 只做布局，
不修改 `packages/`，不使用 private import、第二 renderer 或 app-specific runtime
分支。

## 已确认方案

采用 `WebGLMesh` 内置 tetrahedron descriptor：

```tsx
<WebGLMesh
  id="hero.tetrahedron.mesh"
  geometry={{ kind: "tetrahedron", radius: 0.52 }}
  material={{
    kind: "standard",
    color: "#30343b",
    emissive: "#0a1012",
    emissiveIntensity: 0.06,
    opacity: 0.92,
    metalness: 0.9,
    roughness: 0.12,
  }}
  effects={[{ kind: "hero.tetrahedron.motion", baseScale: 1.12 }]}
/>
```

geometry、material 和 effects descriptor 都必须使用模块级稳定常量并通过
`WebGLMeshProps` 校验。最终字段名以当前公开类型为准；实现不得为匹配示例代码而
修改 package API。

`opacity: 0.92` 是当前已实现的普通 Alpha 透明实验。用户视觉 QA 观察到它保留了
强金属高光并呈白色/乳白效果，没有形成所需的透明或光穿透观感，因此该参数不能
被记录为已验收的透射方案。

不采用以下替代方案：

- custom geometry factory + Three.js `TetrahedronGeometry`：公开内置 descriptor
  已能表达相同几何，不需要增加直接 Three.js 依赖；
- 手写 `BufferGeometry` 顶点和索引：增加维护成本且没有可见收益；
- 保留隐藏的 GLB fallback：会继续携带无用下载、解码和资产维护成本。

## 行为保持

`hero.tetrahedron.motion` 继续负责：

- 不进行时间驱动的持续自转；
- 六秒周期、`±1.2%` 的轻微呼吸缩放；
- 八秒周期、`±0.018` 的 Y 轴浮动；
- 指针在中央邻域移动时的轻微倾斜；
- 指针静止约 120ms 后阻尼回正；
- reduced-motion 下的固定构图；
- 桌面和移动端的 scale / Y offset 响应式差异。

effect 的 source 从 `model/glb` 改为 `mesh`。材质改由 `WebGLMesh.material` 声明，
因此删除依赖 `ctx.object.model.meshes` 的 GLB mesh 遍历和材质写入逻辑。effect
只通过受控 `ctx.object` transform facade 驱动主体，不拥有 geometry、material、
renderer 或 disposal 生命周期。

## 场景与视觉保持

以下现有结构保持不变：

- 一个 `WebGLScrollRuntime`、一个 managed canvas/renderer；
- 一个显式 `hero.tetrahedron.scene`、一个 camera、一个 render pass；
- 背景 Ghost Cursor depth `5`；
- 中央正四面体；
- ambient fill 当前已注释；directional key 和 directional rim 两盏固定 managed
  lights 已启用；
- 由背景 `WebGLTarget` effect 管理的 `hero.pointer-light` 点光源；
- Ghost Cursor overscan、颜色、brightness、pointer trail 和 shader 状态。

`WebGLMesh` 正四面体必须继续位于背景 Ghost Cursor 前方，并保持现有黑银镜面
观感。前景 Ghost Cursor 已于 2026-07-15 移除。替换不引入新的 postprocess、
CSS 视觉层、纹理或粒子效果。

旧 GLB 的 accessor bounds 与节点命名表明其外接半径约为 `0.65`，且几何中心位于
`Y≈0.365`。初次替换以此为基准；2026-07-15 视觉调优再将半径缩小五分之一至
`0.52`。effect 的桌面基准 Y 保持 `0.365`，移动端在此基础上保留原有 `0.19`
偏移（最终 `0.555`）。现有 `baseScale: 1.12` 和移动端 `0.6` 倍率继续负责响应式
构图尺寸。

最初 `radius: 0.65` 的 `WebGLMesh` 替换已做真实浏览器验证。2026-07-15 的前景
Ghost Cursor 移除和 `radius: 0.52` 调优只做自动化测试、类型检查和生产构建；最终
视觉 QA 由用户接手。

## 2026-07-15 鼠标局部高光与后续视觉调优

现有 `hero.ghost.background` DOM target effect 通过公开
`ctx.object.lights?.point(...)` facade 管理一个稳定 key 为
`hero.pointer-light` 的点光源。它使用背景全屏 target 的 target-local pointer，
把横向位置映射到 `[-1.05, 1.05]`，把纵向位置围绕四面体基准
`Y=0.365` 映射到 `±0.72`，并固定在相机侧的 `Z=1.1`。

位置和强度都使用基于 frame delta 的阻尼。pointer 离开 viewport 后保持最后位置并
逐渐把强度衰减到 `0`；reduced-motion 下固定在 `[0, 0.365, 1.1]`，使用静态
低强度冷紫白光，不持续跟随 pointer。每帧用相同 key 更新既有 runtime-owned
PointLight，effect dispose 时通过 lights facade 移除；没有 lights facade 时安全
no-op。当前颜色为 `#a883ff`，active target intensity 为 `10`，`distance: 1.8`、
`decay: 3`，用更短照明距离和更高衰减近似更集中的局部高光。它仍是全向
PointLight，不具备朝向或 target，不能宣称为定向聚光。

该灯光在 runtime 中仍是 scene-scoped，并不具备通用 per-target light isolation。
当前场景只有 standard 材质四面体响应场景灯光，Ghost Cursor 背景使用不响应场景
灯光的自定义 shader，因此当前构图中形成视觉隔离。后续用户调优把材质更新为
emissive intensity `0.06`、opacity `0.92`、metalness `0.9`、roughness `0.12`；
其中 opacity 只启用 Alpha 混合，不是物理透射或折射。用户视觉 QA 认为高
metalness、低 roughness 和强光下的结果呈白色/乳白金属感，未接受为光穿透效果。
camera position 更新为
`[0, 0, 3.2]`；directional key 使用 position `[1.2, 1.2, 2]`、intensity
`4.8`，directional rim 使用 `[1.8, -1.4, 2]`、intensity `2.2`，ambient fill
继续禁用。四面体移除持续自转，normal base rotation 为
`[-0.6, 0.82, 0.08]`，叠加六秒呼吸、八秒浮动和现有 pointer tilt；
reduced-motion 静态角度为 `[-0.6, 0.85, 0.08]`。这些调优不修改 `packages/`，
只做自动化验证；用户已完成本轮视觉 QA，并明确暴露上述材质能力缺口。

当前 public `WebGLMesh.material` 只提供 basic/standard 材质及 color、opacity、
emissive、metalness、roughness 等标量，不提供 physical transmission、thickness
或 IOR。真正的折射/实体透光需要先设计通用 package capability；在用户单独授权
package 工作前，`hero-next` 不使用 CSS、raw Three.js 或 private import 绕过该边界。

## 资源清理

删除 `hero-next` 不再使用的模型和 Draco decoder：

- `apps/hero-next/public/models/4.glb`；
- `apps/hero-next/public/draco/gltf/draco_decoder.js`；
- `apps/hero-next/public/draco/gltf/draco_decoder.wasm`；
- `apps/hero-next/public/draco/gltf/draco_wasm_wrapper.js`。

同时删除 `HeroExperience` 中的 `WebGLModel`、`WebGLModelProps`、loader 和 prepare
声明。只清理 `apps/hero-next` 自己的资产，不修改 `apps/example` 的 GLB 或 Draco
资源。

## 文件修改范围

- `apps/hero-next/src/HeroExperience.tsx`：用 `WebGLMesh` 替换 `WebGLModel`，增加
  稳定 geometry/material/effects descriptor，移除 loader/prepare。
- `apps/hero-next/src/heroEffect.ts`：effect source 改为 `mesh`，删除 GLB-only
  material helper，保留 motion state 与 transform 行为。
- `apps/hero-next/test/HeroExperience.test.tsx`：mock 和断言从 model/src 改为
  mesh/geometry/material。
- `apps/hero-next/test/heroEffect.test.ts`：删除 GLB material traversal 测试，验证
  mesh source 与原有 motion contract。
- `apps/hero-next/test/assetsAndStyle.test.ts`：验证 hero 不再携带 GLB/Draco 资产，
  保留 CSS layout-only 守卫。
- `apps/hero-next/AGENTS.md` 与当前 active design truth：把“GLB tetrahedron”更新为
  `WebGLMesh` 正四面体，不改 package 边界。

不修改 `apps/hero-next/next-env.d.ts` 的现有未提交改动。

## 测试与验证

自动化验证必须证明：

- 页面仍只声明一个 scene、一个 camera、一个背景 Ghost Cursor target；ambient
  fill 不注册，directional key/rim 按当前参数注册；
- 背景 effect 只注册一次，并以稳定 key 更新、衰减和 dispose pointer light；
- 中央主体是一个 `WebGLMesh`，geometry 为 `tetrahedron`；
- mesh 使用 standard 黑银材质与 `hero.tetrahedron.motion` effect；
- effect source 为 `mesh`，无持续自转，breathing、floating、pointer tilt、idle
  return、responsive 和 reduced-motion 行为符合当前真值；
- `apps/hero-next/public` 不再存在 `4.glb` 或 Draco decoder；
- CSS 仍满足 layout-only 约束。

验证顺序：

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

真实浏览器必须使用 package runtime 和 managed canvas，在桌面与移动 viewport
确认：正四面体可见、四面等边且各面可辨；主体尺寸与深度关系合理；材质高光、呼吸
浮动、pointer tilt、Ghost Cursor 前后层次和 reduced-motion 没有回归；Network 与
console 中不再出现 GLB/Draco 请求或错误。

## 范围外

- 修改 `packages/`、public API、runtime 行为或 package version；
- custom geometry、手写 `BufferGeometry`、raw Three.js object ownership；
- 改造 Ghost Cursor shader、增加阴影或其他 package 能力、改动交互语法；
- CSS 画面、第二 scene、第二 pass、第二 canvas 或第二 renderer；
- 部署、发布、push 或 PR。

## 验收标准

- hero 中央主体完全由公开 `WebGLMesh` tetrahedron descriptor 创建；
- 现有视觉层次、材质观感和交互行为保持；
- hero-next 不再携带或请求 GLB/Draco 资源；
- 所有 app-local 自动化命令通过，真实浏览器无视觉、资源或 console 回归；
- 改动严格限制在 `hero-next` 及其 active design truth，不修改 package/runtime。
