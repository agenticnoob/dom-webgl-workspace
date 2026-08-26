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

1. 完整四面体 Hub；
2. 对应目标面旋转至相机并沿观察轴靠近；
3. 面内 atlas 内容与三角面共同放大；
4. 内容在投影达到 DOM 主尺度时锁定到 screen-space，三角窗口继续覆盖视口；
5. 同一排版锚点上的语义 DOM 接管并完成正常章节阅读；
6. 退出时按相反次序收回，回到下一段 Hub 或最终 Hub。

每章进入过渡都拥有不同的两侧短信息。它们位于三角形之外、DOM 内容之下；
目标面扩大后会自然覆盖这些信息。向上滚动使用同一 entry/exit progress 反向解析，
没有脱离浏览器滚动坐标的单向时间线。

## 合成与 ownership

- 页面只有一个 `WebGLScrollRuntime` 和一个 runtime-owned canvas；
- 页面继续使用原有的一个四面体 managed scene/render pass；不增加人物 scene/pass；
- `src/chapters/definitions.ts` 是章节顺序、scroll signals、四面体 face 与 atlas slot
  的唯一结构真值；
- `src/chapters/scrollState.ts` 是 entry/exit progress 到章节视觉阶段的唯一纯映射；
- `src/chapters/geometry.ts` 根据 active face 解析相机空间姿态和投影；
- `src/chapters/layout.ts` 是 atlas 与语义 DOM 的共享响应式布局模型；
- `src/chapters/atlas.ts` 从当前 locale 的 typed content 生成四个面的 managed texture；
- `src/chapters/HeroChapterNarrative.tsx` 负责章节顺序与 Hub 组合，
  `src/chapters/HeroChapter.tsx` 负责章节 timeline、阅读和链接语义；
- `src/chapters/HeroLocaleControl.tsx` 负责语言交互，`src/preferences/locale.ts`
  是 locale 类型、持久化和 committed state 的唯一真值；
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
`12px`。语言控件保留两色语义，增加稳定背景、安全区偏移、粗体和 `44×44px` 触控目标，
避免三角揭示或章节反相时未选语言失去对比度。

## 当前验证边界

- **Automated：** hero-next 20 个 focused test files / 102 tests 覆盖四章选择、双向映射、
  四个目标面、locale/theme 持久化、atlas/DOM 内容、shader 和单 runtime/scene/canvas
  ownership；workspace typecheck 通过。
- **Browser：** 本地 Chromium `1280×720` 保持桌面首屏无回归；`375×812` 验证移动端
  首屏、第一章转场侧文、完整三角揭示、语言切换和 DOM 接管；`320×568` 验证短屏首屏
  与两张信号卡完整排布。上述路径均为单 canvas、无框架错误浮层且 console
  error/warning 为 0。既有 LAN-origin HMR WebSocket 证据未在本轮重跑。
- **未声称：** 本轮没有覆盖 iOS Safari、Android Chrome 真机、横屏、长按主题切换或
  reduced-motion 的浏览器交互；个人 GLB 和视频入口尚未接入；Canvas 与 DOM 的字形
  抗锯齿不承诺像素级一致。

## 维护边界

- 不增加第二 runtime、renderer 或 canvas；
- 不用 CSS mask/clip 替代 WebGL 三角转场；
- 不把逐帧进度放入 React state；
- 不把 app key、文案、资产或布局规则下沉到 package；
- 内容、链接与未来个人模型继续在 hero-next app 边界内替换；模型接入不得增加覆盖四面体
  的额外 pass。
