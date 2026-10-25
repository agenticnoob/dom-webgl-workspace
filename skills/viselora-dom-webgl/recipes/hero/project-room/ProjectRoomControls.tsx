import React, { useSyncExternalStore } from "react";
import type { ProjectRoomStore } from "./room";
import type { ProjectRoomItems, ProjectRoomLabels } from "./types";

export function ProjectRoomControls({
  id,
  items,
  title,
  labels,
  room,
  available = true,
}: {
  readonly id: string;
  readonly items: ProjectRoomItems;
  readonly title: string;
  readonly labels: ProjectRoomLabels;
  readonly room: ProjectRoomStore;
  readonly available?: boolean;
}) {
  const snapshot = useSyncExternalStore(
    room.subscribe,
    room.getSnapshot,
    room.getServerSnapshot,
  );
  const selected = items[snapshot.selected];
  const enhanced = snapshot.ready && available;
  return (
    <>
      <div className="recipe-room__fallback" hidden={enhanced}>
        <h2 id={`${id}.heading`}>{title}</h2>
        {snapshot.error ? <p role="status">{snapshot.error}</p> : null}
        <ol className="recipe-room__list">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a href={item.href}>
                {item.linkLabel ?? labels.visit}{" "}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
      <div className="recipe-room__controls" hidden={!enhanced}>
        <header className="recipe-room__header">
          <h2>{title}</h2>
          <p>{labels.hint}</p>
        </header>
        <div
          className="recipe-room__footer"
          onPointerEnter={() => room.setHovered(true)}
          onPointerLeave={() => room.setHovered(false)}
          onFocusCapture={() => room.setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              room.setFocused(false);
          }}
        >
          <nav
            aria-label={labels.navigation}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowLeft"
                  ? snapshot.selected - 1
                  : event.key === "ArrowRight"
                    ? snapshot.selected + 1
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              room.select(next);
              event.currentTarget
                .querySelector<HTMLButtonElement>(
                  `[data-room-wall="${((next % 4) + 4) % 4}"]`,
                )
                ?.focus();
            }}
          >
            <button
              type="button"
              aria-label={labels.previous}
              onClick={() => room.select(snapshot.selected - 1)}
            >
              ←
            </button>
            {items.map((item, index) => (
              <button
                type="button"
                key={item.id}
                data-room-wall={index}
                aria-pressed={snapshot.selected === index}
                tabIndex={snapshot.selected === index ? 0 : -1}
                onClick={() => room.select(index)}
              >
                {item.title}
              </button>
            ))}
            <button
              type="button"
              aria-label={labels.next}
              onClick={() => room.select(snapshot.selected + 1)}
            >
              →
            </button>
          </nav>
          <a
            className="recipe-room__visit"
            href={selected.href}
            aria-label={`${selected.linkLabel ?? labels.visit}: ${selected.title}`}
            aria-disabled={!snapshot.settled || undefined}
            tabIndex={snapshot.settled ? 0 : -1}
            onClick={(event) => {
              if (!snapshot.settled) event.preventDefault();
            }}
          >
            {selected.linkLabel ?? labels.visit}{" "}
            <span aria-hidden="true">↗</span>
          </a>
          <p className="recipe-room__sr-only" aria-live="polite">
            {selected.title}. {selected.description}
          </p>
        </div>
      </div>
    </>
  );
}
