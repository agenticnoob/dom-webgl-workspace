import { useEffect, useState } from "react";

import type { WebGLImageSequenceFrame } from "@project/dom-webgl-runtime";

export type ExampleResourceState = {
  readonly imageSequenceFrames: readonly WebGLImageSequenceFrame[];
  readonly imageSequenceReady: boolean;
  readonly modelReady: boolean;
};

const imageSequenceFrameCount = 454;
const imageSequenceConcurrency = 6;

type ExampleResourceLoad = {
  readonly imageSequenceComplete: Promise<readonly WebGLImageSequenceFrame[]>;
  readonly imageSequenceReady: Promise<readonly WebGLImageSequenceFrame[]>;
  readonly modelReady: Promise<boolean>;
  readonly all: Promise<{
    readonly imageSequenceFrames: readonly WebGLImageSequenceFrame[];
    readonly modelReady: boolean;
  }>;
};

let resourceLoad: ExampleResourceLoad | undefined;

export function useExampleResources(): ExampleResourceState {
  const [state, setState] = useState<ExampleResourceState>({
    imageSequenceFrames: [],
    imageSequenceReady: false,
    modelReady: false,
  });

  useEffect(() => {
    let active = true;
    const resources = startExampleResourceLoad();

    resources.imageSequenceReady.then((imageSequenceFrames) => {
      if (active) {
        setState((current) => ({
          ...current,
          imageSequenceFrames,
          imageSequenceReady: true,
        }));
      }
    });
    resources.modelReady.then((modelReady) => {
      if (active) {
        setState((current) => ({
          ...current,
          modelReady,
        }));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function loadExampleResources(): Promise<{
  readonly imageSequenceFrames: readonly WebGLImageSequenceFrame[];
  readonly modelReady: boolean;
}> {
  return startExampleResourceLoad().all;
}

function startExampleResourceLoad(): ExampleResourceLoad {
  if (resourceLoad) {
    return resourceLoad;
  }

  const firstImage = loadImage("/example/image.png");
  const backgroundImage = loadImage("/example/bg.png");
  const videoMetadata = loadVideoMetadata("/example/video.mp4");
  const imageSequence = loadImageSequenceFrames({
    count: imageSequenceFrameCount,
    concurrency: imageSequenceConcurrency,
    srcForFrame(frame) {
      return `/example/bg-sequence/frame_${String(frame).padStart(4, "0")}.webp`;
    },
  });
  const heroModelReady = warmModel("/models/hero.glb");
  const fourModelReady = warmModel("/models/4.glb");
  const modelReady = Promise.all([heroModelReady, fourModelReady]).then((results) =>
    results.every(Boolean),
  );
  const all = Promise.all([
    firstImage,
    backgroundImage,
    videoMetadata,
    imageSequence.complete,
    modelReady,
  ]).then(([_firstImage, _backgroundImage, _videoMetadata, frames, model]) => ({
    imageSequenceFrames: frames,
    modelReady: model,
  }));

  resourceLoad = {
    imageSequenceComplete: imageSequence.complete,
    imageSequenceReady: imageSequence.ready,
    modelReady,
    all,
  };

  return resourceLoad;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;

  if (typeof image.decode === "function") {
    return image.decode().then(
      () => image,
      () => image,
    );
  }

  return Promise.resolve(image);
}

function loadVideoMetadata(src: string): Promise<void> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = src;

  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    video.addEventListener("loadedmetadata", settle, { once: true });
    video.addEventListener("error", settle, { once: true });
    video.load();
    window.setTimeout(settle, 3_000);
  });
}

function loadImageSequenceFrames(options: {
  readonly count: number;
  readonly concurrency: number;
  srcForFrame(frame: number): string;
}): {
  readonly complete: Promise<readonly WebGLImageSequenceFrame[]>;
  readonly ready: Promise<readonly WebGLImageSequenceFrame[]>;
} {
  const frames = new Array<HTMLImageElement>(options.count);
  let nextFrame = 2;
  const loadFrame = (frame: number) =>
    loadImage(options.srcForFrame(frame)).then((image) => {
      frames[frame - 1] = image;
      return image;
    });
  const ready = loadFrame(1).then((firstFrame) => {
    for (let index = 0; index < frames.length; index += 1) {
      frames[index] ??= firstFrame;
    }

    return frames;
  });

  const loadNextFrame = (): Promise<void> => {
    if (nextFrame > options.count) {
      return Promise.resolve();
    }

    const frame = nextFrame;
    nextFrame += 1;
    return loadFrame(frame).then(loadNextFrame);
  };
  const workers = Array.from(
    { length: Math.min(Math.max(0, options.concurrency - 1), Math.max(0, options.count - 1)) },
    loadNextFrame,
  );
  const complete = Promise.all([ready, ...workers]).then(() => frames);

  return {
    complete,
    ready,
  };
}

async function warmModel(src: string): Promise<boolean> {
  if (typeof fetch !== "function") {
    return true;
  }

  try {
    const response = await fetch(src, { cache: "force-cache" });
    return response.ok;
  } catch {
    return false;
  }
}
