# 消费者标准使用文档

> 当前仓库处于 capability-stable、alpha release-validation 阶段。本文描述
> `@viselora/dom-webgl` 与 `@viselora/scroll-adapters` 的公开标准用法。

这份文档给下游应用消费者看，目标是先讲清“标准用法”，而不是展示全部 API。
更深的 contract/reference 再去看 `docs/agent/package-usage.md`。

安装公开 alpha：

```bash
npm install @viselora/dom-webgl@alpha @viselora/scroll-adapters@alpha
```

公开包名：

- Runtime 包：`@viselora/dom-webgl`
- 可选滚动适配包：`@viselora/scroll-adapters`

Agent 集成可从 `skills/viselora-dom-webgl/SKILL.md` 开始。这个通用 workflow
先从 brief、2–3 个叙事方向、4–8 个 story beats、本地资产与许可证记录开始，
再读取 `skills/viselora-dom-webgl/references/capability-status.md` 选择当前
版本可用的 public capability，最后进入实现与真实浏览器验证。项目只声明自己
选择的 capability；verifier 不再强制五个 recipe。

## 一句话心智模型

普通 DOM 仍然负责内容、布局、可访问性和 fallback；runtime 负责把声明过的
DOM/媒体/模型目标放进一个内部管理的 WebGL canvas。

消费者只声明“哪个 DOM 目标要进入 WebGL”和“用哪个 app 自己写的 effect”。
不要在消费者代码里创建或持有 raw Three.js renderer、scene、camera、mesh、
material、texture、loader、mixer、composer、render target、physics body 或
render loop。

这不是 R3F 替代品，也不是 R3F companion。需要自由搭 Three.js 场景、Drei
helper、Rapier 物理或 raw ref 控制时，直接用 R3F。这个 runtime 适合页面仍然
是 DOM-first、WebGL 只增强声明过的 DOM target 的场景。

## 先选哪条路

| 你要做什么 | 用什么 |
| --- | --- |
| 普通 DOM/text/image/video/image-sequence/跟随 DOM 的 GLB 效果 | `WebGLRuntime` + `WebGLTarget` |
| 自定义视觉效果 | `defineWebGLEffect(...)` + runtime `effects` |
| 滚动进度驱动 effect | `WebGLScrollRuntime` + `ScrollEffectSection` |
| 真正的 3D 场景，有独立 scene/camera/pass | `WebGLScene` + `WebGLCamera` |
| 有灯光的地板、墙、盒子、背景板 | `WebGLStagePlane` / `WebGLStageBox` |
| scene-native GLB 模型 | `WebGLModel` |
| scene-native 物体 hover/click/drag effect | `defineWebGLSceneObjectEffect(...)` |
| scene-native 物理 | `WebGLStagePlane` / `WebGLStageBox` / `WebGLModel` 上的 `physics` |

默认先用 `WebGLTarget`。只有产品确实需要 scene/camera/pass/model/stage/physics
时，再进入高级 API。

## 标准导入

普通 React 消费者通常只需要：

```tsx
import { defineWebGLEffect } from "@viselora/dom-webgl";
import {
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";
```

滚动 pin/scrub 驱动 WebGL effect 时，再用可选滚动包：

```tsx
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@viselora/scroll-adapters/react";
```

高级 3D scene 才需要：

```tsx
import {
  WebGLCamera,
  WebGLLight,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
} from "@viselora/dom-webgl/react";
```

不要导入内部路径：

```ts
import ... from "@viselora/dom-webgl/src";
import ... from "packages/dom-webgl-runtime/src";
import ... from "@viselora/dom-webgl/effects";
```

runtime 包不提供具体视觉效果，也没有 `effects` preset subpath。具体 effect
属于应用代码。

## 最小 React 用法

先定义 effect，再在 `WebGLRuntime` 上注册 effect definition，最后在
`WebGLTarget.webgl.effects` 上声明这个 target 要用哪个 effect。

