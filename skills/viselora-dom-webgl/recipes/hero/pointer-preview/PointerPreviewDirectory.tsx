import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  pointerPreviewMinimumWidth,
  pointerPreviewQuery,
  resolvePointerPreviewPosition,
  type PreviewPoint,
} from "./layout";
import type { PointerPreviewDirectoryProps } from "./types";
import "./pointer-preview.css";

/** DOM companion; it can run without a WebGL runtime or scroll adapter. */
export function PointerPreviewDirectory({
  id,
  items,
  title = "Directory",
  intro,
  footer,
  className,
}: PointerPreviewDirectoryProps) {
  const generatedId = useId();
  const directoryId = id ?? generatedId;
  const [selection, setSelection] = useState<string | null>(null);
  const container = useRef<HTMLElement | null>(null);
  const preview = useRef<HTMLSpanElement | null>(null);
  const hoveredRow = useRef<HTMLAnchorElement | null>(null);
  const point = useRef<PreviewPoint>({ x: 0, y: 0 });
  const capability = useRef({ enabled: false, reduced: false });
  const frame = useRef(0);
  const selectedItem = items.find((item) => item.id === selection);

  const positionPreview = useCallback(() => {
    const root = container.current;
    const element = preview.current;
    if (!root || !element) return;
    const bounds = root.getBoundingClientRect();
    const size = element.getBoundingClientRect();
    const position = resolvePointerPreviewPosition(
      { x: point.current.x - bounds.left, y: point.current.y - bounds.top },
      bounds,
      size,
    );
    element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }, []);
  const dismiss = useCallback(() => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    hoveredRow.current = null;
    setSelection(null);
  }, []);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const pointer = window.matchMedia(pointerPreviewQuery);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      capability.current = {
        enabled:
          pointer.matches &&
          root.getBoundingClientRect().width >= pointerPreviewMinimumWidth,
        reduced: reduced.matches,
      };
      root.dataset.enhanced = String(capability.current.enabled);
      dismiss();
    };
    const handleScroll = () => {
      const hovered = hoveredRow.current;
      if (
        hovered &&
        hovered.contains(
          document.elementFromPoint(point.current.x, point.current.y),
        )
      ) {
        positionPreview();
      } else dismiss();
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(refresh);
    observer?.observe(root);
    pointer.addEventListener("change", refresh);
    reduced.addEventListener("change", refresh);
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    refresh();
    return () => {
      disposed = true;
      observer?.disconnect();
      pointer.removeEventListener("change", refresh);
      reduced.removeEventListener("change", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", handleScroll, true);
      if (frame.current) window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [dismiss, positionPreview]);

  useEffect(() => {
    // Content may change under the same item ID while its preview stays open.
    if (selectedItem) positionPreview();
  }, [selectedItem, positionPreview]);

  const attachPreview = useCallback(
    (element: HTMLSpanElement | null) => {
      preview.current = element;
      if (element) positionPreview();
    },
    [positionPreview],
  );

  return (
    <section
      id={directoryId}
      ref={container}
      className={["recipe-preview", className].filter(Boolean).join(" ")}
      aria-labelledby={`${directoryId}.heading`}
      onKeyDown={(event) => {
        if (event.key === "Escape") dismiss();
      }}
    >
      <header className="recipe-preview__header">
        <h2 id={`${directoryId}.heading`}>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </header>
      <ul className="recipe-preview__directory" onPointerLeave={dismiss}>
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              className="recipe-preview__row"
              href={item.href}
              aria-describedby={`${directoryId}.description.${index}`}
              data-selected={selection === item.id}
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "touch" ||
                  !capability.current.enabled
                )
                  return;
                hoveredRow.current = event.currentTarget;
                const rect = event.currentTarget.getBoundingClientRect();
                point.current = capability.current.reduced
                  ? { x: rect.right - 320, y: rect.top + rect.height / 2 }
                  : { x: event.clientX, y: event.clientY };
                setSelection(item.id);
              }}
              onPointerMove={(event) => {
                if (
                  event.pointerType === "touch" ||
                  !capability.current.enabled ||
                  capability.current.reduced
                )
                  return;
                point.current = { x: event.clientX, y: event.clientY };
                if (preview.current) preview.current.dataset.following = "true";
                if (!frame.current) {
                  frame.current = window.requestAnimationFrame(() => {
                    frame.current = 0;
                    positionPreview();
                  });
                }
              }}
              onFocus={(event) => {
                if (
                  !capability.current.enabled ||
                  !event.currentTarget.matches(":focus-visible")
                )
                  return;
                const rect = event.currentTarget.getBoundingClientRect();
                hoveredRow.current = null;
                point.current = {
                  x: rect.right - 320,
                  y: rect.top + rect.height / 2,
                };
                setSelection(item.id);
              }}
              onBlur={dismiss}
              onClick={dismiss}
            >
              <span className="recipe-preview__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="recipe-preview__title">{item.title}</span>
              {item.detail ? (
                <span className="recipe-preview__detail">{item.detail}</span>
              ) : null}
              <span
                className="recipe-preview__inline-copy"
                id={`${directoryId}.description.${index}`}
              >
                {item.description}
              </span>
              {item.image ? (
                <img
                  className="recipe-preview__inline-image"
                  src={item.image.src}
                  alt={item.image.alt}
                  width={item.image.width}
                  height={item.image.height}
                  loading="lazy"
                />
              ) : null}
              <span className="recipe-preview__arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
      {selectedItem ? (
        <span
          key={selectedItem.id}
          ref={attachPreview}
          className="recipe-preview__floating"
          aria-hidden="true"
        >
          {selectedItem.label ? (
            <span className="recipe-preview__preview-label">
              {selectedItem.label}
            </span>
          ) : null}
          {selectedItem.image ? (
            <img
              className="recipe-preview__image"
              src={selectedItem.image.src}
              alt=""
              width={selectedItem.image.width}
              height={selectedItem.image.height}
              onLoad={positionPreview}
            />
          ) : (
            <span className="recipe-preview__preview-title">
              {selectedItem.title}
            </span>
          )}
          <span className="recipe-preview__preview-copy">
            {selectedItem.description}
          </span>
        </span>
      ) : null}
      {footer ? (
        <footer className="recipe-preview__footer">{footer}</footer>
      ) : null}
    </section>
  );
}
