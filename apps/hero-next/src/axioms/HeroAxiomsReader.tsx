import type { WebGLDeclaration } from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React, { useMemo, type CSSProperties } from "react";
import type { HeroChapterDefinition } from "../chapters/definitions";
import type { HeroLocaleStore } from "../preferences/locale";
import { resolveAxiomsScrollHeight } from "./config";
import type { AxiomsReaderContent } from "./model";
import { formatAxiomsHeading } from "./reader";

export function HeroAxiomsStage({
  locale,
}: {
  readonly locale: HeroLocaleStore;
}) {
  const declaration = useMemo(
    () =>
      ({
        key: "hero.axioms.reader",
        placement: { mode: "screen-depth", depth: 3, size: "dom" },
        source: { kind: "dom", type: "element" },
        renderRole: "model",
        lifecycle: { hideWhenReady: true, hideMode: "self" },
        effects: [{ kind: "hero.axioms.reader", locale }],
      }) satisfies WebGLDeclaration,
    [locale],
  );
  return (
    <WebGLTarget
      as="div"
      className="hero-axioms-surface"
      aria-hidden="true"
      webgl={declaration}
    />
  );
}

export function HeroAxiomsChapterBody({
  definition,
  content,
}: {
  readonly definition: HeroChapterDefinition;
  readonly content: { readonly body: AxiomsReaderContent };
}) {
  const bodyId = `chapter-${definition.ordinal}-body`;
  const style: CSSProperties & { "--axioms-scroll-height": string } = {
    "--axioms-scroll-height": `${resolveAxiomsScrollHeight(content.body.sections.length)}svh`,
  };
  return (
    <WebGLScrollTimeline
      as="section"
      id={`${bodyId}-timeline`}
      progressKey={definition.signals.body}
      className="hero-chapter__body hero-axioms"
      style={style}
      start="top top"
      end="bottom bottom"
      scrub
      aria-labelledby={bodyId}
    >
      <div className="hero-axioms__semantic">
        <p>{formatAxiomsHeading(content.body.eyebrow)}</p>
        <h2 id={bodyId}>{content.body.title}</h2>
        <p>{content.body.intro}</p>
        {content.body.sections.map((section) => (
          <article key={section.id} data-axioms-article={section.id}>
            <p>{section.label}</p>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </article>
        ))}
      </div>
    </WebGLScrollTimeline>
  );
}
