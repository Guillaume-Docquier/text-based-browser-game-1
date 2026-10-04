---
name: create-github-prs
description: Create GitHub pull requests for Cosmic Empires. Use whenever an agent opens a PR in this repository, including PRs opened during other workflows.
---

# Create GitHub pull requests

Always respect the repository's [PR template](../../../.github/pull_request_template.md) when opening a PR.

## Title

- Always title PRs as `<prefix>(<scope>): <description>`, with both a prefix and a scope.
- Use `project` as the prefix when the change spans multiple areas. For focused work, use the project being changed: `backend`, `frontend`, or `shared`.
- Use the scope to name the concept being worked on, such as `project(pr-title-validation): ...` or `shared(action-costs): ...`.

## Description

If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.
