import type { HeroViewport } from "../shared/viewport";

export const projectRoomConfig = {
  desktopQuery: "(min-width: 901px) and (hover: hover) and (pointer: fine)",
  radius: 3,
  halfHeight: 1.8,
  tangent: 0.9,
  textureWidth: 1024,
  textureHeight: 720,
  texturePixelRatio: 2,
  edgeThreshold: 0.82,
  rearmThreshold: 0.55,
} as const;

export function projectRoomEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(projectRoomConfig.desktopQuery).matches
  );
}

export function roomInteractionWeight(progress: number): number {
  const smooth = (n: number) => {
    const x = Math.max(0, Math.min(1, n));
    return x * x * (3 - 2 * x);
  };
  return smooth(progress / 0.12) * smooth((1 - progress) / 0.12);
}

export function wrapRoomAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function resolveRoomTurn(x: number, y: number, armed: boolean): number {
  // The bottom utility bar is a reading/clicking area, never a turn trigger.
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

export type RoomSnapshot = {
  readonly selected: number;
  readonly ready: boolean;
  readonly active: boolean;
  readonly settled: boolean;
};
const initialRoomSnapshot: RoomSnapshot = {
  selected: 0,
  ready: false,
  active: false,
  settled: true,
};

export function createProjectRoomStore() {
  let snapshot = initialRoomSnapshot;
  let hovered = false;
  let focused = false;
  const listeners = new Set<() => void>();
  const publish = (next: RoomSnapshot) => {
    if (
      next.selected === snapshot.selected &&
      next.ready === snapshot.ready &&
      next.active === snapshot.active &&
      next.settled === snapshot.settled
    )
      return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialRoomSnapshot,
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
    publishFrame(frame: Omit<RoomSnapshot, "selected">) {
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

// Camera-space projection shared by the static face atlas and room geometry.
export function projectRoomPoint(
  viewport: HeroViewport,
  x: number,
  y: number,
  z: number,
): readonly [number, number] {
  const focal = viewport.height / (2 * projectRoomConfig.tangent);
  return [
    viewport.width / 2 + (x * focal) / -z,
    viewport.height / 2 - (y * focal) / -z,
  ];
}
