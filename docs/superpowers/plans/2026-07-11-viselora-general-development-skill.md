# Viselora General Development Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `skills/viselora-dom-webgl/` 从五个固定 recipe 的 onboarding skill 升级为面向外部 npm 消费者的通用滚动叙事网站开发 skill，并用发布后的 `.d.ts`、版本化 capability status、selected-capabilities verifier、可运行模板和 CI 漂移守卫证明其公共边界。

**Architecture:** `SKILL.md` 只承担端到端工作流、硬边界和 reference 路由；人工 references 解释能力语义，四份 build 后的公开 `.d.ts` 自动生成完整导出索引，`api-coverage.json` 负责 public value export 到人工文档的映射。消费者通过 `viselora.capabilities.json` 只声明项目选择的 capabilities，verifier 从 `capability-status.md` 读取当前版本状态并按选中能力执行 AST、fallback、asset manifest 与 evidence 检查，不再把五个示例当成必选范围。

**Tech Stack:** Node.js 24 ESM、TypeScript compiler API 5.8、Vitest 3、React 19 / `@types/react` 19.2+、Vite 6、Markdown、JSON、GitHub Actions、现有 npm workspaces。

## Global Constraints

- Compatible package version 固定为 `0.1.0-alpha.0`；本计划不升级 package version。
- 外部 agent 只能依赖 `@viselora/dom-webgl`、`@viselora/dom-webgl/react`、`@viselora/scroll-adapters`、`@viselora/scroll-adapters/react`、发布 `.d.ts`、skill 和消费者/公共资产。
- 不修改 runtime 行为、npm public API、package README 的 API contract，也不修改 `/Users/ai/AgentWorkspace/projects/viselora-consumer-mvp`。
- 保持一个 runtime/canvas、一个 scroll source、一个 pointer source；禁止 R3F、第二个 renderer、raw Three.js ownership、consumer render loop 和私有源码导入。
- `SKILL.md` 保持精简；叙事、资产、API、lifecycle/debug、status、troubleshooting 和 verification 细节放入一跳可达的 references。
- 先盘点和复用已有静态资源；新增资源必须本地化并记录来源、作者、许可证、用途、修改和 fallback，生产环境禁止 hotlink。
- `verified`、`experimental`、`blocked` 都是与 package version 绑定的证据状态；API 存在不等于 visible output 已验证。
- `surface-pulse-visible-output` 和 `dom-anchored-glb-visible-output` 在 `0.1.0-alpha.0` 为 blocked defect candidate；`image-sequence` 在完成外部验证前为 experimental。
- 五个原 recipe 继续作为可选示例，但不定义 skill 能力边界；普通模板不得默认选中 blocked 或 experimental capability。
- 本任务只完善 skill、模板、文档、verifier 和仓库内自检；不创建新的真实消费者项目，不新增真实消费者 Playwright/E2E，不对新项目的实际使用体验作完成结论。浏览器与叙事质量要求由 skill 写入下游工作流，留待用户在独立新项目中执行。
- 当前实施阶段只允许本地 commit checkpoint，不执行 push、reset、覆盖、删除、发布或外部 consumer 写入。

---

## File Map And Responsibility Boundaries

### Skill entry and routing

- Modify `skills/viselora-dom-webgl/SKILL.md`: brief → directions → beats → assets → capability map → implementation → browser/narrative verification 的短工作流和 reference 路由。
- Modify `skills/viselora-dom-webgl/agents/openai.yaml`: display copy/default prompt 与通用滚动叙事能力同步。
- Modify `skills/viselora-dom-webgl/references/quickstart.md`: exact alpha、React 类型下限、manifest 起步路径和最短验证命令。
- Modify `skills/viselora-dom-webgl/references/architecture-rules.md`: 统一 runtime/canvas/input ownership、DOM-first fallback 和稳定引用规则。

### Narrative and assets

- Create `skills/viselora-dom-webgl/references/narrative-design.md`: 2–3 个方向、4–8 个 beats、滚动节奏、互动密度、mobile/reduced-motion 和叙事 QA。
- Create `skills/viselora-dom-webgl/references/asset-pipeline.md`: 图片、视频、GLB、序列、字体的本地化、license、metadata、fallback 和 hotlink 禁令。
- Create `skills/viselora-dom-webgl/templates/story-plan.md`: brief、方向比较、selected direction、story beats、capability/status、验证矩阵。
- Create `skills/viselora-dom-webgl/templates/asset-manifest.json`: 可复制的 license-aware 本地资产记录格式。

### Public API documentation and status

- Modify `skills/viselora-dom-webgl/references/public-api.md`: 四个公开 entrypoint 的导航页，不再手工承担完整 export inventory。
- Create `skills/viselora-dom-webgl/references/api-effects-rendering.md`: runtime、target、effect、surface/material/texture/text/postprocess/scheduling。
- Create `skills/viselora-dom-webgl/references/api-scenes-models.md`: scene/camera/pass/viewport/stage/light/model/animation/morph/rig/sampling/placement。
- Create `skills/viselora-dom-webgl/references/api-scroll-interaction.md`: adapters、timeline/progress、pointer/picking、camera gestures、drag、physics。
- Create `skills/viselora-dom-webgl/references/api-lifecycle-debug.md`: loading/status/fallback/offscreen/budget/debug selector/disposal/SSR/blank-pixel diagnostics。
- Create `skills/viselora-dom-webgl/references/capability-status.md`: `0.1.0-alpha.0` 的 authoritative versioned matrix。
- Create generated `skills/viselora-dom-webgl/references/api-surface.generated.md`: 四份发布 `.d.ts` 的 deterministic export index。
- Create `skills/viselora-dom-webgl/references/api-coverage.json`: 每个 entrypoint 的 public value export → reference/section/status id 映射。
- Create `skills/viselora-dom-webgl/scripts/generate-api-surface.mjs`: 解析 build 后 `.d.ts`，支持 write/check 两种模式。
- Create `skills/viselora-dom-webgl/scripts/check-api-coverage.mjs`: 校验 value coverage、stale mappings、type index、版本、generated drift 和 status coverage。

### Consumer selection and examples

- Modify `skills/viselora-dom-webgl/scripts/verify-consumer.mjs`: 从固定五 recipe 改为 `viselora.capabilities.json` 驱动的条件验证。
- Modify `skills/viselora-dom-webgl/references/effect-recipes.md`: 五例改成 status-aware optional examples；修正 hover；blocked/experimental 不作为 copy-and-ship default。
- Modify `skills/viselora-dom-webgl/references/troubleshooting.md`: 五类 failure routing 和 ready/active 但无最终像素的 defect reproduction 路径。
- Modify `skills/viselora-dom-webgl/references/verification.md`: static/build/browser/narrative 三层验证和 selected capability evidence。
- Modify `skills/viselora-dom-webgl/templates/effects/image-hover-overlay.ts`: `sourceTextureUniform` + `replace-source` + source sampling。
- Modify `skills/viselora-dom-webgl/templates/effects/surface-pulse.ts`: 保留 reproduction 示例，但在文件注释和 recipe 文档标 blocked。
- Modify `skills/viselora-dom-webgl/templates/effects/pinned-model-glow.tsx`: 区分 GLB lifecycle verified 与 DOM-anchored visible output blocked。
- Modify `skills/viselora-dom-webgl/templates/effects/scroll-image-sequence.tsx`: 标 experimental 和所需 evidence。
- Reshape `skills/viselora-dom-webgl/templates/react-vite/`: 只默认选择 verified 路径，加入 capability/asset/story manifests、完整 Vite/TS 入口和本地示例资产。

