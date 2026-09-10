# Hero Next Visual Design

**状态：** 四章内容基础版本已在既有四面体视觉体系上实现，文案与外部入口可继续替换。
第一章个人 GLB 与环绕式叙事已经接入，但不代表最终文案或移动端真机多浏览器验收。

## 叙事结构

四面体的四个面分别承载一章：

1. **我是谁**：以军旅、校园、城市、代码与独立构建为来路，用文学化叙事呈现仍在形成中的自我；
2. **我的思想**：关于 AI、哲学、AI Native 与 Agent First 的判断；
3. **我做过什么**：依次介绍 AXMORF Studio、Viselora DOM WebGL、SyringeMeter、vibe-journal-pipeline，提供中英文项目简介与各自的 GitHub 入口；
4. **我正在连接什么**：抖音、小红书、哔哩哔哩、博客与 GitHub 的单行大字目录，悬停显示跟随鼠标的预览。

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
气泡与尾部的尺寸、位置和形状全程固定，只让“这是我的正面”“这是我的侧面”“这是我的背面”
逐字变化。进入每个视角阶段时文字从左到右逐字补全，在主角度附近短暂停留；离开阶段时再按
相反顺序逐字清空，边界清空后下一阶段才开始打字。`0 / 1` 为完整正面，`0.25 / 0.75` 为
完整侧面，`0.5` 为完整背面，反向滚动严格回放同一字符状态。稳定占位继续供逐行环绕计算使用，
正文不会因文字长度变化来回摆动。React 不接收逐帧 state，DOM 只在 requestAnimationFrame
内按整数个字符更新透明度；reduced-motion 固定为完整正面。中英文各有同义文案。

## 空间链路

### 第二章：扇面目录与文章纸卡

第二章使用同一 `hero.chapter-2.body` 进度驱动阅读器。左侧矩形标题沿圆弧进入和离开
阅读视窗，中部标题放大并反相选中；右侧每篇文章是一张不同宽高的完整纸卡。首张直接落位，
后续纸卡从视窗右侧沿二次贝塞尔弧线进入，途中轻微侧倾，落位时回正并盖在旧卡上。
旧卡保持原有尺寸与位置，宽高差露出底层卡片，不再折叠为纸边。四边采用邮票式半圆齿孔，
缺口真正透出底层纸卡；`stamp.ts` 统一齿孔间距、半径和四边几何，实时 shader 与首尾 atlas 共用。
滚动进度直接驱动目录和入栈，不再切成固定停顿和短促的缓动切换；停止滚动即可停下阅读。
无溢出的最后一篇落位后直接进入章节回程，不额外占用一整段无交互滚动。
反向滚动让顶层卡沿原路径退回右侧，由同一纯函数还原，未加入鼠标驱动或点击选择。

`src/axioms/layout.ts` 负责响应式几何，`frame.ts` 负责可逆进度，`artwork.ts` 组合排版，
`typography.ts` 负责文字测量与换行，`canvas.ts` 负责首尾帧绘制。
中文、英文共用内容模型，标题完整换行；引言的实际高度决定下方阅读区域起点。窄屏文章超出
纸卡时，仅按实际溢出高度分配阅读距离，同一滚动进度先移动卡内文本，完整读到末行，
再进入下一篇；正文完整容纳时不保留无反馈的阅读停顿。
reduced-motion 保留全部命题、阅读和首尾堆叠构图，目录选择与新卡落位直接切换，移除连续圆弧和侧倾。

`HeroAxiomsReader.tsx` 保留完整标题与文章 DOM 语义，并声明一个加入原 scene/pass 的
managed `WebGLTarget`。`effect.ts` / `program.ts` 通过 public material-layer facade
绘制扇面、纸卡和文字，使用既有双色；纹理只在 viewport / locale 改变时生成，滚动只更新
几何与阅读偏移 uniform。`texture.ts` 从实际 tile 数量计算网格，`program.ts` 从实际文章
数量生成 shader 数组与循环，不再固定四篇或九格。没有额外 renderer、scene、pass、显示 canvas、鼠标事件或 React
逐帧状态。第二章 lead/tail atlas 与阅读器共用排版和首尾帧，分别显示首张纸卡与最后一篇在顶层的完整卡堆。
图集打包时预先计算每格的精确起点，Canvas 绘制与 shader 采样共用 `tileOrigins`；
不在 GPU 中通过浮点取模和向下取整重新推导行列，避免行首格被采样到空白位置。
第一章的固定气泡现只在第一章正文可见，避免进入阅读器后仍悬在上方。
切换语言会在语义 DOM 更新后刷新所有章节的滚动触发位置，避免前章英文排版高度变化导致
第二章提前退场。阅读 surface 使用 `100vw` 与 atlas 的视口宽度保持一致，包括系统滚动条可见时。

#### 扩展文章

