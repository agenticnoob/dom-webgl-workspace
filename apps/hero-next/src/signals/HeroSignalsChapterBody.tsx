import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React, { useEffect, useRef, useState } from "react";
import type { HeroChapterBodyProps } from "../chapters/HeroChapter";
import type { HeroLocale } from "../preferences/locale";
import { resolveSignalPreviewPosition } from "./layout";

export function HeroSignalsChapterBody({
  definition,
  content,
  locale,
}: HeroChapterBodyProps & { readonly locale: HeroLocale }) {
  const [selection, setSelection] = useState<number | null>(null);
  const preview = useRef<HTMLSpanElement>(null);
  const point = useRef({ x: 0, y: 0 });
  const bodyId = `chapter-${definition.ordinal}-body`;
  const zh = locale === "zh";

  function positionPreview() {
    const element = preview.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const position = resolveSignalPreviewPosition(
      point.current,
      { width: window.innerWidth, height: window.innerHeight },
      { width, height },
    );
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
  }

  useEffect(() => {
    if (selection === null) return;
    const dismiss = () => setSelection(null);
    window.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener("resize", dismiss, { passive: true });
    return () => {
      window.removeEventListener("scroll", dismiss);
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
        onKeyDown={(event) => {
          if (event.key === "Escape") setSelection(null);
        }}
      >
        <header className="hero-signals__heading">
          <span>04 / {zh ? "在别处，继续" : "ELSEWHERE"}</span>
          <h2 id={bodyId}>{content.body.title}</h2>
        </header>
        <div className="hero-signals__directory">
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
              aria-disabled={!item.link || undefined}
              data-selected={selection === index}
              onPointerEnter={(event) => {
                if (event.pointerType === "touch") return;
                point.current = { x: event.clientX, y: event.clientY };
                setSelection(index);
              }}
              onPointerLeave={() => setSelection(null)}
              onFocus={(event) => {
                if (!event.currentTarget.matches(":focus-visible")) return;
                const rect = event.currentTarget.getBoundingClientRect();
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
              <span
                className="hero-signals__label"
                onPointerMove={(event) => {
                  if (event.pointerType === "touch") return;
                  point.current = { x: event.clientX, y: event.clientY };
                  positionPreview();
                }}
              >
                {item.title}
              </span>
              <span className="hero-signals__arrow" aria-hidden="true">
                {item.link ? "↗" : "·"}
              </span>
              {selection === index && (
                <span
                  className="hero-signals__preview"
                  ref={(element) => {
                    preview.current = element;
                    if (element) positionPreview();
                  }}
                >
                  <span className="hero-signals__preview-top">
                    {item.label}
                  </span>
                  <span className="hero-signals__preview-title">
                    {item.title}
                  </span>
                  <span className="hero-signals__preview-copy">
                    {item.body}
                  </span>
                  <span className="hero-signals__preview-action">
                    {item.link
                      ? `${item.link.label} ↗`
                      : zh
                        ? "链接待补充"
                        : "Link coming soon"}
                  </span>
                </span>
              )}
            </a>
          ))}
        </div>
        <footer className="hero-signals__footer">
          <span>{content.body.closing}</span>
          <span>
            {zh ? "悬停预览 · 点击前往" : "Hover to preview · Click to visit"}
          </span>
        </footer>
      </div>
    </WebGLScrollTimeline>
  );
}
