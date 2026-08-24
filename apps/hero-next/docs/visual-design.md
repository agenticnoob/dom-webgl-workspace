# Hero Next Visual Design

**状态：** 章节 1 的完整可逆滚动纵向切片已实现。画面使用临时但可辨识的
`FIELD NOTES` 章节内容；这证明空间链路和 ownership，不代表四章内容或最终视觉验收。

## 当前链路

一个纵向滚动坐标驱动以下连续阶段：

1. 完整四面体 Hub，保留轻微 breathing、float 与 pointer tilt；
2. 目标面从第一帧起一边旋转、一边靠近固定相机；旋转结束时，目标面的法线、up
   方向与相机坐标系一致，面质心落在相机观察轴上；
3. 对准后不再旋转，四面体沿相机观察轴稳定推进。三角边界与 face-space 内容始终属于
   同一 mesh transform，不存在三角边界静止而内容独自放大的阶段；
4. 目标面投影达到真实 DOM 的主尺度后，在同一几何帧切到 screen-space 内容坐标；随后
   内容保持屏幕坐标不动，只有三角窗口继续沿相机坐标推进并像幕布一样越过视口四角；
5. 三角覆盖视口后，真实语义 DOM 在同一排版锚点接管；
6. 正常章节滚动；
7. 章节尾部以相反次序收回，最终进入约 `80svh` 的完整 Hub 区间。

向上滚动读取同一 entry/exit progress，并由纯函数 resolver 重建完全相反的阶段。
Lenis 只平滑实际滚动位置；没有脱离滚动条的单向时间线。Reduced Motion 保留阶段、
内容、主题和双向映射，只关闭 ambient、tilt 与 shake 等非必要运动。

## 合成与 ownership

- 页面只有一个 `WebGLScrollRuntime`、一个 runtime-owned canvas、一个四面体 mesh；
- `heroChapterScroll.ts` 是 entry/exit progress 到视觉阶段的唯一纯映射；
- `heroChapterGeometry.ts` 负责固定相机坐标、投影尺度与四面体 transform 的纯函数解析；
- `heroChapterLayout.ts` 是 atlas 与真实 DOM 的唯一响应式布局模型；
  `heroChapterLayoutReact.ts` 只在 viewport resize 时把模型发布为 DOM CSS variables，
  不订阅逐帧滚动；
- `heroEffect.ts` 只组合几何 frame、managed shader uniforms 与 Hub hold 状态；
- `heroTetrahedronShader.ts` 用 flat face normal 识别面，在受控 Standard material shader
  内完成 face UV、screen UV 和三角覆盖；
- `heroChapterAtlas.ts` 生成 runtime-owned canvas texture，章节 1 与真实 DOM 共用
  `heroChapterContent.ts` 的文案和 `heroChapterLayout.ts` 的 viewport、inset、字号、
  line-box、card geometry。Atlas backing pixels 可以按上限缩放，但逻辑排版坐标始终保留
  当前 viewport 尺寸；
- `HeroChapterNarrative.tsx` 是语义、阅读、选择、focus 和交互真值；WebGL 只是装饰投影；
- CSS 负责 DOM 排版、可访问主题 token、stacking 和 pointer routing，不使用
  `clip-path`、mask 或第二个三角形实现核心转场。

当前公开 API 足以稳定表达本纵向切片：app 只使用 public managed scene/mesh/effect/
shader/canvas-texture/scroll API，未引入 raw Three ownership、private import、第二 renderer
或 package 修改。Atlas sampler 由 managed shader facade 创建、替换、上传并在 shader
remove/runtime dispose 时释放。

## 可逆 phase 真值

Entry stops：`orientEnd=0.26`、`lockEnd=0.62`。

Exit stops：`contractEnd=0.38`、`retreatEnd=0.74`。

`heroChapterScroll.ts` 输出：

- `orientation`
- `approach`
- `screenLock`
- `triangleReveal`
- `domContentActive`
- `hubInteractive`

