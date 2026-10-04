---
name: create-github-prs
description: Create GitHub pull requests. Use when you want to open a PR.
---

# Create GitHub pull requests

Always respect the repository's [PR template](../../../.github/pull_request_template.md) when opening a PR.

## Title

- Follow the [PR title validation](../../../.github/workflows/pr-title-validation.yml): `<scope>: <description>`.
- Choose a single, non-empty scope using only letters (`a-z`, `A-Z`), numbers (`0-9`), and dashes (`-`), such as `pr-title-validation` or `action-costs`. There is no scope allowlist or required project prefix.
- Separate the scope and description with a colon and a space. The description must be non-empty and can contain any characters.
- This format applies only to PR titles. Using it for commits is optional.

## Description

If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.
