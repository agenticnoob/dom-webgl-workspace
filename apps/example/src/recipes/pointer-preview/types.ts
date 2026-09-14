export type PointerPreviewItem = {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly label?: string;
  readonly description: string;
  readonly href: string;
  readonly image?: {
    readonly src: string;
    readonly alt: string;
    readonly width: number;
    readonly height: number;
  };
};

export type PointerPreviewDirectoryProps = {
  readonly id?: string;
  readonly items: readonly PointerPreviewItem[];
  readonly title?: string;
  readonly intro?: string;
  readonly footer?: string;
  readonly className?: string;
};
