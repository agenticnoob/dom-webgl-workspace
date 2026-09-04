# Hero Next Visual Design

**状态：** 四章内容基础版本已在既有四面体视觉体系上实现，文案与外部入口可继续替换。
第一章个人 GLB 与环绕式叙事已经接入，但不代表最终文案或移动端真机多浏览器验收。

## 叙事结构

四面体的四个面分别承载一章：

1. **我是谁**：以军旅、校园、城市、代码与独立构建为来路，用文学化叙事呈现仍在形成中的自我；
2. **我的思想**：关于 AI、哲学、AI Native 与 Agent First 的判断；
3. **我做过什么**：Viselora、公开构建方向及已确认的 GitHub 入口；
4. **我正在连接什么**：产品、博客和公开表达入口，未知的视频地址保留为明确占位。

第四章退出后回到最终 Hub，以“愿与同道者共研同进，或有所得，亦未可知。”收束，
并展示已确认的 GitHub 与博客联系入口。中文和英文消费同一个 typed content model，
语言选择通过版本化 locale store 持久化。

第一章正文不采用居中的履历卡片，也不再用左右背景块围出模型通道。人物 GLB 在完整
四面体上已经作为浅浮雕贴附于第一面，随该面共用同一套位置、姿态、呼吸与 pointer tilt；
第一面揭示时，同一个模型从面内连续恢复厚度并放大到视口中央，退出时沿原路径重新贴回。
过渡段通过相机深度匹配把正文人物投影保持在目标面前方；接管与回贴边界虽然切换世界深度，
屏幕位置、大小和姿态仍连续，不再被四面体深度遮挡或跳现。只要四面体可见，它就是第一面
的一部分；进入其他章节正文、四面体隐藏时才一同隐藏。

四章 DOM 都只渲染正文，不再有独立的章节首屏或尾屏。entry/exit timeline 仍作为 3D 过渡
所需的不可见滚动信号，但它们不承载标题、摘要、卡片、继续链接或其他内容。语义层保持透明，
由原有 WebGL background plane 提供章节反相底色。

第一章正文仍拆成明确的左、右两列，但两列集中在视口中部，外侧留作位移空间。环绕以浏览器
实际排出的文字行为单位：同一视觉行的中英文 token 共享位移，每一行根据自身纵向范围与响应式
模型保护椭圆、头顶漫画对话框两个占位的交叠独立向外移动；远离人物时回到中间，经过人物或
对话框时沿对应椭圆横截面自然让开。新增或替换正文 section 不需要逐项硬编码 margin，
也不会让整个内容模块一起跳开。body timeline 在 DOM 完整接管后从 `0 → 1` 唯一映射
人物局部 Y 轴的 `0 → -2π`，并在正文底部到达视口底部、exit return 开始的同一坐标完成
一周。四面体飞入期间人物保持面内初始姿态，回贴与返程期间保持一周后的等价姿态，不再叠加人物局部自转；
反向滚动会回到同一姿态。reduced-motion 下保留模型与内容，只移除旋转。

人物头顶保留一个浅底深字、前景色描边的圆角长方形漫画对话框；它与章节使用同一组语义
色，因此主题切换和 Atlas/DOM 接管不会跳色。它不建立第二套时间线：直接读取上述 body progress，
用连续权重在“这是我的正面”“这是我的侧面”“这是我的背面”之间交叉淡化；`0 / 1` 为正面，
`0.25 / 0.75` 为侧面，`0.5` 为背面，反向滚动严格回放。React 不接收逐帧 state，DOM 只在
requestAnimationFrame 内写入三个文本层的透明度；reduced-motion 固定正面。中英文各有同义文案。

## 空间链路

每一章都使用同一套可逆阶段：

1. 首屏完整四面体保持 Hub 呼吸，左右显示整个网站的定位与浏览提示；首个 entry timeline
   从文档顶部开始，滚动一发生便进入交接，不再先消费一段无视觉响应的 Hub runway；
2. 首章 entry 的独立 handoff 阶段把网站介绍向屏幕外侧淡出、把第一章简介从靠近
   四面体的一侧淡入各自左右锚点；两组文字除相反横向路径外，还在 managed 3D plane 上
   做可逆的 Y 轴转入/转出。交接占首章 entry 更长比例，四面体继续保持 Hub 呼吸，
   其主飞行、缩放和 screen lock 在交接完成后才开始；