- 在 `src/axioms/content.ts` 的 `heroAxiomsArticles` 数组中新增、删除或调整记录顺序；
  每条记录包含唯一且稳定的 `id` 和 `translations.zh / translations.en`，
  每种语言填写 `label / title / body`。两种语言从同一列表派生，不分别维护文章数量与顺序。
- 可选 `paper: { width: 0.92, height: 0.8 }` 指定相对可用纸卡区域的宽高比例，
  取值为 `(0, 1]`；省略时按 `config.ts` 中的尺寸组合轮换。内容更新不需要修改 shader 或 CSS。
- `config.ts` 集中每篇滚动距离、圆弧间距、入场弧线/侧倾、邮票齿孔和纹理预算等视觉参数。
  正文高度为一屏加每篇 `0.9` 屏的滚动距离；当前四篇为 `460svh`，实际滚动段为 `3.6` 屏。
  `frame.ts` 依据排版得到的溢出高度分配阅读段，其余进度连续驱动入栈，无额外时间动画或二次缓动。
  远端标题只显示圆弧的正面半圆；已到达纸卡保持固定落位，未来纸卡不绘制，文章增多不会绕回目录或无限堆出视窗。
- React 由内容 props 派生正文高度，以文章 ID 作为 key；换序与语言切换保留文章节点。
  `reader.ts` 是章节数据与通用排版之间的适配层，首尾 atlas 和实时效果共用这一入口。
  不增加冗余派生 state、逐帧 React 更新或文章专用事件监听。

已覆盖空列表、单篇、4、7、12 篇的纯逻辑与纹理布局。12 篇的浏览器证据来自此前模块化阶段，
本次邮票边与连续入栈的浏览器验证使用交付的四篇内容，不视为当前 12 篇像素验收。
当前采用一次打包的文字纹理与按篇数生成的 uniform 数组，不声称无限列表：
若增长为大规模文章库，应另行引入分页或按需纹理窗口，避免纹理清晰度与 GPU uniform 预算下降。

### 第三章：四面项目空间

宽度大于 `900px` 且主指针支持 hover/fine 的桌面端，将四个项目按内容顺序放在围合空间的四面墙上。
鼠标在中央移动产生轻微视角与位置视差；进入左右边缘时转向相邻墙面，回到中央后重新允许下一次转向。
停留边缘不会连续翻面。底部项目按钮与左右按钮支持键盘选择，当前墙面落稳后提供对应仓库的真实 DOM 链接。
控件 hover 或键盘焦点锁住鼠标视差，避免阅读或点击时目标继续移动。

空间通过既有 scene/pass 中的一个 managed surface 绘制，使用同一 runtime 的标准化 pointer 输入。
`src/projects/room.ts` 管理纯导航计算与低频语义状态，`effect.ts` 保留逐帧姿态，`program.ts` 投影视线与四面墙、
地面和顶面的交点；项目中英文内容仍来自 `src/chapters/content.ts`。文字以 `2×` 分辨率预排为一张
`4096×2880` 纹理，旋转只更新 uniform。正文与 DOM 语义保持完整，不增加原生 Three 对象或第二个显示 canvas。

桌面 body 使用 `280svh`；首尾各 `12%` 的 body progress 收束到第一面正前方，正文中段允许自由探索。
所选墙面在退出后保留，反向返回正文中段时恢复；滚动只控制收束权重，不能单独决定探索中的墙面与视差。
首尾 face atlas 都由同一墙面文字纹理和投影参数生成，侧墙按实际源条带裁切绘制，避免越界纹理复制。
reduced-motion 下取消鼠标视差和插值转向，通过项目按钮直接选择。

移动端、窄屏和无精细鼠标的设备保持普通项目正文与链接；不启用空间交互，不创建项目空间文字纹理。
媒体条件变化会刷新 atlas 和正文滚动布局。WebGL surface 尚未就绪时保留普通 DOM 内容作为 fallback。

### 第四章：公共入口与跟随预览

桌面端以抖音、小红书、哔哩哔哩、博客、GitHub 五行大字作为正文，保持既有双色与 Arial / Helvetica 字体。
每行居中组合平台、AXMORF／栏目名和账号信息；`1440×900` 中文主字号为 `99px`，英文按较长名称收敛字号。
`src/chapters/content.ts` 的 `directory` 提供名称和账号，`link` 提供当前行的原生跳转，`image` 提供二维码原图与本地化替代文本。
只有 `(min-width: 901px) and (hover: hover) and (pointer: fine)` 启用预览；整行文字、空白与箭头都持续驱动同一个窗口。
窗口首帧直接定位，之后以 `transform` 和 `120ms` ease-out 缓动跟随鼠标，换行时复用窗口并更换内容，边缘连续限位。
预览不拦截指针，点击当前行或键盘 Enter 直接打开主页。没有点击固定或二次确认；reduced-motion 下取消位置缓动。
鼠标离开目录、焦点离开、Escape 或视口变化关闭预览。滚动时按当前指针位置重新命中检测：仍在当前行上则保留窗口，移出当前行才关闭，避免章节进入或布局刷新触发的滚动事件造成首次闪烁。