### Tests, root verification, and active docs

- Modify `test/skill.test.ts`: 新结构、reference links、metadata、recipe status、selected verifier 正/反例。
- Create `test/skill-api-surface.test.ts`: generator 与 coverage checker 的 red/green/drift/version/status tests。
- Create `scripts/verify-skill-template.mjs`: 在临时目录安装精确 public alpha 后运行 template typecheck/build，不污染 skill 模板。
- Modify `test/workflows.test.ts`: root scripts 和 CI 顺序断言。
- Modify `package.json`: API generate/check、template verify、聚合 `verify:skill` scripts。
- Modify `.github/workflows/verify.yml`: package build 后执行 skill API drift/coverage/template/verifier gate。
- Modify `README.md`, `docs/README.md`, `docs/STATUS.md`, `docs/project-release-validation.md`, `docs/consumer-standard-usage.md`, `docs/agent/package-onboarding.md`: 同步“通用开发 skill”定位和新验证边界；不暗示 runtime capability 扩张。

---

### Task 1: Lock The Skill Structure, Consumer Manifests, And Red Tests

**Files:**
- Modify: `test/skill.test.ts`
- Create: `test/skill-api-surface.test.ts`
- Create later in this task as test fixtures: temporary files only under `mkdtempSync(...)`

**Interfaces:**
- Produces: canonical required-file list; `viselora.capabilities.json` schema expectations; `asset-manifest.json` expectations; CLI contracts `generate-api-surface.mjs [--check] [--root <path>]` and `check-api-coverage.mjs [--root <path>]`.
- Consumes: current `copyTemplate()`, `runVerifier()`, `spawnSync()` patterns in `test/skill.test.ts`.

- [ ] **Step 1: Replace the fixed deliverable and fixed-recipe assertions with the approved structure**

Set `requiredFiles` to the exact sorted set from the File Map, including these additions:

```ts
"references/api-effects-rendering.md",
"references/api-lifecycle-debug.md",
"references/api-scenes-models.md",
"references/api-scroll-interaction.md",
"references/api-surface.generated.md",
"references/api-coverage.json",
"references/asset-pipeline.md",
"references/capability-status.md",
"references/narrative-design.md",
"scripts/check-api-coverage.mjs",
"scripts/generate-api-surface.mjs",
"templates/asset-manifest.json",
"templates/story-plan.md",
"templates/react-vite/asset-manifest.json",
"templates/react-vite/index.html",
"templates/react-vite/src/main.tsx",
"templates/react-vite/src/styles.css",
"templates/react-vite/story-plan.md",
"templates/react-vite/tsconfig.json",
"templates/react-vite/viselora.capabilities.json",
```

Keep the existing optional effect templates. Add assertions that `SKILL.md` links every reference directly, contains the compatible version once, routes rather than duplicates the generated export list, and that every Markdown link under `SKILL.md` resolves inside the skill root.

- [ ] **Step 2: Define selected-capability manifest fixtures in the tests**

Use this exact consumer contract in copied fixtures:

```json
{
  "schemaVersion": 1,
  "compatiblePackageVersion": "0.1.0-alpha.0",
  "mode": "consumer",
  "assetManifest": "./asset-manifest.json",
  "capabilities": [
    {
      "id": "managed-image-hover",
      "checks": [
        "final-canvas-pixel-change",
        "touch-or-scroll-alternative",
        "loading-error-fallback"
      ]
    }
  ]
}
```

Add helpers `readJson(root, path)`, `writeJson(root, path, value)`, `selectCapabilities(root, entries, mode = "consumer")`, and `runScript(path, args)` so tests mutate structured JSON instead of string-splicing manifests.

- [ ] **Step 3: Add verifier acceptance tests that prove unrelated recipes are no longer required**

Add tests with these exact outcomes:

```ts
test("accepts a verified subset without unrelated recipes", () => {
  const fixtureRoot = copyTemplate();
  const result = runVerifier(fixtureRoot);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
});

test("accepts an acknowledged experimental image sequence without requiring video or model", () => {
  const fixtureRoot = copyTemplate();
  selectCapabilities(fixtureRoot, [{
    id: "image-sequence",
    acknowledgement: "experimental",
    checks: [
      "final-canvas-pixel-change",
      "first-frame-fallback",
      "bounded-cache",
      "forward-reverse-scroll"
    ],
  }]);
  installImageSequenceFixture(fixtureRoot);
  expect(runVerifier(fixtureRoot).status).toBe(0);
});
```

Add corresponding rejection tests for missing manifest, unknown capability id, version mismatch, empty capability list, unacknowledged experimental selection, blocked capability in `mode: "consumer"`, blocked capability without `acknowledgement: "blocked-defect-reproduction"`, missing required check name, selected local media missing an asset record, hotlinked production asset, private import, second runtime, unstable effect array, unmanaged scroll/pointer source, and missing selected capability implementation evidence.

- [ ] **Step 4: Add API generator and coverage red tests**

`test/skill-api-surface.test.ts` must:

1. spawn `generate-api-surface.mjs --check --root <repoRoot>` and expect success after implementation;
2. copy a minimal four-entrypoint fixture into a temp root and assert deterministic alphabetical entrypoint/symbol output;
3. mutate one `.d.ts` export and expect `--check` to report `api-surface.generated.md is stale`;
4. remove a public value mapping and expect `check-api-coverage.mjs` to report the entrypoint and symbol;
5. add a stale mapped value and expect a stale-mapping failure;
6. remove one exported type row from generated Markdown and expect a missing-type failure;
7. make package, skill, coverage, or status versions disagree and expect an exact version-mismatch failure;
8. remove a mapped capability status row and expect a missing-status failure.

- [ ] **Step 5: Run the focused tests and preserve the expected red state**

Run:

```bash
npm test -- --run test/skill.test.ts test/skill-api-surface.test.ts
```

Expected: FAIL because the new references, templates, scripts, generated output, manifest-driven verifier, and coverage checker do not exist yet. The failure must be missing/new-contract failures, not a TypeScript syntax error in the tests.

- [ ] **Step 6: Commit the executable specification**

```bash
git add test/skill.test.ts test/skill-api-surface.test.ts
git commit -m "test: specify general Viselora skill contracts"
```

Do not push.

---

### Task 2: Generate The Public API Surface From Built Declarations

**Files:**
- Create: `skills/viselora-dom-webgl/scripts/generate-api-surface.mjs`
- Create: `skills/viselora-dom-webgl/references/api-surface.generated.md`
- Test: `test/skill-api-surface.test.ts`

