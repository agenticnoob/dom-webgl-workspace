import { useEffect, useState } from "react";

export type ExampleResourceState = {
  readonly imageSequenceFrames: readonly HTMLImageElement[];
  readonly imageSequenceReady: boolean;
};

const imageSequenceFrameCount = 454;
const imageSequenceConcurrency = 6;

type ExampleResourceLoad = {
  readonly imageSequenceReady: Promise<readonly HTMLImageElement[]>;
  readonly all: Promise<{
    readonly imageSequenceFrames: readonly HTMLImageElement[];
  }>;
};

let resourceLoad: ExampleResourceLoad | undefined;

export function useExampleResources(): ExampleResourceState {
  const [state, setState] = useState<ExampleResourceState>({
    imageSequenceFrames: [],
    imageSequenceReady: false,
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
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function loadExampleResources(): Promise<{
  readonly imageSequenceFrames: readonly HTMLImageElement[];
}> {
  return startExampleResourceLoad().all;
}

function startExampleResourceLoad(): ExampleResourceLoad {
  if (resourceLoad) {
    return resourceLoad;
  }

  const imageSequence = loadImageSequenceFrames({
    count: imageSequenceFrameCount,
    concurrency: imageSequenceConcurrency,
    srcForFrame(frame) {
      return `/example/bg-sequence/frame_${String(frame).padStart(4, "0")}.webp`;
    },
  });
  const all = imageSequence.complete.then((frames) => ({
    imageSequenceFrames: frames,
  }));

  resourceLoad = {
    imageSequenceReady: imageSequence.ready,
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

function loadImageSequenceFrames(options: {
  readonly count: number;
  readonly concurrency: number;
  srcForFrame(frame: number): string;
}): {
  readonly complete: Promise<readonly HTMLImageElement[]>;
  readonly ready: Promise<readonly HTMLImageElement[]>;
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
    {
      length: Math.min(
        Math.max(0, options.concurrency - 1),
        Math.max(0, options.count - 1),
      ),
    },
    loadNextFrame,
  );
  const complete = Promise.all([ready, ...workers]).then(() => frames);

  return {
    complete,
    ready,
  };
}