窄屏和无悬停／粗指针设备直接展示纵向内容列表：平台名、账号、三张完整二维码以及博客／GitHub 简介常显，整项均可点击跳转。
此模式取消 sticky 单屏目录、反相悬停、跟随窗口和鼠标操作提示，也不会因键盘聚焦而打开预览。
三个视频平台使用用户提供的 AXMORF 主页；抖音与小红书为 `Cognition_hub`，B 站 UID 为 `269573670`。
`public/channels/` 的原图不裁剪、不重新编码、不做主题反色；二维码保留供平台 App 扫描。

桌面正文使用 `180svh` 区域与 `100svh` sticky 目录，完整进入后保留 `80svh` 的浏览滚动距离，再触发离场；首尾 atlas 都绘制同一居中长行目录。
移动正文自然展开，入口与出口分别绘制列表开头和结尾；`resolveSignalsMobileLayout` 与 CSS 共用排版尺寸。
Atlas 复用已加载的语义图片，图片就绪或输入模式变化时更新，不另建图片加载器；组件卸载时释放图片引用。
`src/signals/` 拥有交互、布局、图片引用与端点绘制。DOM pointer move 不进入 React state，无额外渲染器或动画时间线。

### 共用进出场

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

atlas 仍保持四个面的一份结构真值，每章预先打包 lead 与 tail 两个 tile。普通 DOM 正文的 lead
读取章节计数、title 与 intro，tail 读取最后卡片与 closing；第二章分别读取阅读器首尾帧，
第三章桌面模式的两个端点都读取第一面正前方构图，移动端保留普通正文首尾；第四章首尾共用未选中的五行入口。Atlas 与语义 DOM 共用同一套响应式
几何；第一章还共用居中双列、均衡标题、人物保护椭圆和圆角长方形正面对话框，因此三角面完整
覆盖后不会突然出现气泡或切换成另一套排版。每个 tile 在自己的像素边界内独立裁剪，长文案即使
超出当前格也不会污染相邻章节或 lead/tail 格；第一章尾段的高度恰好补齐正文底部视口，最后一段
会在回程边界前自然离场，closing、人物与对话框则在 DOM/Atlas 两侧保持同一视口中心。
exit 只切换 shader 内的 tile 选择，不因滚动重建或重新上传纹理；缓存随 viewport、locale
或项目空间媒体条件变化而失效。目标面的 face-space 投影 UV 仍按 approach 连续插值，在 Hub 边界归零，
因此章节 ID 换面不会造成纹理坐标跳变。

两侧文案由同一 hero scene 内、位于四面体之后的 DOM-text targets 显示。文案逐字形透明度
与横向位移读取同一 progress store，四面体扩大时通过真实深度自然遮住它们；React 只在
`site → site+content → contentId` 这些语义边界，以及 locale、viewport 或样式标识变化时
挂载或更换内容，不接收逐帧滚动状态。locale 与 viewport 变化会重挂载文字 target，
让 runtime 为变化后的文字尺寸创建新的受管纹理。
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
- `src/axioms/` 独立拥有第二章文章数据、排版、阅读进度与纸卡效果；实时阅读器和章节 atlas
  通过 `reader.ts` 共用内容适配，通过 `stamp.ts` 共用邮票边几何；
- `src/signals/` 拥有第四章链接语义、鼠标预览和首尾目录绘制，文案与目标地址仍由章节内容模块提供；
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
仓库内版本为 `1,824,732` bytes、`449,954` triangles，使用 Draco 几何压缩与 `1024px`
WebP 纹理，在不增加传输体积的前提下保留更多轮廓细节。人物材质忽略资产中接近中性的
normal map，以几何法线获得更干净的表面；最终颜色保留大部分 PBR 光照，并以 `32%` 底色
柔化高光，粗糙度设为 `0.72`，避免全哑光的粉笔感和低粗糙度的硬塑料感。材质基色在两种
主题下都固定使用 light token `#B8B8B8`，不再乘上 committed background；因此反色章节不会
把贴图从浅灰突然压到 `#5F5F5F`，默认主题的既有曝光也保持不变。源文件保持不变且不进入
仓库。第四章的三个视频平台地址与二维码由用户提供，直接链接及账号信息共用章节内容声明。

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

## 维护边界

- 不增加第二 runtime、renderer 或 canvas；
- 不用 CSS mask/clip 替代 WebGL 三角转场；
- 不把逐帧进度放入 React state；
- 不把 app key、文案、资产或布局规则下沉到 package；
- 内容、链接与个人模型继续在 hero-next app 边界内替换；模型迭代不得增加覆盖四面体的
  额外 pass。