```tsx
import { defineWebGLEffect } from "@viselora/dom-webgl";
import {
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

type FadeEffectParams = {
  kind: "app.fade";
  opacity?: number;
};

const fadeEffect = defineWebGLEffect<FadeEffectParams>({
  kind: "app.fade",
  update(ctx, _state, params) {
    ctx.object.opacity = params.opacity ?? 1;
  },
});

const runtimeEffects = [fadeEffect] as const;

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.title",
          source: { kind: "dom", type: "text" },
          effects: [{ kind: "app.fade", opacity: 0.82 }],
        }}
      >
        Hero title
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

规则：

- `runtimeEffects` 是可执行 effect 代码，引用要稳定。
- `webgl.effects` 是数据，只写 effect `kind` 和参数。
- effect definition 的 `kind` 必须和 target declaration 里的 `kind` 完全一致。
- 每个 `key` 在同一个 runtime 内必须稳定且唯一。
- `webgl` declaration 按“挂载时注册”理解；如果 `source`、`effects`、
  `scroll`、`pointer`、`lifecycle` 或 placement 要换，换 key 或 remount。
- target effects 只用数组形式：`effects: [{ kind: "app.effect", ...params }]`。

## Source 怎么选

`WebGLTarget` 是 DOM 进入 WebGL 的默认入口。

```tsx
<WebGLTarget
  webgl={{
    key: "card",
    source: { kind: "dom", type: "element" },
  }}
>
  <article>DOM-authored card content</article>
</WebGLTarget>
```

常用 source：

| Source | 用途 |
| --- | --- |
| `{ kind: "dom", type: "element" }` | 普通 DOM 元素转 WebGL surface |
| `{ kind: "dom", type: "text" }` | 文本/glyph 动效 |
| `{ kind: "media", type: "image", src }` | 图片纹理 |
| `{ kind: "media", type: "video", src, playback }` | 视频纹理 |
| `{ kind: "media", type: "image-sequence", frames, frameCount }` | 滚动或进度驱动序列帧 |
| `{ kind: "model", type: "glb", src }` | 跟随 DOM target 布局和生命周期的 GLB |

重点：`WebGLTarget` 里的 `model/glb` 是 DOM-backed model target，不是
`WebGLModel` 的旧写法。

## WebGLTarget model/glb 和 WebGLModel 怎么选

模型要跟着 DOM 卡片、hero 区域、普通布局响应，就用 `WebGLTarget model/glb`：

```tsx
<WebGLTarget
  webgl={{
    key: "product.card.model",
    source: {
      kind: "model",
      type: "glb",
      src: "/models/product.glb",
    },
    effects: [{ kind: "app.modelFloat" }],
  }}
>
  <div aria-label="Product model fallback" />
</WebGLTarget>
```

这条路有：

- DOM fallback
- DOM rect fitting
- target lifecycle / offscreen 策略
- `ctx.targetPointer`
- target-local effects

模型是 3D 场景里的独立物体，就用 `WebGLModel`：

```tsx
<WebGLScene
  id="showroom"
  projection="perspective-stage"
  render={{ camera: "showroom.camera" }}
>
  <WebGLCamera
    id="showroom.camera"
    type="perspective"
    mode="perspective-stage"
    default
  />
  <WebGLLight id="key.light" kind="directional" intensity={2} />
  <WebGLModel
    id="product.model"
    src="/models/product.glb"
    position={[0, 0, 0]}
    scale={1}
  />
</WebGLScene>
```

这条路没有 DOM fallback、DOM rect fitting、`ctx.targetPointer` 和 target-local
lifecycle。它是高级 scene-native 3D 对象。

## Lifecycle 和 fallback

`WebGLTarget` 默认等 WebGL 输出 ready 后才隐藏 fallback DOM。加载中或出错时，
fallback DOM 会继续可见。

```tsx
<WebGLTarget
  webgl={{
    key: "hero.image",
    source: { kind: "media", type: "image", src: "/hero.webp" },
    lifecycle: {
      hideWhenReady: true,
      hideMode: "self",
      offscreen: { strategy: "restore-dom" },
    },
  }}
>
  <img src="/hero.webp" alt="Hero fallback" />