输出只依赖归一化 entry/exit progress。`orientation` 与 `approach` 从 entry 第一帧同步
增加；`orientation` 在 `orientEnd` 达到 1 后保持不变，`approach` 继续到 `lockEnd`。
退出时先收幕布，再沿同一相机轴回退，最后一段同时回退与解除朝向。mesh 始终保持固定
scale，透视尺寸变化只来自 scene-space position 靠近固定相机；幕布段沿 camera forward/up
计算位置，使三角底边与上方两条斜边在交接帧全部越过视口。

`screenLock` 不再承担中间的内容放大动画：它在真实 DOM 主尺度的 lock 几何帧完成坐标
接管，幕布阶段保持为 1。`heroChapterGeometry.ts` 从相机 FOV、viewport aspect 和目标面
投影解析 lock footprint 的 width/height fraction；shader 用同一组 fraction 缩放目标面
UV。因此 lock 帧不只是中心点相等，而是目标面上每个 fragment 的 face-space atlas UV
都与其 screen-space UV 数学同值。跨过离散 `screenLock` 边界时内容锚点不变，随后只有
三角幕布继续运动。

WebGL/DOM 交接也不使用 `+Npx` 校正：Canvas 与 CSS 消费同一个响应式布局对象；Canvas
文本基线由实际 font bounding metrics 放入同一个 CSS line-box。移动端旧的标题 optical
offset 和独立 card padding 公式已经删除。由于 Canvas 与 DOM 是不同栅格器，字形边缘的
抗锯齿仍可有轻微差异，但元素比例与布局锚点不再切换真值。
正向和反向不会保存“播放方向”，也不会启动独立 animation clock。完整 Hub 的 runway
为 `80svh`；entry 为桌面 `520svh`、移动 `460svh`，exit 为 `420svh`。

## 主题真值

语义色仍只有：

| Token | 色值 |
| --- | --- |
| `light` | `#B8B8B8` |
| `dark` | `#5F5F5F` |

完整 Hub 上真实 mesh 长按约一秒，从命中点扩张共享 radial boundary；覆盖最远角后才
commit。提前松开在 `300ms` 全程速度下收回，re-press 可续接，commit 后必须 release。
离开完整 Hub 时 gate 立即关闭，进行中的 attempt 收回；章节内没有主题入口。

`heroTheme.ts` 拥有唯一 committed scheme，通过版本化 key
`viselora.hero.theme.v1` 写入 local storage。React 只订阅离散 committed theme 与
DOM/WebGL ownership 切换，不保存逐帧滚动或 shader 状态。四面体、atlas 投影、背景和
真实 DOM 都读取同一 committed scheme。Hub 与过渡页背景使用 committed scheme；章节
统一对调其 background/foreground 角色，因此四面体 atlas、screen-space WebGL 投影与
真实 DOM 章节始终使用同一反相章节配色。`screenLock` 只交接 face/screen UV，不切换
色彩角色；三角覆盖视口后可直接交接同配色 DOM。WebGL 章节 palette 以 `0.92` 权重覆盖
PBR lighting，保留少量立体明暗，并在 screen lock 完成时提升到 `1.0` 以匹配 DOM token。

## 当前验证边界

- **Automated:** hero-next 17 个 focused test files / 92 tests 覆盖 phase resolver
  边界、同坐标双向映射、theme gate/persistence、hold state、lock projection/UV scale、
  atlas/DOM 共享响应式 composition、managed shader sampler 声明/生命周期、React 单
  runtime/mesh/timeline composition。
- **Browser:** production Chromium 实际验证 desktop `1280×720` 与 mobile `390×844`
  的单 canvas、正向/反向路径、screen lock、WebGL/DOM handoff、正常 DOM 滚动、退出
  收回、Hub-only theme gate、刷新持久化，以及 console/page/shader errors 为 0。
- **未声称:** 临时 atlas/DOM 内容不是最终视觉；没有复制到章节 2–4；未把自动化或
  浏览器结构证据描述为主观最终设计 acceptance；Canvas/DOM 字形抗锯齿一致性不作为
  像素级相等承诺。

## 维护边界

- 不增加第二 renderer、canvas、四面体或滚动真值；
- 不用 CSS clip/mask 替代 WebGL 三角转场；
- 不把逐帧进度放入 React state；
- 不把 app key、copy、asset 或布局规则放进 package；
- 完成/废弃的设计记录留在 `docs/archive/`，不作为当前运行真值。
