import { recipeCatalog } from "../recipes/catalog";

/** What draws the effect: the DOM stays the content either way. */
export type CatalogRendering = "WebGL" | "WebGL + DOM" | "DOM";

export type CatalogEntry = {
  readonly name: string;
  /** Component or technique to look for in the source. */
  readonly source: string;
  readonly href: string;
  readonly rendering: CatalogRendering;
};

export type CatalogGroup = {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly entries: readonly CatalogEntry[];
};

const oneTake: CatalogGroup = {
  id: "one-take",
  title: "一镜到底组件",
  note: "整页滚动特效，单文件复制使用，随 skill 发布。",
  entries: [
    { name: "镜头轨道与章节转场", source: "OneTakeRail", href: "/showcase.html", rendering: "WebGL" },
    { name: "开场逐格转入", source: "IntroReveal", href: "/showcase.html", rendering: "WebGL" },
    { name: "网格画廊悬停显现", source: "GalleryReveal", href: "/showcase.html", rendering: "WebGL + DOM" },
    { name: "粒子形体", source: "ParticleForm", href: "/showcase.html", rendering: "WebGL" },
    { name: "产品转台与标注", source: "ProductTurntable", href: "/showcase.html", rendering: "WebGL + DOM" },
    { name: "逐字归位与颗粒溶解", source: "GlyphScatter", href: "#glyphs", rendering: "WebGL" },
    { name: "指针墨迹流体", source: "InkField", href: "#glass", rendering: "WebGL" },
    { name: "折射玻璃标题", source: "GlassTitle", href: "#glass", rendering: "WebGL" },
  ],
};

const site: CatalogGroup = {
  id: "site",
  title: "站点组件",
  note: "放进 Drei View 的整块界面，带键盘访问和降级。",
  entries: recipeCatalog.map((recipe) => ({
    name: recipe.title,
    source: recipe.component,
    href: `/effects.html#${recipe.id}`,
    rendering: recipe.rendering,
  })),
};

const basics = (
  anchor: string,
  rendering: CatalogRendering,
  source: string,
  names: readonly string[],
) =>
  names.map(
    (name): CatalogEntry => ({ name, source, href: `/effects.html#${anchor}`, rendering }),
  );

const basic: CatalogGroup = {
  id: "basic",
  title: "基础效果",
  note: "单个元素的写法示例：表面、文字、媒体、模型和滚动。",
  entries: [
    ...basics("surfaces", "WebGL + DOM", "CanvasTexture", ["表面填充", "表面脉冲", "Ghost Cursor", "Waves 背景", "视频背景纹理"]),
    ...basics("stage", "WebGL + DOM", "R3F", ["灯光与舞台几何", "滚动驱动模型动画", "固定滚动 3D 舞台", "场景内拾取", "Rapier 物理"]),
    ...basics("text", "WebGL + DOM", "CanvasTexture", ["文字波浪", "文字显现", "文字聚光", "文字压感", "文字扰码", "文字组合"]),
    ...basics("media", "WebGL + DOM", "Texture", ["图片平移", "图片缩放", "镜头推进", "图片悬停叠层", "视频播放", "视频漂移"]),
    ...basics("scroll", "WebGL + DOM", "ScrollEffectSection", ["滚动图片序列", "固定滚动显现"]),
    ...basics("models", "WebGL", "useGLTF", ["模型旋转", "模型浮动", "模型自发光"]),
  ],
};

export const siteCatalog: readonly CatalogGroup[] = [oneTake, site, basic];

export const catalogCount = siteCatalog.reduce(
  (total, group) => total + group.entries.length,
  0,
);
