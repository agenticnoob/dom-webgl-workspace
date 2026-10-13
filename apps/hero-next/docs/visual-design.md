# Hero Next Visual Design

**状态：** 四章内容基础版本已在既有四面体视觉体系上实现，文案与外部入口可继续替换。
第一章个人 GLB 与环绕式叙事已经接入，但不代表最终文案或移动端真机多浏览器验收。

## R3F Runtime 迁移

当前工作区以 React Three Fiber 管理唯一 Canvas、renderer 和帧循环。四面体、背景、人物、
文章阅读器与项目空间使用原生 Three.js 对象及 `useFrame`；Runtime 仅提供 DOM 绑定、
测量、fallback、可用状态和共享滚动输入。文章图集、四面体 GLSL、可逆滚动数学与语义正文继续由 app 持有。
Portal 使用 Runtime 的 DOM text texture 快照与原生 MeshBasicMaterial，主题、语言、视口或字体
变化会更新快照。人物通过 Drei `useGLTF` 加载，并由局部 Suspense/ErrorBoundary 处理加载与错误。
app 仅释放自己创建的图集纹理、ShaderMaterial 和模型材质副本，不释放共享 GLB 缓存。
Canvas 不可用时 Portal 恢复 DOM，所有章节解除过渡期隐藏并恢复有对比度的章节底色，
文章章节恢复完整可读正文。项目章节同时检查 Runtime 可用状态与本地 room readiness，
因此 context 丢失而 scene 仍挂载时，普通项目链接也会恢复显示和键盘访问。