**Interfaces:**
- Produces: `collectPublicApi(root) -> { version, entrypoints }`; `renderApiSurface(api) -> string`; CLI write/check modes.
- Consumes: four exact `dist/*.d.ts` paths and `packages/*/package.json` versions.

- [ ] **Step 1: Implement CLI parsing and fixed entrypoint metadata**

Use one constant list so generation and tests cannot silently discover private declarations:

```js
const entrypoints = [
  ["@viselora/dom-webgl", "packages/dom-webgl-runtime/dist/index.d.ts"],
  ["@viselora/dom-webgl/react", "packages/dom-webgl-runtime/dist/react.d.ts"],
  ["@viselora/scroll-adapters", "packages/dom-webgl-scroll-adapters/dist/index.d.ts"],
  ["@viselora/scroll-adapters/react", "packages/dom-webgl-scroll-adapters/dist/react.d.ts"],
];
```

Support only `--check` and `--root <absolute-or-relative-path>`; reject unknown flags with usage text and exit code `1`. Resolve output to `skills/viselora-dom-webgl/references/api-surface.generated.md` below the supplied root.

- [ ] **Step 2: Parse exported symbols with the TypeScript compiler API**

Load the repository-local `typescript` package. For each `.d.ts`, create a `SourceFile`, index top-level `type`, `interface`, `class`, `function`, `const`, `enum`, import and module declarations by local name, then read named `export { ... }` specifiers. Classify a specifier as `type` when the specifier/export clause is type-only or its resolved declaration is type-only; otherwise classify it as `value`.

Return exact records:

```ts
type PublicExportRecord = {
  entrypoint: string;
  name: string;
  kind: "type" | "value";
  signature: string;
  origin?: string;
};
```

Normalize signature whitespace to a single line, escape Markdown table delimiters/backticks, and cap summaries at 240 characters with the deterministic suffix `…`. Do not include non-exported bundled helper declarations.

- [ ] **Step 3: Render deterministic Markdown**

The generated file must begin exactly with:

```md
# Generated Public API Surface

> Generated by `scripts/generate-api-surface.mjs` from built package declarations. Do not edit this file manually.

Compatible package version: 0.1.0-alpha.0
```

Render one heading per entrypoint in the constant order. Under each, render a table `Symbol | Kind | Declaration summary | Re-export origin`, sorted first by `kind` (`value`, then `type`) and then by symbol name. Include every exported type and value, even when the same symbol is exported by two entrypoints.

- [ ] **Step 4: Implement write and check modes**

Write mode updates the generated file only when bytes differ and prints `Generated Viselora API surface: <value-count> values, <type-count> types`. Check mode performs no writes; on drift it prints `api-surface.generated.md is stale; run npm run skill:api:generate` to stderr and exits `1`.

- [ ] **Step 5: Build both packages, generate the baseline, and run generator tests**

Run:

```bash
npm run build -w @viselora/dom-webgl
npm run build -w @viselora/scroll-adapters
node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs
npm test -- --run test/skill-api-surface.test.ts -t "API surface"
```

Expected: both builds pass; generated index contains all four entrypoints; generator determinism and stale-output tests pass. Coverage-specific tests may remain red until Task 3.

- [ ] **Step 6: Commit the generator and generated truth**

```bash
git add skills/viselora-dom-webgl/scripts/generate-api-surface.mjs skills/viselora-dom-webgl/references/api-surface.generated.md test/skill-api-surface.test.ts
git commit -m "feat: generate Viselora public API index"
```

---

### Task 3: Add Versioned Capability Status And Public Value Coverage

**Files:**
- Create: `skills/viselora-dom-webgl/references/capability-status.md`
- Create: `skills/viselora-dom-webgl/references/api-coverage.json`
- Create: `skills/viselora-dom-webgl/scripts/check-api-coverage.mjs`
- Test: `test/skill-api-surface.test.ts`

**Interfaces:**
- Produces: parseable capability table and value-export coverage gate.
- Consumes: `collectPublicApi()` / `renderApiSurface()` exports from Task 2.

- [ ] **Step 1: Write the authoritative `0.1.0-alpha.0` status matrix**

Use a table with exact machine-readable columns:

```md
| Capability id | Status | Required evidence | Consumer guidance |
| --- | --- | --- | --- |
```

Record these rows:

- `public-imports-ssr`, `single-runtime-canvas`, `runtime-remount`, `managed-image-hover`, `managed-video`, `shared-scroll-progress`, `resource-fallback-lifecycle`, `glb-loading-lifecycle`, `reduced-motion-signaling`: `verified`.
- `image-sequence`, `scene-camera-pass`, `scene-native-models`, `scene-object-interaction`, `camera-gestures`, `physics`, `advanced-effect-facades`: `experimental` because the external report did not complete their required browser matrix.
- `surface-pulse-visible-output`, `dom-anchored-glb-visible-output`: `blocked`, with links/commands for retained public-boundary pixel reproductions and DOM/CSS or verified media fallback guidance.

For `managed-image-hover`, require `sourceTextureUniform`, `mode: "replace-source"`, source sampling, managed pointer state, final-canvas pixel evidence, and a touch/scroll alternative. State explicitly that `glb-loading-lifecycle` being verified does not upgrade `dom-anchored-glb-visible-output`.

- [ ] **Step 2: Map every public value export in `api-coverage.json`**

Use this shape:

```json
{
  "schemaVersion": 1,
  "compatiblePackageVersion": "0.1.0-alpha.0",
  "entrypoints": {
    "@viselora/dom-webgl": {
      "createEffectDeclarations": { "reference": "api-effects-rendering.md", "section": "Typed effect declarations", "capability": "advanced-effect-facades" }
    }
  }
}
```

Populate all values, including duplicates by entrypoint:

- `@viselora/dom-webgl`: `createEffectDeclarations`, `createWebGLRuntime`, `defineWebGLEffect`, `defineWebGLSceneObjectEffect`.
- `@viselora/dom-webgl/react`: `WebGLRuntimeProvider`, `WebGLRuntime`, `WebGLTarget`, `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, `WebGLPassViewport`, `WebGLStagePlane`, `WebGLStageBox`, `WebGLLight`, `WebGLModel`, `useWebGLRuntime`, `WebGLDebugPanel`, `useWebGLDebugState`.
- `@viselora/scroll-adapters`: `createGsapTickerLenisBridge`, `createLenisScrollAdapter`, `createLenisGsapScrollStack`, `createScrollEffectProgressStore`, `createScrollTriggerBridge`, `createScrollTriggerSection`.
- `@viselora/scroll-adapters/react`: `createScrollEffectProgressStore`, `WebGLScrollRuntime`, `WebGLScrollTimeline`, `ScrollEffectSection`, `useScrollEffectProgressStore`.

Use reference section names that will be created verbatim in Tasks 5–6. Map core runtime/target ownership to verified ids, advanced scene/model/interaction values to the matching experimental id, and debug/lifecycle values to `resource-fallback-lifecycle`.

- [ ] **Step 3: Implement the coverage checker**

The checker must:

1. call Task 2 collection/rendering without modifying files;
2. compare generated bytes and fail on drift;
3. compare both package versions, adapter dependency version, `SKILL.md`, `api-coverage.json`, generated index, and capability-status version;
4. report every missing public value mapping as `<entrypoint>#<symbol>`;
5. report every mapped value absent from current declarations;
6. confirm every public type has an exact generated table row under its entrypoint;
7. confirm each mapping's reference file exists and contains the exact `## <section>` heading;
8. parse the status table, allow only `verified|experimental|blocked`, reject duplicate ids, and confirm every mapped capability id has a row.

