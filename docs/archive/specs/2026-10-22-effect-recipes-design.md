# 第一批特效 recipe 设计（草案）

**日期：** 2026-10-22

**状态：** 草案，待确认。本文是设计输入，不是当前运行真值。性能约定见
[runtime 性能托管设计](./2026-10-22-runtime-performance-governance-design.md)。

## 1. 目标

为 agent 提供一批**好看、开箱即用、默认不超预算**的特效 recipe：可复制进项目、代码归
使用者所有，照着用就能在中端手机和集显笔记本上保持 30fps 以上。

选题依据是 Awwwards 近期获奖站点实际在用的效果，而不是凭感觉挑选。

## 2. 调研方法

- **Awwwards**：在 `WebGL`、`Three.js` 两个标签的前 6 页中筛出带奖项的站点，共 45 个，
  其中 44 个 Site of the Day、1 个 Site of the Month，时间为 2026 年 8 月至 10 月。逐个读取
  详情页的 Elements（站点自己标注的亮点效果）、标签和描述，其中 34 个有 Elements。
- **Codrops 技术复盘**：Shopify Spring '26 Edition、HAOQI.DESIGN（同为 Awwwards SOTD）、
  Real Folds Real Fire、Chasing the Moment、Sixty Frames for the Record。
- 效果分类由人工归类，同一站点在一个类别中只计一次。数字是约数，用来看相对频率。

## 3. 获奖站点里的高频效果

| 类别 | 站点数（/45） | 例子 |
| --- | ---: | --- |
| 滚动驱动的 3D 叙事（含一镜到底） | 19 | Emotion Agency、/zeroz、EDOLUS、Belgrade Arbor、Why Zero（SOTM）、Cerebrium、MEER MOHSIN |
| 场景或页面 WebGL 转场 | 13 | Emotion "Grid Shift Transition"、Jesper Landberg、Pensatori Irrazionali、MIU MIU |
| WebGL 开场加载与转入 | 13 | Emotion "WebGL Intro Transition"、Michael Gatt、Nick Ho、United Carriers |
| 鼠标响应（悬停变形、光标场、交互背景） | 12 | The state of the gallery "oil slick + particles bulge"、Maria Vasilyeva、PX PUSH |
| 3D 产品或物体展示 | 11 | The Watch、Nick Ho 360° 头盔、Vero New-York、Noho |
| WebGL 图片画廊或网格 | 9 | Sobha "3D WebGL Gallery"、HAOQI.DESIGN、Emotion "Projects Gallery" |
| 可探索的世界、地图、地球 | 6 | Overworld Audio、Why Zero、Cerebrium 力场地球 |
| 粒子或点云 | 4 | Lidar Drone Scanning、Emotion "Particles Mouse Interaction" |
| 玻璃折射 | 2 | HAOQI.DESIGN、The state of the gallery |

结论：

- 获奖站点很少只靠单个效果，常见组合是"开场转入 + 滚动叙事 + 场景转场 + 一两个鼠标交互"。
- 前四类覆盖了绝大多数站点，第一批 recipe 应围绕它们。
- GSAP 出现在 22 个站点，Nuxt 和 Next 各 7 个。DOM 承载内容、WebGL 承载氛围是主流架构，
  和 Viselora 的定位一致。

## 4. 复盘里可以直接采用的工程经验

