import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { OrthographicCamera, View } from "@react-three/drei";
import { PaperReaderSurface } from "./PaperReaderSurface";
import { useRuntimeReady } from "../../useRuntimeReady";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import { resolvePaperReaderScrollHeight } from "./config";
import {
  defaultPaperReaderPalette,
  validatePaperReader,
  type PaperReaderProps,
} from "./model";
import { resolvePaperReaderProgress } from "./scroll";
import "./paper-reader.css";

const motionQuery = "(prefers-reduced-motion: reduce)";

/** A source-distributed recipe. The caller owns the single WebGLScrollRuntime. */
export function PaperReader(props: PaperReaderProps) {
  validatePaperReader(props);
  // Content edits rebuild the shader capacity and texture together, including
  // changes to the number of article sheets.
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
  const runtimeReady = useRuntimeReady();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    () => true,
  );
  const animated = !reducedMotion && articles.length > 0;
  const enhanced = animated && ready && runtimeReady;
  const progressKey = `${id}.paper-reader.progress`;
  const headingId = `${id}.paper-reader.heading`;
  const surface = useMemo(
    () => ({
      progressKey,
      content: { title, intro: description, sections: articles },
      eyebrow,
      palette,
      onReady: setReady,
      onError(error: Error) {
        if (errorRef.current) errorRef.current(error);
        else
          console.error("PaperReader reverted to its text transcript:", error);
      },
    }),
    [progressKey, title, description, articles, eyebrow, palette],
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
      const stageRect = stage.getBoundingClientRect();
      const stageHeight = stageRect.height;
      setViewport((current) =>
        current.width === stageRect.width && current.height === stageHeight
          ? current
          : { width: stageRect.width, height: stageHeight },
      );
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
            <View
              id={`${id}.paper-reader.viewport`}
              className="paper-reader__viewport"
            >
              <OrthographicCamera
                makeDefault
                manual
                position={[0, 0, 1]}
                left={-1}
                right={1}
                top={1}
                bottom={-1}
                near={0.01}
                far={10}
              />
              <PaperReaderSurface
                {...surface}
                progress={progressStore.source}
                viewport={viewport}
              />
            </View>
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