Print one success line: `Viselora API coverage passed: <N> value exports, <M> type exports, <K> capability statuses`.

- [ ] **Step 4: Run coverage tests red, add the referenced heading shells, then run green**

Before the API reference files exist, run:

```bash
node skills/viselora-dom-webgl/scripts/check-api-coverage.mjs
```

Expected: FAIL naming missing reference files/headings. Create the Task 5 reference files with their final table of contents and exact second-level headings, then rerun:

```bash
npm test -- --run test/skill-api-surface.test.ts
node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs --check
node skills/viselora-dom-webgl/scripts/check-api-coverage.mjs
```

Expected: PASS. The references may still be content-incomplete until Task 5, but every mapped heading and status id must already be exact.

- [ ] **Step 5: Commit status and drift guards**

```bash
git add skills/viselora-dom-webgl/references/capability-status.md skills/viselora-dom-webgl/references/api-coverage.json skills/viselora-dom-webgl/references/api-*.md skills/viselora-dom-webgl/scripts/check-api-coverage.mjs test/skill-api-surface.test.ts
git commit -m "feat: guard Viselora API and capability coverage"
```

---

### Task 4: Add Narrative And Asset Planning Workflow

**Files:**
- Create: `skills/viselora-dom-webgl/references/narrative-design.md`
- Create: `skills/viselora-dom-webgl/references/asset-pipeline.md`
- Create: `skills/viselora-dom-webgl/templates/story-plan.md`
- Create: `skills/viselora-dom-webgl/templates/asset-manifest.json`
- Modify: `test/skill.test.ts`

**Interfaces:**
- Produces: human planning artifacts consumed before capability selection and implementation.
- Consumes: status ids from Task 3 and the approved brief/beat/asset contract.

- [ ] **Step 1: Add failing structural/content assertions**

Assert that narrative guidance contains audience, core message, outcome, tone, page length, interaction density, existing assets, accessibility/mobile/performance/reduced-motion constraints, 2–3 directions, a recommendation, 4–8 beats, and chronology/journey/problem-to-solution/layered reveal/state transformation/comparison/spatial exploration patterns.

Assert that asset guidance and the JSON template contain local path, story beat purpose, source URL, author, license, modifications, metadata, fallback, alt/description, deployment rights, and explicit no-production-hotlink language.

Run `npm test -- --run test/skill.test.ts -t "narrative|asset"`; expect red for missing files.

- [ ] **Step 2: Write `narrative-design.md` with a table of contents and decision gates**

Define the workflow:

1. infer or collect the brief;
2. propose 2–3 materially different narrative directions and recommend one;
3. stop for direction confirmation only when the choice materially changes scope;
4. build 4–8 beats;
5. assign semantic DOM/fallback, entrance/active/exit, media/scene owner, scroll range, optional primary interaction, mobile, reduced motion, capability id/status, asset ids, and direct evidence to each beat;
6. check complete-page pacing and message progression before implementation.

Include the default rule “at most one primary interaction per beat” and require hover meaning to have touch or scroll parity.

- [ ] **Step 3: Write `story-plan.md` as an actionable template**

Use fixed sections: Narrative brief, Direction options (three rows), Selected direction and rationale, Story beats (eight available rows; delete unused rows but retain 4–8 normally), Global scroll rhythm, Interaction map, Responsive/reduced-motion behavior, Capability selection summary, Asset ids, Browser evidence, Narrative review sign-off.

Every beat row must have fields `Beat id`, `Message advance`, `Semantic DOM/fallback`, `Entrance`, `Active`, `Exit`, `Scroll owner/range`, `Primary interaction`, `Mobile`, `Reduced motion`, `Capability id/status`, `Asset ids`, `Direct assertion`.

- [ ] **Step 4: Write `asset-pipeline.md` and the JSON manifest template**

Define inventory-first and freeze-before-implementation. Use the manifest schema:

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "id": "hero-product-image",
      "kind": "image",
      "localPath": "public/media/hero-product.webp",
      "storyBeatIds": ["beat-02"],
      "purpose": "Preserve the product source beneath the managed hover treatment",
      "source": {
        "url": "https://example.com/original-source-page",
        "author": "Asset author or generating application",
        "license": "SPDX id or exact license name",
        "deploymentRights": "public-deployment-approved"
      },
      "modifications": ["cropped to 1600x1000", "converted to WebP"],
      "metadata": { "width": 1600, "height": 1000 },
      "fallback": { "kind": "dom-image", "localPath": "public/media/hero-product.webp" },
      "alt": "Concise meaningful product description"
    }
  ]
}
```

Explain per-kind additions: video `poster`/duration/autoplay rejection; GLB clips/compression/decoder/poster; sequence frame count/pattern/start frame/progress range/first frame/cache budget; font family/weights/formats/system fallback. User-provided unknown-license assets get `local-validation-only`, which verifier rejects for public deployment mode.

- [ ] **Step 5: Run the focused tests and commit**

```bash
npm test -- --run test/skill.test.ts -t "narrative|asset"
git add skills/viselora-dom-webgl/references/narrative-design.md skills/viselora-dom-webgl/references/asset-pipeline.md skills/viselora-dom-webgl/templates/story-plan.md skills/viselora-dom-webgl/templates/asset-manifest.json test/skill.test.ts
git commit -m "docs: add Viselora narrative and asset workflow"
```

Expected: focused tests pass; no generated/consumer files outside the repo were changed.

---

### Task 5: Fill The Human Public API Capability References

**Files:**
- Modify: `skills/viselora-dom-webgl/references/public-api.md`
- Modify/Create: `skills/viselora-dom-webgl/references/api-effects-rendering.md`
- Modify/Create: `skills/viselora-dom-webgl/references/api-scenes-models.md`
- Modify/Create: `skills/viselora-dom-webgl/references/api-scroll-interaction.md`
- Modify/Create: `skills/viselora-dom-webgl/references/api-lifecycle-debug.md`
- Modify: `skills/viselora-dom-webgl/references/quickstart.md`
- Test: `test/skill.test.ts`, `test/skill-api-surface.test.ts`

**Interfaces:**
- Produces: every public value's mapped section and capability-level explanations for external agents.
- Consumes: `api-coverage.json`, generated index, current public `.d.ts`; must not cite private source or internal tests as consumer instructions.

- [ ] **Step 1: Add a shared reference contract test**

For every `api-*.md`, assert: a Contents section; compatible version; public entrypoint; when-to-use; exact consumer declaration/props shape; ownership/reference stability; fallback/lifecycle; version limitation; minimal public-import example; direct verification requirement. Run the focused test and expect red until content is complete.

- [ ] **Step 2: Make `public-api.md` a navigation layer**

List exactly four entrypoints and route each capability family to one human reference, `capability-status.md`, and `api-surface.generated.md`. State that status is per capability/version, not per entrypoint; the generated file is exhaustive but not recommendation evidence.

- [ ] **Step 3: Complete `api-effects-rendering.md`**

Use exact mapped headings for runtime creation, runtime/provider ownership, targets and stable declarations, typed effect declarations, effect scheduling/resources, managed object facade, surfaces/text, material/layers/source sampling, media textures/video, and runtime-scoped postprocess. Explain both `material.createLayer(...)` and the source-backed `texture.material.createMaterialLayer(...)` only where present in public declarations, and warn that postprocess is canvas/pass scoped.

- [ ] **Step 4: Complete `api-scenes-models.md`**

Cover scene/camera/pass/viewport, stage primitives/materials/lights, `WebGLModel`, model animation/morph/rig/sampling, placement and scene-object effects. Make the `glb-loading-lifecycle` vs `dom-anchored-glb-visible-output` status split explicit; never suggest raw loader/camera/renderer workarounds.

- [ ] **Step 5: Complete `api-scroll-interaction.md`**

Cover all six root adapter values and five React values, one scroll owner, stable `ScrollTrigger`, progress store/timeline matching, managed pointer declarations, picking, gestures, drag and physics. Keep buttons/forms as DOM and require touch/scroll alternatives for hover.

- [ ] **Step 6: Complete `api-lifecycle-debug.md`**

Document `loading|ready|error`, lifecycle/offscreen/fallback, `park` vs `restore-dom`, performance budgets, SSR imports, disposal, and a selector that stores only changed target fields:

```tsx
const [modelState, setModelState] = useState({
  resourceStatus: "loading",
  lifecycleState: "inactive",
  visible: false,
  error: undefined as string | undefined,
});

