import type {
  WebGLDeclaration,
  WebGLProgressSignalSource,
} from "@viselora/dom-webgl";
import { WebGLTarget, type WebGLTargetProps } from "@viselora/dom-webgl/react";
import React, {
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { getHeroChapterContent, heroSiteContent } from "../chapters/content";
import {
  heroChapterDefinitions,
  heroChapterOrder,
} from "../chapters/definitions";
import type { HeroLocale } from "../preferences/locale";
import type { HeroPortalMotionParams } from "./portalEffect";
import {
  resolveHeroPortalRenderKey,
  heroPortalTerminalContentId,
  type HeroPortalContentId,
  type HeroPortalNarrativeContentId,
  type HeroPortalRenderKey,
  type HeroPortalSide,
} from "./portalState";

const portalDepth = 3.65;
const portalTravelViewportFraction = 0.16;
const portalMaxTravelPx = 240;

type HeroPortalPair = {
  readonly left: readonly [WebGLDeclaration, WebGLDeclaration];
  readonly right: readonly [WebGLDeclaration, WebGLDeclaration];
};

const heroPortalContentOrder = [
  "site",
  ...heroChapterOrder,
  heroPortalTerminalContentId,
] as const satisfies readonly HeroPortalContentId[];
const portalDeclarations = new Map<HeroPortalContentId, HeroPortalPair>(
  heroPortalContentOrder.map((contentId) => [
    contentId,
    createPortalPair(contentId),
  ]),
);

export function HeroPortalStage({
  locale,
  progress,
  styleKey,
}: {
  readonly locale: HeroLocale;
  readonly progress: WebGLProgressSignalSource;
  readonly styleKey: string;
}) {
  const renderKey = useHeroPortalRenderKey(progress);
  const viewportKey = useSyncExternalStore(
    subscribePortalViewport,
    readPortalViewportKey,
    () => "server",
  );
  const textKey = `${styleKey}:${locale}:${viewportKey}`;
  const showSite = renderKey === "site" || renderKey === "site+content";
  const activeContentId: HeroPortalNarrativeContentId | undefined =
    renderKey === "site" || renderKey === "none"
      ? undefined
      : renderKey === "site+content"
        ? heroChapterOrder[0]
        : renderKey;
  const isFinal = activeContentId === heroPortalTerminalContentId;
  const stageClassName = [
    "hero-portal-stage",
    isFinal ? "hero-portal-stage--final" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={stageClassName} aria-hidden="true">
      {showSite ? (
        <HeroPortalContent
          key={`${textKey}:site`}
          contentId="site"
          locale={locale}
        />
      ) : null}
      {activeContentId ? (
        <HeroPortalContent
          key={`${textKey}:${activeContentId}`}
          contentId={activeContentId}
          locale={locale}
        />
      ) : null}
    </div>
  );
}

function HeroPortalContent({
  contentId,
  locale,
}: {
  readonly contentId: HeroPortalContentId;
  readonly locale: HeroLocale;
}) {
  const declarations = readPortalDeclarations(contentId);

  if (contentId === heroPortalTerminalContentId) {
    return <HeroFinalPortalContent locale={locale} webgl={declarations} />;
  }

  const copy = resolvePortalCopy(contentId, locale);

  return (
    <>
      <PortalColumn
        side="left"
        webgl={declarations.left}
        primary={copy.left.primary}
        secondary={copy.left.secondary}
        secondaryClassName={copy.left.secondaryClassName}
      />
      <PortalColumn
        side="right"
        webgl={declarations.right}
        primary={copy.right.primary}
        secondary={copy.right.secondary}
        secondaryClassName={copy.right.secondaryClassName}
      />
    </>
  );
}

function HeroFinalPortalContent({
  locale,
  webgl,
}: {
  readonly locale: HeroLocale;
  readonly webgl: HeroPortalPair;
}) {
  const final = heroSiteContent[locale].final;

  return (
    <>
      <PortalText className="hero-portal-final__eyebrow" webgl={webgl.left[0]}>
        {final.eyebrow}
      </PortalText>
      <PortalText className="hero-portal-final__title" webgl={webgl.left[1]}>
        {final.title}
      </PortalText>
      <PortalText className="hero-portal-final__summary" webgl={webgl.right[0]}>
        {final.summary}
      </PortalText>
    </>
  );
}

function PortalColumn({
  primary,
  secondary,
  secondaryClassName,
  side,
  webgl,
}: {
  readonly primary: ReactNode;
  readonly secondary: ReactNode;
  readonly secondaryClassName?: string;
  readonly side: HeroPortalSide;
  readonly webgl: readonly [WebGLDeclaration, WebGLDeclaration];
}) {
  return (
    <section className={`hero-portal-copy hero-portal-copy--${side}`}>
      <PortalText webgl={webgl[0]}>{primary}</PortalText>
      <PortalText className={secondaryClassName} webgl={webgl[1]}>
        {secondary}
      </PortalText>
    </section>
  );
}

function PortalText({
  children,
  className,
  webgl,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly webgl: WebGLDeclaration;
}) {
  const classes = ["hero-portal-line", className].filter(Boolean).join(" ");

  return (
    <WebGLTarget as="p" className={classes} webgl={webgl}>
      {children}
    </WebGLTarget>
  );
}

function useHeroPortalRenderKey(
  progress: WebGLProgressSignalSource,
): HeroPortalRenderKey {
  const subscribe = useCallback(
    (listener: () => void) =>
      progress.subscribe?.(listener) ?? (() => undefined),
    [progress],
  );
  const getSnapshot = useCallback(
    () => resolveHeroPortalRenderKey(progress),
    [progress],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => "site");
}

function createPortalPair(contentId: HeroPortalContentId): HeroPortalPair {
  return {
    left: [
      createPortalDeclaration(contentId, "left", "primary"),
      createPortalDeclaration(contentId, "left", "secondary"),
    ],
    right: [
      createPortalDeclaration(contentId, "right", "primary"),
      createPortalDeclaration(contentId, "right", "secondary"),
    ],
  };
}

function createPortalDeclaration(
  contentId: HeroPortalContentId,
  side: HeroPortalSide,
  slot: "primary" | "secondary",
): WebGLDeclaration {
  const effect = {
    kind: "hero.portal.motion",
    contentId,
    side,
    travelViewportFraction: portalTravelViewportFraction,
    maxTravelPx: portalMaxTravelPx,
    ...(contentId === "self"
      ? {
          hideAfterProgressKey: heroChapterDefinitions.self.signals.entry,
        }
      : {}),
  } satisfies HeroPortalMotionParams;

  return {
    key: `hero.portal.${contentId}.${side}.${slot}`,
    placement: { mode: "screen-depth", depth: portalDepth, size: "dom" },
    source: { kind: "dom", type: "text" },
    renderRole: "model",
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: [effect],
  } satisfies WebGLTargetProps<"p">["webgl"];
}

type PortalCopy = {
  readonly left: PortalCopyColumn;
  readonly right: PortalCopyColumn;
};

type PortalCopyColumn = {
  readonly primary: ReactNode;
  readonly secondary: ReactNode;
  readonly secondaryClassName?: string;
};

function resolvePortalCopy(
  contentId: HeroPortalContentId,
  locale: HeroLocale,
): PortalCopy {
  const site = heroSiteContent[locale];

  if (contentId === "site") {
    return {
      left: {
        primary: site.intro.eyebrow,
        secondary: site.intro.title,
        secondaryClassName: "hero-portal-copy__headline",
      },
      right: {
        primary: site.intro.summary,
        secondary: site.intro.hint,
      },
    };
  }

  if (contentId === heroPortalTerminalContentId) {
    return {
      left: {
        primary: site.final.eyebrow,
        secondary: site.final.title,
        secondaryClassName: "hero-portal-copy__headline",
      },
      right: {
        primary: site.final.summary,
        secondary: `${site.final.linksLabel}\n${site.final.github} · ${site.final.blog}`,
      },
    };
  }

  const chapter = getHeroChapterContent(contentId, locale);

  return {
    left: {
      primary: chapter.portal.left.label,
      secondary: chapter.portal.left.body,
    },
    right: {
      primary: chapter.portal.right.label,
      secondary: chapter.portal.right.items.join("\n"),
    },
  };
}

function readPortalDeclarations(
  contentId: HeroPortalContentId,
): HeroPortalPair {
  const declarations = portalDeclarations.get(contentId);

  if (!declarations) {
    throw new Error(`Missing portal declaration for ${contentId}`);
  }

  return declarations;
}

// DOM text canvases need new managed textures when their measured size changes.
function readPortalViewportKey(): string {
  return `${window.innerWidth}:${window.innerHeight}`;
}

function subscribePortalViewport(listener: () => void): () => void {
  let frame = 0;
  const update = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      listener();
    });
  };
  window.addEventListener("resize", update);
  return () => {
    window.removeEventListener("resize", update);
    window.cancelAnimationFrame(frame);
  };
}
