export type SceneGateStart = "top top" | "center center" | "bottom bottom";

export type SceneGateRect = {
  top: number;
  height: number;
  bottom?: number;
};

export type SceneGateMeasurement = {
  anchorLine: number;
  viewportLine: number;
  offset: number;
};

export type SceneGateCrossing = "forward" | "reverse" | null;
export type SceneGateReleasePolicy = "forward-complete" | "both-directions-complete";

export type SceneGateMetadata = {
  gateKey: string;
  duration: number;
  release: SceneGateReleasePolicy;
};

export type SceneGateInactiveState = {
  kind: "inactive";
};

export type SceneGateActiveState = SceneGateMetadata & {
  kind: "active";
  entryDirection: "forward" | "reverse";
  sceneProgress: number;
};

export type SceneGateReleasedState = {
  kind: "released";
  gateKey: string;
  entryDirection: "forward" | "reverse";
  release: SceneGateReleasePolicy;
  releaseDirection: "forward" | "backward";
  sceneProgress: 0 | 1;
};

export type SceneGateState =
  | SceneGateInactiveState
  | SceneGateActiveState
  | SceneGateReleasedState;

type SceneGateAnchor = "top" | "center" | "bottom";

export function parseSceneGateStart(start: string): SceneGateStart {
  if (start === "top top" || start === "center center" || start === "bottom bottom") {
    return start;
  }

  throw new Error(
    `Unsupported scene gate start: ${start}. Supported starts are "top top", "center center", and "bottom bottom".`,
  );
}

export function measureSceneGateStart(input: {
  rect: SceneGateRect;
  viewportHeight: number;
  start: string;
}): SceneGateMeasurement {
  const start = parseSceneGateStart(input.start);
  const anchor = readAnchor(start);
  const anchorLine = readAnchorLine(input.rect, anchor);
  const viewportLine = readViewportLine(input.viewportHeight, anchor);

  return {
    anchorLine,
    viewportLine,
    offset: anchorLine - viewportLine,
  };
}

export function detectSceneGateCrossing(input: {
  previousOffset: number;
  currentOffset: number;
}): SceneGateCrossing {
  if (input.previousOffset > 0 && input.currentOffset <= 0) {
    return "forward";
  }

  if (input.previousOffset < 0 && input.currentOffset >= 0) {
    return "reverse";
  }

  return null;
}

export function createSceneGateStateMachine() {
  return {
    inactive(): SceneGateInactiveState {
      return { kind: "inactive" };
    },

    enterForward(metadata: SceneGateMetadata): SceneGateActiveState {
      return {
        kind: "active",
        gateKey: metadata.gateKey,
        entryDirection: "forward",
        release: metadata.release,
        duration: metadata.duration,
        sceneProgress: 0,
      };
    },

    enterReverse(metadata: SceneGateMetadata): SceneGateActiveState | SceneGateInactiveState {
      if (metadata.release === "forward-complete") {
        return { kind: "inactive" };
      }

      return {
        kind: "active",
        gateKey: metadata.gateKey,
        entryDirection: "reverse",
        release: metadata.release,
        duration: metadata.duration,
        sceneProgress: 1,
      };
    },

    applyScrollDelta(input: {
      state: SceneGateState;
      viewportHeight: number;
      deltaY: number;
    }): SceneGateState {
      if (input.state.kind !== "active") {
        return input.state;
      }

      if (input.viewportHeight <= 0) {
        throw new Error("Scene gate viewport height must be positive.");
      }

      if (input.state.entryDirection === "reverse") {
        if (input.deltaY >= 0) {
          return input.state;
        }

        const nextProgress = clampSceneProgress(
          input.state.sceneProgress - Math.abs(input.deltaY) / (input.state.duration * input.viewportHeight),
        );

        if (nextProgress <= 0) {
          return {
            kind: "released",
            gateKey: input.state.gateKey,
            entryDirection: "reverse",
            release: input.state.release,
            releaseDirection: "backward",
            sceneProgress: 0,
          };
        }

        return {
          ...input.state,
          sceneProgress: nextProgress,
        };
      }

      if (input.deltaY <= 0) {
        return input.state;
      }

      const nextProgress = clampSceneProgress(
        input.state.sceneProgress + input.deltaY / (input.state.duration * input.viewportHeight),
      );

      if (nextProgress >= 1) {
        return {
          kind: "released",
          gateKey: input.state.gateKey,
          entryDirection: "forward",
          release: input.state.release,
          releaseDirection: "forward",
          sceneProgress: 1,
        };
      }

      return {
        ...input.state,
        sceneProgress: nextProgress,
      };
    },
  };
}

function readAnchor(start: SceneGateStart): SceneGateAnchor {
  if (start === "top top") {
    return "top";
  }

  if (start === "center center") {
    return "center";
  }

  return "bottom";
}

function readAnchorLine(rect: SceneGateRect, anchor: SceneGateAnchor): number {
  if (anchor === "top") {
    return rect.top;
  }

  if (anchor === "center") {
    return rect.top + rect.height / 2;
  }

  return rect.bottom ?? rect.top + rect.height;
}

function readViewportLine(viewportHeight: number, anchor: SceneGateAnchor): number {
  if (anchor === "top") {
    return 0;
  }

  if (anchor === "center") {
    return viewportHeight / 2;
  }

  return viewportHeight;
}

function clampSceneProgress(progress: number): number {
  return Math.min(Math.max(progress, 0), 1);
}