</WebGLTarget>
```

选择建议：

- `hideMode: "self"`：混合 DOM/WebGL 容器，优先用这个。
- `hideMode: "subtree"`：整个 subtree 都由 WebGL 替换时才用。
- `offscreen.strategy: "restore-dom"`：远离视口后可以释放 WebGL 资源并恢复 DOM。
- `offscreen.strategy: "park"`：更在意资源保持 warm，不想频繁释放。

## 自定义 effect 怎么写

effect 只通过受控的 `ctx.object` 操作视觉结果。

```ts
const tiltEffect = defineWebGLEffect<{
  kind: "app.pointerTilt";
  strength?: number;
}>({
  kind: "app.pointerTilt",
  source: "dom/element",
  update(ctx, _state, params) {
    const strength = params.strength ?? 1;
    const x = ctx.targetPointer.normalized.x - 0.5;
    const y = ctx.targetPointer.normalized.y - 0.5;

    ctx.object.rotation.y = x * strength * 0.18;
    ctx.object.rotation.x = -y * strength * 0.18;
  },
});
```

常用能力：

- `ctx.object.position` / `rotation` / `scale`
- `ctx.object.visible` / `opacity`
- `ctx.object.material`
- `ctx.object.lights`
- `ctx.object.animation`：GLB clip 控制
- `ctx.object.text` / `texture` / `video` / `model`：source 支持时才存在
- `ctx.pointer`：runtime/canvas pointer
- `ctx.targetPointer`：当前 target-local pointer
- `ctx.progress.get(key)`：命名进度信号
- `ctx.runtime.postprocess.request(...)`：canvas/pass-scoped bloom、grain、blur

不要用 `ctx.runtime.postprocess` 假装做 target-local glow。模型局部发光优先用
material/emissive + runtime-owned lights。

## Pointer 和 Interaction

DOM-backed target 的 pointer data 在 target declaration 里打开：

```tsx
<WebGLTarget
  webgl={{
    key: "cta",
    source: { kind: "dom", type: "element" },
    pointer: { hover: true, press: true, click: true, drag: true },
    effects: [{ kind: "app.pointerTilt" }],
  }}
>
  Call to action
</WebGLTarget>
```

scene-native stage/model object 用 `interaction.pickable`：

```tsx
<WebGLStagePlane
  id="floor"
  role="floor"
  interaction={{
    pickable: {
      hitTest: "mesh",
      pointer: { hover: true, click: true },
    },
  }}
/>
```

scene-object effect 用 `defineWebGLSceneObjectEffect(...)`，拿到的是
`ctx.objectPointer`，不是 `ctx.targetPointer`。

## Pinned scroll 标准用法

普通 pinned section 用可选 React scroll adapter。不要用 scene gate 做普通 pinned
scroll。

```tsx
import { defineWebGLEffect } from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@viselora/scroll-adapters/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const revealEffect = defineWebGLEffect<{
  kind: "app.scrollReveal";
  progressKey: string;
}>({
  kind: "app.scrollReveal",
  update(ctx, _state, params) {
    const progress = ctx.progress.get(params.progressKey);
    ctx.object.opacity = progress;
    ctx.object.position.y = (1 - progress) * 80;
  },
});

const runtimeEffects = [revealEffect] as const;

