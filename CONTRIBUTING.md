# Contributing

This repository is an npm-workspaces monorepo for a public React/R3F DOM coordination
runtime, optional scroll adapters, consumer examples, and a versioned
development skill.

Read [docs/STATUS.md](./docs/STATUS.md) before changing behavior and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) before changing ownership or
public boundaries.

## Development workflow

Install dependencies from the repository root:

```bash
npm install
```

Use a focused RED → minimal implementation → GREEN cycle:

1. Add or update a focused test outside production `src/` directories.
2. Run the focused test and confirm the expected failure.
3. Implement the smallest general solution.
4. Run focused tests, then widen verification.
5. Update the one document that owns the changed fact.
6. Review the diff for private data, generated artifacts, and unrelated edits.

Do not change tests to hide a real correctness failure. Do not use `skip`,
`xfail`, `@ts-ignore`, or lower thresholds as a substitute for a fix.

## Repository boundaries

- Runtime code belongs in `packages/dom-webgl-runtime/src`.
- Optional Lenis/GSAP/ScrollTrigger glue belongs in
  `packages/dom-webgl-scroll-adapters/src`.
- `apps/example` and `apps/hero-next` consume public package entrypoints only.
- Runtime code must not branch on app keys, asset paths, copy, DOM structure, or
  layout.
- Package/app tests live in that workspace's `test/` directory and mirror the
  source path. Repository guards live in `test/`.
- Browser assets belong to the owning app's `public/` directory.
- Build output, browser sessions, screenshots, and temporary evidence do not
  belong in Git.

## Coding conventions

- Prefer `create*()` factory functions and object literals over classes.
- Use `type` aliases for object shapes.
- Use exhaustive switches for discriminated unions; avoid a catch-all default.
- Prefer `satisfies` to unsafe assertions.
- Use `@ts-expect-error` only in type-boundary tests; never use `@ts-ignore` or
  `as any`.
- Keep module import safe for SSR. Runtime source must not touch `window` or
  `document` at module load.
- Keep lifecycle disposal idempotent with a `disposed` guard.
- `node:*` imports belong only in tests and scripts.

## Public API changes

Public APIs coordinate DOM layout, progress, fallback and availability. Use
native R3F/Three.js scene components, materials, loaders and animation directly.
R3F owns the single renderer loop; do not reintroduce scene declarations,
material facades or duplicate engine subsystems.

When a public type or export changes:

1. update package source and public-export tests;
2. update generated skill API data with `npm run skill:api:generate`;
3. update only the affected package README or user guide;
4. update [docs/STATUS.md](./docs/STATUS.md) only if current capability truth
   changed;
5. run package, skill, tarball, and consumer gates in proportion to risk.

## Documentation responsibilities

Keep one owner for each kind of information:

| Document | Put here | Do not put here |
| --- | --- | --- |
| `README.md` | Product purpose, install, minimal example, repository map, links | Release diary, exhaustive API, implementation history |
| `CONTRIBUTING.md` | Human workflow, code/test conventions, verification | Current feature status, app-specific design |
| `AGENTS.md` | Agent execution constraints and read order | Product tutorial, historical implementation truth |
| `docs/STATUS.md` | Current implementation, release, evidence, limitations, next focus | Tutorials, plans, detailed architecture |
| `docs/ARCHITECTURE.md` | Stable ownership, boundaries, data flow, non-goals | Dated status, verification logs |
| `docs/guides/*` | Task-oriented user instructions | Project diary or exhaustive generated API |
| package/app README | Owner-local purpose, commands, boundaries, links | Repository-wide status |
| `docs/archive/*` | Completed plans, superseded decisions, old reports | Current truth or active backlog |

If a fact already has an owner, link to it instead of copying it.

## Verification

Focused checks:

```bash
npm test -- --run path/to/test.ts
npm run typecheck -w <workspace-name>
npm run build -w <workspace-name>
npm run check:docs
```