const onDebugStateChange = useCallback((state: WebGLDebugState) => {
  const target = state.targets.find((entry) => entry.key === "story.product-model");
  if (!target) return;
  const next = {
    resourceStatus: target.resourceStatus,
    lifecycleState: target.lifecycleState,
    visible: target.visible,
    error: target.error,
  };
  setModelState((current) => shallowEqual(current, next) ? current : next);
}, []);
```

Explain that ready/active only proves resource/lifecycle. If console, source, viewport, placement, camera/light and fallback checks pass but clipped final-canvas pixels stay unchanged, keep fallback visible and create a minimal public-boundary reproduction.

- [ ] **Step 7: Update quickstart and verify coverage**

State exact packages, TypeScript, React runtime peer range, and the effective `@types/react >=19.2.0` requirement for the published scroll React declarations. Route new projects to copy the three templates before code. Run:

```bash
npm test -- --run test/skill.test.ts -t "reference contract"
node skills/viselora-dom-webgl/scripts/check-api-coverage.mjs
```

Expected: all mapped headings exist, all public values are explained, and all public types remain searchable in generated output.

- [ ] **Step 8: Commit human API guidance**

```bash
git add skills/viselora-dom-webgl/references/public-api.md skills/viselora-dom-webgl/references/api-*.md skills/viselora-dom-webgl/references/quickstart.md test/skill.test.ts
git commit -m "docs: explain Viselora public capability families"
```

---

### Task 6: Redesign The Consumer Verifier Around Selected Capabilities

**Files:**
- Modify: `skills/viselora-dom-webgl/scripts/verify-consumer.mjs`
- Modify: `test/skill.test.ts`

**Interfaces:**
- Consumes: `<consumer>/viselora.capabilities.json`, referenced asset manifest, `references/capability-status.md`, consumer-local TypeScript.
- Produces: conditional architecture/capability violations without requiring unrelated recipes.

- [ ] **Step 1: Run the new verifier tests and confirm the old fixed-recipe failure**

```bash
npm test -- --run test/skill.test.ts -t "subset|experimental|blocked|capability manifest"
```

Expected: FAIL because old `verifyRecipeSurfaces()` still requires all five surfaces and ignores manifests/status.

- [ ] **Step 2: Parse and validate the project manifest before AST analysis**

Implement `readCapabilityManifest()`, `readCapabilityStatus()`, `readAssetManifest()`, and `validateCapabilitySelection()`. Enforce schema version `1`, exact compatible version, mode `consumer|retained-defect-reproduction`, non-empty unique ids, known checks, and relative asset-manifest path confined to the consumer root.

Derive status from `capability-status.md`; do not trust a consumer-supplied status. Experimental selections require `acknowledgement: "experimental"`. Blocked selections require both top-level `mode: "retained-defect-reproduction"` and entry acknowledgement `blocked-defect-reproduction`; otherwise reject.

- [ ] **Step 3: Keep universal architecture guards unconditional**

Always check exact package versions, public imports, exactly one runtime/canvas owner, no R3F/direct `WebGLRenderer`, stable module-scope runtime effects, stable target declarations, no private imports, no duplicate manual scroll/wheel/touch/pointer ownership, and no consumer render loop (`requestAnimationFrame`/`setAnimationLoop`) outside test/config files.

- [ ] **Step 4: Replace `verifyRecipeSurfaces()` with a capability requirement registry**

Use a registry shaped as:

```js
const capabilityRequirements = {
  "managed-image-hover": {
    requiredChecks: ["final-canvas-pixel-change", "touch-or-scroll-alternative", "loading-error-fallback"],
    assetKinds: ["image"],
    verify: verifyManagedImageHover,
  },
  "managed-video": {
    requiredChecks: ["playback", "autoplay-rejection-fallback", "network-error-fallback", "offscreen-reentry"],
    assetKinds: ["video"],
    verify: verifyManagedVideo,
  },
  "shared-scroll-progress": {
    requiredChecks: ["slow-forward-scroll", "fast-forward-scroll", "reverse-scroll"],
    assetKinds: [],
    verify: verifySharedScrollProgress,
  },
  "image-sequence": {
    requiredChecks: ["final-canvas-pixel-change", "first-frame-fallback", "bounded-cache", "forward-reverse-scroll"],
    assetKinds: ["image-sequence"],
    verify: verifyImageSequence,
  }
};
```

Complete the registry with these exact requirement groups:

- `public-imports-ssr`: `browser-public-imports`, `ssr-public-imports`.
- `single-runtime-canvas`: `one-canvas-mounted`, `unmount-remount-1-0-1`.
- `runtime-remount`: `unmount-remount-1-0-1`, `disposed-resources-released`.
- `resource-fallback-lifecycle`: `loading-fallback`, `network-error-fallback`, `offscreen-reentry`.
- `glb-loading-lifecycle`: `glb-ready-active`, `glb-network-error-fallback`, `offscreen-reentry`, plus a local `model` asset record.
- `reduced-motion-signaling`: `reduced-motion-content-continuity`, `reduced-motion-no-required-animation`.
- `scene-camera-pass`: `scene-camera-pass-declarations`, `clipped-final-canvas-pixel-change`.
- `scene-native-models`: `model-asset-ready`, `scene-model-final-canvas-pixel-change`.
- `scene-object-interaction`: `managed-picking`, `pointer-touch-alternative`, `interaction-final-canvas-pixel-change`.
- `camera-gestures`: `managed-camera-controller`, `mobile-gesture-alternative`, `camera-persistence-after-release`.
- `physics`: `managed-physics-descriptors`, `direct-drag-release-inertia`, `fallback-without-physics`.
- `advanced-effect-facades`: `public-facade-only`, `effect-resource-disposal`, `final-canvas-pixel-change`.
- `surface-pulse-visible-output`: `retained-surface-pulse-reproduction`, `effect-surface-pixels-change`, `final-canvas-pixel-threshold`.
- `dom-anchored-glb-visible-output`: `retained-dom-glb-reproduction`, `glb-ready-active`, `final-canvas-pixel-threshold`.

Capabilities whose evidence cannot be proven statically still require these named browser checks in the manifest; the verifier must say that it validates declaration, ownership, asset and planned-evidence presence, not that it executed the browser.

- [ ] **Step 5: Implement the friction-specific validators**

- `verifyManagedImageHover`: require `media/image`, `pointer.hover`, source-backed material layer, `mode: "replace-source"`, nonempty `sourceTextureUniform`, shader sampling of that uniform, `ctx.targetPointer`, `ctx.resources.addDisposable`, stable declaration, lifecycle/offscreen and image fallback.
- `verifyManagedVideo`: require managed `ctx.object.video`/texture path, local video asset, poster/semantic fallback, lifecycle/offscreen and autoplay rejection evidence name.
- `verifySharedScrollProgress`: require matching timeline/source/effect progress expression and one ScrollTrigger ownership path.
- `verifyImageSequence`: require stable complete frames before mount, matching progress, first-frame fallback, manifest frame metadata/cache budget and experimental acknowledgement.
- GLB validators: allow verified loading lifecycle, but require blocked reproduction mode for the default DOM-anchored visible-output path in this version.
- Asset validation: reject `http://`/`https://` `localPath`, missing source/author/license/purpose/modifications/fallback, public-deployment use of `local-validation-only`, and missing poster/firstFrame/text fallback by kind.