export function StorySection() {
  return (
    <WebGLScrollRuntime effects={runtimeEffects} smooth={false}>
      <ScrollEffectSection
        progressKey="story.hero"
        ScrollTrigger={ScrollTrigger}
        pin
        scrub
        end="+=140%"
      >
        <WebGLTarget
          webgl={{
            key: "story.hero.title",
            source: { kind: "dom", type: "text" },
            effects: [
              {
                kind: "app.scrollReveal",
                progressKey: "story.hero",
              },
            ],
          }}
        >
          Scroll-driven title
        </WebGLTarget>
      </ScrollEffectSection>
    </WebGLScrollRuntime>
  );
}
```

effect 里读 `ctx.progress.get(progressKey)`。不要在 effect 里直接读 Lenis、
GSAP 或 ScrollTrigger instance。

## Managed scene 标准用法

只有需要真实 scene/camera/pass ownership 时才用 managed scene。

```tsx
<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene
    id="hero.stage"
    projection="perspective-stage"
    render={{
      camera: "hero.camera",
      postprocess: {
        bloom: { strength: 0.35, radius: 0.25, threshold: 0.4 },
      },
    }}
  >
    <WebGLCamera
      id="hero.camera"
      type="perspective"
      mode="perspective-stage"
      default
      position={[0, 80, 420]}
      target={[0, 0, 0]}
    />
    <WebGLStagePlane
      id="floor"
      role="floor"
      size={[800, 800]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={{ kind: "standard", color: "#101418", roughness: 0.72 }}
    />
    <WebGLLight id="ambient" kind="ambient" intensity={0.45} />
    <WebGLLight
      id="key"
      kind="directional"
      intensity={2}
      position={[120, 260, 180]}
    />
  </WebGLScene>
</WebGLRuntime>
```

`WebGLPassViewport` 只在 render pass 要被某个 DOM rect 裁剪/约束时使用：

```tsx
<WebGLPassViewport id="product.stage.viewport" as="section">
  <WebGLScene
    id="product.stage"
    projection="perspective-stage"
    render={{
      camera: "product.camera",
      viewport: { mode: "dom-rect" },
    }}
  >
    <WebGLCamera id="product.camera" type="perspective" default />
  </WebGLScene>
</WebGLPassViewport>
```

普通 `WebGLTarget` 不需要 `WebGLPassViewport`。

## Physics 标准用法

Physics 只属于 scene-native object。用在 `WebGLStagePlane`、`WebGLStageBox`、
`WebGLModel` 上。

```tsx
<WebGLStageBox
  id="floating.box"
  size={[40, 40, 40]}
  position={[0, 120, 0]}
  physics={{
    body: {
      type: "dynamic",
      mass: 1,
      damping: 0.1,
      gravityScale: 1,
    },
    collider: { kind: "box" },
    pointerDrag: true,
  }}
/>
```

这不是 Level 1 `WebGLTarget` physics。runtime 拥有 body state、integration、
collision response、transform writes 和 dispose。

## 非 React 用法

React 是推荐路径；非 React 消费者可以直接用 vanilla runtime。

```ts
import {
  createWebGLRuntime,
  defineWebGLEffect,
} from "@viselora/dom-webgl";

const effect = defineWebGLEffect({
  kind: "app.fade",
  update(ctx) {
    ctx.object.opacity = 0.8;
  },
});

const runtime = createWebGLRuntime({
  container,
  effects: [effect],
});

runtime.registerTarget(element, {
  key: "hero",
  source: { kind: "dom", type: "element" },
  effects: [{ kind: "app.fade" }],
});

runtime.sync();
```

应用卸载拥有 runtime 的 surface 时 dispose：

```ts
runtime.dispose();
```

## Debug

用 `onDebugStateChange` 或 `getDebugState()` 看 descriptor-only 状态。debug
state 可以报告 target 数量、resource status、scene id、render pass、model、
light、physics summary、pointer summary 和 performance warning。

debug state 不暴露 raw Three.js object、raw GLTF、raw mixer、render target 或
physics engine handle。

```tsx
<WebGLRuntime
  effects={runtimeEffects}
  onDebugStateChange={(state) => {
    console.log(state.targetCount, state.renderableCount);
  }}
>
  {children}
</WebGLRuntime>
```

## 常见错误

- 从 `src` 或 workspace 内部路径导入。
- 以为 package 自带具体 visual effects。
- 每次 render 都重新创建 `effects`、`scrollAdapter` 或 declaration object。
- 不换 key 就修改已挂载 target 的 `source` 或 `effects`。
- 用 `WebGLModel` 做本该跟随 DOM 布局的模型。
- 用 `WebGLTarget model/glb` 做本该属于 scene/camera/stage/physics 的模型。
- 在 DOM-fitted GLB 上写 `ctx.object.position` 或 `ctx.object.scale`，把模型移出视口。
- 在 effect 里直接读 Lenis/GSAP/ScrollTrigger，而不是 `ctx.progress.get(key)`。
- 用 canvas/pass-scoped postprocess 做 target-local glow。
- 在 consumer effect 里创建 raw Three.js renderer、scene、camera、light、mesh、
  material、loader、mixer、composer 或 render loop。

## 验证

下游应用至少跑：

```bash
npm run typecheck
npm run build
```

本 workspace 修改 package 文档或 examples 后跑：

```bash
npm run typecheck
npm run test -- --run
npm run build
npm run check:imports
git diff --check
```

## 继续阅读

- `docs/agent/package-onboarding.md`：agent 从零集成入口。
- `docs/agent/package-usage.md`：完整 downstream package contract。
- `docs/agent/custom-effects.md`：effect authoring 细节。
- `docs/agent/scroll-adapters.md`：Lenis、GSAP、ScrollTrigger 集成。
- `docs/examples/effect-authoring.md`：React-only consumer tutorial。
- `docs/STATUS.md`：当前实现真值。