Repository checks:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run check:docs
git diff --check
```

Release work additionally uses `npm run verify:release`. That command includes
version, tarball, external-consumer, and skill verification and can be
substantially slower than normal development checks.

## Agent skill

`skills/viselora-dom-webgl/` follows the [Agent Skills](https://agentskills.io)
format and is installed into consumer projects by the
[`skills` CLI](https://github.com/vercel-labs/skills). Only that directory is
copied, so it must be self-contained: relative links stay inside it, repository
docs use absolute GitHub URLs, and maintainer scripts live in `scripts/`.
`test/skill.test.ts` enforces this.

Check what the CLI discovers before pushing:

```bash
npx skills add . --list
```

Users install from the generated
[agenticnoob/viselora-skills](https://github.com/agenticnoob/viselora-skills)
repository, because the CLI clones the whole source repository and this
workspace's demo assets make that slow. `skills/` here is its only source:
`scripts/build-skill-repo.mjs` writes the tracked skill files, a README from
`scripts/skill-repo.README.md` and the LICENSE, and the
[skill sync workflow](./.github/workflows/sync-skill.yml) pushes the result
whenever those inputs change on `main`. Preview the output locally:

```bash
node scripts/build-skill-repo.mjs /tmp/viselora-skills
```

The workflow authenticates with the `SKILL_REPO_DEPLOY_KEY` secret: the private
half of an SSH deploy key that has write access to `viselora-skills` only.
Without it the sync job fails at checkout and nothing is published.

[skills.sh](https://skills.sh) has no submission form. A skill appears there
after users install it with `npx skills add agenticnoob/viselora-skills`;
ranking comes from anonymous CLI install telemetry. Keep the `name` equal to
the directory name and keep the `description` specific about when to use the
skill.

## Publish an alpha release

Core and scroll adapters use one `<major>.<minor>.<patch>-alpha.<number>`
version. Choose an unused version after checking both packages with
`npm view --registry=https://registry.npmjs.org`; mirrors may lag behind releases.

1. Run `npm run release:version -- <version>` to align the manifests, lockfile,
   app consumers and skill compatibility declaration. Update the skill template,
   coverage map and capability reference to that version, then run
   `npm run skill:api:generate`.
2. Align current guides, package READMEs and migration instructions. Keep
   publication state in `docs/STATUS.md` pending until registry readback succeeds.
3. Run `npm run verify:release` and `git diff --check`. Review the diff and commit
   the verified source. Next.js may rewrite `next-env.d.ts` during builds; keep
   unrelated generated changes out of the commit.
4. Push the release commit to `main` through the normal reviewed integration
   path. The `npm-release` environment currently permits only this branch.
5. Dispatch the existing release workflow against that commit's branch:

   ```bash
   gh workflow run release.yml --ref main -f version=<version>
   ```

6. Approve the workflow's `npm-release` environment gate when authorized to
   publish. The workflow reruns all release checks, publishes core before
   adapters with `--tag alpha --provenance`, and verifies registry metadata.
   It uses the configured CI publishing identity; local npm login is unnecessary.
7. Confirm the run's source commit and successful conclusion, then read back
   both packages with `npm view <package>@<version> --json` and
   `npm view <package> dist-tags --json`, adding
   `--registry=https://registry.npmjs.org --prefer-online` to each readback.
   Update `docs/STATUS.md` with the verified
   release and commit/push that documentation follow-up.

The publisher can resume a partial release only when an existing version's
integrity and metadata match the locally packed artifact. Never overwrite or
unpublish a version to repair a mismatch. The `latest` tag is a separate channel
and is not advanced by this alpha workflow.

## Commit checklist

- Tests and builds relevant to the change pass.
- Documentation ownership remains clear and links resolve.
- Package versions and generated API references are aligned when applicable.
- No token, cookie, credential, private configuration, browser profile,
  screenshot, build output, or temporary file is included.
- Existing unrelated worktree changes are preserved.
- The commit message describes the behavior or structural change.
