import type { ProjectRoomItems } from "./types";

export const projectRoomConfig = {
  pointerQuery: "(hover: hover) and (pointer: fine)",
  minimumWidth: 680,
  radius: 3,
  halfHeight: 1.8,
  tangent: 0.9,
  textureWidth: 1024,
  textureHeight: 720,
  edgeThreshold: 0.82,
  rearmThreshold: 0.55,
} as const;

export function validateProjectRoomItems(items: ProjectRoomItems): void {
  if (items.length !== 4)
    throw new Error("ProjectRoom requires exactly four items.");
  if (new Set(items.map((item) => item.id)).size !== 4)
    throw new Error("ProjectRoom item IDs must be unique.");
  for (const item of items) {
    if (!item.id.trim() || !item.title.trim() || !item.href.trim())
      throw new Error("ProjectRoom items require an ID, title and href.");
  }
}

export function wrapRoomAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function resolveRoomTurn(x: number, y: number, armed: boolean): number {
  // The header and footer are reading/clicking areas, never turn triggers.
  if (!armed || y > 0.65 || y < -0.7) return 0;
  if (x > projectRoomConfig.edgeThreshold) return 1;
  if (x < -projectRoomConfig.edgeThreshold) return -1;
  return 0;
}

export function stepRoomAngle(
  current: number,
  target: number,
  delta: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return target;
  return wrapRoomAngle(
    current +
      wrapRoomAngle(target - current) *
        (1 - Math.exp(-Math.max(0, Math.min(delta, 64)) / 150)),
  );
}

export type ProjectRoomSnapshot = {
  readonly selected: number;
  readonly ready: boolean;
  readonly settled: boolean;
  readonly error?: string;
};

export function createProjectRoomStore(initialSelected = 0) {
  const initial: ProjectRoomSnapshot = {
    selected: ((Math.trunc(initialSelected) % 4) + 4) % 4,
    ready: false,
    settled: true,
  };
  let snapshot = initial;
  let hovered = false;
  let focused = false;
  const listeners = new Set<() => void>();
  const publish = (next: ProjectRoomSnapshot) => {
    if (
      next.selected === snapshot.selected &&
      next.ready === snapshot.ready &&
      next.settled === snapshot.settled &&
      next.error === snapshot.error
    )
      return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(index: number) {
      if (!Number.isInteger(index)) return;
      const selected = ((index % 4) + 4) % 4;
      if (selected !== snapshot.selected)
        publish({ ...snapshot, selected, settled: false });
    },
    publishFrame(frame: Omit<ProjectRoomSnapshot, "selected">) {
      if (!frame.ready) {
        hovered = false;
        focused = false;
      }
      publish({ ...snapshot, ...frame });
    },
    setHovered(value: boolean) {
      hovered = value;
    },
    setFocused(value: boolean) {
      focused = value;
    },
    pointerLocked: () => hovered || focused,
  };
}

export type ProjectRoomStore = ReturnType<typeof createProjectRoomStore>;
