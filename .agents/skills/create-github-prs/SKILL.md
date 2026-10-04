---
name: create-github-prs
description: Create GitHub pull requests. Use when you want to open a PR.
---

# Create GitHub pull requests

Always respect the repository's [PR template](../../../.github/pull_request_template.md) when opening a PR.

## Title

- Follow the [PR title convention](../../../CONTRIBUTING.md#pull-request-titles): `<scope>: <description>`.
- Choose any scope that describes the area being changed, such as `pr-title-validation: simplify title checks` or `action-costs: correct resource calculations`. There is no scope allowlist or required project prefix.
- This format applies only to PR titles. Using it for commits is optional.

## Description

If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.
