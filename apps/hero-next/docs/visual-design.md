# Hero Next Visual Design

**状态：** 四章内容基础版本已在既有四面体视觉体系上实现，文案与外部入口可继续替换。
它已经形成完整、可逆的个人叙事链路，但不代表最终文案、个人 GLB 或移动端真机多浏览器验收。

## 叙事结构

四面体的四个面分别承载一章：

1. **我是谁**：抽象身份、工作方式与信念；个人 GLB 仍作为后续资产接入项；
2. **我的思想**：关于 AI、哲学、AI Native 与 Agent First 的判断；
3. **我做过什么**：Viselora、公开构建方向及已确认的 GitHub 入口；
4. **我正在连接什么**：产品、博客和公开表达入口，未知的视频地址保留为明确占位。

第四章退出后回到最终 Hub，以“愿与同道者共研同进，或有所得，亦未可知。”收束，
并展示已确认的 GitHub 与博客联系入口。中文和英文消费同一个 typed content model，
语言选择通过版本化 locale store 持久化。

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
5. 三角窗口完整覆盖视口时，目标面姿态、章节 screen-space 中心和 DOM Frame 的视口中心
   在同一个滚动坐标同时完成对齐，再由语义 DOM 接管；
6. 同一排版锚点上的语义 DOM 接管并完成正常章节阅读；章节进入与退出各自消费独立的
   typed Frame 内容，不假设真实内容在两个节点重复；
7. 章节 exit 一开始便在满屏三角遮挡下，将当前四面体面切到该章独立的退出 Frame，
   同时把两侧文案预切为下一章，再按相反次序收回；末章的下一节点是最终联系方式，
   不再重复第四章简介；末章 exit 完成后继续由同一终章 Portal 保持唯一一套标题和简介，
   最终 runway 只提供无障碍语义和可交互链接，不再从下方重播第二套终章内容。

atlas 仍保持四个面的一份结构真值，但缓存键额外包含当前退出章节；退出发生时只替换
该章对应 tile，其余三个面继续使用进入 Frame。因为切换发生在满屏三角遮挡下，正向与
反向滚动都能恢复正确内容，而不需要把进入/退出文案硬绑定为同一份。

两侧文案由同一 hero scene 内、位于四面体之后的 DOM-text targets 显示。文案逐字形透明度
与横向位移读取同一 progress store，四面体扩大时通过真实深度自然遮住它们；React 只在
`site → site+content → contentId` 这些语义边界跨越时挂载或更换内容，不接收逐帧滚动状态。
内容序列统一建模为网站介绍、四个章节和最终联系方式，Effect 只消费通用 `contentId`、
side 和进度，不包含第四章或联系方式专用动画分支。DOM-text raster 继承元素的计算色，
以最多 `2×` DPR、sRGB 色彩空间和关闭 mipmap 的线性采样提升高分屏清晰度；Portal
标题行盒为粗体字形保留垂直空间。响应式 Frame 样式提交后会刷新 ScrollTrigger，保证
entry/exit 起点与变化后的真实文档布局重新对齐。
向上滚动使用同一 entry/exit progress 反向解析，文案归属、弧线、姿态和遮挡均严格回放，
没有脱离浏览器滚动坐标的单向时间线。

非 reduced-motion 状态下，靠近阶段使用可逆的 camera-space Bézier 弧线、quaternion
最短路径姿态插值和中段归零的 bank；姿态插值持续到章节完整揭示，screen-space 锁定也
随揭示渐进完成，避免“先转完再沿 Z 轴放大”的独立尾段。启用
`prefers-reduced-motion` 后保留目标面朝向、章节锁定和揭示语义，但降级为直接路径并
移除额外侧倾。Hub 的 1.2% 缩放呼吸与轻微浮动在进程、回程中以 55% 强度继续叠加；
pointer tilt 在靠近与退回的空间飞行中以 72% 强度继续叠加，并在 screen lock 满屏阶段
归零，避免破坏三角窗口边界。两侧 Portal 文字同时读取统一 viewport pointer，在 managed
3D plane 上以阻尼俯仰/偏航形成视差；reduced-motion 下两类视差均归零。

## 合成与 ownership

- 页面只有一个 `WebGLScrollRuntime` 和一个 runtime-owned canvas；
- 页面继续使用原有的一个四面体 managed scene/render pass；不增加人物 scene/pass；
- `src/chapters/definitions.ts` 是章节顺序、scroll signals、四面体 face 与 atlas slot
  的唯一结构真值；
- `src/chapters/scrollState.ts` 是 entry/exit progress 到章节视觉阶段的唯一纯映射；
- `src/chapters/geometry.ts` 根据 active face 解析相机空间姿态和投影；
- `src/chapters/layout.ts` 是 atlas 与语义 DOM 的共享响应式布局模型；
- `src/chapters/atlas.ts` 从当前 locale 与退出章节状态生成四个面的 managed texture；
- `src/chapters/HeroChapterNarrative.tsx` 负责章节顺序、最终联系方式语义和真实链接，
  `src/chapters/HeroChapter.tsx` 负责章节 timeline、阅读和链接语义；
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

