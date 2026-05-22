# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

Infer the repo from `git remote -v`; `gh` does this automatically inside the clone.

## Common operations

- Create an issue with `gh issue create --title "..." --body "..."`
- Read an issue with `gh issue view <number> --comments`
- List issues with `gh issue list`
- Comment with `gh issue comment <number> --body "..."`
- Apply or remove labels with `gh issue edit`
- Close with `gh issue close <number> --comment "..."`

## Skill conventions

When a skill says "publish to the issue tracker", create a GitHub issue.

When a skill says "fetch the relevant ticket", run `gh issue view <number> --comments`.
