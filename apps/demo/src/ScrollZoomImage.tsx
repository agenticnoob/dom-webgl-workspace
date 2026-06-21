import * as React from "react";
import type { ReactNode } from "react";

import { WebGLTarget } from "@project/dom-webgl-runtime/react";

export type ScrollZoomGalleryItem = {
  alt: string;
  label: string;
  src: string;
};

export type ScrollZoomImageProps = {
  alt: string;
  children?: ReactNode;
  galleryItems?: readonly ScrollZoomGalleryItem[];
  maxScale?: number;
  src: string;
  webglKey: string;
};

const defaultGalleryItems: readonly ScrollZoomGalleryItem[] = [
  {
    alt: "Layered mountain lake gallery image",
    label: "Image texture / 图片纹理",
    src: "/demo/image.png",
  },
  {
    alt: "Wide landscape cover gallery image",
    label: "Layout cover / 布局封面",
    src: "/demo/layout-cover.png",
  },
  {
    alt: "Background detail gallery image",
    label: "Zoom source / 缩放源图",
    src: "/demo/bg.png",
  },
  {
    alt: "Repeated media texture gallery image",
    label: "Runtime target / 运行时目标",
    src: "/demo/image.png",
  },
];

export function ScrollZoomImage({
  alt,
  children,
  galleryItems = defaultGalleryItems,
  maxScale = 1.72,
  src,
  webglKey,
}: ScrollZoomImageProps) {
  return (
    <section className="demo-scroll-zoom-stage">
      <WebGLTarget
        as="img"
        className="demo-scroll-card demo-scroll-card--zoom-image"
        alt={alt}
        src={src}
        webgl={{
          key: webglKey,
          source: { kind: "image", src },
          effects: [
            { kind: "demo.scrollImageZoom", maxScale },
          ],
        }}
      />
      {children ? (
        <WebGLTarget
          className="demo-scroll-zoom-content"
          webgl={{
            key: `${webglKey}.content`,
            source: { kind: "snapshot", mode: "element" },
          }}
        >
          {children}
        </WebGLTarget>
      ) : null}
      <div className="demo-scroll-zoom-gallery-viewport" aria-label="Scroll-linked image gallery">
        <div className="demo-scroll-zoom-gallery">
          {galleryItems.map((item, index) => (
            <figure className="demo-scroll-zoom-gallery-item" key={`${item.src}-${index}`}>
              <WebGLTarget
                as="img"
                className="demo-scroll-zoom-gallery-image"
                alt={item.alt}
                src={item.src}
                webgl={{
                  key: `${webglKey}.gallery.${index}`,
                  source: { kind: "image", src: item.src },
                  effects: [{ kind: "demo.scrollGallery" }],
                }}
              />
              <WebGLTarget
                as="figcaption"
                className="demo-scroll-zoom-gallery-caption"
                webgl={{
                  key: `${webglKey}.gallery.${index}.caption`,
                  source: { kind: "snapshot", mode: "text" },
                  effects: [{ kind: "demo.scrollGallery" }],
                }}
              >
                {item.label}
              </WebGLTarget>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
