import type { WebGLEffectTargetHandle } from "./effectAuthoring";
import type {
  WebGLEffectScaleLike,
  WebGLEffectVector3Like,
} from "./effectObject";

export type WebGLEffectObjectTransform = {
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
};

export function createEffectObjectTransform(
  target?: WebGLEffectTargetHandle,
): WebGLEffectObjectTransform {
  const position = createVector3((x, y, z) => {
    target?.setPosition(x, y, z);
  });
  const rotation = createVector3((x, y, z) => {
    target?.setRotation(x, y, z);
  });
  const scale = createScale((x, y, z) => {
    target?.setScale(x, y, z);
  });
  let visible = true;
  let opacity = 1;

  return {
    position,
    rotation,
    scale,
    get visible() {
      return visible;
    },
    set visible(value) {
      visible = value;
      target?.setVisible(value);
    },
    get opacity() {
      return opacity;
    },
    set opacity(value) {
      opacity = value;
      target?.setOpacity(value);
    },
  };
}

function createVector3(
  commit: (x: number, y: number, z: number) => void,
): WebGLEffectVector3Like {
  let x = 0;
  let y = 0;
  let z = 0;

  return {
    get x() {
      return x;
    },
    set x(value) {
      x = value;
      commit(x, y, z);
    },
    get y() {
      return y;
    },
    set y(value) {
      y = value;
      commit(x, y, z);
    },
    get z() {
      return z;
    },
    set z(value) {
      z = value;
      commit(x, y, z);
    },
    set(nextX, nextY, nextZ = 0) {
      x = nextX;
      y = nextY;
      z = nextZ;
      commit(x, y, z);
    },
  };
}

function createScale(
  commit: (x: number, y: number, z: number) => void,
): WebGLEffectScaleLike {
  let x = 1;
  let y = 1;
  let z = 1;

  return {
    get x() {
      return x;
    },
    set x(value) {
      x = value;
      commit(x, y, z);
    },
    get y() {
      return y;
    },
    set y(value) {
      y = value;
      commit(x, y, z);
    },
    get z() {
      return z;
    },
    set z(value) {
      z = value;
      commit(x, y, z);
    },
    set(nextX, nextY, nextZ = 1) {
      x = nextX;
      y = nextY;
      z = nextZ;
      commit(x, y, z);
    },
    setScalar(value) {
      x = value;
      y = value;
      z = value;
      commit(x, y, z);
    },
  };
}