个人 GLB 不在本轮挂载，避免为了模型改变既有合成层。第四章只连接已确认地址；未确认的
视频账号不会被虚构。

窄屏以 `700px` 为内容断点：Hub 四面体保留更强的首屏占比，Frame 小字最小为 `16px`，
两张信号卡提前到视口 `54%` 并在 `320×568` 短屏内完整排下；转场两侧信息提升到
`15px`，桌面端从 `16px` 起，并为 WebGL 文本行盒保留对称的上下安全区；交接中段使用
更强的透明度衰减，避免窄栏中的两组长文案同时保持高可见度。
语言控件保留两色语义，增加稳定背景、安全区偏移、粗体和 `44×44px` 触控目标，
避免三角揭示或章节反相时未选语言失去对比度。

四面体继续使用单个 managed StandardMaterial 和两盏 managed directional lights，不增加
接地平面、shadow map 或重复 mesh。Hub 阶段从纯色回填中让出更多真实 PBR 光照，材质改为
中等金属度与更高粗糙度，并把 rim 调到 key 的对向，因此四个平面产生更明确的明暗分区与
模拟自阴影；screen lock 后仍回到完整章节色，保证 Atlas/DOM 接管时的色彩一致。

## 当前验证边界

- **Automated：** hero-next 22 个 focused test files / 112 tests 覆盖首屏网站介绍、首章文案
  handoff 静止段、持续到完整揭示的旋转靠近、渐进 screen lock 与居中接管、独立
  entry/exit Frame、退出 atlas 切换、飞行 pointer tilt、Portal 视差阻尼、
  退出时下一内容预选、末章到联系方式、四章选择、双向映射、四个目标面、locale/theme 持久化、
  shader 和单 runtime/scene/canvas ownership；workspace typecheck 通过。
- **Browser：** production Chromium `1280×720` 完整验证网站介绍首屏、首章 handoff
  呼吸静止段、handoff 后弧线飞行、DOM 接管、第一章退出遮挡下预切 `02 / 公理`、缩回
  呼吸态后继续显示第二章简介，以及反向滚动恢复第一章；本轮同时在 `1280×720` 和
  `375×812` 验证 Portal 继承当前主题前景色、标题行盒无裁切、末章退出预切联系方式、
  反向恢复第四章，以及 exit 完成后同一终章 Portal 持续显示。两种视口均保持单 canvas、
  无框架错误浮层且 console error/warning 为 0。`2026-08-30` 另在 `1280×720` 复验
  真实视口布局提交后会刷新 ScrollTrigger：末章 exit 越过起点便预切 `OPEN LOOP / 同道`，
  回程四面体两侧不再残留第四章简介；同时在 `1280×720` 与 `375×812` 确认放大后的
  Portal 行盒无裁切、单 canvas 且 console error/warning 为 0。`2026-08-31` 再次确认
  第四章退出、四面体回归和页面到底始终只有一套终章视觉内容，旧 `.hero-final-hub`
  不再挂载，最终 GitHub 与博客链接可见可交互；浏览器媒体模拟也确认 reduced-motion
  路径保留最终联系方式语义。`2026-08-31` 本轮又在 `1280×720` 与 `375×812` 验证
  opening runway 高度与首个 entry top 都为 `0`，轻微滚动立即挂载首章 Portal 并进入
  3D handoff；桌面交接中点、完成态和 face-space 飞行以及移动端交接中点、完成态均保持
  单 canvas、无框架错误浮层且 console error/warning 为 0，反向滚回 `scrollY=0` 会恢复
  唯一网站介绍。同日追加在 `1280×720` 验证第一章进入 Frame 与 `SELF / TRACE` 退出
  Frame 内容不同，退出回程预切 `02 / 公理`；鼠标从左下移动到右上时 Portal plane 与
  四面体飞行姿态均平滑响应。在 `375×812` 再验证独立退出 Frame、退出 atlas、screen-lock
  与回程 Portal，无裁切、单 canvas、无框架错误浮层且 console error/warning 为 0。
  同日最新一轮在开发态 Chromium 的 `1280×720` 与 `375×812` 验证首章最终揭示仍持续
  旋转靠近，目标面在完整章节出现时完成归正并由同尺寸 DOM Frame 接管；桌面反向滚动
  会恢复同一倾斜揭示姿态。两种视口均保持单 canvas、无框架错误浮层且 console
  error/warning 为 0。
  既有 LAN-origin HMR WebSocket 证据未在本轮重跑。
- **未声称：** 本轮没有覆盖 `320×568`、iOS Safari、Android Chrome 真机、横屏或
  长按主题切换；个人 GLB 和视频入口尚未接入；Canvas 与 DOM 的字形抗锯齿不承诺
  像素级一致。

## 维护边界

- 不增加第二 runtime、renderer 或 canvas；
- 不用 CSS mask/clip 替代 WebGL 三角转场；
- 不把逐帧进度放入 React state；
- 不把 app key、文案、资产或布局规则下沉到 package；
- 内容、链接与未来个人模型继续在 hero-next app 边界内替换；模型接入不得增加覆盖四面体
  的额外 pass。
