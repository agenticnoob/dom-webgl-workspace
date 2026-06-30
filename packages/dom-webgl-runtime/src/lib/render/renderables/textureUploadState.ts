export type TextureUploadDirtyReason =
  | "initial"
  | "source-change"
  | "canvas-raster"
  | "glyph-commands"
  | "texture-transform"
  | "effect-draw"
  | "effect-invalidate"
  | "material-uniform";

export type TextureUploadTelemetry = {
  key: string;
  width: number;
  height: number;
  devicePixelRatio?: number;
  sourceKind: "canvas" | "image" | "video" | "image-bitmap" | "unknown";
  dirty: boolean;
  dirtyReason?: TextureUploadDirtyReason;
};

export type TextureUploadSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | HTMLVideoElement
  | ImageBitmap
  | undefined;

export type TextureUploadStateOptions = {
  key: string;
  texture: { needsUpdate?: boolean };
  source?: TextureUploadSource;
  requestFrame?(): void;
};

export type TextureUploadState = {
  markUploadDirty(reason: TextureUploadDirtyReason): void;
  markFrameDirty(reason: TextureUploadDirtyReason): void;
  updateSource(source: TextureUploadSource): void;
  updateSize(size: {
    width: number;
    height: number;
    devicePixelRatio?: number;
  }): void;
  inspect(): TextureUploadTelemetry;
  dispose(): void;
};

type TextureSourceSignature = {
  source: TextureUploadSource;
  width: number;
  height: number;
  sourceKind: TextureUploadTelemetry["sourceKind"];
};

export function createTextureUploadState(
  options: TextureUploadStateOptions,
): TextureUploadState {
  let disposed = false;
  let dirty = false;
  let dirtyReason: TextureUploadDirtyReason | undefined;
  let sourceSignature = readSourceSignature(options.source);
  let telemetry: TextureUploadTelemetry = {
    key: options.key,
    width: sourceSignature.width,
    height: sourceSignature.height,
    sourceKind: sourceSignature.sourceKind,
    dirty,
  };

  const markFrameDirty = (reason: TextureUploadDirtyReason): void => {
    if (disposed) {
      return;
    }

    dirty = true;
    dirtyReason = reason;
    telemetry = createTelemetry(
      options.key,
      sourceSignature,
      telemetry.devicePixelRatio,
      dirty,
      dirtyReason,
    );
    options.requestFrame?.();
  };

  const markUploadDirty = (reason: TextureUploadDirtyReason): void => {
    if (disposed) {
      return;
    }

    options.texture.needsUpdate = true;
    markFrameDirty(reason);
  };

  return {
    markUploadDirty,
    markFrameDirty,
    updateSource(source): void {
      if (disposed) {
        return;
      }

      const nextSignature = readSourceSignature(source);
      if (isSameSourceSignature(sourceSignature, nextSignature)) {
        return;
      }

      sourceSignature = nextSignature;
      telemetry = createTelemetry(
        options.key,
        sourceSignature,
        telemetry.devicePixelRatio,
        dirty,
        dirtyReason,
      );
      markUploadDirty("source-change");
    },
    updateSize(size): void {
      if (disposed) {
        return;
      }

      sourceSignature = {
        ...sourceSignature,
        width: normalizeSize(size.width),
        height: normalizeSize(size.height),
      };
      telemetry = createTelemetry(
        options.key,
        sourceSignature,
        size.devicePixelRatio,
        dirty,
        dirtyReason,
      );
    },
    inspect(): TextureUploadTelemetry {
      return { ...telemetry };
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
    },
  };
}

function createTelemetry(
  key: string,
  sourceSignature: TextureSourceSignature,
  devicePixelRatio: number | undefined,
  dirty: boolean,
  dirtyReason: TextureUploadDirtyReason | undefined,
): TextureUploadTelemetry {
  return {
    key,
    width: sourceSignature.width,
    height: sourceSignature.height,
    ...(devicePixelRatio !== undefined ? { devicePixelRatio } : {}),
    sourceKind: sourceSignature.sourceKind,
    dirty,
    ...(dirty && dirtyReason ? { dirtyReason } : {}),
  };
}

function readSourceSignature(
  source: TextureUploadSource,
): TextureSourceSignature {
  const sourceKind = readSourceKind(source);
  const size = readSourceSize(source, sourceKind);

  return {
    source,
    width: size.width,
    height: size.height,
    sourceKind,
  };
}

function readSourceKind(
  source: TextureUploadSource,
): TextureUploadTelemetry["sourceKind"] {
  if (!source) {
    return "unknown";
  }

  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    return "canvas";
  }
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return "image";
  }
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
    return "video";
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return "image-bitmap";
  }

  return "unknown";
}

function readSourceSize(
  source: TextureUploadSource,
  sourceKind: TextureUploadTelemetry["sourceKind"],
): { width: number; height: number } {
  if (!source) {
    return { width: 0, height: 0 };
  }

  switch (sourceKind) {
    case "canvas":
    case "image-bitmap":
      return {
        width: normalizeSize(source.width),
        height: normalizeSize(source.height),
      };
    case "image":
      if (!("naturalWidth" in source) || !("naturalHeight" in source)) {
        return { width: 0, height: 0 };
      }
      return {
        width: normalizeSize(source.naturalWidth || source.width),
        height: normalizeSize(source.naturalHeight || source.height),
      };
    case "video":
      if (!("videoWidth" in source) || !("videoHeight" in source)) {
        return { width: 0, height: 0 };
      }
      return {
        width: normalizeSize(source.videoWidth || source.width),
        height: normalizeSize(source.videoHeight || source.height),
      };
    case "unknown":
      return { width: 0, height: 0 };
  }
}

function isSameSourceSignature(
  current: TextureSourceSignature,
  next: TextureSourceSignature,
): boolean {
  return (
    current.source === next.source &&
    current.width === next.width &&
    current.height === next.height &&
    current.sourceKind === next.sourceKind
  );
}

function normalizeSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}