3. handoff 完成后，对应目标面才沿偏离观察轴的三次弧线飞向相机，姿态使用最短路径
   插值并在中段轻微侧倾；到达 DOM 主尺度后旋转不会提前结束，而是继续贯穿最后的
   三角揭示；
4. 面内 atlas 内容与三角面共同靠近放大，screen-space 接管随最后一段揭示连续插值，
   不再形成一段姿态静止的单纯靠近放大；
5. 三角窗口完整覆盖视口时，目标面姿态、章节 screen-space 中心和正文视口中心
   在同一个滚动坐标完成对齐，再由语义 DOM 正文接管；
6. 每章 content timeline 只包含一份正文；entry/exit runway 为空，只为可逆 3D 阶段提供进度；
   exit 从正文底部到达视口底部时立即开始，不再保留一整屏无内容尾段；
7. 章节 exit 一开始便在满屏三角遮挡下把两侧 Portal 文案预切为下一章，再按相反次序
   收回；末章的下一节点是最终联系方式，
   不再重复第四章简介；末章 exit 完成后继续由同一终章 Portal 保持唯一一套标题和简介，
   最终 runway 只提供无障碍语义和可交互链接，不再从下方重播第二套终章内容。

atlas 仍保持四个面的一份结构真值，每章预先打包 lead 与 tail 两个 tile：lead 读取章节计数、
title 与 intro，tail 直接读取正文最后卡片与 closing。Atlas 与语义 DOM 共用同一套响应式
几何；第一章还共用居中双列、均衡标题、人物保护椭圆和圆角长方形正面对话框，因此三角面完整
覆盖后不会突然出现气泡或切换成另一套排版。每个 tile 在自己的像素边界内独立裁剪，长文案即使
超出当前格也不会污染相邻章节或 lead/tail 格；第一章尾段的高度恰好补齐正文底部视口，最后一段
会在回程边界前自然离场，closing、人物与对话框则在 DOM/Atlas 两侧保持同一视口中心。
exit 只切换 shader 内的 tile 选择，不因滚动重建或重新上传纹理；缓存只随 viewport
或 locale 变化。目标面的 face-space 投影 UV 仍按 approach 连续插值，在 Hub 边界归零，
因此章节 ID 换面不会造成纹理坐标跳变。

两侧文案由同一 hero scene 内、位于四面体之后的 DOM-text targets 显示。文案逐字形透明度
与横向位移读取同一 progress store，四面体扩大时通过真实深度自然遮住它们；React 只在
`site → site+content → contentId` 这些语义边界跨越时挂载或更换内容，不接收逐帧滚动状态。
内容序列统一建模为网站介绍、四个章节和最终联系方式，Effect 只消费通用 `contentId`、
side 和进度，不包含第四章或联系方式专用动画分支。DOM-text raster 继承元素的计算色，
以最多 `2×` DPR、sRGB 色彩空间和关闭 mipmap 的线性采样提升高分屏清晰度；Portal
标题行盒为粗体字形保留垂直空间。响应式正文布局变化后会刷新 ScrollTrigger，保证
entry/exit 起点与变化后的真实文档布局重新对齐。
向上滚动使用同一 entry/exit progress 反向解析，文案归属、弧线、姿态和遮挡均严格回放，
没有脱离浏览器滚动坐标的单向时间线。

非 reduced-motion 状态下，靠近阶段使用可逆的 camera-space Bézier 弧线、quaternion
最短路径姿态插值和中段归零的 bank；姿态插值持续到章节完整揭示，screen-space 锁定也
随揭示渐进完成，避免“先转完再沿 Z 轴放大”的独立尾段。启用
`prefers-reduced-motion` 后保留目标面朝向、章节锁定和揭示语义，但降级为直接路径并
移除额外侧倾。Hub 的 1.2% 缩放呼吸与轻微浮动在进程、回程中以 55% 强度继续叠加；
pointer tilt 采用更大的俯仰/偏航幅度与更快阻尼，在靠近与退回的空间飞行中以 72% 强度
继续叠加，并在 screen lock 满屏阶段归零，避免破坏三角窗口边界。两侧 Portal 文字同时
读取统一 viewport pointer，在 managed
3D plane 上以阻尼俯仰/偏航形成视差；reduced-motion 下两类视差均归零。

## 合成与 ownership

