export type ObjectFitInput = {
  fit: "fill" | "contain" | "cover" | "none" | "scale-down";
  position: string;
  box: { width: number; height: number };
  media: { width: number; height: number };
};

export type TextureTransform = {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
};

export type ObjectFitContentBox = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export function computeObjectFitTextureTransform(
  input: ObjectFitInput,
): TextureTransform {
  if (
    input.fit === "fill" ||
    input.fit === "contain" ||
    input.fit === "scale-down" ||
    input.box.width <= 0 ||
    input.box.height <= 0 ||
    input.media.width <= 0 ||
    input.media.height <= 0
  ) {
    return identityTransform();
  }

  if (input.fit === "none") {
    return identityTransform();
  }

  const boxRatio = input.box.width / input.box.height;
  const mediaRatio = input.media.width / input.media.height;
  const [positionX, positionY] = readObjectPosition(input.position);

  if (mediaRatio > boxRatio) {
    const repeatX = boxRatio / mediaRatio;
    const offsetX = (1 - repeatX) * positionX;

    return {
      repeatX,
      repeatY: 1,
      offsetX,
      offsetY: 0,
    };
  }

  const repeatY = mediaRatio / boxRatio;
  const offsetY = (1 - repeatY) * (1 - positionY);

  return {
    repeatX: 1,
    repeatY,
    offsetX: 0,
    offsetY,
  };
}

export function computeObjectFitContentBox(
  input: ObjectFitInput,
): ObjectFitContentBox {
  if (
    input.fit === "fill" ||
    input.fit === "cover" ||
    input.box.width <= 0 ||
    input.box.height <= 0 ||
    input.media.width <= 0 ||
    input.media.height <= 0
  ) {
    return fullContentBox(input);
  }

  const [positionX, positionY] = readObjectPosition(input.position);
  const containScale = Math.min(
    input.box.width / input.media.width,
    input.box.height / input.media.height,
  );
  const noneWidth = input.media.width;
  const noneHeight = input.media.height;
  const containWidth = input.media.width * containScale;
  const containHeight = input.media.height * containScale;
  const useContain =
    input.fit === "contain" ||
    (input.fit === "scale-down" &&
      (containWidth < noneWidth || containHeight < noneHeight));
  const width = useContain ? containWidth : noneWidth;
  const height = useContain ? containHeight : noneHeight;

  return {
    width,
    height,
    offsetX: (input.box.width - width) * positionX,
    offsetY: (input.box.height - height) * positionY,
  };
}

function fullContentBox(input: ObjectFitInput): ObjectFitContentBox {
  return {
    width: input.box.width,
    height: input.box.height,
    offsetX: 0,
    offsetY: 0,
  };
}

function identityTransform(): TextureTransform {
  return { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
}

function readObjectPosition(position: string): [number, number] {
  const [x = "50%", y = "50%"] = position.trim().split(/\s+/);

  return [readPositionComponent(x), readPositionComponent(y)];
}

function readPositionComponent(component: string): number {
  if (component === "left" || component === "top") {
    return 0;
  }

  if (component === "right" || component === "bottom") {
    return 1;
  }

  if (component === "center") {
    return 0.5;
  }

  if (component.endsWith("%")) {
    const parsed = Number.parseFloat(component) / 100;

    if (Number.isFinite(parsed)) {
      return Math.min(1, Math.max(0, parsed));
    }
  }

  return 0.5;
}
