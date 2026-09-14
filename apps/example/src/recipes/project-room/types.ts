export type ProjectRoomItem = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly linkLabel?: string;
};

/** A square room has exactly four walls, ordered clockwise. */
export type ProjectRoomItems = readonly [
  ProjectRoomItem,
  ProjectRoomItem,
  ProjectRoomItem,
  ProjectRoomItem,
];

export type ProjectRoomPalette = {
  readonly background: string;
  readonly foreground: string;
};

export type ProjectRoomLabels = {
  readonly hint: string;
  readonly navigation: string;
  readonly previous: string;
  readonly next: string;
  readonly visit: string;
};

export type ProjectRoomProps = {
  /** Unique within the parent runtime; also prefixes DOM, scene, pass and target IDs. */
  readonly id: string;
  readonly items: ProjectRoomItems;
  readonly title?: string;
  readonly palette?: ProjectRoomPalette;
  readonly labels?: Partial<ProjectRoomLabels>;
  readonly initialSelected?: 0 | 1 | 2 | 3;
  readonly className?: string;
};
