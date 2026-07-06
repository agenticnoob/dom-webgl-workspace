import type { WebGLFrameInput } from "../types";
import type { PointerController } from "./pointerController";

export type FrameClock = () => number;

export type ScrollStateController = {
  getState(): WebGLFrameInput["scroll"];
  update(): WebGLFrameInput["scroll"];
};

export type WebGLFrameInputSource = {
  getState(): WebGLFrameInput;
  update(): WebGLFrameInput;
};

export function createFrameInputSource(
  scrollState: ScrollStateController,
  pointerController: PointerController,
  clock: FrameClock,
): WebGLFrameInputSource {
  let lastTime: number | undefined;
  let state = createFrameInput(
    0,
    0,
    scrollState.getState(),
    pointerController.getState(),
  );

  return {
    getState(): WebGLFrameInput {
      return cloneFrameInput(state);
    },
    update(): WebGLFrameInput {
      const rawTime = clock();
      const time = lastTime === undefined ? rawTime : Math.max(lastTime, rawTime);
      const delta = lastTime === undefined ? 0 : time - lastTime;

      lastTime = time;
      state = createFrameInput(
        time,
        delta,
        scrollState.update(),
        pointerController.getState(),
      );

      return cloneFrameInput(state);
    },
  };
}

function createFrameInput(
  time: number,
  delta: number,
  scroll: WebGLFrameInput["scroll"],
  pointer: WebGLFrameInput["pointer"],
): WebGLFrameInput {
  return {
    time,
    delta,
    scroll: { ...scroll },
    pointer: clonePointer(pointer),
  };
}

function cloneFrameInput(input: WebGLFrameInput): WebGLFrameInput {
  return {
    time: input.time,
    delta: input.delta,
    scroll: { ...input.scroll },
    pointer: clonePointer(input.pointer),
  };
}

function clonePointer(
  pointer: WebGLFrameInput["pointer"],
): WebGLFrameInput["pointer"] {
  return {
    ...pointer,
    buttons: pointer.buttons.slice(),
    modifiers: { ...pointer.modifiers },
  };
}
