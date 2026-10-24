export type Vector3 = readonly [number, number, number];
export type Quaternion = readonly [number, number, number, number];

export function quaternionFromBasis(
  right: Vector3,
  up: Vector3,
  forward: Vector3,
): Quaternion {
  const m11 = right[0];
  const m12 = up[0];
  const m13 = forward[0];
  const m21 = right[1];
  const m22 = up[1];
  const m23 = forward[1];
  const m31 = right[2];
  const m32 = up[2];
  const m33 = forward[2];
  const trace = m11 + m22 + m33;

  if (trace > 0) {
    const scale = 0.5 / Math.sqrt(trace + 1);
    return normalizeQuaternion([
      (m32 - m23) * scale,
      (m13 - m31) * scale,
      (m21 - m12) * scale,
      0.25 / scale,
    ]);
  }
  if (m11 > m22 && m11 > m33) {
    const scale = 2 * Math.sqrt(1 + m11 - m22 - m33);
    return normalizeQuaternion([
      0.25 * scale,
      (m12 + m21) / scale,
      (m13 + m31) / scale,
      (m32 - m23) / scale,
    ]);
  }
  if (m22 > m33) {
    const scale = 2 * Math.sqrt(1 + m22 - m11 - m33);
    return normalizeQuaternion([
      (m12 + m21) / scale,
      0.25 * scale,
      (m23 + m32) / scale,
      (m13 - m31) / scale,
    ]);
  }

  const scale = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return normalizeQuaternion([
    (m13 + m31) / scale,
    (m23 + m32) / scale,
    0.25 * scale,
    (m21 - m12) / scale,
  ]);
}

export function quaternionFromEuler([x, y, z]: Vector3): Quaternion {
  const cosineX = Math.cos(x / 2);
  const cosineY = Math.cos(y / 2);
  const cosineZ = Math.cos(z / 2);
  const sineX = Math.sin(x / 2);
  const sineY = Math.sin(y / 2);
  const sineZ = Math.sin(z / 2);

  return [
    sineX * cosineY * cosineZ + cosineX * sineY * sineZ,
    cosineX * sineY * cosineZ - sineX * cosineY * sineZ,
    cosineX * cosineY * sineZ + sineX * sineY * cosineZ,
    cosineX * cosineY * cosineZ - sineX * sineY * sineZ,
  ];
}

export function multiplyQuaternions(
  left: Quaternion,
  right: Quaternion,
): Quaternion {
  const [leftX, leftY, leftZ, leftW] = left;
  const [rightX, rightY, rightZ, rightW] = right;
  return [
    leftX * rightW + leftW * rightX + leftY * rightZ - leftZ * rightY,
    leftY * rightW + leftW * rightY + leftZ * rightX - leftX * rightZ,
    leftZ * rightW + leftW * rightZ + leftX * rightY - leftY * rightX,
    leftW * rightW - leftX * rightX - leftY * rightY - leftZ * rightZ,
  ];
}

export function slerpQuaternions(
  start: Quaternion,
  end: Quaternion,
  progress: number,
): Quaternion {
  const safeProgress = clampProgress(progress);
  let target = end;
  let cosine = dotQuaternion(start, target);
  if (cosine < 0) {
    target = scaleQuaternion(target, -1);
    cosine = -cosine;
  }

  if (cosine > 0.9995) {
    return normalizeQuaternion(
      addQuaternions(
        scaleQuaternion(start, 1 - safeProgress),
        scaleQuaternion(target, safeProgress),
      ),
    );
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const sine = Math.sin(theta);
  return addQuaternions(
    scaleQuaternion(start, Math.sin((1 - safeProgress) * theta) / sine),
    scaleQuaternion(target, Math.sin(safeProgress * theta) / sine),
  );
}

export function eulerFromQuaternion([x, y, z, w]: Quaternion): Vector3 {
  const matrix11 = 1 - 2 * (y * y + z * z);
  const matrix12 = 2 * (x * y - z * w);
  const matrix13 = 2 * (x * z + y * w);
  const matrix22 = 1 - 2 * (x * x + z * z);
  const matrix23 = 2 * (y * z - x * w);
  const matrix32 = 2 * (y * z + x * w);
  const matrix33 = 1 - 2 * (x * x + y * y);
  const rotationY = Math.asin(Math.max(-1, Math.min(1, matrix13)));

  if (Math.abs(matrix13) < 0.9999999) {
    return [
      Math.atan2(-matrix23, matrix33),
      rotationY,
      Math.atan2(-matrix12, matrix11),
    ];
  }

  return [Math.atan2(matrix32, matrix22), rotationY, 0];
}

export function rotateVector(vector: Vector3, quaternion: Quaternion): Vector3 {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(...vector);
  return scaleVector(vector, 1 / length);
}

function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const length = Math.hypot(...quaternion);
  return scaleQuaternion(quaternion, 1 / length);
}

export function addVectors(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function scaleVector(vector: Vector3, multiplier: number): Vector3 {
  return [
    vector[0] * multiplier,
    vector[1] * multiplier,
    vector[2] * multiplier,
  ];
}

export function lerpVector(
  start: Vector3,
  end: Vector3,
  progress: number,
): Vector3 {
  return [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress),
    lerp(start[2], end[2], progress),
  ];
}

function addQuaternions(left: Quaternion, right: Quaternion): Quaternion {
  return [
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2],
    left[3] + right[3],
  ];
}

function scaleQuaternion(
  quaternion: Quaternion,
  multiplier: number,
): Quaternion {
  return [
    quaternion[0] * multiplier,
    quaternion[1] * multiplier,
    quaternion[2] * multiplier,
    quaternion[3] * multiplier,
  ];
}

function dotQuaternion(left: Quaternion, right: Quaternion): number {
  return (
    left[0] * right[0] +
    left[1] * right[1] +
    left[2] * right[2] +
    left[3] * right[3]
  );
}

export function dotVector(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function lerp(start: number, end: number, progress: number): number {
  const safeProgress = clampProgress(progress);
  return start + (end - start) * safeProgress;
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
