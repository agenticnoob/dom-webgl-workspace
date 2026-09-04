import type { HeroChapterId } from "./definitions";
import type { HeroLocale } from "../preferences/locale";

export type HeroChapterLink = {
  readonly href: string;
  readonly label: string;
};

export type HeroChapterBodyContent = {
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

export type HeroChapterLocalizedContent = {
  readonly portal: {
    readonly left: { readonly label: string; readonly body: string };
    readonly right: {
      readonly label: string;
      readonly items: readonly string[];
    };
  };
  readonly body: HeroChapterBodyContent;
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
    intermediateHub:
      "Back at the complete tetrahedron. Continue to the next chapter.",
    final: {
      eyebrow: "OPEN LOOP / KINDRED MINDS",
      title: "Inquire, then advance",
      summary:
        "May kindred minds inquire and move forward together. What may come of it remains to be seen.",
      linksLabel: "Public connections",
      github: "GitHub",
      blog: "Personal blog",
    },
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
      readonly profileModelLabel: string;
    }
  >
>;

export const heroChapterContent = {
  self: {
    zh: {
      portal: {
        left: {
          label: "01 / 来路",
          body: "一条没有被预先写好的线，穿过军营、校园、城市与代码。",
        },
        right: {
          label: "沿途坐标",
          items: ["号声与晨光", "书页与像素", "智能与自由"],
        },
      },
      body: {
        eyebrow: "SELF / NOOBLI",
        title: "我不是沿一条直线抵达这里。",
        intro:
          "徐力，也叫 noobli。1994 年生；先在军营听过清晨的号声，后来在书页与浏览器的微光里重写自己的方向。如今以独立构建者的身份，继续探问智能、软件与自由如何彼此照亮。",
        sections: [
          {
            label: "2012—2014 / 晨光",
            title: "先学会站立，再学习远行。",
            body: "十八岁那年，时间被号声切成清晰的刻度。两年的军旅没有替我回答远方，却让我懂得：自由从来不是松弛，而是能够为自己的选择站稳。",
          },
          {
            label: "2014—2018 / 书页",
            title: "把被规定的时间，重新交还给疑问。",
            body: "离开军营之后，我回到校园。知识不再是一张通往确定答案的地图，更像一扇扇窗——让我看见，人生可以被重新命名，也可以重新开始。",
          },
          {
            label: "2018—后来 / 像素",
            title: "在浏览器的光里，造过一些可以运行的世界。",
            body: "毕业后，我成为前端开发者，在杭州、温州与上海之间工作和生活。代码把抽象变成可触碰的界面，也让我第一次意识到：秩序并非只能接受，它也可以亲手设计。",
          },
          {
            label: "转身 / 无固定席位",
            title: "离开一张确定的工位，去寻找更完整的生活。",
            body: "后来，我把职业从一个地点里取出，成为自由职业者。那不是逃离工作，而是重新安排工作、时间与生活的关系，让道路本身也成为答案的一部分。",
          },
          {
            label: "此刻 / 未完成",
            title: "让软件理解意图，也让自己继续改变。",
            body: "现在，我把目光投向 AI、Agent 与认知边界：尝试让系统不只执行指令，也能承接意图；同时保留人的判断、责任，以及随时改变方向的权利。",
          },
        ],
        closing: "不把身份写成终点，只把它当作下一次出发前，暂时落下的坐标。",
      },
    },
    en: {
      portal: {
        left: {
          label: "01 / THE WAY HERE",
          body: "An unwritten line through barracks, campus, cities, and code.",
        },
        right: {
          label: "COORDINATES",
          items: [
            "Reveille and dawn",
            "Pages and pixels",
            "Intelligence and freedom",
          ],
        },
      },
      body: {
        eyebrow: "SELF / NOOBLI",
        title: "I did not arrive here in a straight line.",
        intro:
          "Xu Li, also known as noobli, born in 1994. I first heard the day begin with reveille, then rewrote my direction in the quiet glow of books and browsers. Now, as an independent builder, I keep asking how intelligence, software, and freedom might illuminate one another.",
        sections: [
          {
            label: "2012—2014 / DAWN",
            title: "First, learn to stand. Then, learn to leave.",
            body: "At eighteen, reveille divided time into exact measures. Two years in the military did not answer where to go, but taught me that freedom is not ease; it is the strength to stand behind a choice.",
          },
          {
            label: "2014—2018 / PAGES",
            title: "Return prescribed time to the keeping of questions.",
            body: "After the barracks, I returned to campus. Knowledge stopped resembling a map to certain answers and became a field of windows: life could be renamed, and begun again.",
          },
          {
            label: "2018—AFTER / PIXELS",
            title:
              "In the browser's light, I built small worlds that could run.",
            body: "After graduation, I worked as a front-end developer across Hangzhou, Wenzhou, and Shanghai. Code turned abstraction into touchable surfaces and revealed that order need not only be accepted; it can be designed.",
          },
          {
            label: "TURNING / NO FIXED SEAT",
            title: "I left a certain desk in search of a more whole life.",
            body: "Later, I lifted work out of a single place and became a freelancer. It was not an escape from work, but a new arrangement between work, time, and life—letting the road become part of the answer.",
          },
          {
            label: "NOW / UNFINISHED",
            title:
              "Let software understand intent—and let the self keep changing.",
            body: "Today I look toward AI, agents, and the edges of cognition: building systems that can carry intent, while preserving human judgment, responsibility, and the right to change direction.",
          },
        ],
        closing:
          "I do not write identity as an ending—only as a coordinate set down briefly before the next departure.",
      },
    },
  },
  axioms: {
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
  builds: {
    zh: {
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
        title:
          "Agents must be able to use it. Direct human use can become secondary.",
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
  signals: {
    zh: {
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
            link: {
              href: heroPublicLinks.githubProfile,
              label: "前往 GitHub",
            },
          },
        ],
        closing: "愿与同道者共研同进，或有所得，亦未可知。",
      },
    },
    en: {
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
            link: {
              href: heroPublicLinks.blog,
              label: "Visit the personal blog",
            },
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
            link: {
              href: heroPublicLinks.githubProfile,
              label: "Visit GitHub",
            },
          },
        ],
        closing:
          "May kindred minds inquire and move forward together. What may come of it remains to be seen.",
      },
    },
  },
} as const satisfies Readonly<
  Record<
    HeroChapterId,
    Readonly<Record<HeroLocale, HeroChapterLocalizedContent>>
  >
>;

export function getHeroChapterContent(
  chapterId: HeroChapterId,
  locale: HeroLocale,
): HeroChapterLocalizedContent {
  return heroChapterContent[chapterId][locale];
}
