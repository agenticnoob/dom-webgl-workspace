# dom-webgl-workspace 项目资料索引

> 路径均相对项目根目录。AGENTS.md / CLAUDE.md 由 agent 原生加载，这里只列位置，不复述内容。

Viselora 是面向 React / Next.js 的 DOM 与单个 WebGL 场景协调运行时，基于 React Three Fiber 和 Three.js。
仓库使用 npm workspaces，包含运行时、可选滚动适配器、消费示例和可发布的 agent 技能。

## 入口与规则

- `README.md` — 产品定位、安装、最小示例与仓库地图入口。
- `AGENTS.md` — 仓库级 agent 规则位置。
- `CLAUDE.md` — Claude Code 规则入口位置。
- `apps/hero-next/AGENTS.md` — Hero Next 子项目 agent 规则位置。
- `apps/hero-next/CLAUDE.md` — Hero Next 的 Claude Code 规则入口位置。
- `docs/README.md` — 文档导航与各类文档的职责分工。
- `docs/STATUS.md` — 查询全仓当前实现、发布、验证结果与已知边界时阅读。

## 架构与设计

- `docs/ARCHITECTURE.md` — DOM、Viselora、R3F 与应用之间的职责、数据流和资源所有权。
- `apps/example/docs/design-system.md` — 示例站点的视觉语言、设计变量与组件呈现规范。
- `apps/hero-next/docs/visual-design.md` — Hero Next 四章叙事、过渡、文章阅读器和项目空间的设计与扩展说明。

## 模块 / 子包

- `packages/dom-webgl-runtime/README.md` — 核心包的公共入口、DOM 绑定、文本工具与包内开发命令。
- `packages/dom-webgl-scroll-adapters/README.md` — 滚动适配器包的入口、可选依赖与开发命令。
- `apps/example/README.md` — Vite / React 示例站点的页面用途、启动与构建方式。
- `apps/example/src/recipes/README.md` — 可复用视觉组件目录、输入契约、降级行为与集成入口。
- `apps/example/src/showcase/README.md` — 一镜到底展示页的组合方式与组件职责。
- `apps/hero-next/README.md` — Next.js App Router 消费应用的功能、运行方式与验证入口。
- `evals/README.md` — agent A/B 评估结论、方法、限制及各轮报告入口。

## 流程与运行手册

- `CONTRIBUTING.md` — 本地开发、测试、构建和贡献流程。
- `docs/guides/getting-started.md` — 首次接入、DOM 目标、Next.js 集成及旧版迁移指南。
- `docs/guides/effects.md` — 原生 R3F 视觉效果与 DOM 文本纹理的使用指南。
- `docs/guides/scroll.md` — 滚动进度、时间线以及 Lenis / GSAP / ScrollTrigger 的集成指南。
- `apps/example/docs/verification.md` — 示例应用的自动化、浏览器验证证据与验证边界。
- `apps/example/docs/benchmark.md` — 一镜到底基准场景、桌面及手机运行方法与性能结果。

## 技能（.agents/skills 等）

- `skills/viselora-dom-webgl/SKILL.md` — 面向消费者的 Viselora 页面构建、迁移与调试技能入口。
- `skills/viselora-dom-webgl/references/` — 公共 API、所有权、效果配方、资源、验证与排错的按需参考目录。
- `skills/viselora-dom-webgl/recipes/` — 技能随附的可复制视觉实现与 Hero 组件配方目录。
- `skills/viselora-dom-webgl/templates/` — 技能随附的叙事计划及可运行 React / Vite 模板目录。
- `.agents/skills/threejs-fundamentals/SKILL.md` — 场景、相机、渲染器、对象层级与坐标变换技能。
- `.agents/skills/threejs-animation/SKILL.md` — 关键帧、骨骼、形变与动画混合技能。
- `.agents/skills/threejs-geometry/SKILL.md` — 内置几何体、自定义顶点与实例化技能。
- `.agents/skills/threejs-interaction/SKILL.md` — 射线拾取、控制器与鼠标触摸交互技能。
- `.agents/skills/threejs-lighting/SKILL.md` — 光源、阴影与环境照明技能。
- `.agents/skills/threejs-loaders/SKILL.md` — 模型、纹理、HDR 与异步加载技能。
- `.agents/skills/threejs-materials/SKILL.md` — PBR、基础材质、材质属性与优化技能。
- `.agents/skills/threejs-postprocessing/SKILL.md` — 后处理管线、泛光、景深与屏幕效果技能。
- `.agents/skills/threejs-shaders/SKILL.md` — GLSL、自定义 ShaderMaterial 与 uniform 技能。
- `.agents/skills/threejs-textures/SKILL.md` — UV、纹理类型、环境贴图与纹理配置技能。

## 历史与归档

- `docs/archive/README.md` — 历史资料总入口与归档用途说明。
- `docs/archive/plans/` — 历史实施计划目录，按早期运行时、实施和维护分类，多数文件采用“日期-主题”命名。
- `docs/archive/specs/` — 已完成或被替代的设计方案，文件采用“日期-主题”命名。
- `docs/archive/reports/` — 历史评审、发布验证、性能分析与调查报告目录。
- `docs/archive/reference/` — 被替代的架构、教程、路线图与消费参考目录。
- `docs/archive/status/` — 旧版执行状态快照目录。
