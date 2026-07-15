# Runtime Render Quality Controls Design

**日期：** 2026-07-16
**状态：** 已实现并通过自动化与下游 consumer 验证；hero-next 视觉 QA 待用户确认

## 目标

为 managed runtime 增加受控、声明式、runtime-scoped 的渲染质量配置，使
`apps/hero-next` 可以为四面体轮廓开启 MSAA 并把最大 device pixel ratio 提高到
`2`，同时保持现有消费者的性能默认值不变。

## 根因与边界

当前 Three.js renderer 固定使用 `antialias: false`，canvas DPR 限制在 `1.5`。
这会让旋转后的程序化四面体斜边出现明显阶梯状 aliasing。
增加 tetrahedron `detail` 只会改变几何轮廓，不能解决像素覆盖问题。

runtime 继续拥有 renderer、canvas、WebGL context、resize 与 disposal。公共 API
不暴露 `WebGLRenderer`、context attributes、render target 或任意 raw Three.js
handle。hero-next 不创建第二个 renderer，也不通过 CSS 或自定义几何伪造抗锯齿。

## 公共 API

根入口新增类型：

```ts
export type WebGLRenderQualityDeclaration = {
  antialias?: boolean;
  maxDevicePixelRatio?: number;
};
```

`WebGLRuntimeOptions` 新增：

```ts
renderQuality?: WebGLRenderQualityDeclaration;
```

React `WebGLRuntimeProps` 暴露同名 prop；`WebGLScrollRuntimeProps` 通过现有
`Omit<WebGLRuntimeProps, "progressSignals">` 和 props spread 自动继承、转发。
声明必须保持引用稳定；变更声明引用会按现有 runtime-level config 规则重建
runtime，因为 MSAA 是 WebGL context 创建时属性，不能原地切换。

## 默认值与验证

- `antialias` 默认 `false`，保留当前 performance-first 行为。
- `maxDevicePixelRatio` 默认 `1.5`，保留当前 canvas 上限。
- `maxDevicePixelRatio` 必须是有限正数；无效值在创建 renderer 前抛出明确错误。
- 实际 DPR 为浏览器 DPR 与声明上限的较小值。
- renderer canvas 和 runtime layout snapshot 使用同一个 normalized 上限；
  DOM-backed texture 模块可以保留更严格的内部 safety cap。

## hero-next 消费

`HeroExperience.tsx` 使用模块级稳定声明：

```ts
const heroRenderQuality = {
  antialias: true,
  maxDevicePixelRatio: 2,
} satisfies WebGLRenderQualityDeclaration;
```

并传给 `<WebGLScrollRuntime renderQuality={heroRenderQuality} />`。不改变四面体
`detail`、材质、灯光、相机、motion、Ghost Cursor shader 或 CSS。

## 验证标准

- 单元测试证明默认值仍为 `false / 1.5`，opt-in 值为 `true / 2`。
- renderer 构造参数使用 opt-in `antialias`，resize 使用 opt-in DPR cap。
- layout snapshot 记录 renderer 的有效 DPR cap；DOM-backed texture 模块可以
  保留更严格的内部 safety cap。
- React runtime 转发并在质量声明引用变化时重建。
- public root types 和 React props 可由下游 TypeScript 消费。
- hero-next SSR contract 证明它显式声明 `true / 2`。
- 完整 repo test、typecheck、build、import boundary 与 consumer gates 通过。

浏览器视觉 QA 仍由用户负责；自动化只证明配置链路和 build truth，不把它表述成
像素级视觉验收。
