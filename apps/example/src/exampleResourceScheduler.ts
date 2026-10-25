import { useEffect, useState } from "react";

import { createFrameSequence, type FrameSequence } from "./frameSequence";

export type ExampleResourceState = {
  readonly imageSequence: FrameSequence | undefined;
  readonly imageSequenceReady: boolean;
};

const imageSequenceFrameCount = 454;
// The sources are 1600×900; the row draws them at about this size.
const imageSequenceSize = { width: 1280, height: 720 };

let imageSequence: FrameSequence | undefined;

export function useExampleResources(): ExampleResourceState {
  const [state, setState] = useState<ExampleResourceState>({
    imageSequence: undefined,
    imageSequenceReady: false,
  });

  useEffect(() => {
    let active = true;
    const sequence = startExampleResourceLoad();
    void sequence.ready.then(() => {
      if (active) setState({ imageSequence: sequence, imageSequenceReady: true });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

/**
 * Shared for the page's lifetime: remounting the row reuses the fetched frames.
 * Created on first use after mount, never during render or SSR.
 */
export function startExampleResourceLoad(): FrameSequence {
  imageSequence ??= createFrameSequence({
    urls: Array.from(
      { length: imageSequenceFrameCount },
      (_, index) =>
        `/example/bg-sequence/frame_${String(index + 1).padStart(4, "0")}.webp`,
    ),
    ...imageSequenceSize,
  });
  return imageSequence;
}