- [ ] **Step 6: Make failure messages capability-specific and rerun focused tests**

Prefix conditional messages with `[<capability-id>]`; keep universal architecture messages stable where existing tests rely on them. Run:

```bash
npm test -- --run test/skill.test.ts
node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite
```

Expected: valid verified subset passes; removing unrelated recipes does not fail; experimental acknowledgement and blocked reproduction rules behave exactly as specified; all existing import/ownership negative cases still fail.

- [ ] **Step 7: Commit the selected-capability verifier**

```bash
git add skills/viselora-dom-webgl/scripts/verify-consumer.mjs test/skill.test.ts
git commit -m "feat: verify selected Viselora capabilities"
```

---

### Task 7: Correct Recipes And Build A Verified Runnable Template

**Files:**
- Modify: `skills/viselora-dom-webgl/references/effect-recipes.md`
- Modify: `skills/viselora-dom-webgl/templates/effects/*.ts*`
- Modify: `skills/viselora-dom-webgl/templates/react-vite/package.json`
- Modify: `skills/viselora-dom-webgl/templates/react-vite/src/App.tsx`
- Modify: `skills/viselora-dom-webgl/templates/react-vite/src/effects.ts`
- Create: `skills/viselora-dom-webgl/templates/react-vite/index.html`
- Create: `skills/viselora-dom-webgl/templates/react-vite/tsconfig.json`
- Create: `skills/viselora-dom-webgl/templates/react-vite/src/main.tsx`
- Create: `skills/viselora-dom-webgl/templates/react-vite/src/styles.css`
- Create: `skills/viselora-dom-webgl/templates/react-vite/public/media/product-source.svg`
- Create: `skills/viselora-dom-webgl/templates/react-vite/viselora.capabilities.json`
- Create: `skills/viselora-dom-webgl/templates/react-vite/asset-manifest.json`
- Create: `skills/viselora-dom-webgl/templates/react-vite/story-plan.md`
- Test: `test/skill.test.ts`

**Interfaces:**
- Produces: verified-default public consumer template and status-aware optional recipe library.
- Consumes: manifest/status/verifier contracts from Tasks 3 and 6.

- [ ] **Step 1: Add red assertions for hover source sampling and status-safe defaults**

Assert hover shader contains `uniform sampler2D uSourceTexture`, `texture2D(uSourceTexture, vUv)`, `sourceTextureUniform: "uSourceTexture"`, and `mode: "replace-source"`. Assert the default React template does not register `surfacePulseEffect`, `modelGlowEffect`, or `imageSequenceEffect`; its manifest selects only verified capabilities. Assert recipe docs label each example with version/status/assets/fallback/ownership/mobile/reduced-motion/evidence/limitations.

- [ ] **Step 2: Correct standalone and template hover effects**

Use this shader behavior in both files:

```glsl
uniform sampler2D uSourceTexture;
uniform float uHover;
varying vec2 vUv;

void main() {
  vec4 source = texture2D(uSourceTexture, vUv);
  float edge = 1.0 - smoothstep(0.2, 0.8, distance(vUv, vec2(0.5)));
  vec3 tint = vec3(0.49, 0.83, 0.98);
  gl_FragColor = vec4(mix(source.rgb, tint, uHover * edge * 0.35), source.a);
}
```

Create the layer with:

```ts
material.createMaterialLayer({
  key: `${ctx.key}.hover-overlay`,
  mode: "replace-source",
  sourceTextureUniform: "uSourceTexture",
  program: { fragmentShader, uniforms: { uHover: 0 } },
});
```

Keep managed pointer input and disposal; do not add DOM pointer listeners.

- [ ] **Step 3: Make the five recipes optional and status-aware**

At the top of each recipe, state required exports, status id/status/version, local assets and fallback, ownership, mobile/reduced-motion, required evidence and limitation. Mark surface pulse and default DOM-anchored model visible output blocked; mark image sequence experimental. Keep these source files as reproduction/learning examples, but add top-file comments that route consumers to `capability-status.md` before use.

- [ ] **Step 4: Reshape the React/Vite template around verified hover plus shared scroll progress**

Remove blocked surface/model and experimental sequence from `App.tsx` and `runtimeEffects`. Keep one `WebGLScrollRuntime`, one `WebGLScrollTimeline`, one module-scope `runtimeEffects`, one local image target with semantic `img` fallback, reduced-motion CSS/behavior and a scroll/touch narrative alternative. Register two verified effects on that target: corrected `imageHoverOverlayEffect` for managed pointer input and `imageScrollProgressEffect` that reads the timeline's stable `progressKey` and applies a bounded managed texture transform. This gives `shared-scroll-progress` a real timeline/source/effect evidence path without adding a second input pipeline. Use the checked-in SVG only as a generated demo asset and record author/license/modifications in the template asset manifest.

