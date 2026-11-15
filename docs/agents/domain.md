# Domain docs

This repository uses a single-context layout across the backend, frontend, and contracts.

## Before exploring

Read `AGENTS.md`, the root `GLOSSARY.md`, and relevant decisions in `docs/adr/`.
For implementation, also read the specification, linked tickets, and their dependencies
in the configured GitHub Issues tracker.

If domain files do not exist yet, proceed silently. The `domain-modeling` skill
creates them when terms or decisions are resolved; do not create placeholder decisions.

## Paths

- `GLOSSARY.md`: shared domain terms at the repository root.
- `docs/adr/`: architecture and domain decisions, using numbered Markdown files.

Use glossary terms consistently in specifications, tickets, code, and tests.
If a proposed change contradicts an existing ADR, identify the ADR and explain
why it should be revisited instead of silently overriding the decision.