原 Runtime 隐式添加的环境光与方向光现在显式声明在应用场景中，继续影响标准材质与人物模型。
当前验证范围见本文的 [验证边界](#当前验证边界)。

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

`HeroAxiomsReader.tsx` 保留完整标题与文章 DOM 语义，`HeroAxiomsScene.tsx` 在原生 R3F
场景中组合 mesh 与 ShaderMaterial。`effect.ts` 创建文字图集，`program.ts` 定义 shader，
绘制扇面、纸卡和文字并使用既有双色；纹理只在 viewport / locale 改变时生成，滚动只更新
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

空间由 `HeroProjectRoomScene.tsx` 在同一 R3F scene 中用原生 mesh 与 ShaderMaterial 绘制，
直接读取 R3F 的标准化 pointer。`src/projects/room.ts` 管理纯导航计算与低频语义状态，
场景组件持有逐帧姿态，`program.ts` 投影视线与四面墙、地面和顶面的交点。
项目中英文内容仍来自 `src/chapters/content.ts`，文字以 `2×` 分辨率预排为一张
`4096×2880` 纹理，旋转只更新 uniform。正文与 DOM 语义保持完整，app 释放自有纹理与材质。

桌面 body 使用 `280svh`；首尾各 `12%` 的 body progress 收束到第一面正前方，正文中段允许自由探索。
所选墙面在退出后保留，反向返回正文中段时恢复；滚动只控制收束权重，不能单独决定探索中的墙面与视差。
首尾 face atlas 都由同一墙面文字纹理和投影参数生成，侧墙按实际源条带裁切绘制，避免越界纹理复制。
reduced-motion 下取消鼠标视差和插值转向，通过项目按钮直接选择。

移动端、窄屏和无精细鼠标的设备保持普通项目正文与链接，不启用空间交互。
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
   四面体的一侧淡入各自左右锚点；两组文字除相反横向路径外，还在原生 Three.js plane 上
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
让 Portal 场景为变化后的文字尺寸重新调用 DOM text texture 工具，并释放旧纹理。
内容序列统一建模为网站介绍、四个章节和最终联系方式，Portal 场景只消费通用 `contentId`、
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
读取 R3F viewport pointer，在原生
Three.js plane 上以阻尼俯仰/偏航形成视差；reduced-motion 下两类视差均归零。

## 合成与 ownership

- 页面只有一个 `WebGLScrollRuntime` host 和一个 R3F Canvas；
- 人物通过 Drei `useGLTF` 加载，克隆对象与材质后加入原生 R3F scene；共享 GLB 缓存保持独立；
- `src/chapters/definitions.ts` 是章节顺序、scroll signals、四面体 face 与 atlas slot
  的唯一结构真值；
- `src/chapters/scrollState.ts` 是 entry/exit progress 到章节视觉阶段的唯一纯映射；
- `src/chapters/geometry.ts` 根据 active face 解析相机空间姿态和投影；
- `src/chapters/layout.ts` 是 atlas 的响应式布局模型；
- `src/chapters/atlas.ts` 从当前 locale 的四章正文生成四个面的 app-owned CanvasTexture；
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
  `HeroPortalStage.tsx` 负责低频 DOM 挂载，`HeroPortalScene.tsx` 持有原生 mesh、材质和纹理，
  `portalEffect.ts` 提供位移、透明度与视差纯计算；
- CSS 保留既有背景、前景、章节反相、stacking 与 pointer routing，不用 `clip-path`
  或第二个三角形冒充 WebGL 转场。

应用通过 public package entrypoints 使用 Runtime，并直接拥有原生 R3F/Three.js 视觉对象。
保持一个 renderer 和 Canvas，不增加 Hero 专用 package 分支。

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

四面体继续使用单个 MeshStandardMaterial 和应用声明的方向光，不增加
接地平面、shadow map 或重复 mesh。Hub 阶段从纯色回填中让出更多真实 PBR 光照，材质改为
中等金属度与更高粗糙度，并把 rim 调到 key 的对向，因此四个平面产生更明确的明暗分区与
模拟自阴影。同一材质通过 onBeforeCompile 额外叠加基于视角法线的 Fresnel 边缘光，并降低
纯色回填与 emissive 强度以释放更多 PBR 对比；边缘光随目标面 screen lock 渐进归零，锁定后
仍回到完整章节色，保证 Atlas/DOM 接管时的色彩一致。
鼠标光在 Hub 保留原强度，但 entry 随滚动把背景光斑连续降到 `10%`、point light 降到
`4%`，章节内维持该上限，exit 再连续回升；因此章节中的人物与反相底色不会被鼠标补光
打得发白。

## 当前验证边界

2026-10-14 的 React/R3F 迁移验证以当前源码和已打包公共入口为准。历史实现的测试数量、
截图尺寸与浏览器记录已归档，不用于推断当前渲染路径的效果。

- 自动化覆盖原生场景、材质、共享 Canvas、章节纯数学、双语 atlas、项目交互，以及运行中
  Canvas 不可用后恢复正文与链接；应用 typecheck 和 production build 通过。
- 本地 Chromium 在桌面 `1780×833` 与移动视口 `390×844` 核对首屏、EN 切换、长按主题、
  人物模型、文章阅读器、项目房间、Next wall 链接、reduced-motion 和反向滚动回到首屏。
  保持单 Canvas、没有横向溢出或 console error；补齐原场景灯光后，人物材质与环绕正文正常显示。
- 章节深度写入修复后，Axioms 与 Projects 前景正确遮挡后方 Portal 文案，两个视口均复核。
- 使用 `WEBGL_lose_context` 触发真实 context 丢失后，`data-webgl-ready` 变为 `false`，
  四章均恢复 `visibility: visible` 和当前主题的章节底色；恢复 context 后 readiness 回到
  `true`，仍只有一个 Canvas，未记录到页面或控制台错误。
- 用户已查看当前运行的 demo 并接受效果。没有建立旧版与新版逐帧截图基线，因此不声明
  像素级一致；Canvas 与 DOM 的文字抗锯齿仍可能不同。
- 移动证据来自 Chromium 模拟视口；未覆盖 iOS Safari、移动真机、扫码及平台 App 唤起。
  npm 发布不代表应用已生产部署。

全仓库验证与发布状态由 [当前状态](../../../docs/STATUS.md) 统一记录。

## 维护边界

- 不增加第二 runtime、renderer 或 canvas；
- 不用 CSS mask/clip 替代 WebGL 三角转场；
- 不把逐帧进度放入 React state；
- 不把 app key、文案、资产或布局规则下沉到 package；
- 内容、链接与个人模型继续在 hero-next app 边界内替换；模型迭代不得增加覆盖四面体的
  额外 pass。
