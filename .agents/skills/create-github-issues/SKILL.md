---
name: create-github-issues
description: Create GitHub issues for Cosmic Empires. Use whenever an agent creates issues in this repository, including issues created during other workflows. Require the Needs Human Review label, membership in the cosmic-empires GitHub project, and Backlog status.
---

# Create GitHub issues

Every issue an agent creates must satisfy all three requirements:

- Apply the existing `Needs Human Review` label at creation time.
- Add the issue to the repository's GitHub project, `cosmic-empires`: [Guillaume-Docquier project 7](https://github.com/users/Guillaume-Docquier/projects/7).
- Keep the project's `Status` field set to `Backlog`, the default status for new items.

These requirements apply to every issue in a batch as well as individual issues. Additional relevant labels may accompany `Needs Human Review`.

## Create and verify

Use repository `Guillaume-Docquier/text-based-browser-game-1`. Respect any repository issue templates when drafting the title and body. Describe the concrete problem or requested outcome and include the evidence or acceptance criteria needed for human review.

Prefer GitHub CLI when available, since it can apply the label and add project membership during creation. Write the exact issue body to a temporary file and pass it with `--body-file`:

```powershell
gh issue create --repo Guillaume-Docquier/text-based-browser-game-1 --title "Issue title" --body-file <body-file-path> --label "Needs Human Review" --project "cosmic-empires"
```

If using an API or connector instead, apply the label when creating the repository issue, then add that same issue to project 7. A repository issue alone or a project draft does not satisfy the requested outcome.

Read back the created issue's labels and project fields, for example:

```powershell
gh issue view <issue-number> --repo Guillaume-Docquier/text-based-browser-game-1 --json url,labels,projectItems
```

If creation partially succeeds or its outcome is uncertain, locate and repair the existing issue before retrying; do not create a duplicate. If missing access prevents the required label, project membership, or status, report the issue URL and the unmet requirement. Claim completion only after all three requirements are verified, and return the issue URL.
