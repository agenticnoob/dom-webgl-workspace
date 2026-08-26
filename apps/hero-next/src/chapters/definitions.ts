type Vector3 = readonly [number, number, number];

type HeroChapterDefinitionShape = {
  readonly ordinal: number;
  readonly number: string;
  readonly signals: {
    readonly entry: string;
    readonly exit: string;
  };
  readonly face: {
    readonly normal: Vector3;
    readonly up: Vector3;
    readonly right: Vector3;
    readonly targetRotation: Vector3;
  };
  readonly atlas: {
    readonly column: number;
    readonly row: number;
    readonly uvOffset: readonly [number, number];
  };
};

export const heroChapterDefinitions = {
  self: {
    ordinal: 1,
    number: "01",
    signals: {
      entry: "hero.chapter-1.entry",
      exit: "hero.chapter-1.exit",
    },
    face: {
      normal: [-1, 1, 1],
      up: [2, 1, 1],
      right: [0, -1, 1],
      targetRotation: [-0.5158110562, 0.7853981634, 1.5707963268],
    },
    atlas: { column: 0, row: 0, uvOffset: [0, 0.5] },
  },
  axioms: {
    ordinal: 2,
    number: "02",
    signals: {
      entry: "hero.chapter-2.entry",
      exit: "hero.chapter-2.exit",
    },
    face: {
      normal: [1, 1, -1],
      up: [1, 1, 2],
      right: [-1, 1, 0],
      targetRotation: [-2.086607383, 0, -2.3561944902],
    },
    atlas: { column: 1, row: 0, uvOffset: [0.5, 0.5] },
  },
  builds: {
    ordinal: 3,
    number: "03",
    signals: {
      entry: "hero.chapter-3.entry",
      exit: "hero.chapter-3.exit",
    },
    face: {
      normal: [1, -1, 1],
      up: [1, 2, 1],
      right: [1, 0, -1],
      targetRotation: [-0.5158110562, -0.7853981634, 0],
    },
    atlas: { column: 0, row: 1, uvOffset: [0, 0] },
  },
  signals: {
    ordinal: 4,
    number: "04",
    signals: {
      entry: "hero.chapter-4.entry",
      exit: "hero.chapter-4.exit",
    },
    face: {
      normal: [-1, -1, -1],
      up: [-1, 2, -1],
      right: [-1, 0, 1],
      targetRotation: [2.6257815974, 0.7853981634, -3.1415926536],
    },
    atlas: { column: 1, row: 1, uvOffset: [0.5, 0] },
  },
} as const satisfies Record<string, HeroChapterDefinitionShape>;

export type HeroChapterId = keyof typeof heroChapterDefinitions;
export type HeroChapterDefinition =
  (typeof heroChapterDefinitions)[HeroChapterId];

export const heroChapterOrder = [
  "self",
  "axioms",
  "builds",
  "signals",
] as const satisfies readonly HeroChapterId[];

export const heroChapterCount = heroChapterOrder.length;

export function getHeroChapterDefinition(
  chapterId: HeroChapterId,
): HeroChapterDefinition {
  return heroChapterDefinitions[chapterId];
}