Set `@types/react` and `@types/react-dom` to `^19.2.0`. Add strict TS config with `skipLibCheck: false`, `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, and `noEmit: true`; make `build` run `tsc --noEmit && vite build`.

- [ ] **Step 5: Add the template manifests and complete entry files**

`viselora.capabilities.json` selects `managed-image-hover`, `shared-scroll-progress`, `single-runtime-canvas`, `resource-fallback-lifecycle`, and `reduced-motion-signaling` with every required check named. `asset-manifest.json` records `public/media/product-source.svg` as locally generated, CC0-1.0, public-deployment-approved, with dimensions/fallback/alt. `story-plan.md` contains four complete beats and direct browser evidence per beat.

Add `index.html`, `src/main.tsx`, and CSS that provides readable no-WebGL content, focus styles, responsive layout, no horizontal overflow, and `prefers-reduced-motion` continuity.

- [ ] **Step 6: Run structure and verifier checks**

```bash
npm test -- --run test/skill.test.ts
node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite
```

Expected: PASS; default template no longer depends on blocked/experimental examples; hover source sampling is explicit.

- [ ] **Step 7: Commit recipes and template**

```bash
git add skills/viselora-dom-webgl/references/effect-recipes.md skills/viselora-dom-webgl/templates test/skill.test.ts
git commit -m "feat: add verified Viselora consumer template"
```

---

### Task 8: Refactor `SKILL.md`, Diagnostics, Verification, And Agent Metadata

**Files:**
- Modify: `skills/viselora-dom-webgl/SKILL.md`
- Modify: `skills/viselora-dom-webgl/agents/openai.yaml`
- Modify: `skills/viselora-dom-webgl/references/architecture-rules.md`
- Modify: `skills/viselora-dom-webgl/references/troubleshooting.md`
- Modify: `skills/viselora-dom-webgl/references/verification.md`
- Test: `test/skill.test.ts`

**Interfaces:**
- Produces: concise skill entrypoint and task-trigger metadata.
- Consumes: all Task 3–7 references and templates.

- [ ] **Step 1: Add failing routing and metadata assertions**

Assert the description triggers for new narrative, existing-site enhancement, API selection, interaction, assets, debugging and verification. Assert the default prompt asks the skill to turn a brief into a local-asset, public-API, browser-verified scroll narrative. Assert `SKILL.md` directly links every reference and stays below 120 non-frontmatter lines.

- [ ] **Step 2: Rewrite `SKILL.md` as a concise procedural router**

Keep exact version near the top. Use seven workflow steps: establish brief; offer 2–3 directions; define 4–8 beats; inventory/freeze local assets; map selected capabilities/status; implement within managed ownership; verify static/browser/narrative quality. Include one short “load only what the task needs” routing table and one hard-boundaries list.

Do not paste export lists, status tables, long recipes, asset schemas or troubleshooting trees into `SKILL.md`.

- [ ] **Step 3: Update architecture, troubleshooting and verification references**

- Architecture: one runtime/canvas/scroll/pointer, stable module-scope effects/runtime array, stable mounted declarations, semantic DOM/fallback, managed ownership, no production hotlinks.
- Troubleshooting: classify API/type, asset, lifecycle, visible-output and package-defect-candidate failures in that order.
- Verification: require skill integrity, selected consumer checks, real-browser final-canvas evidence per dynamic beat, desktop/mobile/reduced-motion pacing, fallback/network/autoplay/offscreen/remount checks, and asset license review.

Make completion claims conditional on final pixels or direct behavioral assertions, not callbacks/debug status alone.

- [ ] **Step 4: Synchronize `agents/openai.yaml`**

Use:

```yaml
interface:
  display_name: "Viselora Development"
  short_description: "Build verified scroll narratives with public Viselora packages"
  default_prompt: "Use $viselora-dom-webgl to turn my brief into a DOM-first scroll narrative with local licensed assets, selected public capabilities, and browser-backed verification."
```

- [ ] **Step 5: Run skill structural validation and focused tests**

```bash
python /Users/ai/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/viselora-dom-webgl
npm test -- --run test/skill.test.ts
```

Expected: `Skill is valid!` (or the validator's equivalent success line) and all skill tests pass. Do not add the local absolute validator path to repository scripts or CI.

- [ ] **Step 6: Commit entrypoint and guidance**

```bash
git add skills/viselora-dom-webgl/SKILL.md skills/viselora-dom-webgl/agents/openai.yaml skills/viselora-dom-webgl/references/architecture-rules.md skills/viselora-dom-webgl/references/troubleshooting.md skills/viselora-dom-webgl/references/verification.md test/skill.test.ts
git commit -m "docs: generalize Viselora development skill"
```

---

### Task 9: Wire Template/API Verification Into Root Scripts And CI

**Files:**
- Create: `scripts/verify-skill-template.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Modify: `test/workflows.test.ts`

**Interfaces:**
- Produces: portable `skill:api:generate`, `skill:api:check`, `verify:skill:template`, and aggregate `verify:skill` commands；这些命令只证明 skill/template 自洽，不替代独立消费者项目的真实浏览器验收。
- Consumes: package build outputs, Tasks 2–8 scripts/template/tests.

- [ ] **Step 1: Add failing root-script and workflow-order assertions**

Expect exact root scripts:

```json
{
  "skill:api:generate": "node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs",
  "skill:api:check": "node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs --check && node skills/viselora-dom-webgl/scripts/check-api-coverage.mjs",
  "verify:skill:template": "node ./scripts/verify-skill-template.mjs"
}
```

Expect aggregate `verify:skill` to run focused skill/API tests, API check, selected template verifier, and template typecheck/build. Expect CI order `npm run build` → `npm run verify:skill` → `git diff --check`.

Run `npm test -- --run test/workflows.test.ts`; expect red.

- [ ] **Step 2: Implement the portable template verification runner**

