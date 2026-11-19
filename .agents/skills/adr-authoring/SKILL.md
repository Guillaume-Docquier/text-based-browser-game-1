---
name: adr-authoring
description: Decide whether to write, edit, amend, supersede, retire, or review an Architecture Decision Record (ADR) in Cosmic Empires. Use whenever a task leads to a proposed ADR or a change to an existing ADR, including incidental documentation edits during implementation.
---

# ADR Authoring

Read the [architecture decisions index](../../../docs/architecture/decisions/README.md) and the relevant accepted ADRs. Check the relevant code or planned change. If it conflicts with an accepted decision, surface the conflict and discuss it with the human before changing direction.

## Decide what changed

State the architectural rule before and after the change. Compare the rule, its scope and exceptions, and the reasons that materially justify it.

| Change                                                                                                                           | Action                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| An implementation change follows the accepted rule, or an existing ADR already records the decision                              | Leave the ADR alone. Update implementation docs if they need to describe the new behavior. |
| A typo, link, rewording, restructuring, or stale example needs correction, and the rule and its material rationale stay the same | Edit directly. Leave amendment history alone.                                              |
| An accepted decision gains or loses a requirement, scope boundary, or exception, or its material rationale changes               | Amend the accepted ADR.                                                                    |
| A different architectural decision replaces an accepted one                                                                      | Write a new ADR and supersede the old one.                                                 |
| A durable architectural decision has no existing record                                                                          | Propose a new ADR.                                                                         |

## Keep the decision durable

Ask whether a future contributor could change a detail while still following the decision. If they could, put that detail in code or implementation docs when it needs documentation. Name a technology, boundary, or mechanism when the decision requires it. State what contributors must do and why.

For example, ADR-007 defines which code belongs in the shared package. Removing action submission leaves the package rule in effect. Removing an example of action submission from the ADR is an editorial edit. Adding a new exception to the dependency boundary changes the rule and needs an amendment.

## Use the relevant reference

- For proposals, new records, amendments, or status changes, read [authoring.md](references/authoring.md).
- Before finalizing an ADR edit or when asked to review one, use [review-checklist.md](references/review-checklist.md). For an editorial edit, check the diff for changes in meaning and verify any links you touched.
