---
name: review-code-comments
description: Review added, edited, and removed code comments in a Git branch diff or a user-specified diff. Decide which comments are needed and recommend concrete ways to avoid or restore them.
---

# Review Code Comments

Review the necessity of changed source and configuration comments. Follow the current [code comment conventions](../../../docs/typescript-coding-standards.md#code-comments) and any instructions for the files under review. Use a read-only review and report findings in chat.

## Select the diff

Use the user's scope when they specify a commit, range, file set, or working-tree diff. Otherwise, review the entire branch at its committed tip. Use the pull request's base branch when known. Otherwise use the repository's default branch, typically `origin/HEAD` or `origin/main`, with local `main` as a fallback. Use `git diff --find-renames <base>...<head>` to compare from the merge base. State the refs or range you reviewed.

Read every added or removed comment and enough surrounding code on both sides to judge its purpose. Recover the full text of multiline comments when the diff shows only part. Compare both sides of an edit together. Review a moved comment when the new location changes its usefulness. Use the surrounding code, tests, lint rules, and documentation as evidence for the comments under review.

## Decide whether each comment is needed

Ask which plausible edit or misunderstanding the comment prevents, and what would fail or become harder to diagnose. Check whether an existing name, type, test, lint rule, or document already makes the same fact clear.

- For an addition or edit, recommend dropping the comment when it repeats clear code or provides no useful information. If its information matters and can live in a more reliable place, identify the specific replacement.
- For a deletion, check how the current code or documentation conveys the lost information. If an important fact is missing, recommend a concrete replacement or propose a concise comment when readers need the fact at that location.
- Evaluate compiler and linter directives by what they do. Review the necessity of the suppression. For a removed directive, verify whether the diagnostic or negative type assertion it handled still applies.

Name the smallest sound replacement. Give the proposed variable or function name, the type or invariant to encode, the test scenario and expected behavior, or the lint rule and its scope. Use the [glossary](../../../docs/glossary.md) for project vocabulary and the relevant [game design or architecture documentation](../../../docs/README.md) for durable decisions. Follow the repository's documentation guidance when recommending a decision record.

## Report findings

Give one finding per actionable concern. Identify the comment's file and line, explain the consequence, and recommend a concrete change. Anchor removed comments to the base side of the diff. For a necessary comment that needs to be restored or rewritten, propose wording that follows the current comment policy. If the review has no actionable findings, say so.