| 经验 | 来源 | 落到哪里 |
| --- | --- | --- |
| 只挂载当前章节和相邻章节，其余卸载 | Shopify | 区段"首次接近才挂载"；补一个远处释放选项（见第 7 节） |
| 按设备分档；手机按内存压力主动降档；每档用不同密度的资源（1024/512/256） | Shopify | 质量档位；recipe 的分档资源 |
| 按**像素预算**而不是 DPR 限制绘图缓冲区（同样 DPR 下 5K 屏比笔记本多一倍以上像素） | Sixty Frames | 修改质量档位定义（见第 7 节） |
| 灯光用强度开关，不切换可见性：灯光数量是 shader 编译常量，变化会让所有材质重新编译 | Chasing the Moment、Sixty Frames | recipe 规则；区段内有灯光时开发模式警告 |
| 加载期就编译 shader，不要等到转场时 | Chasing the Moment | 预热 |
| 滚动与渲染放进同一个帧循环，否则 WebGL 比 DOM 慢一帧 | HAOQI.DESIGN | 需验证 Viselora 的 Lenis 驱动方式（见第 7 节） |
| 近处 DOM 目标每帧测量，远处每 12 帧错峰测量 | HAOQI.DESIGN | runtime 测量优化（见第 7 节） |
| 光线步进设硬性步数上限 | Shopify | 全屏类 recipe 的档位参数 |
| 共享模拟（流体场）只由活动区段推进 | Shopify | 光标场 recipe |
| 多 MB 的几何体和材质放进 ref，不放进 React state | Shopify | recipe 规则 |
| 多个动态纹理错峰刷新（24 块屏幕各按 24Hz 轮流重绘） | Sixty Frames | 视频、画布纹理类 recipe |
| 不在 WebGL 画布上叠 `mix-blend-mode` 的 DOM | Sixty Frames | recipe 规则；文档 |
| 手机上避免像素回读 | Real Folds Real Fire | recipe 规则 |
| 看 p95 而不是 p50，p95 才是体感 | Sixty Frames | 基准已按 p95 统计 |

本仓库基准页还发现一条：材质先以 `map={null}` 挂载、之后再赋纹理，three 不会重新编译，
贴图不生效。recipe 规则要求纹理就绪后再挂载材质，或显式设置 `material.needsUpdate`。

## 5. 第一批 recipe（5 个）

每个 recipe 都满足 runtime 设计第 9 节的约定：自带 `WebGLSection`；读取
`useRenderQuality()`；只释放自己拥有的资源；文件头写明 `medium` 档预算；配演示页、
`browser-check` 检查和基准条目。

### R1. 一镜到底章节轨道 + 场景转场（OneTakeRail）

- **对应类别**：滚动 3D 叙事、场景转场。参考 Emotion Agency、/zeroz、Chasing the Moment、
  Shopify。
- **效果**：滚动带着摄像机沿样条路径穿过多个章节；章节之间用一次全屏转场，可选噪声溶解、
  网格位移、像素格揭示。
- **实现**：`CatmullRomCurve3` 路径加按章节的视线目标；每章是一个 `progress` 模式的区段；
  转场只在两章交界的进度区间启用，把相邻两章分别渲染到 render target 后在合成 pass 里过渡，
  其余时间不额外绘制。
- **Viselora 能力**：区段启停、预热（下一章在转场前编译完）、进度信号。
- **档位**：转场 render target 分辨率 1 / 0.75 / 0.5；过渡噪声倍频数 4 / 3 / 2。
- **medium 预算**：转场期间额外 2 个全屏 pass；平时 0 个。
- **降级**：减少动态效果时转场改为淡入淡出；无 WebGL 时是普通的长页面。

### R2. WebGL 开场转入（IntroReveal）

- **对应类别**：开场加载与转入。参考 Emotion "WebGL Intro Transition"、HAOQI 的像素格语言。
- **效果**：首屏先显示 DOM 内容；资源就绪后，WebGL 用像素格或噪声溶解，从 DOM 画面过渡到
  3D 画面。
- **实现**：首屏 DOM 用 `createDOMTextTexture` 和图片拍成纹理；过渡 shader 按格子从中心
  扩散；过渡结束后释放这张快照纹理。
- **Viselora 能力**：readiness 和 fallback。资源没就绪时 DOM 保持可见，过渡开始才隐藏
  fallback。正好用来演示"ready 但没画出来"的开发期检查。
