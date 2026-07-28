# Repository Information Architecture Implementation Plan

> **For agentic workers:** Execute the tasks in order. Preserve unrelated
> worktree changes, use public package boundaries, and verify each structural
> change before claiming completion.

**Goal:** Replace the accumulated documentation and directory sprawl with a
small, enforceable information architecture that separates current truth,
usage guidance, contributor rules, agent rules, app-local context, and history.

**Architecture:** The repository root owns only discovery and contribution
entrypoints. `docs/` owns one current status, one architecture overview, and a
small set of task-oriented guides. Package and app details stay with their
owners. Completed plans, reports, decisions, and superseded references move to
`docs/archive/` and are explicitly non-authoritative.

**Tech Stack:** Markdown, npm workspaces, TypeScript, Vitest, Node.js.

## Global Constraints

- Preserve the existing `apps/hero-next/next-env.d.ts` modification.
- Preserve `.playwright-cli/` and `output/`; ignore generated browser artifacts
  instead of deleting them.
- Preserve the untracked two-tone tetrahedron plan content while archiving it.
- Do not change runtime behavior or public package APIs.
- Do not treat archived documents as current product truth.
- Keep `apps/example` on public package entrypoints only.

---

### Task 1: Documentation governance test

**Files:**

- Modify: `test/documentation.test.ts`
- Modify: `package.json`

**Produces:** An executable allowlist for active documentation, responsibility
and size checks for entrypoint documents, local-link validation, and a focused
`check:docs` command.

- [ ] Replace release-history assertions with current information-architecture
  assertions.
- [ ] Run `npm test -- --run test/documentation.test.ts` and confirm it
  fails against the old layout.
- [ ] Keep the test independent of archived historical wording.

### Task 2: Archive completed and superseded material

**Files:**

- Move: `docs/superpowers/plans/*` to `docs/archive/plans/implementation/`
- Move: `docs/superpowers/specs/*` to `docs/archive/specs/`
- Move superseded root/docs references into `docs/archive/reference/`,
  `docs/archive/reports/`, or `docs/archive/status/`
- Modify: `docs/archive/README.md`

**Produces:** No active `docs/superpowers`, `docs/agent`, `docs/examples`,
`docs/new-project`, `docs/performance`, or `docs/roadmap` trees.

- [ ] Move files without rewriting historical content.
- [ ] Preserve the untracked plan exactly.
- [ ] Index archive categories and state that archive content is evidence only.

### Task 3: Rebuild current project documentation

**Files:**

- Modify: `README.md`
- Create: `CONTRIBUTING.md`
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/STATUS.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/guides/getting-started.md`
- Create: `docs/guides/effects.md`
- Create: `docs/guides/scroll.md`

**Produces:** One responsibility per document and one authoritative current
status.

- [ ] Keep README focused on product, install, minimal usage, repository layout,
  and links.
- [ ] Put human development workflow in CONTRIBUTING.
- [ ] Keep AGENTS limited to read order, boundaries, coding rules, verification,
  safety, and documentation rules.
- [ ] Keep implementation/release/evidence truth only in `docs/STATUS.md`.
- [ ] Keep stable ownership and data-flow concepts only in
  `docs/ARCHITECTURE.md`.
- [ ] Keep guides task-oriented and link to generated API truth instead of
  copying the full API surface.

### Task 4: Localize app documentation

**Files:**

- Create: `apps/example/README.md`
- Move: `DESIGN.md` to `apps/example/docs/design-system.md`
- Create: `apps/hero-next/README.md`
- Modify: `apps/hero-next/AGENTS.md`
- Move: `apps/hero-next/VISUAL_DESIGN.md` to
  `apps/hero-next/docs/visual-design.md`

**Produces:** Each app is self-describing; app-specific visual truth no longer
pollutes root or repository-wide status documents.

- [ ] Keep app README files focused on purpose, boundaries, run commands, and
  local documentation.
- [ ] Keep hero agent rules behavioral, not historical.
- [ ] Preserve the current hero visual configuration and evidence in the
  app-local visual document.

### Task 5: Path and generated-artifact cleanup

**Files:**

- Modify: `.gitignore`
- Modify references in active documentation and tests

**Produces:** Semantic paths, no active links to superseded locations, and
ignored local browser outputs without deleting user data.

- [ ] Ignore `.playwright-cli/` and `output/`.
- [ ] Update active relative links.
- [ ] Run the documentation test until green.

### Task 6: Repository verification

**Files:** All changed files.

**Produces:** Evidence that the reorganization did not change runtime behavior
or break package/app builds.

- [ ] Run `npm run check:docs`.
- [ ] Run `npm run test -- --run`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run check:imports`.
- [ ] Run `git diff --check`.
- [ ] Review `git status`, verify the pre-existing `next-env.d.ts` diff remains
  untouched, and confirm no generated/private artifact is staged.

## Self-Review Record

- The plan covers documentation roles, archive policy, app/package locality,
  directory semantics, enforcement, and verification.
- No runtime or public API change is included.
- No user-owned generated artifact is deleted.
- The plan itself is stored under the archive because completed implementation
  plans are not active product truth in the target information architecture.
