# Documentation

This directory contains the repository's current project documentation.

## Start here

- [STATUS.md](./STATUS.md) — current implementation, release, verification,
  limitations, and immediate focus.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — stable system model, ownership, public
  boundaries, and non-goals.
- [guides/getting-started.md](./guides/getting-started.md) — install and first
  React integration.
- [guides/effects.md](./guides/effects.md) — controlled effect authoring.
- [guides/scroll.md](./guides/scroll.md) — native scroll, progress timelines,
  Lenis, GSAP, and ScrollTrigger.
- [archive/README.md](./archive/README.md) — historical records and archive
  policy.

Package and application details stay with their owners:

- [core package](../packages/dom-webgl-runtime/README.md)
- [scroll adapters](../packages/dom-webgl-scroll-adapters/README.md)
- [example app](../apps/example/README.md)
- [hero app](../apps/hero-next/README.md)
- [consumer development skill](../skills/viselora-dom-webgl/SKILL.md)

## Document responsibilities

| Location | Owns | Must not contain |
| --- | --- | --- |
| Root `README.md` | Product discovery, install, minimal example, repository map | Exhaustive API, implementation history |
| Root `CONTRIBUTING.md` | Human workflow, code/test rules, verification | Current feature status |
| Root/subtree `AGENTS.md` | Agent execution constraints | Product tutorial or feature diary |
| `STATUS.md` | Only repository-wide current truth | Tutorials or detailed design |
| `ARCHITECTURE.md` | Stable ownership, flow, boundaries, non-goals | Dated status or test logs |
| `guides/*` | One user task per file | Roadmap, backlog, project diary |
| package/app README | Owner-local setup, commands, constraints | Repository-wide truth |
| `archive/*` | Completed and superseded records | Active plans or authoritative API |

Archived documents are not current truth. Validate any historical statement
against source, tests, package metadata, and `STATUS.md`.

## Update routing

- Capability, release, or evidence changed → update `STATUS.md`.
- Ownership, data flow, or public boundary changed → update `ARCHITECTURE.md`.
- User workflow changed → update one guide.
- Package install or entrypoint changed → update that package README.
- App behavior or local constraints changed → update that app README/docs.
- Agent execution rule changed → update the nearest `AGENTS.md`.
- A plan, design, investigation, or report is complete → move it to `archive/`.

If a fact already has an owner, link to it instead of copying it.

## File and directory conventions

- Use lowercase kebab-case for guide, report, plan, and design filenames.
- Keep standard entrypoint names uppercase: `README.md`, `AGENTS.md`,
  `CONTRIBUTING.md`, `STATUS.md`, `ARCHITECTURE.md`.
- Group by responsibility, not authoring tool.
- Do not create active directories named after a workflow or agent.
- Keep screenshots, browser profiles, build output, and temporary evidence
  outside tracked documentation.

Run `npm run check:docs` after changing documentation paths or links.