- **档位**：格子尺寸 12 / 16 / 24 px；快照分辨率上限 2 / 1.5 / 1 倍。
- **medium 预算**：过渡期间 1 个全屏 pass、1 张快照纹理。
- **降级**：减少动态效果时直接显示结果；资源加载失败时保持 DOM。

### R3. DOM 网格画廊 + 悬停揭示 + 滚动速度弯曲（GalleryReveal）

- **对应类别**：图片画廊、鼠标响应。参考 HAOQI.DESIGN、Sobha、The state of the gallery。
- **效果**：CSS Grid 排版的作品卡片，悬停时用像素格从中心揭示第二张图；快速滚动时卡片
  随速度轻微弯曲，停下即回弹。
- **实现**：每张卡片是一个 `WebGLTarget`，平面按 DOM 矩形摆放；悬停和速度写入 uniform，
  不触发 React 更新；离开视口的卡片不绘制，揭示进度复位。
- **Viselora 能力**：DOM 目标测量（几十个目标，用来检验测量优化）、`hideWhenReady`、
  区段启停。
- **档位**：网格分段 32 / 16 / 8；同时最多绘制的卡片数 24 / 16 / 8。
- **medium 预算**：可见卡片数 + 1 个 draw call，纹理按需加载。
- **降级**：减少动态效果时去掉弯曲，悬停改为淡入淡出；无 WebGL 时是普通图片网格。

### R4. 鼠标交互粒子形体（ParticleForm）

- **对应类别**：粒子与点云、鼠标响应。参考 Emotion "Particles Mouse Interaction"、
  Lidar Drone Scanning、Shopify 点云。
- **效果**：粒子按滚动在几个形体之间变形（来自 GLB 表面采样、DOM 文字轮廓、图片亮度），
  鼠标附近的粒子被推开并缓慢回流。
- **实现**：形体在加载时采样成多组目标位置属性，顶点着色器按进度插值，鼠标位置用 uniform
  传入，不做像素回读；只有活动区段推进时间。
- **Viselora 能力**：区段启停、质量档位、DOM 文字采样（用 `measureDOMText`/`drawDOMText`
  的字形布局）。
- **档位**：粒子数 120k / 60k / 25k，对应三套采样密度。
- **medium 预算**：1 个 draw call，60k 顶点，叠加混合的覆盖面积不超过屏幕的 60%。
- **降级**：减少动态效果时只保留形体，关闭鼠标扰动和漂移。

### R5. 滚动驱动的 3D 产品展示（ProductTurntable）

- **对应类别**：3D 产品展示。参考 Nick Ho 360° 头盔、The Watch、Vero New-York。
- **效果**：滚动驱动产品转台和镜头推近；几个关键角度停住，旁边的 DOM 说明随之出现；产品上
  的热点标签用 DOM 绘制，跟随 3D 位置。
- **实现**：GLB 加环境贴图；滚动进度映射到旋转和镜头关键帧；热点每帧把 3D 点投影成屏幕
  坐标，通过 ref 写 DOM 的 transform，不触发 React 渲染；配色切换只改材质参数，不换 shader。
- **Viselora 能力**：区段启停、预热（环境贴图和材质提前编译）、DOM 目标。
- **档位**：环境贴图 1024 / 512 / 256；阴影开 / 低分辨率 / 关。
- **medium 预算**：模型自身 draw call 加 2 个，三角形不超过 30 万。
- **降级**：减少动态效果时转台改为点击切换角度；无 WebGL 时显示静态产品图和说明。

## 6. 第二批候选

- **玻璃折射标题**（HAOQI）：需要额外的 FBO pass。`low` 档降为普通透明材质。
- **共享流体光标场**（Shopify、HAOQI）：只由活动区段推进的共享模拟；模拟分辨率 128 / 64 / 32。
- **DOM 逐字动画**：按字形布局实现散开、重组、溶解，是 Viselora 独有的能力。
- **可探索的地图或地球**（Overworld Audio、Cerebrium）。

