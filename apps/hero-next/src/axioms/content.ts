import type { HeroLocale } from "../preferences/locale";
import type { HeroChapterLocalizedContent } from "../chapters/content";
import type { AxiomsArticle, AxiomsArticleContent } from "./model";

// This ordered collection is the only article registry. Keep translations with their stable ID.
export const heroAxiomsArticles: readonly AxiomsArticle[] = [
  {
    id: "ai-premises",
    translations: {
      zh: {
        label: "命题一",
        title: "AI 改写问题的前提",
        body: "当智能系统能够承担越来越完整的执行链，变化不再只是效率提升，而会进入角色、责任和组织结构本身。",
      },
      en: {
        label: "PROPOSITION ONE",
        title: "AI rewrites the premises",
        body: "As intelligent systems take on complete chains of execution, change moves beyond efficiency into roles, responsibility, and organizational structure.",
      },
    },
  },
  {
    id: "agent-first",
    translations: {
      zh: {
        label: "命题二",
        title: "AI-native 必然走向 Agent-first",
        body: "如果主要操作者开始从人转向 Agent，软件就不应只为人的界面习惯优化，而应优先提供稳定契约、明确权限、状态、证据和恢复路径。",
      },
      en: {
        label: "PROPOSITION TWO",
        title: "AI-native becomes agent-first",
        body: "When agents become primary operators, software should prioritize stable contracts, explicit permissions, state, evidence, and recovery paths over human interface conventions alone.",
      },
    },
  },
  {
    id: "language-projection",
    translations: {
      zh: {
        label: "命题三",
        title: "语言可能只是认知的投影",
        body: "流畅表达不必然等同于理解。语言是线性而有损的通道，智能或许存在更高维、并行且难以完整翻译的内部形态。",
      },
      en: {
        label: "PROPOSITION THREE",
        title: "Language may be a projection",
        body: "Fluent expression is not identical to understanding. Language is a linear, lossy channel; intelligence may inhabit higher-dimensional forms that resist complete translation.",
      },
    },
  },
  {
    id: "accountable-automation",
    translations: {
      zh: {
        label: "命题四",
        title: "自动化不能消解责任",
        body: "Agent 可以承担复杂执行，但不可逆边界、价值判断和最终发布仍需要明确的责任主体。能力越强，治理与审计越重要。",
      },
      en: {
        label: "PROPOSITION FOUR",
        title: "Automation does not dissolve responsibility",
        body: "Agents can execute complex work, but irreversible boundaries, value choices, and final publication still need accountable human ownership.",
      },
    },
  },
];

export function localizeAxiomsArticles(
  articles: readonly AxiomsArticle[],
  locale: HeroLocale,
): readonly AxiomsArticleContent[] {
  return articles.map(({ id, paper, translations }) => ({
    id,
    paper,
    ...translations[locale],
  }));
}

export const heroAxiomsContent = {
  zh: {
    portal: {
      left: {
        label: "02 / 公理",
        body: "AI 会改进旧世界，还是让旧问题本身失效？",
      },
      right: {
        label: "持续追问",
        items: ["认知与语言", "递归与涌现", "责任与自由"],
      },
    },
    body: {
      eyebrow: "AXIOMS / WORKING NOTES",
      title: "真正的颠覆，不只是更好的答案。",
      intro:
        "我关心 AI 今天能完成什么，也更关心它会不会改变软件、组织、认知乃至人类理解世界的前提。以下不是终局判断，而是持续接受证据修正的工作命题。",
      sections: localizeAxiomsArticles(heroAxiomsArticles, "zh"),
    },
  },
  en: {
    portal: {
      left: {
        label: "02 / AXIOMS",
        body: "Will AI improve the old world, or make its questions obsolete?",
      },
      right: {
        label: "OPEN QUESTIONS",
        items: [
          "Cognition and language",
          "Recursion and emergence",
          "Agency and freedom",
        ],
      },
    },
    body: {
      eyebrow: "AXIOMS / WORKING NOTES",
      title: "Disruption is more than producing better answers.",
      intro:
        "I care about what AI can do today, and even more about whether it changes the premises of software, organizations, cognition, and how humans understand the world. These are working propositions, not final truths.",
      sections: localizeAxiomsArticles(heroAxiomsArticles, "en"),
    },
  },
} satisfies Readonly<Record<HeroLocale, HeroChapterLocalizedContent>>;

export function getAxiomsContent(locale: HeroLocale) {
  return heroAxiomsContent[locale];
}