- 页面只有一个 `WebGLScrollRuntime` 和一个 runtime-owned canvas；
- 人物 GLB 作为 scene-native model 加入原有 managed scene/render pass；不增加人物 scene/pass；
- `src/chapters/definitions.ts` 是章节顺序、scroll signals、四面体 face 与 atlas slot
  的唯一结构真值；
- `src/chapters/scrollState.ts` 是 entry/exit progress 到章节视觉阶段的唯一纯映射；
- `src/chapters/geometry.ts` 根据 active face 解析相机空间姿态和投影；
- `src/chapters/layout.ts` 是 atlas 的响应式布局模型；
- `src/chapters/atlas.ts` 从当前 locale 的四章正文生成四个面的 managed texture；
- `src/chapters/HeroChapterNarrative.tsx` 负责章节顺序、最终联系方式语义和真实链接，
  `src/chapters/HeroChapter.tsx` 负责章节 timeline、阅读和链接语义；
- `src/profile/HeroProfileChapterBody.tsx` 负责第一章居中的左右叙事结构，
  `useProfileWrap.ts` 与 `wrap.ts` 负责实际视觉行测量、分组和椭圆位移，
  `HeroProfileModel.tsx` 和 `modelEffect.ts` 分别负责稳定模型声明与纯 scroll-to-frame 映射；
- `src/chapters/HeroLocaleControl.tsx` 负责语言交互，`src/preferences/locale.ts`
  是 locale 类型、持久化和 committed state 的唯一真值；
- `src/transition/portalState.ts` 从统一内容序列解析网站介绍、章节和最终联系方式的归属，
  `HeroPortalStage.tsx` 与 `portalEffect.ts` 分别负责低频内容挂载和逐帧 WebGL 位移/透明度；
- CSS 保留既有背景、前景、章节反相、stacking 与 pointer routing，不用 `clip-path`
  或第二个三角形冒充 WebGL 转场。

应用只消费 public package entrypoints，未引入 raw Three.js ownership、第二 scene、第二
renderer、第二 canvas 或 Hero 专用 package 分支。

## 视觉与交互真值

语义色仍只有 `light #B8B8B8` 与 `dark #5F5F5F`。章节读取 committed theme 的反相
色彩角色，atlas、三角投影和 DOM 使用同一 palette。完整 Hub 上长按真实四面体约一秒
触发 radial theme transition；离开 Hub 后 gate 关闭。主题和语言分别持久化，但逐帧滚动、
shader 和章节激活进度不进入 React state。

个人 GLB 由原始 `80,547,988` bytes、约 `1,499,852` triangles 的源资产生成独立交付副本；
仓库内版本为 `1,845,364` bytes、`179,968` triangles，使用 Draco 几何压缩、MikkTSpace
tangents 与 `1024px` WebP 纹理。源文件保持不变且不进入仓库。第四章只连接已确认地址；
未确认的视频账号不会被虚构。

窄屏以 `700px` 为内容断点：第一章把中央模型保护椭圆收窄到约 `38vw`，同时让中部两列的
字号、间距、段落宽度和头顶对话框独立降级；逐行位移仍对人物与气泡联合求解并限制在安全边界内。
Hub 四面体保留更强的首屏占比；
转场 atlas 与两侧 Portal 信息使用独立响应式排版，转场两侧信息提升到
`15px`，桌面端从 `16px` 起，并为 WebGL 文本行盒保留对称的上下安全区；交接中段使用
更强的透明度衰减，避免窄栏中的两组长文案同时保持高可见度。
语言控件保留两色语义，增加稳定背景、安全区偏移、粗体和 `44×44px` 触控目标，
避免三角揭示或章节反相时未选语言失去对比度。

四面体继续使用单个 managed StandardMaterial 和两盏 managed directional lights，不增加
接地平面、shadow map 或重复 mesh。Hub 阶段从纯色回填中让出更多真实 PBR 光照，材质改为
中等金属度与更高粗糙度，并把 rim 调到 key 的对向，因此四个平面产生更明确的明暗分区与
模拟自阴影。同一 managed material shader 额外叠加基于视角法线的 Fresnel 边缘光，并降低
纯色回填与 emissive 强度以释放更多 PBR 对比；边缘光随目标面 screen lock 渐进归零，锁定后
仍回到完整章节色，保证 Atlas/DOM 接管时的色彩一致。
鼠标光在 Hub 保留原强度，但 entry 随滚动把背景光斑连续降到 `10%`、point light 降到
`4%`，章节内维持该上限，exit 再连续回升；因此章节中的人物与反相底色不会被鼠标补光
打得发白。

