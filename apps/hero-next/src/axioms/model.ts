import type { HeroLocale } from "../preferences/locale";

export type AxiomsPaperSize = {
  /** Fraction of the available paper area, greater than zero and at most one. */
  readonly width: number;
  readonly height: number;
};

export type AxiomsPaperOptions = { readonly paper?: AxiomsPaperSize };

export type AxiomsArticleCopy = {
  readonly label: string;
  readonly title: string;
  readonly body: string;
};

export type AxiomsArticle = AxiomsPaperOptions & {
  readonly id: string;
  readonly translations: Readonly<Record<HeroLocale, AxiomsArticleCopy>>;
};

export type AxiomsArticleContent = AxiomsPaperOptions &
  AxiomsArticleCopy & {
    readonly id: string;
  };

export type AxiomsReaderContent = {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly AxiomsArticleContent[];
};
