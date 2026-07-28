# Hero Next 暗室空间设计（已被替代）

> 状态：已被 `2026-07-13-hero-next-matte-studio-depth-design.md` 替代，不再作为当前实现依据。

## 目标

将 `apps/hero-next` 从明亮、近乎空白的展示面改为深灰磨砂的暗室空间。保留现有四面体作为唯一主体，通过完全由 WebGL 管理的背景面、透视网格、体积光和雾层建立空间深度，并加入中等强度鼠标视差。

## 已确认方向

- 视觉方向：C「暗室坐标系」。
- 实现方式：所有视觉层均属于同一个 WebGL 场景，不使用 CSS 视差层。
- 视差强度：中等。
- 页面内容：不增加文字、按钮、导航或其他可见内容。
- 最终视觉验收由用户完成。

## 视觉系统

页面以接近 `#111315` 的石墨黑为底色。场景中心略亮，四角自然压暗；整体只使用石墨黑、冷灰和少量暖灰轮廓光，不加入高饱和色。

空间由四类受控对象组成：

1. 最远处的背景平面使用 shader 生成深灰渐变、暗角和低对比磨砂噪声。
2. 四面体后下方放置倾斜的透明网格平面，网格只在画面下半部隐约出现。
3. 中景透明平面生成一道从右上指向左下的冷灰体积光。
4. 两个不同深度的透明雾面以极慢速度漂移，提供空气感但不遮挡主体轮廓。

现有四面体继续作为视觉焦点。材质调整为深石墨磨砂，降低尖锐镜面高光，保留冷暖双侧轮廓光和原有呼吸、漂浮动画。不增加粒子、闪烁或高频动态。

## 场景架构

所有对象通过 `@viselora/dom-webgl/react` 的公开组件声明：

- `WebGLScene`：继续拥有单一 `hero.tetrahedron.scene`。
- `WebGLCamera`：继续使用 perspective-stage，相机 controller 开启 runtime 管理的 pointer parallax。
- `WebGLStagePlane`：声明背景、网格、体积光和雾面。
- `WebGLModel`：继续加载 `/models/4.glb`。
- `WebGLLight`：继续提供环境光和冷暖方向光，按新材质微调强度。

背景平面与氛围平面使用 `defineWebGLSceneObjectEffect` 配置受控 material program。应用不直接创建 renderer、scene、camera 或裸 Three.js 对象，也不修改 runtime 公共 API。

对象放在不同 Z 深度，相机位移因此自然产生分层视差。鼠标到视口边缘时，相机最大偏移目标约为 X `0.16`、Y `0.10` 场景单位；使用 runtime damping 平滑追随并在指针离开后回中。

## 动态与降级

- 四面体保留现有呼吸、漂浮和缓慢旋转。
- 雾层只进行低速、低幅漂移。
- 网格、背景和体积光不做闪烁。
- `prefers-reduced-motion: reduce` 下关闭相机视差和雾层漂移，保留静态构图。
- 触屏设备不依赖 hover 或 pointer parallax，保持稳定的居中构图。
- WebGL 对象尚未就绪或加载失败时，页面仍显示纯深灰 CSS 底色，避免白屏。

## 响应式

桌面端展示完整暗室纵深。宽度不超过 700px 时：

- 沿用现有四面体缩放和垂直偏移策略。
- 缩小网格覆盖范围与体积光宽度。
- 保持主体位于安全视觉中心。
- 不启用依赖鼠标的视差行为。

## 文件边界

预计修改范围限定在 `apps/hero-next`：

- `src/HeroExperience.tsx`：声明相机 controller 与新增 stage planes。
- `src/heroEffect.ts`：调整四面体材质，并增加背景、网格、光束和雾面 effects。
- `app/globals.css`：改为深灰 fallback surface，保留轻量全屏 grain fallback。
- `test/`：覆盖新增声明、effect 行为、视觉 token 与降级约束。

不修改 runtime/package 行为，不在 runtime 源码中加入 hero-next 专用分支。

## 验收标准

- 首屏为深灰磨砂暗室，不再呈现明亮空白背景。
- 四面体始终是唯一主体，轮廓清晰，氛围层不遮挡它。
- 透视网格、体积光和雾层可感知但保持低对比。
- 桌面鼠标移动产生中等强度、阻尼平滑的分层视差，移出后自然回中。
- 减少动态偏好和移动端下保持稳定静态构图。
- hero-next 相关测试、类型检查与 production build 通过。
- 浏览器检查无控制台错误、明显溢出或首屏白闪。
