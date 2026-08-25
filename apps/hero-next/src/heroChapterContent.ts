export const heroLocales = ["zh", "en"] as const;

export type HeroLocale = (typeof heroLocales)[number];
export type HeroChapterId = "self" | "axioms" | "builds" | "signals";

export type HeroChapterLink = {
  readonly href: string;
  readonly label: string;
};

export type HeroChapterLocalizedContent = {
  readonly faceLabel: string;
  readonly frame: {
    readonly eyebrow: string;
    readonly titleLines: readonly string[];
    readonly summary: string;
    readonly signals: readonly [
      { readonly label: string; readonly value: string },
      { readonly label: string; readonly value: string },
    ];
  };
  readonly portal: {
    readonly left: { readonly label: string; readonly body: string };
    readonly right: {
      readonly label: string;
      readonly items: readonly string[];
    };
  };
  readonly body: {
    readonly eyebrow: string;
    readonly title: string;
    readonly intro: string;
    readonly sections: readonly {
      readonly label: string;
      readonly title: string;
      readonly body: string;
      readonly link?: HeroChapterLink;
    }[];
    readonly closing?: string;
  };
};

export type HeroChapter = {
  readonly id: HeroChapterId;
  readonly number: string;
  readonly content: Readonly<Record<HeroLocale, HeroChapterLocalizedContent>>;
};

export const heroPublicLinks = {
  githubProfile: "https://github.com/agenticnoob",
  currentProject: "https://github.com/agenticnoob/dom-webgl-workspace",
  blog: "https://blog.zzzxc.com",
} as const;

export const heroSiteContent = {
  zh: {
    ariaLabel: "noobli 的四章节 Agent-first 个人站",
    localeControlLabel: "选择语言",
    intro: {
      eyebrow: "NOOBLI / 独立构建者",
      title: "为智能体重新思考软件",
      summary: "在技术、认知与自由的交界处，构建 AI-native 系统。",
      hint: "滚动进入四个章节 · 长按四面体切换主题",
    },
    intermediateHub: "回到完整四面体，继续前往下一章。",
    final: {
      eyebrow: "OPEN LOOP / 同道",
      title: "共研，同进",
      summary: "愿与同道者共研同进，或有所得，亦未可知。",
      linksLabel: "公开连接",
      github: "GitHub",
      blog: "个人博客",
    },
    continueLabel: "继续前往章节出口",
    profileModelLabel: "抽象个人形象",
  },
  en: {
    ariaLabel: "noobli's four-chapter agent-first personal site",
    localeControlLabel: "Choose language",
    intro: {
      eyebrow: "NOOBLI / INDEPENDENT BUILDER",
      title: "Rethinking software for agents",
      summary:
        "Building AI-native systems where technology, cognition, and freedom meet.",
      hint: "Scroll through four chapters · Hold the tetrahedron to switch theme",
    },
    intermediateHub: "Back at the complete tetrahedron. Continue to the next chapter.",
    final: {
      eyebrow: "OPEN LOOP / KINDRED MINDS",
      title: "Inquire, then advance",
      summary:
        "May kindred minds inquire and move forward together. What may come of it remains to be seen.",
      linksLabel: "Public connections",
      github: "GitHub",
      blog: "Personal blog",
    },
    continueLabel: "Continue to the chapter exit",
    profileModelLabel: "Abstract personal figure",
  },
} as const satisfies Readonly<
  Record<
    HeroLocale,
    {
      readonly ariaLabel: string;
      readonly localeControlLabel: string;
      readonly intro: {
        readonly eyebrow: string;
        readonly title: string;
        readonly summary: string;
        readonly hint: string;
      };
      readonly intermediateHub: string;
      readonly final: {
        readonly eyebrow: string;
        readonly title: string;
        readonly summary: string;
        readonly linksLabel: string;
        readonly github: string;
        readonly blog: string;
      };
      readonly continueLabel: string;
      readonly profileModelLabel: string;
    }
  >
>;