## 当前验证边界

- **Automated：** hero-next 25 个 focused test files / 148 tests 覆盖首屏网站介绍、首章文案
  handoff 静止段、持续到完整揭示的旋转靠近、渐进 screen lock 与居中接管、独立
  四章 body-only DOM、空 entry/exit runways、内容结束即回程、正文派生且预打包的 lead/tail atlas、
  连续 face-lock UV、飞行 pointer tilt、Portal 视差阻尼、
  退出时下一内容预选、末章到联系方式、四章选择、双向映射、四个目标面、locale/theme 持久化、
  profile GLB 大小与 decoder 资产、第一面浅浮雕贴附、连续面到正文变换、人物固定位置、
  响应式人物椭圆/对话框圆角矩形联合避让、圆角边界外的连续预让位、混合文字视觉行分组和环绕 DOM 标记、
  正面/侧面/背面的连续对话框权重、反向确定性与 reduced-motion、
  内容进度到一周旋转的纯映射、进程/返程局部自转冻结、章节 pointer-light 衰减、reduced-motion、
  shader 和单 runtime/scene/canvas ownership；全仓库 169 个 test files / 1152 tests、
  workspace typecheck、import check 与 docs check 通过。`2026-09-04` production build
  在 `/tmp` 隔离副本中通过，没有与正在运行的 dev server 争用工作区 `.next`。
- **Browser：** `2026-09-04` 在开发态 Chromium `1440×900` 与 `375×812` 精确跨越第一章
  Atlas → DOM 接管及 DOM → tail 回程坐标前后各 `2px`，章节计数、标题逐行断点、简介、
  人物位置、尺寸与正面对话框连续；
  在正文进度 `0 / 0.25 / 0.5 / 0.75 / 1` 及反向序列回读到正面/侧面/背面/侧面/正面，
  三层文案权重在主角度分别为 `1 / 0 / 0`，中间角度连续交叉淡化。桌面与移动端正文 token
  以各 41 个正文进度点抽样，文字对气泡实际圆角矩形的碰撞数和视口裁切数均为 0；
  两种视口始终只有一个 canvas、无框架错误浮层且 console error/warning 为 0。另在
  `1280×720` 与 `375×812` 验证四章 DOM
  均只有正文，4 组 entry/exit runway 均无子元素，页面没有章节首/尾 Frame。第一章正文 closing
  后仅保留排版所需约 `130px` 间距，跨过 exit 边界 `4px` 即进入回程；模型以一整圈后的等价朝向连续回贴，
  四面体第一面切换为真实章节 closing，而不是章节开头。第二章回程同样显示正文最后卡片；切换中英文后
  locale 与 Atlas 同步更新，仍保持一个 canvas、无框架错误浮层且 page error 为 0。第一章仍是居中的明确
  左右两列；桌面当前模型高度内 9 条受影响行产生 9 个不同位移，移动端 29 条产生 29 个不同
  位移，两种视口的人物保护椭圆碰撞数均为 0。既有 3D handoff、双向回放、最终联系方式、主题交互、reduced-motion
  与 LAN-origin 证据未在本轮重跑。
  针对章节一尾部硬切的用户截图，另在 `1697×742`、`1822×730` 与 `375×812` 逐点回读 DOM 尾帧、exit 边界后首帧及
  `10%` 回程帧：Atlas 格间文字污染和多余句号均已消失，尾帧不再残留上一段正文；人物、closing 与正面对话框
  的位置和尺寸连续，移动端三角收束过程合理，始终只有一个 canvas，console error/warning 为 0。
- **未声称：** 本轮没有覆盖 `320×568`、iOS Safari、Android Chrome 真机、横屏或
  长按主题切换；视频入口尚未接入；Canvas 与 DOM 的字形抗锯齿不承诺
  像素级一致。

## 维护边界

- 不增加第二 runtime、renderer 或 canvas；
- 不用 CSS mask/clip 替代 WebGL 三角转场；
- 不把逐帧进度放入 React state；
- 不把 app key、文案、资产或布局规则下沉到 package；
- 内容、链接与个人模型继续在 hero-next app 边界内替换；模型迭代不得增加覆盖四面体的
  额外 pass。
