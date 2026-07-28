# Documentation Archive

This directory preserves completed plans, superseded decisions, prior status
snapshots, investigations, reports, and legacy reference material.

Archived documents are not current truth, active backlog, or authoritative
public API documentation. Validate historical statements against current
source, tests, package metadata, [../STATUS.md](../STATUS.md), and
[../ARCHITECTURE.md](../ARCHITECTURE.md).

## Layout

| Directory | Contents |
| --- | --- |
| `plans/early-runtime/` | Early runtime implementation plans |
| `plans/implementation/` | Completed task-by-task implementation plans |
| `plans/maintenance/` | Completed repository maintenance plans |
| `specs/` | Completed or superseded design decisions |
| `reports/` | Reviews, release reports, performance notes, and investigations |
| `reference/` | Superseded architecture, package guides, tutorials, roadmaps, and consumer notes |
| `status/` | Prior long-form execution/status snapshots |

Archive paths are organized for evidence retention. Internal links in old files
may describe their original active locations and may no longer resolve.

## Archiving rules

- Move a plan/spec/report here once its implementation or investigation ends.
- Preserve historical content; do not rewrite it to match the current API.
- Use date-prefixed lowercase kebab-case for new records.
- Do not add archive files to active documentation indexes except through this
  archive index.
- Do not treat unchecked boxes or old phase labels as current work.
- Current facts must be summarized in `docs/STATUS.md` or the owning app/package
  document, then linked rather than copied.
