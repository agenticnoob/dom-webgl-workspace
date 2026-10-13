# Hero Next pre-R3F verification

Archived on 2026-10-14 from the app visual-design document. These records
describe the previous renderer implementation and are not acceptance evidence
for the React/R3F release. Historical claims and limits are preserved below.

## 当前验证边界

- **第四章自动化：** 覆盖双语长行、三平台精确地址、原图与账号、整行跳转、连续跟随、跨行窗口复用、
  Escape/离开目录关闭、滚动时保留当前命中行并在移出时关闭、连续限位，以及无悬停设备的常显内容、无预览行为、移动端首尾排版与图片就绪后的 atlas 更新。
- **第四章 Browser：** `2026-09-10` 生产构建在 ego-browser 中验证 `1440×900` 中文居中长行与 `99px` 主字号，
  `1440px` 与 `901px` 英文长行无文字／箭头重叠，桌面连续跟随仍有效。
  禁用浏览器缓存复查首次移入与图片加载；首次显示后触发滚动事件仍保留同一个窗口，继续移动及跨平台切换无需重新移入。
  停留距离微调后，`1440×900` 正文高 `1620px`，进入后滚动 `500px` 仍停留目录，距离场还有 `220px`；越过 `720px` 后离场，反向滚动可返回目录。移动端仍为自然高度列表。
  `390×844` 中文和 `320×740` 英文常显内容列表无横向溢出；触摸二维码直接打开 B 站主页，没有预览窗口。
  三张图片完整加载、简介未截断，保留一个 canvas，未记录到页面或控制台错误。未验证真机扫码或平台 App 唤起。
  B 站与抖音主页可加载，小红书连接超时；三个地址以用户提供资料为准。
  32 个应用测试文件 / 191 tests、应用 typecheck/build 通过，React Doctor 本次改动为 100/100。
