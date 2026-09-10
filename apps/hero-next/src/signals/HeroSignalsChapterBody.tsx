import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { HeroChapterBodyProps } from "../chapters/HeroChapter";
import type { HeroLocale } from "../preferences/locale";
import { resolveSignalPreviewPosition, signalsHoverEnabled } from "./layout";
import { setSignalImage, removeSignalImage } from "./images";
import type { HeroChapterBodyContent } from "../chapters/content";

export function HeroSignalsChapterBody({
  definition,
  content,
  locale,
}: HeroChapterBodyProps & { readonly locale: HeroLocale }) {
  const [selection, setSelection] = useState<number | null>(null);
  const preview = useRef<HTMLSpanElement>(null);
  const hoveredRow = useRef<HTMLAnchorElement | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const bodyId = `chapter-${definition.ordinal}-body`;
  const zh = locale === "zh";
  const selectedItem =
    selection === null ? undefined : content.body.sections[selection];

  function positionPreview() {
    const element = preview.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const position = resolveSignalPreviewPosition(
      point.current,
      { width: window.innerWidth, height: window.innerHeight },
      { width, height },
    );
    element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }

  useEffect(() => {
    if (selection === null) return;
    const dismiss = () => setSelection(null);
    const handleScroll = () => {
      // Entry/refresh scroll events can fire while the pointer stays on a row.
      if (
        hoveredRow.current?.contains(
          document.elementFromPoint(point.current.x, point.current.y),
        )
      )
        return;
      dismiss();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", dismiss, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", dismiss);
    };
  }, [selection]);

  return (
    <WebGLScrollTimeline
      as="section"
      id={`${bodyId}-timeline`}
      progressKey={definition.signals.body}
      className="hero-chapter__body hero-signals"
      start="top top"
      end="bottom bottom"
      scrub
      aria-labelledby={bodyId}
    >
      <div
        className="hero-signals__stage"
        lang={locale}
        onKeyDown={(event) => {
          if (event.key === "Escape") setSelection(null);
        }}
      >
        <header className="hero-signals__heading">
          <span>04 / {zh ? "在别处，继续" : "ELSEWHERE"}</span>
          <h2 id={bodyId}>{content.body.title}</h2>
        </header>
        <div
          className="hero-signals__directory"
          onPointerLeave={() => setSelection(null)}
        >
          {content.body.sections.map((item, index) => (
            <a
              key={item.title}
              className="hero-signals__row"
              href={item.link?.href}
              target={item.link ? "_blank" : undefined}
              rel={item.link ? "noreferrer" : undefined}
              role={item.link ? undefined : "link"}
              tabIndex={0}
              aria-label={item.title}
              aria-description={item.body}
              aria-disabled={!item.link || undefined}
              data-selected={selection === index}
              onPointerEnter={(event) => {
                if (event.pointerType === "touch" || !signalsHoverEnabled())
                  return;
                point.current = { x: event.clientX, y: event.clientY };
                hoveredRow.current = event.currentTarget;
                setSelection(index);
              }}
              onPointerMove={(event) => {
                if (event.pointerType === "touch" || !signalsHoverEnabled())
                  return;
                point.current = { x: event.clientX, y: event.clientY };
                // The first reveal starts at the pointer; only later moves ease.
                if (preview.current) preview.current.dataset.following = "true";
                positionPreview();
              }}
              onFocus={(event) => {
                if (
                  !signalsHoverEnabled() ||
                  !event.currentTarget.matches(":focus-visible")
                )
                  return;
                const rect = event.currentTarget.getBoundingClientRect();
                hoveredRow.current = null;
                point.current = {
                  x: rect.right - 24,
                  y: rect.top + rect.height / 2,
                };
                setSelection(index);
              }}
              onBlur={() => setSelection(null)}
              onClick={(event) => {
                if (!item.link) event.preventDefault();
                setSelection(null);
              }}
            >
              <span className="hero-signals__label">
                <span className="hero-signals__title">{item.title}</span>
                {item.directory && (
                  <>
                    <span
                      className="hero-signals__separator"
                      aria-hidden="true"
                    >
                      {" "}
                      ·{" "}
                    </span>
                    <span className="hero-signals__name">
                      {item.directory.name}
                    </span>
                  </>
                )}
              </span>
              {item.directory && (
                <span className="hero-signals__detail">
                  {item.directory.detail}
                </span>
              )}
              {item.image ? (
                <HeroSignalInlineImage image={item.image} />
              ) : (
                <span className="hero-signals__inline-copy">{item.body}</span>
              )}
              <span className="hero-signals__arrow" aria-hidden="true">
                {item.link ? "↗" : "·"}
              </span>
            </a>
          ))}
          {selectedItem && (
            <span
              className="hero-signals__preview"
              aria-hidden="true"
              data-has-image={Boolean(selectedItem.image)}
              ref={(element) => {
                preview.current = element;
                if (element) positionPreview();
              }}
            >
              <span className="hero-signals__preview-top">
                {selectedItem.label}
              </span>
              {selectedItem.image ? (
                <Image
                  className="hero-signals__preview-image"
                  src={selectedItem.image.src}
                  width={selectedItem.image.width}
                  height={selectedItem.image.height}
                  alt={selectedItem.image.alt}
                  unoptimized
                  onLoad={positionPreview}
                />
              ) : (
                <span className="hero-signals__preview-title">
                  {selectedItem.title}
                </span>
              )}
              <span className="hero-signals__preview-copy">
                {selectedItem.body}
              </span>
              <span className="hero-signals__preview-action">
                {selectedItem.link
                  ? zh
                    ? "点击当前行前往主页 ↗"
                    : "Click the row to visit ↗"
                  : zh
                    ? "链接待补充"
                    : "Link coming soon"}
              </span>
            </span>
          )}
        </div>
        <footer className="hero-signals__footer">
          <span>{content.body.closing}</span>
          <span>
            <span className="hero-signals__hover-hint">
              {zh ? "移动预览 · 点击前往" : "Move to preview · Click to visit"}
            </span>
            <span className="hero-signals__touch-hint">
              {zh ? "点击内容，前往主页 ↗" : "Tap to visit the profile ↗"}
            </span>
          </span>
        </footer>
      </div>
    </WebGLScrollTimeline>
  );
}

function HeroSignalInlineImage({
  image,
}: {
  readonly image: NonNullable<
    HeroChapterBodyContent["sections"][number]["image"]
  >;
}) {
  const element = useRef<HTMLImageElement | null>(null);
  const attach = useCallback(
    (next: HTMLImageElement | null) => {
      if (element.current) removeSignalImage(image.src, element.current);
      element.current = next;
      if (next) setSignalImage(image.src, next);
    },
    [image.src],
  );
  return (
    <Image
      className="hero-signals__inline-image"
      ref={attach}
      src={image.src}
      width={image.width}
      height={image.height}
      alt={image.alt}
      unoptimized
      onLoad={(event) => setSignalImage(image.src, event.currentTarget)}
    />
  );
}