## 7. 对 runtime 设计的补充

1. **质量档位改成像素预算**：每档规定绘图缓冲区的最大像素数（初定 `high` 4.0MP、`medium`
   2.0MP、`low` 1.0MP，按基准调整），DPR 由预算和视口反推，并且不超过设备 DPR。这样大屏和
   手机都能得到合理的分辨率。原设计里"`low` 档 DPR 下限可能要到 0.75"的问题一并解决。
2. **区段内的灯光**：区段隐藏会改变场景中的灯光数量，导致所有受光材质重新编译。开发模式下
   发现区段子树里有灯光时警告，并提示改用强度开关或把灯光移到区段外。
3. **测量分级**：目标多时，近处每帧测量，远处错峰低频测量，滚动时用滚动增量修正缓存的矩形。
   R3 正好可以检验这一项。
4. **滚动同帧（需验证）**：`@viselora/scroll-adapters` 目前用 GSAP ticker 驱动 `lenis.raf`，
   和 R3F 是两个独立的 requestAnimationFrame 回调。如果同一帧里 R3F 先执行，WebGL 会比 DOM
   落后一帧。需要在浏览器里快速滚动对比验证；如果确实存在，改为在 R3F 的帧前回调里推进
   Lenis。
5. **远处释放**：Shopify 会卸载并释放非相邻场景的资源。区段默认保留资源、只在 sleep 时清理
   effect；为手机内存压力增加 `retain="release"` 选项，远离后彻底卸载子树。

## 8. 交付形式与验收

- recipe 放在 `skills/viselora-dom-webgl/recipes/`，可复制；`apps/example` 增加一个由五个
  recipe 组成的一镜到底展示页。
- 展示页同时作为基准页的"托管"对照组：与 `bench.html` 用同一个测量脚本，在 UHD 630、
  CPU 降速 4 倍和华为 P30 上测量。
- 验收：每个 recipe 单独在 `medium` 档达到 p95 ≤ 33.3ms（集显笔记本、P30）；展示页全程
  p95 ≤ 33.3ms；滚动中新增的 shader 程序数为 0；`browser-check` 通过；有减少动态效果
  和无 WebGL 时的降级截图。
- 视觉方向：深色编辑风格，一个强调色，排版以 DOM 为主；颜色、字体和强调色都通过 props
  配置，不写死在 recipe 里。

## 9. 待确认

1. 已确认（2026-10-22）：第一批为 R1～R5，按 R1 → R5 的顺序实现。
2. 已确认（2026-10-22）：深色编辑风格，单一强调色，颜色、字体可配置。
3. 第 7 节对 runtime 设计的五项补充是否纳入。

## 来源

- Awwwards WebGL 标签：https://www.awwwards.com/websites/webgl/
- Awwwards Three.js 标签：https://www.awwwards.com/websites/three-js/
- Emotion Agency（SOTD 2026-10-22）：https://www.awwwards.com/sites/emotion-agency-1
- Lando Norris（SOTD 2025-11-17）：https://www.awwwards.com/sites/lando-norris
- Shopify Spring '26 Edition 复盘：https://tympanus.net/codrops/2026/06/26/engineering-the-web-experience-behind-shopifys-spring-26-edition-everywhere/
- HAOQI.DESIGN 复盘：https://tympanus.net/codrops/2026/08/15/inside-haoqi-design-letting-dom-and-webgl-share-a-retro-futurist-stage/
- Real Folds, Real Fire：https://tympanus.net/codrops/2026/10/18/real-folds-real-fire/
- Chasing the Moment：https://tympanus.net/codrops/2026/10/12/chasing-the-moment/
- Sixty Frames for the Record：https://tympanus.net/codrops/2026/08/22/sixty-frames-for-the-record-a-three-js-game-seven-fly-throughs-and-a-wall-of-crts/