- **第三章自动化：** 覆盖边缘转向与重新触发、最短角度路径、首尾收束、reduced-motion、语义状态去重、键盘与 hover 锁定、DOM fallback、四个项目链接及双语纹理排版和源区域边界。
- **Automated：** hero-next 32 个 focused test files / 191 tests 覆盖第二章数据扩展、稳定文章 ID、
  动态滚动长度、纹理网格、空列表/单篇/多篇边界、命题选择、无固定停顿的连续映射、
  按实际溢出分配阅读段、四边齿孔几何与共享 shader 参数、
  弧线入场与累积堆叠、旧卡几何不变、反向回放、窄屏中英文完整排版、卡内溢出阅读、reduced-motion 和首章气泡
  显示范围，以及首屏网站介绍、首章文案
  handoff 静止段、持续到完整揭示的旋转靠近、渐进 screen lock 与居中接管、独立
  四章 body-only DOM、空 entry/exit runways、内容结束即回程、正文派生且预打包的 lead/tail atlas、
  连续 face-lock UV、飞行 pointer tilt、Portal 视差阻尼、
  退出时下一内容预选、末章到联系方式、四章选择、双向映射、四个目标面、locale/theme 持久化、
  profile GLB 大小与 decoder 资产、第一面浅浮雕贴附、连续面到正文变换、人物固定位置、
  响应式人物椭圆/对话框圆角矩形联合避让、圆角边界外的连续预让位、混合文字视觉行分组和环绕 DOM 标记、
  固定气泡内正面/侧面/背面文案的逐字出现—停留—逐字消失、反向确定性与 reduced-motion、
  内容进度到一周旋转的纯映射、进程/返程局部自转冻结、章节 pointer-light 衰减、reduced-motion、
  shader、主题间稳定的人物材质基色和单 runtime/scene/canvas ownership。全仓库收尾验证由
  [当前状态](../../../docs/STATUS.md#verification-truth) 统一记录；下方浏览器证据按日期保留，
  不将历史尺寸或交互验证视为本轮重跑。
- **Browser：** `2026-09-04` 在开发态 Chromium `1440×900` 与 `375×812` 精确跨越第一章
  Atlas → DOM 接管及 DOM → tail 回程坐标前后各 `2px`，章节计数、标题逐行断点、简介、
  人物位置、尺寸与固定气泡轮廓连续；桌面与移动端正文 token
  以各 41 个正文进度点抽样，文字对气泡实际圆角矩形的碰撞数和视口裁切数均为 0；
  两种视口始终只有一个 canvas、无框架错误浮层且 console error/warning 为 0。另在
  `1280×720` 与 `375×812` 验证四章 DOM
  均只有正文，4 组 entry/exit runway 均无子元素，页面没有章节首/尾 Frame。第一章正文 closing
  后仅保留排版所需约 `130px` 间距，跨过 exit 边界 `4px` 即进入回程；模型以一整圈后的等价朝向连续回贴，
  四面体第一面切换为真实章节 closing，而不是章节开头。第二章回程同样显示正文最后卡片；切换中英文后
  locale 与 Atlas 同步更新，仍保持一个 canvas、无框架错误浮层且 page error 为 0。第一章仍是居中的明确
  左右两列；桌面当前模型高度内 9 条受影响行产生 9 个不同位移，移动端 29 条产生 29 个不同
  位移，两种视口的人物保护椭圆碰撞数均为 0。LAN-origin 证据沿用既有验证，未在
  `2026-09-05` 重跑。
  针对章节一尾部硬切的用户截图，另在 `1697×742`、`1822×730` 与 `375×812` 逐点回读 DOM 尾帧、exit 边界后首帧及
  `10%` 回程帧：Atlas 格间文字污染和多余句号均已消失，尾帧不再残留上一段正文；人物、closing 与正面对话框
  的位置和尺寸连续，移动端三角收束过程合理，始终只有一个 canvas，console error/warning 为 0。
  `2026-09-05` 固定气泡打字机效果在开发态 Chromium `1440×900` 与 `375×812` 用真实滚轮验证：正面字符数按
  `6 → 3 → 0` 递减，随后侧面按 `0 → 4 → 6` 递增，反向滚动从完整侧面回到 4 个字符；桌面气泡始终为
  `259.1875×84px`、移动端始终为 `176×88px`，surface 与尾部 computed transform 均为 `none`。
  英文阶段同步逐字显示（中间帧为 `This i`），reduced-motion 在背面进度仍固定完整正面，两个视口均保持
  单 canvas、无页面错误或框架错误浮层。开发态 Chromium 仍报告既有
  `glCopySubTextureCHROMIUM` WebGL warning；本次 DOM 气泡改动未处理该渲染器警告。
  本轮人物表面优化在开发态 Chromium `1440×900` 与 `375×812` 复核第一章正面和侧面：更高细节的
  Draco 派生资产保持既有屏幕位置与尺寸，几何法线与柔化后的 PBR 高光没有新增贴图接缝或硬塑料反光；
  移动端真实滚轮从正面进入侧面后仍保持一个 canvas，本次会话的 console error/warning 为 0。
  `2026-09-05` 从 Hub 真实长按切到 inverted theme 后，在 `1440×900`、用户截图同尺寸
  `1080×1440` 与 `375×812` 复核第一章正面：人物不再随 committed background 变暗，肤色、黑发和
  灰色衣服仍保留明暗层次且高光没有洗白；三个视口均保持一个 canvas、无错误浮层和 page error。
  Chromium 在 resize 后仍会报告既有 `glCopySubTextureCHROMIUM` WebGL warning，本次材质修复未处理该警告。
- **第二章 Browser：** `2026-09-05` production Chromium 在 `1440×900` 中文、`375×812` 中文与
  `320×568` 英文验证四张完整命题纸卡、四边邮票齿孔、右侧弧线入栈的早/中/晚帧、旧卡尺寸保留、
  圆弧标题选择、真实滚轮双向驱动与 reduced-motion。
  三种尺寸在 entry/exit 边界前后各 `2px` 的接管状态正确；同一正文进度的正向/反向截图
  均逐像素一致。真实滚轮小幅输入 `40px` 后三种视口均有可见画面变化，反向 `-40px` 回到
  原滚动坐标；英文窄屏保留按实际溢出驱动的卡内阅读，最后一篇完整读到末行。
  均保持一个 canvas、四篇完整语义文章、无横向溢出，第一章固定气泡不残留。
  语言切换后重新计算章节布局，英文末卡保持到正文终点；阅读层使用视口宽度，与转场 atlas 几何对齐。
  本轮 page error 与 console error 为 0；resize 后仍有既有 `glCopySubTextureCHROMIUM` warning，
  未在本轮处理。Atlas 与实时阅读层的文字栅格化仍有细微抗锯齿差异，不声称交接截图逐像素一致。
  模块化重构另以临时 12 篇数据在开发态 `1440×900` 中文和 `320×568` 英文验证
  第一篇、第六篇、第十二篇及反向返回：均为 12 篇语义文章、单 canvas、无横向溢出和页面/console error；
  测试内容验证后已移除。提交收尾使用 React Doctor `--scope changed --base HEAD --include-untracked`
  扫描 25 个文件，得分 `57/100`，无第二章诊断；唯一报告是第一章气泡 `effect-needs-cleanup`。
  对照当前源码和 HEAD，effect 均在 cleanup 中调用 `unsubscribe()`、移除媒体查询监听并取消待执行
  动画帧，因此判定为静态分析误报，未添加规则屏蔽；不声称 React Doctor 命令通过。
  用户随后报告第二篇正文与第三个目录标题空白；此前的 DOM/进度验证未发现这个实际像素缺陷，
  因而不能视为所有文字均已显示的证据。本次在 `1690×764` 生产态复现并修正图集行首采样：
  两块内部文字区域修复前均为 0 个文字亮像素，修复后分别为 19,361 与 3,914 个，截图回读确认
  第二篇标题/正文及第三个目录标题恢复。0、1、4、7、12 篇的自动化现检查共享采样起点，
  并禁止 shader 重新以浮点运算计算 tile 行列。
- **第三章 Browser：** `2026-09-06` production Chromium 在 `1440×900` 验证鼠标边缘依次转过四面、
  正面项目与真实 GitHub 链接一致、中英文切换；`390×844` 触屏模拟保留普通单列四项目正文和可聚焦链接，
  不启用项目空间或鼠标控件，无横向溢出。另验证 reduced-motion 下鼠标不转面、键盘 Enter 选择项目、
  退出后反向滚回保留选择，以及 `1440×900 → 390×844 → 1440×900` 的展示模式切换。
  以上会话始终只有一个 canvas，page error 与 console error/warning 均为 0。
  本轮定位语言切换时的 WebGL texture 尺寸警告来自 Portal DOM 文字尺寸变化；Portal 现在按 locale 和
  viewport 重挂载文字 target，使 runtime 为新尺寸创建受管纹理，未修改 package。
  app 31 个 test files / 184 tests、typecheck、production build、import/docs check 均通过；
  React Doctor 按 HEAD 与未跟踪文件扫描本轮 15 个文件，100/100，无诊断。移动端结果来自浏览器模拟，未做真机验证。
- **提交前复核：** `2026-09-08` 重建后在 production Chromium `1440×900` 再次验证四面鼠标导航、
  每面 GitHub 链接、中英文切换；`390×844` 触屏模拟验证普通单列四项目、可聚焦链接、无空间控件与无横向溢出。
  两个独立浏览器上下文的 page error 与 console error/warning 均为 0；移动端保留一个 canvas。
  本轮未重跑 reduced-motion、键盘和窗口缩放路径，其最近证据仍为 `2026-09-06`。
- **未声称：** 第一章未重验 `320×568`；本轮没有覆盖 iOS Safari、Android Chrome 真机、横屏或
  反向切回 initial theme；三个视频平台的目标地址待补充；Canvas 与 DOM 的字形抗锯齿不承诺
  像素级一致。