Use `mkdtemp`, `cp`, `rm` from `node:fs/promises`, `tmpdir`, and `spawnSync`. Copy `skills/viselora-dom-webgl/templates/react-vite` to a temp directory, run:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run build
```

Always remove the temp directory in `finally`. Forward stdout/stderr and fail on the first nonzero status. Never install into the tracked template directory.

- [ ] **Step 3: Update root scripts**

Set `verify:skill` to run, in order:

```bash
npm test -- --run test/skill.test.ts test/skill-api-surface.test.ts
npm run skill:api:check
node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite
npm run verify:skill:template
```

Keep `verify:release` ordering so the existing `npm run build` happens before `verify:skill`. Do not add network install work before the package build or mutate package versions.

- [ ] **Step 4: Update CI and run focused tests**

Keep the existing build and release-validation chain; `verify:skill` now carries `.d.ts` drift, coverage, verifier and template gates. Run:

```bash
npm test -- --run test/workflows.test.ts test/skill-api-surface.test.ts
npm run build
npm run verify:skill
```

Expected: workflow tests pass; both package builds regenerate declarations; generated output is clean; template installs/types/builds in a temp directory.

- [ ] **Step 5: Commit verification wiring**

```bash
git add scripts/verify-skill-template.mjs package.json .github/workflows/verify.yml test/workflows.test.ts
git commit -m "ci: verify Viselora skill and API drift"
```

---

### Task 10: Synchronize Active Docs And Run The Complete Closeout Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/project-release-validation.md`
- Modify: `docs/consumer-standard-usage.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify if assertions require: `test/release-documentation.test.ts`

**Interfaces:**
- Produces: active-doc truth that distinguishes API presence, capability status, external verification and blocked defects.
- Consumes: final skill paths/scripts/status matrix.

- [ ] **Step 1: Add/adjust active-doc truth assertions before editing docs**

Assert active docs call the skill a general brief-to-browser development skill, link `capability-status.md` and generated API index, mention selected-capability verification, and do not claim all public APIs are externally verified. Run the focused documentation test and confirm red.

- [ ] **Step 2: Update active entry docs without duplicating references**

- `README.md`: describe the skill in one paragraph and link its entrypoint/status/index.
- `docs/README.md`: add the skill design/plan and consumer-skill references to the active index.
- `docs/STATUS.md`: record the approved/implemented general skill workstream without changing runtime capability status.
- `docs/project-release-validation.md`: expand `verify:skill` gate to include `.d.ts` drift, value coverage, selected capabilities and template build.
- `docs/consumer-standard-usage.md`: route agent users through brief/beats/assets/status before code.
- `docs/agent/package-onboarding.md`: explain that the skill is the consumer workflow while this doc remains package contract onboarding.

Do not copy the full capability matrix into these docs; link the authoritative file.

- [ ] **Step 3: Run focused documentation and skill checks**

```bash
npm test -- --run test/release-documentation.test.ts test/skill.test.ts test/workflows.test.ts test/skill-api-surface.test.ts
python /Users/ai/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/viselora-dom-webgl
```

Expected: all focused tests pass and skill structure validates.

- [ ] **Step 4: Run the required package/declaration/template gate**

Run in this exact order:

```bash
npm run build -w @viselora/dom-webgl
npm run build -w @viselora/scroll-adapters
node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs --check
node skills/viselora-dom-webgl/scripts/check-api-coverage.mjs
node skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite
npm run verify:skill:template
```

Expected: both package builds pass; no `.d.ts` or generated Markdown drift; value/type/status coverage passes; selected template passes verifier, strict typecheck and production build.

- [ ] **Step 5: Run the full repository gate**

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all tests pass, TypeScript passes, all workspaces build, example import boundary passes, and no whitespace errors are reported.

- [ ] **Step 6: Audit scope and repository hygiene**

Run:

```bash
git status --short
git diff --name-only 6fbb9567 --
git diff -- packages/dom-webgl-runtime/src packages/dom-webgl-scroll-adapters/src packages/dom-webgl-runtime/package.json packages/dom-webgl-scroll-adapters/package.json
git diff --check
```

Expected: only planned skill/tests/root verification/active docs files changed; runtime/adapter source and both package manifests have no diff; external consumer is untouched; no secrets, installed `node_modules`, temp build outputs or package-lock from the template temp directory are present.

- [ ] **Step 7: Commit the active-doc closeout**

```bash
git add README.md docs/README.md docs/STATUS.md docs/project-release-validation.md docs/consumer-standard-usage.md docs/agent/package-onboarding.md test/release-documentation.test.ts
git commit -m "docs: align general Viselora skill guidance"
```

- [ ] **Step 8: Produce the implementation handoff and stop**

Report: completed task commits; key files; API value/type/status counts; selected-capability verifier matrix; skill validator result; template typecheck/build result; full repository gate; the two blocked defect candidates and image-sequence experimental status; no runtime/API/version/external-consumer changes; no push performed.

---

## Final Verification Matrix

| Layer | Command / evidence | Required result |
| --- | --- | --- |
| Workspace baseline | `git status --short` before implementation | clean or only explicitly approved changes |
| Skill structure | `quick_validate.py skills/viselora-dom-webgl` | valid frontmatter/layout |
| Skill tests | `npm test -- --run test/skill.test.ts` | selected capabilities and structure pass |
| API scripts | `npm test -- --run test/skill-api-surface.test.ts` | generator/coverage red-green/drift cases pass |
| Package declarations | two package workspace builds | four current `dist/*.d.ts` produced |
| Generated drift | generator `--check` | byte-identical tracked index |
| Public coverage | `check-api-coverage.mjs` | all value mappings, types, versions, statuses pass |
| Consumer architecture | `verify-consumer.mjs templates/react-vite` | verified subset passes; no unrelated recipes required |
| Template types/build | `verify:skill:template` | strict `skipLibCheck: false` typecheck and Vite production build pass |
| Downstream browser contract | `verification.md`、capability manifest 和 story-plan 字段 | skill 明确要求每个动态 beat 在独立消费者项目中取得 pixels/behavior evidence；本任务不执行该 E2E |
| Downstream narrative quality | story-plan review checklist | skill 覆盖 message、pacing、mobile、fallback、reduced motion；真实结论由后续独立消费者项目给出 |
| Repository tests | `npm run test -- --run` | all Vitest suites pass |
| Repository types | `npm run typecheck` | pass |
| Repository build | `npm run build` | all workspaces pass |
| Import boundary | `npm run check:imports` | pass |
| Diff hygiene | `git diff --check` | pass |

## Risks And Containment

- **Bundled declaration parser drift:** tsup may change formatting while exports stay stable. Parse TypeScript AST and compare semantic records; only render normalized deterministic summaries.
- **Generated index becoming recommendation truth:** keep status and human guidance separate; generated output is discovery only.
- **Status duplication drift:** verifier and coverage checker parse one authoritative `capability-status.md`; consumer never declares its own trusted status.
- **Verifier false confidence:** static checks validate architecture/declarations/planned evidence, while `verification.md` requires real browser pixels/behavior before completion claims.
- **Verifier false positives on flexible consumer code:** preserve semantic AST resolution and add alias/property/useMemo fixtures before broadening rules.
- **Blocked capabilities leaking into defaults:** remove them from default template/runtimeEffects and require retained-defect-reproduction mode.
- **Template validation polluting the repo:** install/build only in an auto-cleaned temp copy.
- **React declaration mismatch:** document and test `@types/react >=19.2.0` with `skipLibCheck: false`.
- **Asset license ambiguity:** asset manifest requires deployment rights; `local-validation-only` cannot pass public deployment verification.
- **Scope creep into runtime fixes:** final diff explicitly checks package `src` and `package.json`; defect candidates remain documented, not patched.

## Self-Review Checklist

- Spec coverage: all twelve confirmed design points map to Tasks 2–10; no runtime/API/version/external-consumer work is included.
- File coverage: every user-requested file/category appears in the File Map and at least one task.
- TDD ordering: generator, coverage, verifier, structure, workflow and docs each begin with failing tests before implementation and passing commands.
- Type/name consistency: capability manifest is always `viselora.capabilities.json`; asset manifest is always `asset-manifest.json`; status ids are derived from one authoritative table.
- Validation coverage: 当前任务执行 skill structure、package builds、`.d.ts` generation/drift、template typecheck/build、tests、typecheck、build、import boundary 和 diff check；真实消费者 browser/narrative evidence 被明确留给后续独立项目。
- Scope boundary: no R3F, extra renderer/canvas/input pipeline, raw Three ownership, consumer render loop, private import, package bump, runtime defect fix, push or external consumer mutation.
