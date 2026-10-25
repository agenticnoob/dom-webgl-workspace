import * as React from "react";

/** Anchors on the effects page; the site's catalog links to these ids. */
export const effectGroups = [
  { id: "surfaces", title: "表面", note: "把元素表面画进 CanvasTexture 或着色器。" },
  { id: "stage", title: "舞台与交互", note: "R3F 舞台、模型动画、场景内拾取和物理。" },
  { id: "text", title: "文字", note: "DOM 保留语义与布局，字形输出交给 WebGL。" },
  { id: "media", title: "图片与视频", note: "原生纹理驱动的平移、缩放、叠层和视频。" },
  { id: "scroll", title: "滚动", note: "固定区间里的图片序列和滚动显现。" },
  { id: "models", title: "模型", note: "Drei 加载，useFrame 直接控制 Object3D。" },
  { id: "site", title: "站点组件", note: "Hero Next 提炼出的整块界面，可复制进项目。" },
] as const;

export type EffectGroupId = (typeof effectGroups)[number]["id"];

export function EffectsGroup({ id }: { readonly id: EffectGroupId }) {
  const group = effectGroups.find((item) => item.id === id);
  if (!group) return null;
  return (
    <header className="effects-group" id={group.id}>
      <h2>{group.title}</h2>
      <p>{group.note}</p>
    </header>
  );
}

export function EffectsNav() {
  return (
    <nav className="effects-nav" aria-label="效果分组">
      <a className="effects-nav-home" href="/">
        ← Viselora
      </a>
      {effectGroups.map((group) => (
        <a key={group.id} href={`#${group.id}`}>
          {group.title}
        </a>
      ))}
    </nav>
  );
}
