export type WavesNoise = {
  readonly gradP: readonly Grad[];
  readonly perm: readonly number[];
};

type Grad = {
  readonly x: number;
  readonly y: number;
};

export function createWavesNoise(seedInput: number): WavesNoise {
  let seed = seedInput;
  if (seed > 0 && seed < 1) {
    seed *= 65536;
  }
  seed = Math.floor(seed);
  if (seed < 256) {
    seed |= seed << 8;
  }

  const perm: number[] = [];
  const gradP: Grad[] = [];
  for (let index = 0; index < 256; index += 1) {
    const permutation = permutationTable[index] ?? 0;
    const value =
      index & 1
        ? permutation ^ (seed & 255)
        : permutation ^ ((seed >> 8) & 255);
    perm[index] = value;
    perm[index + 256] = value;
    gradP[index] = grad3[value % 12] ?? grad3[0];
    gradP[index + 256] = gradP[index] ?? grad3[0];
  }

  return { gradP, perm };
}

export function perlin2(noise: WavesNoise, xInput: number, yInput: number): number {
  let x = xInput;
  let y = yInput;
  let floorX = Math.floor(x);
  let floorY = Math.floor(y);
  x -= floorX;
  y -= floorY;
  floorX &= 255;
  floorY &= 255;

  const n00 = dot2(readGrad(noise, floorX, floorY), x, y);
  const n01 = dot2(readGrad(noise, floorX, floorY + 1), x, y - 1);
  const n10 = dot2(readGrad(noise, floorX + 1, floorY), x - 1, y);
  const n11 = dot2(readGrad(noise, floorX + 1, floorY + 1), x - 1, y - 1);
  const u = fade(x);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
}

function readGrad(noise: WavesNoise, x: number, y: number): Grad {
  return noise.gradP[x + (noise.perm[y] ?? 0)] ?? grad3[0];
}

function dot2(grad: Grad, x: number, y: number): number {
  return grad.x * x + grad.y * y;
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function lerp(left: number, right: number, amount: number): number {
  return (1 - amount) * left + amount * right;
}

const grad3 = [
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

const permutationTable = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
  36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
  234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
  88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
  134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
  230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63,
  161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135,
  130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226,
  250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59,
  227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152,
  2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39,
  253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246,
  97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51,
  145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184,
  84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222,
  114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
] as const;
