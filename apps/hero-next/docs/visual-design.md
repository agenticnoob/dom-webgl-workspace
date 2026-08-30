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

1. 首屏完整四面体保持 Hub 呼吸，左右显示整个网站的定位与浏览提示；
2. 首章 entry 的独立 handoff 阶段只把网站介绍向屏幕外侧淡出、把第一章简介从靠近
   四面体的一侧淡入各自左右锚点，两组文字使用相反横向路径避免交接中段叠字，
   四面体的位移、姿态、缩放和 screen lock 均保持为零；
3. handoff 完成后，对应目标面才沿偏离观察轴的三次弧线飞向相机，姿态使用最短路径
   插值并在中段轻微侧倾；
4. 面内 atlas 内容与三角面共同放大；
5. 内容在投影达到 DOM 主尺度时锁定到 screen-space，三角窗口继续覆盖视口；
6. 同一排版锚点上的语义 DOM 接管并完成正常章节阅读；
7. 章节 exit 一开始便在满屏三角遮挡下把两侧文案预切为下一章，再按相反次序收回，
   因而四面体缩回呼吸态时露出的已经是下一内容节点；末章的下一节点是最终联系方式，
   不再重复第四章简介；末章 exit 完成后继续由同一终章 Portal 保持唯一一套标题和简介，
   最终 runway 只提供无障碍语义和可交互链接，不再从下方重播第二套终章内容。

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
最短路径姿态插值和中段归零的 bank，避免“先转完再沿 Z 轴放大”的平面感。启用
`prefers-reduced-motion` 后保留目标面朝向、章节锁定和揭示语义，但降级为直接路径并
移除额外侧倾。

## 合成与 ownership

- 页面只有一个 `WebGLScrollRuntime` 和一个 runtime-owned canvas；
- 页面继续使用原有的一个四面体 managed scene/render pass；不增加人物 scene/pass；
- `src/chapters/definitions.ts` 是章节顺序、scroll signals、四面体 face 与 atlas slot
  的唯一结构真值；
- `src/chapters/scrollState.ts` 是 entry/exit progress 到章节视觉阶段的唯一纯映射；
- `src/chapters/geometry.ts` 根据 active face 解析相机空间姿态和投影；
- `src/chapters/layout.ts` 是 atlas 与语义 DOM 的共享响应式布局模型；
- `src/chapters/atlas.ts` 从当前 locale 的 typed content 生成四个面的 managed texture；
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

窄屏以 `700px` 为内容断点：Hub 四面体保留更强的首屏占比，Frame 小字最小为 `14px`，
两张信号卡提前到视口 `54%` 并在 `320×568` 短屏内完整排下；转场两侧信息提升到
`13px`，桌面端从 `14px` 起，并为 WebGL 文本行盒保留对称的上下安全区；交接中段使用
更强的透明度衰减，避免窄栏中的两组长文案同时保持高可见度。
语言控件保留两色语义，增加稳定背景、安全区偏移、粗体和 `44×44px` 触控目标，
避免三角揭示或章节反相时未选语言失去对比度。

## 当前验证边界

- **Automated：** hero-next 22 个 focused test files / 108 tests 覆盖首屏网站介绍、首章文案
  handoff 静止段、退出时下一内容预选、末章到联系方式、四章选择、双向映射、四个目标面、locale/theme
  持久化、atlas/DOM 内容、shader 和单 runtime/scene/canvas ownership；workspace typecheck
  通过。
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
  路径保留最终联系方式语义。既有 LAN-origin HMR WebSocket 证据未在本轮重跑。
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
