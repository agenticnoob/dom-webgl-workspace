# Hero Next WebGLMesh 正四面体替换设计

**日期：** 2026-07-14
**状态：** 已确认，待实现

## 目标

把 `apps/hero-next` 当前由 `/models/4.glb` 提供的中央四面体替换为公开
`WebGLMesh` API 绘制的正四面体。替换只改变主体的几何来源，不重做现有
Ghost Cursor 空间、单 scene 架构、相机、灯光、材质观感、慢速自转、鼠标视差或
响应式构图。

实现继续遵守 `apps/hero-next/AGENTS.md` 的 package-only 视觉边界：CSS 只做布局，
不修改 `packages/`，不使用 private import、第二 renderer 或 app-specific runtime
分支。

## 已确认方案

采用 `WebGLMesh` 内置 tetrahedron descriptor：

```tsx
<WebGLMesh
  id="hero.tetrahedron.mesh"
  geometry={{ kind: "tetrahedron", radius: 1 }}
  material={{
    kind: "standard",
    color: "#30343b",
    emissive: "#0d0a12",
    emissiveIntensity: 0.06,
    metalness: 0.9,
    roughness: 0.12,
  }}
  effects={[{ kind: "hero.tetrahedron.motion", baseScale: 1.12 }]}
/>
```

geometry、material 和 effects descriptor 都必须使用模块级稳定常量并通过
`WebGLMeshProps` 校验。最终字段名以当前公开类型为准；实现不得为匹配示例代码而
修改 package API。

不采用以下替代方案：

- custom geometry factory + Three.js `TetrahedronGeometry`：公开内置 descriptor
  已能表达相同几何，不需要增加直接 Three.js 依赖；
- 手写 `BufferGeometry` 顶点和索引：增加维护成本且没有可见收益；
- 保留隐藏的 GLB fallback：会继续携带无用下载、解码和资产维护成本。

## 行为保持

`hero.tetrahedron.motion` 继续负责：

- 48 秒一圈的缓慢多轴自转；
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
- 前景 Ghost Cursor depth `2`；
- ambient、directional key 和 directional rim 三盏 managed lights；
- Ghost Cursor overscan、颜色、brightness、pointer trail 和 shader 状态。

`WebGLMesh` 正四面体必须继续位于相机和两层 Ghost Cursor 之间，并保持现有黑银
镜面观感。替换不引入新的 postprocess、CSS 视觉层、纹理或粒子效果。

`radius` 的初始值使用 `1`，现有 `baseScale: 1.12` 和移动端 `0.6` 倍率继续负责
构图尺寸。真实浏览器验证若显示与现有主体尺寸存在明显差异，只允许在 app 内调整
`radius` 或现有 baseScale，不改变 package/runtime。

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

- 页面仍只声明一个 scene、一个 camera、两个 Ghost Cursor target 和三盏灯；
- 中央主体是一个 `WebGLMesh`，geometry 为 `tetrahedron`；
- mesh 使用 standard 黑银材质与 `hero.tetrahedron.motion` effect；
- effect source 为 `mesh`，原有 rotation、pointer tilt、idle return、responsive 和
  reduced-motion 行为保持；
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
确认：正四面体可见、四面等边且各面可辨；主体尺寸与深度关系合理；材质高光、慢速
自转、pointer tilt、Ghost Cursor 前后层次和 reduced-motion 没有回归；Network 与
console 中不再出现 GLB/Draco 请求或错误。

## 范围外

- 修改 `packages/`、public API、runtime 行为或 package version；
- custom geometry、手写 `BufferGeometry`、raw Three.js object ownership；
- 改造 Ghost Cursor、场景构图、灯光方案或交互语法；
- CSS 画面、第二 scene、第二 pass、第二 canvas 或第二 renderer；
- 部署、发布、push 或 PR。

## 验收标准

- hero 中央主体完全由公开 `WebGLMesh` tetrahedron descriptor 创建；
- 现有视觉层次、材质观感和交互行为保持；
- hero-next 不再携带或请求 GLB/Draco 资源；
- 所有 app-local 自动化命令通过，真实浏览器无视觉、资源或 console 回归；
- 改动严格限制在 `hero-next` 及其 active design truth，不修改 package/runtime。
