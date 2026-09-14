import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { WebGLDeclaration } from "@viselora/dom-webgl";
import {
  WebGLCamera,
  WebGLPassViewport,
  WebGLScene,
  WebGLTarget,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import { resolvePaperReaderScrollHeight } from "./config";
import type { PaperReaderEffectParams } from "./effect";
import {
  defaultPaperReaderPalette,
  validatePaperReader,
  type PaperReaderProps,
} from "./model";
import { resolvePaperReaderProgress } from "./scroll";
import "./paper-reader.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const passViewport = { mode: "dom-rect", scissor: true } as const;

/** A source-distributed recipe. The caller owns the single WebGLScrollRuntime. */
export function PaperReader(props: PaperReaderProps) {
  validatePaperReader(props);
  // Runtime declarations are immutable while mounted. Data edits must rebuild the
  // target, shader capacity and texture together, even when article count changes.
  const revision = JSON.stringify([
    props.id,
    props.articles,
    props.title,
    props.description,
    props.eyebrow,
    props.palette,
  ]);
  return <PaperReaderInstance key={revision} {...props} />;
}

function PaperReaderInstance({
  id,
  articles,
  title = "Collected notes",
  description = "Scroll to turn the index and unfold each article.",
  eyebrow = "READING ROOM",
  palette = defaultPaperReaderPalette,
  className,
  height = "min(90svh, 820px)",
  stickyTop = 0,
  transcriptLabel = "Read the full text",
  onError,
}: PaperReaderProps) {
  const progressStore = useScrollEffectProgressStore();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  const [ready, setReady] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    () => true,
  );
  const animated = !reducedMotion && articles.length > 0;
  const enhanced = animated && ready;
  const progressKey = `${id}.paper-reader.progress`;
  const headingId = `${id}.paper-reader.heading`;
  const declaration = useMemo(
    () =>
      ({
        key: `${id}.paper-reader.surface`,
        source: { kind: "dom", type: "element" },
        lifecycle: { hideWhenReady: false, offscreen: { strategy: "park" } },
        effects: [
          {
            kind: "recipe.paper-reader",
            progressKey,
            content: { title, intro: description, sections: articles },
            eyebrow,
            palette,
            onReady: setReady,
            onError(error) {
              if (errorRef.current) errorRef.current(error);
              else
                console.error(
                  "PaperReader reverted to its text transcript:",
                  error,
                );
            },
          } satisfies PaperReaderEffectParams,
        ],
      }) satisfies WebGLDeclaration,
    [id, progressKey, title, description, articles, eyebrow, palette],
  );
  const render = useMemo(
    () =>
      ({
        id: `${id}.paper-reader.pass`,
        camera: `${id}.paper-reader.camera`,
        viewport: passViewport,
        clearDepth: true,
      }) satisfies WebGLSceneRenderOptions,
    [id],
  );

  useEffect(() => {
    if (!animated) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const rect = section.getBoundingClientRect();
      const stageHeight = stage.getBoundingClientRect().height;
      section.style.setProperty(
        "--paper-reader-runway",
        `${(stageHeight * resolvePaperReaderScrollHeight(articles.length)) / 100}px`,
      );
      progressStore.set(
        progressKey,
        resolvePaperReaderProgress(
          rect.top,
          rect.height,
          stageHeight,
          stickyTop,
        ),
      );
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(section);
    observer?.observe(stage);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      progressStore.clear(progressKey);
    };
  }, [
    animated,
    articles.length,
    enhanced,
    progressKey,
    progressStore,
    stickyTop,
  ]);

  const style: CSSProperties &
    Record<`--paper-reader-${string}`, string | number | undefined> = {
    "--paper-reader-stage-height":
      typeof height === "number" ? `${height}px` : height,
    "--paper-reader-sticky-top": `${stickyTop}px`,
    "--paper-reader-background": palette.background,
    "--paper-reader-foreground": palette.foreground,
  };
  return (
    <div
      className={["paper-reader", className].filter(Boolean).join(" ")}
      style={style}
    >
      <section
        ref={sectionRef}
        className="paper-reader__scroll"
        data-enhanced={enhanced}
        aria-label={title}
      >
        {animated && (
          <div
            ref={stageRef}
            className="paper-reader__stage"
            aria-hidden="true"
          >
            <WebGLPassViewport
              id={`${id}.paper-reader.viewport`}
              as="div"
              className="paper-reader__viewport"
            >
              <WebGLScene
                id={`${id}.paper-reader.scene`}
                projection="dom-aligned"
                render={render}
              >
                <WebGLCamera
                  id={`${id}.paper-reader.camera`}
                  default
                  type="orthographic"
                  mode="dom-aligned"
                />
                <WebGLTarget
                  as="div"
                  className="paper-reader__surface"
                  webgl={declaration}
                />
              </WebGLScene>
            </WebGLPassViewport>
          </div>
        )}
        <div className="paper-reader__fallback" hidden={enhanced}>
          <ReaderContent
            id={`${headingId}.fallback`}
            title={title}
            description={description}
            eyebrow={eyebrow}
            articles={articles}
          />
        </div>
      </section>
      {enhanced && (
        <details className="paper-reader__transcript">
          <summary>{transcriptLabel}</summary>
          <ReaderContent
            id={headingId}
            title={title}
            description={description}
            eyebrow={eyebrow}
            articles={articles}
          />
        </details>
      )}
    </div>
  );
}

function ReaderContent({
  id,
  title,
  description,
  eyebrow,
  articles,
}: Pick<
  PaperReaderProps,
  "id" | "title" | "description" | "eyebrow" | "articles"
>) {
  return (
    <div className="paper-reader__content">
      <header>
        <p>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </header>
      {articles.map((article) => (
        <article key={article.id}>
          <p className="paper-reader__label">{article.label}</p>
          <h3>{article.title}</h3>
          <p className="paper-reader__body">{article.body}</p>
        </article>
      ))}
    </div>
  );
}

function readMotion(): boolean {
  return window.matchMedia(motionQuery).matches;
}

function subscribeMotion(listener: () => void): () => void {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
