import type { WebGLDeclaration } from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import type { HeroChapterBodyProps } from "../chapters/HeroChapter";
import { formatHeroChapterCounter } from "../chapters/definitions";
import type { HeroLocale, HeroLocaleStore } from "../preferences/locale";
import type { ProjectRoomStore } from "./room";

export function HeroProjectRoomStage({
  locale,
  room,
}: {
  readonly locale: HeroLocaleStore;
  readonly room: ProjectRoomStore;
}) {
  const declaration = useMemo(
    () =>
      ({
        key: "hero.projects.room",
        placement: { mode: "screen-depth", depth: 3, size: "dom" },
        source: { kind: "dom", type: "element" },
        renderRole: "model",
        lifecycle: { hideWhenReady: true, hideMode: "self" },
        effects: [{ kind: "hero.projects.room", locale, room }],
      }) satisfies WebGLDeclaration,
    [locale, room],
  );
  return (
    <WebGLTarget
      as="div"
      className="hero-projects-surface"
      aria-hidden="true"
      webgl={declaration}
    />
  );
}

export function HeroProjectsChapterBody({
  definition,
  content,
  locale,
  room,
  onLayoutChange,
}: HeroChapterBodyProps & {
  readonly locale: HeroLocale;
  readonly room: ProjectRoomStore;
  readonly onLayoutChange: () => void;
}) {
  const snapshot = useSyncExternalStore(
    room.subscribe,
    room.getSnapshot,
    room.getServerSnapshot,
  );
  useEffect(() => {
    onLayoutChange();
  }, [snapshot.ready, onLayoutChange]);
  const bodyId = `chapter-${definition.ordinal}-body`;
  const projects = content.body.sections;
  const selected = projects[snapshot.selected];
  const controlsEnabled = snapshot.ready && snapshot.active;
  const ui =
    locale === "zh"
      ? {
          title: "项目空间",
          hint: "移向左右边缘，转向另一面。回到中央阅读。",
          nav: "选择项目",
          link: "查看项目源码",
          previous: "上一面",
          next: "下一面",
        }
      : {
          title: "Project space",
          hint: "Move to either edge to turn. Return to the center to read.",
          nav: "Choose a project",
          link: "View project source",
          previous: "Previous wall",
          next: "Next wall",
        };
  return (
    <WebGLScrollTimeline
      as="section"
      id={`${bodyId}-timeline`}
      progressKey={definition.signals.body}
      className="hero-chapter__body hero-projects"
      start="top top"
      end="bottom bottom"
      scrub
      aria-labelledby={bodyId}
      data-room-ready={snapshot.ready}
      data-room-active={controlsEnabled}
      data-room-selected={snapshot.selected}
      data-room-settled={snapshot.settled}
    >
      <div className="hero-projects__content">
        <p className="hero-chapter__index">
          {formatHeroChapterCounter(definition)}
        </p>
        <h2 id={bodyId}>{content.body.title}</h2>
        <p>{content.body.intro}</p>
        <div className="hero-chapter__notes">
          {projects.map((project, index) => (
            <section className="hero-chapter__note" key={project.title}>
              <p>
                {String(index + 1).padStart(2, "0")} / {project.label}
              </p>
              <h3>{project.title}</h3>
              <p>{project.body}</p>
              {project.link && (
                <a
                  href={project.link.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={snapshot.ready ? -1 : undefined}
                >
                  {project.link.label} ↗
                </a>
              )}
            </section>
          ))}
        </div>
      </div>
      <div
        className="hero-projects__controls"
        hidden={!controlsEnabled}
        onPointerEnter={() => room.setHovered(true)}
        onPointerLeave={() => room.setHovered(false)}
        onFocusCapture={() => room.setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            room.setFocused(false);
        }}
      >
        <header className="hero-projects__heading">
          <span>03 / {ui.title}</span>
          <span className="hero-projects__hint">{ui.hint}</span>
        </header>
        <button
          type="button"
          className="hero-projects__turn hero-projects__turn--left"
          aria-label={ui.previous}
          onClick={() => room.select(snapshot.selected - 1)}
        >
          ←
        </button>
        <button
          type="button"
          className="hero-projects__turn hero-projects__turn--right"
          aria-label={ui.next}
          onClick={() => room.select(snapshot.selected + 1)}
        >
          →
        </button>
        <footer className="hero-projects__footer">
          <nav aria-label={ui.nav}>
            {projects.map((project, index) => (
              <button
                type="button"
                key={project.title}
                aria-pressed={snapshot.selected === index}
                onClick={() => room.select(index)}
              >
                {project.title}
              </button>
            ))}
          </nav>
          {selected?.link && (
            <a
              className="hero-projects__source"
              href={selected.link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${ui.link}: ${selected.title}`}
              aria-disabled={!snapshot.settled}
              tabIndex={snapshot.settled ? 0 : -1}
              onClick={(event) => {
                if (!snapshot.settled) event.preventDefault();
              }}
            >
              {ui.link} ↗
            </a>
          )}
        </footer>
      </div>
    </WebGLScrollTimeline>
  );
}