export const heroChapters = [
  {
    id: "self",
    number: "01",
    content: {
      zh: {
        faceLabel: "自我",
        frame: {
          eyebrow: "NOOBLI / 01",
          titleLines: ["在变化中", "持续构建"],
          summary: "我是 noobli，一名关注 AI、软件与认知边界的独立构建者。",
          signals: [
            { label: "方向", value: "AI-NATIVE" },
            { label: "原则", value: "AGENT-FIRST" },
          ],
        },
        portal: {
          left: {
            label: "01 / 自我",
            body: "我是谁、我做什么，以及我为什么这样构建。",
          },
          right: {
            label: "身份坐标",
            items: ["独立构建者", "AI-native", "Agent-first"],
          },
        },
        body: {
          eyebrow: "SELF / NOOBLI",
          title: "我构建系统，也持续校正自己的判断。",
          intro:
            "我把模糊的问题拆成可以验证的系统，用技术减少重复劳动、扩大选择，同时保留人的责任与最终控制。",
          sections: [
            {
              label: "工作",
              title: "独立构建",
              body: "围绕 AI Agent、自动化、内容系统和开放工具持续实验，让想法尽快进入可以运行和验证的状态。",
            },
            {
              label: "方法",
              title: "从真实问题出发",
              body: "先确认事实与边界，再建立可观察、可审计、可回退的完整工作流。大胆实验，但不把未经验证的结果当作结论。",
            },
            {
              label: "理念",
              title: "自由来自可设计的结构",
              body: "技术的价值不仅是效率，也在于减少对固定工具、地点和既定路径的依赖，把时间交还给真正重要的问题。",
            },
          ],
        },
      },
      en: {
        faceLabel: "SELF",
        frame: {
          eyebrow: "NOOBLI / 01",
          titleLines: ["BUILDING", "THROUGH CHANGE"],
          summary:
            "I am noobli, an independent builder working at the edges of AI, software, and cognition.",
          signals: [
            { label: "DIRECTION", value: "AI-NATIVE" },
            { label: "PRINCIPLE", value: "AGENT-FIRST" },
          ],
        },
        portal: {
          left: {
            label: "01 / SELF",
            body: "Who I am, what I build, and why I work this way.",
          },
          right: {
            label: "COORDINATES",
            items: ["Independent builder", "AI-native", "Agent-first"],
          },
        },
        body: {
          eyebrow: "SELF / NOOBLI",
          title: "I build systems while continuously revising my own model.",
          intro:
            "I turn ambiguous questions into systems that can be tested, using technology to reduce repetition and expand choice while preserving human responsibility and final control.",
          sections: [
            {
              label: "WORK",
              title: "Independent building",
              body: "I experiment with AI agents, automation, content systems, and open tools so ideas can become runnable and verifiable quickly.",
            },
            {
              label: "METHOD",
              title: "Start from a real problem",
              body: "Establish facts and boundaries first, then build observable, auditable, reversible workflows. Experiment boldly without promoting unverified output into truth.",
            },
            {
              label: "BELIEF",
              title: "Freedom needs designed structure",
              body: "Technology matters not only for efficiency, but for reducing dependence on fixed tools and paths, returning time to questions that truly matter.",
            },
          ],
        },
      },
    },
  },
  {
    id: "axioms",
    number: "02",
    content: {
      zh: {
        faceLabel: "公理",
        frame: {
          eyebrow: "AXIOMS / 02",
          titleLines: ["改变答案之前", "先改变前提"],
          summary: "AI 的深层影响，可能是重新书写问题赖以成立的公理。",
          signals: [
            { label: "变化", value: "PREMISES" },
            { label: "智能", value: "BEYOND LANGUAGE" },
          ],
        },
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
          sections: [
            {
              label: "命题一",
              title: "AI 改写问题的前提",
              body: "当智能系统能够承担越来越完整的执行链，变化不再只是效率提升，而会进入角色、责任和组织结构本身。",
            },
            {
              label: "命题二",
              title: "AI-native 必然走向 Agent-first",
              body: "如果主要操作者开始从人转向 Agent，软件就不应只为人的界面习惯优化，而应优先提供稳定契约、明确权限、状态、证据和恢复路径。",
            },
            {
              label: "命题三",
              title: "语言可能只是认知的投影",
              body: "流畅表达不必然等同于理解。语言是线性而有损的通道，智能或许存在更高维、并行且难以完整翻译的内部形态。",
            },
            {
              label: "命题四",
              title: "自动化不能消解责任",
              body: "Agent 可以承担复杂执行，但不可逆边界、价值判断和最终发布仍需要明确的责任主体。能力越强，治理与审计越重要。",
            },
          ],
        },
      },
      en: {
        faceLabel: "AXIOMS",
        frame: {
          eyebrow: "AXIOMS / 02",
          titleLines: ["CHANGE", "THE PREMISES"],
          summary:
            "AI may matter most when it rewrites the axioms that made our old questions possible.",
          signals: [
            { label: "CHANGE", value: "PREMISES" },
            { label: "INTELLIGENCE", value: "BEYOND LANGUAGE" },
          ],
        },
        portal: {
          left: {
            label: "02 / AXIOMS",
            body: "Will AI improve the old world, or make its questions obsolete?",
          },
          right: {
            label: "OPEN QUESTIONS",
            items: ["Cognition and language", "Recursion and emergence", "Agency and freedom"],
          },
        },
        body: {
          eyebrow: "AXIOMS / WORKING NOTES",
          title: "Disruption is more than producing better answers.",
          intro:
            "I care about what AI can do today, and even more about whether it changes the premises of software, organizations, cognition, and how humans understand the world. These are working propositions, not final truths.",
          sections: [
            {
              label: "PROPOSITION ONE",
              title: "AI rewrites the premises",
              body: "As intelligent systems take on complete chains of execution, change moves beyond efficiency into roles, responsibility, and organizational structure.",
            },
            {
              label: "PROPOSITION TWO",
              title: "AI-native becomes agent-first",
              body: "When agents become primary operators, software should prioritize stable contracts, explicit permissions, state, evidence, and recovery paths over human interface conventions alone.",
            },
            {
              label: "PROPOSITION THREE",
              title: "Language may be a projection",
              body: "Fluent expression is not identical to understanding. Language is a linear, lossy channel; intelligence may inhabit higher-dimensional forms that resist complete translation.",
            },
            {
              label: "PROPOSITION FOUR",
              title: "Automation does not dissolve responsibility",
              body: "Agents can execute complex work, but irreversible boundaries, value choices, and final publication still need accountable human ownership.",
            },
          ],
        },
      },
    },
  },
  {
    id: "builds",
    number: "03",
    content: {
      zh: {
        faceLabel: "构建",
        frame: {
          eyebrow: "BUILDS / 03",
          titleLines: ["让智能体", "读懂并行动"],
          summary: "不是给人的功能再套一层 AI，而是重新定义软件的第一使用者。",
          signals: [
            { label: "当前", value: "VISELORA" },
            { label: "证据", value: "PUBLIC GITHUB" },
          ],
        },
        portal: {
          left: {
            label: "03 / 构建",
            body: "思想需要进入真实系统，才能暴露自己的边界。",
          },
          right: {
            label: "构建原则",
            items: ["可发现", "可操作", "可验证"],
          },
        },
        body: {
          eyebrow: "BUILDS / EVIDENCE",
          title: "Agent 一定要会用，人能否直接使用可以成为次要问题。",
          intro:
            "我希望未来的构建从 Agent 的理解与执行成本出发：能力必须容易发现，契约必须稳定，结果必须可以回读和验证。",
          sections: [
            {
              label: "当前项目",
              title: "Viselora",
              body: "一个开放、可复用的 DOM-first WebGL runtime。它用受控声明、稳定边界、测试与使用技能，把复杂视觉能力变成 Agent 能理解和组合的公共契约。",
              link: {
                href: heroPublicLinks.currentProject,
                label: "在 GitHub 查看当前项目",
              },
            },
            {
              label: "Agent-first",
              title: "降低机器的心智负担",
              body: "为 Agent 提供明确入口、最小权限、结构化状态、可观察执行和可复制验证，而不是要求它在隐式约定中反复猜测。",
            },
            {
              label: "开放实践",
              title: "用真实仓库承担证据",
              body: "源码、文档、测试、运行状态和失败边界共同组成项目证据。展示不是终点，能够被继续理解、修改和验证才是。",
              link: {
                href: heroPublicLinks.githubProfile,
                label: "查看 GitHub 上的更多构建",
              },
            },
          ],
        },
      },
      en: {
        faceLabel: "BUILDS",
        frame: {
          eyebrow: "BUILDS / 03",
          titleLines: ["MAKE AGENTS", "UNDERSTAND AND ACT"],
          summary:
            "Not another AI layer on a human feature, but a new definition of software's first user.",
          signals: [
            { label: "CURRENT", value: "VISELORA" },
            { label: "EVIDENCE", value: "PUBLIC GITHUB" },
          ],
        },
        portal: {
          left: {
            label: "03 / BUILDS",
            body: "Ideas reveal their limits only when they enter real systems.",
          },
          right: {
            label: "BUILD PRINCIPLES",
            items: ["Discoverable", "Operable", "Verifiable"],
          },
        },
        body: {
          eyebrow: "BUILDS / EVIDENCE",
          title: "Agents must be able to use it. Direct human use can become secondary.",
          intro:
            "I want future systems to begin with the agent's cost of understanding and execution: capabilities must be discoverable, contracts stable, and outcomes readable and verifiable.",
          sections: [
            {
              label: "CURRENT PROJECT",
              title: "Viselora",
              body: "An open, reusable DOM-first WebGL runtime. Controlled declarations, stable boundaries, tests, and usage skills turn complex visual capabilities into contracts agents can understand and compose.",
              link: {
                href: heroPublicLinks.currentProject,
                label: "View the current project on GitHub",
              },
            },
            {
              label: "AGENT-FIRST",
              title: "Lower machine cognitive load",
              body: "Give agents explicit entry points, minimal permissions, structured state, observable execution, and reproducible verification instead of making them guess hidden conventions.",
            },
            {
              label: "OPEN PRACTICE",
              title: "Let the repository carry the evidence",
              body: "Source, documentation, tests, runtime state, and failure boundaries form the evidence. A build matters when others can understand, modify, and verify it.",
              link: {
                href: heroPublicLinks.githubProfile,
                label: "Explore more builds on GitHub",
              },
            },
          ],
        },
      },
    },
  },
  {
    id: "signals",
    number: "04",
    content: {
      zh: {
        faceLabel: "联结",
        frame: {
          eyebrow: "SIGNALS / 04",
          titleLines: ["让信号", "抵达同道"],
          summary: "产品、文章与视频，是思考向外部世界留下的不同接口。",
          signals: [
            { label: "思想方向", value: "AXMORF" },
            { label: "持续发布", value: "WORDS / VIDEO" },
          ],
        },
        portal: {
          left: {
            label: "04 / 联结",
            body: "构建之外，也让仍在形成的思想被看见、被质疑。",
          },
          right: {
            label: "公共信号",
            items: ["产品", "文章", "视频"],
          },
        },
        body: {
          eyebrow: "SIGNALS / OPEN LOOP",
          title: "把未完成的思考，放进真实交流。",
          intro:
            "我正在建立一套关于 AI cognition、Agent 与未来软件形态的公共表达。它不是已经定型的答案，而是邀请更多证据和不同经验进入。",
          sections: [
            {
              label: "思想方向",
              title: "AXMORF",
              body: "Change until the axioms morph. 变化持续发生，直到定义世界的公理本身也被改变。这是一个仍在发展的 AI cognition 与思想媒体方向。",
            },
            {
              label: "文字",
              title: "个人博客",
              body: "记录长期思考、实践轨迹与尚未结束的问题，让短暂信号沉淀成可以继续追索的文本。",
              link: { href: heroPublicLinks.blog, label: "前往个人博客" },
            },
            {
              label: "影像",
              title: "AI 视频与公共表达",
              body: "把模型、Agent、产业、安全和未来软件拆解成深入浅出的短视频。正式频道链接将在确认后加入。",
            },
            {
              label: "代码",
              title: "公开构建",
              body: "在 GitHub 上查看可运行的实验、工具与开放项目。",
              link: { href: heroPublicLinks.githubProfile, label: "前往 GitHub" },
            },
          ],
          closing: "愿与同道者共研同进，或有所得，亦未可知。",
        },
      },
      en: {
        faceLabel: "SIGNALS",
        frame: {
          eyebrow: "SIGNALS / 04",
          titleLines: ["LET THE SIGNAL", "FIND ITS PEERS"],
          summary:
            "Products, essays, and videos are different interfaces between thought and the outside world.",
          signals: [
            { label: "THOUGHT DIRECTION", value: "AXMORF" },
            { label: "PUBLISHING", value: "WORDS / VIDEO" },
          ],
        },
        portal: {
          left: {
            label: "04 / SIGNALS",
            body: "Beyond building, let developing ideas be seen and challenged.",
          },
          right: {
            label: "PUBLIC SIGNALS",
            items: ["Products", "Writing", "Video"],
          },
        },
        body: {
          eyebrow: "SIGNALS / OPEN LOOP",
          title: "Put unfinished thought into real exchange.",
          intro:
            "I am developing a public body of work around AI cognition, agents, and the future form of software. It is not a finished answer, but an invitation for more evidence and different experience.",
          sections: [
            {
              label: "THOUGHT DIRECTION",
              title: "AXMORF",
              body: "Change until the axioms morph. A developing direction for AI cognition and public thought, following change until the premises themselves begin to move.",
            },
            {
              label: "WRITING",
              title: "Personal blog",
              body: "Long-form notes on practice, changing beliefs, and questions that remain open.",
              link: { href: heroPublicLinks.blog, label: "Visit the personal blog" },
            },
            {
              label: "VIDEO",
              title: "AI video and public explanation",
              body: "Clear, compact videos about models, agents, industry, safety, and the future of software. A confirmed channel link will be added later.",
            },
            {
              label: "CODE",
              title: "Open builds",
              body: "Runnable experiments, tools, and open projects live on GitHub.",
              link: { href: heroPublicLinks.githubProfile, label: "Visit GitHub" },
            },
          ],
          closing:
            "May kindred minds inquire and move forward together. What may come of it remains to be seen.",
        },
      },
    },
  },
] as const satisfies readonly HeroChapter[];

export function getHeroChapterContent(
  chapter: HeroChapter,
  locale: HeroLocale,
): HeroChapterLocalizedContent {
  return chapter.content[locale];
}
