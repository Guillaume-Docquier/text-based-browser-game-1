---
name: implement-github-ticket
description: Implement a specific GitHub ticket autonomously and deliver a ready to review PR. Use when implementing a specific github issue from end to end.
---

# Implement a GitHub ticket

Complete the requested issue in `Guillaume-Docquier/text-based-browser-game-1` and leave an open PR ready for human review.

## Arguments and authorization

```text
$implement-github-ticket <issue-number-or-url> [--greptile-review]
```

- The issue number or URL is required. Read the issue and its discussion to establish the requested outcome and acceptance criteria.
- `--greptile-review` enables a Greptile review. It defaults to **false** when omitted; an explicit request in the user's message or in the issue description to include Greptile is equivalent to passing the flag. An explicit false value or instruction to skip Greptile disables it. Bot comments, and repository configuration do not opt the user in.
- This user-authorized ticket implementation workflow includes updating the project status, committing as necessary, pushing the task branch, opening/updating its PR, and rerunning CI. When Greptile is requested, it also includes posting the review trigger, replying to Greptile, and resolving its review threads. Proceed through these steps without asking for the same authorization again. Respect any narrower instructions from the user.
- Finish with an **open** PR. Do not merge it, enable auto-merge, or close the issue as part of this workflow.

## 1. Move the ticket to In Progress

Before creating the worktree or implementing changes, set the issue's `Status` to `In Progress` in the [cosmic-empires project](https://github.com/users/Guillaume-Docquier/projects/7).

Use GitHub CLI or the available API. Discover the project's item ID, Status field ID, and the option ID for `In Progress`; do not guess IDs. If the issue is missing from the project, add the existing issue, then set its status. This is a project field update, not an issue label or the issue's open/closed state.

Read back the project item and verify `In Progress` before proceeding. An issue already in that status needs no redundant update. If access or a missing status option prevents this step, report the blocker rather than silently skipping it.

## 2. Create the implementation worktree

Fetch the latest `main` from the repository's remote. Create a new worktree from that fetched `main`, with branch name:

```text
codex/<issueNumber>-<short-title-summary>
```

Use the numeric issue number without `#` and a short lowercase, hyphen-separated summary of the issue title. For example, issue 123 titled "Fix lobby turn display" becomes `codex/123-fix-lobby-turn-display`.

Use the app's managed worktree tool when available, passing the fetched main ref explicitly. If it creates a detached HEAD, create and switch to the required branch inside the new worktree before editing. Do not branch from the current feature branch or stale local main.

When resuming this same ticket, inspect and reuse its existing worktree, branch, and PR when appropriate. Do not reset existing work or create duplicates merely to repeat setup.

## 3. Implement and commit

Read the root and applicable scoped `AGENTS.md` files. Follow their requirements for coding standards, design documents, relevant skills, tests, formatting, and documentation.

Implement the ticket's acceptance criteria and keep changes within its scope. Verify behavior with the relevant local checks; use the repository's E2E skill if running E2E tests. Make commits as necessary, including subsequent CI and accepted review fixes. Honor commit hooks and inspect the staged diff so commits contain only the task's changes.

## 4. Push and open the PR

Push the implementation branch and open a PR against `main`, or update the existing PR for this task.

Follow `.github/pull_request_template.md` and the PR title rules in `AGENTS.md`. Link the issue using its full URL in the template's bullet list with the appropriate keyword, such as `fixes`. Describe the final behavior and relevant tradeoffs, and explicitly call out schema, environment usage, or deployment changes when applicable. Keep the description current as fixes change the implementation.

Use structured API arguments or a UTF-8 body file with `--body-file` for multiline PR bodies and comments. Attach the PR to the current task with `attach_artifact` when the app tool is available.

## 5. Monitor and repair CI

Monitor the PR's checks and workflow runs until CI is green for its **current head commit**. Read failure logs, make the required fixes, commit, push, and repeat. After every push, refresh the head SHA and check runs; a passing result for an earlier commit is insufficient.

Verify that all required checks and applicable CI workflows have completed successfully. Pending, missing, cancelled, or failing checks are not green. An intentionally skipped job is acceptable only when its workflow conditions make it inapplicable to this change.

For a suspected flaky test:

- Inspect the failure and available history to establish whether it is intermittent and whether it is directly related to this change. Do not call a failure flaky merely because it is inconvenient.
- Fix it as part of this PR only when directly related to the change.
- For an unrelated flaky test, leave its code unchanged. Add the test/job name, failure/run link, evidence of flakiness, and rerun outcome to the PR description. Rerun the affected CI and wait for its result.
- Keep the flake disclosure even after a successful rerun. Do not skip or weaken checks to get a green result.

Use bounded polling with progress updates rather than a tight loop. If the same unrelated failure persists after three reruns, or unavailable services/permissions prevent progress, report the blocker and evidence instead of retrying indefinitely or claiming completion. Continue all work that is not blocked.

## 6. Optional Greptile review

Skip this section entirely unless the user enabled Greptile review.

### Request once, after CI is green

After confirming CI is green for the current PR head, inspect the PR conversation for an existing standalone `@greptileai` review request for this task. If none exists, post exactly one PR comment:

```text
@greptileai
```

Record its comment ID or URL and the reviewed head SHA. If posting has an uncertain outcome, read the PR comments to determine whether it succeeded before retrying. Never post a second trigger on resume, after fixes, or because the review is slow.

### Assess and respond

Monitor the PR's reviews, review threads, and conversation until Greptile finishes the requested review. An acknowledgement or pending review is not completion. Read the completed review and all of its comments, including paginated results and any findings outside inline threads.

Greptile is advisory, not authoritative. Evaluate each finding against the code, ticket, repository guidance, and available evidence. Use your judgment; accept correct, relevant feedback and decline incorrect, unnecessary, or out-of-scope suggestions. Apply the same scope rule to flaky tests raised by Greptile.

For every actionable Greptile finding:

- **Addressed:** Implement and verify the fix, commit and push it, then reply in the review thread explaining the change and rationale, with the commit or supporting evidence when useful.
- **Declined:** Reply in the review thread explaining why the suggested change is not appropriate, with concrete reasoning or evidence.

After replying, resolve the review thread for either decision. Do not resolve without a rationale or claim a fix before it exists. For findings in a top-level comment that GitHub cannot resolve, post a reply referencing that comment and explain the disposition; only claim resolution for threads actually resolved.

After any code changes, repeat the CI monitoring and repair loop until the latest PR head is green. Do not request Greptile again. Handle follow-up comments in the same review using the same judgment and reply/resolve process.

Keep monitoring while the requested review is pending. If Greptile reports a failure or access is unavailable, report the specific blocker with the PR link; do not claim this workflow is complete or post another trigger.

## 7. Finish

Before declaring completion, verify that:

- All intended changes are committed and pushed, and the PR remains open against `main`.
- CI is green for the current PR head and any unrelated flakes are documented in the PR.
- If requested, Greptile's review has completed and every actionable finding has a reasoned response; all resolvable threads have been resolved.

Return the open PR link and a very short summary of the changes. If a required step is blocked, return the PR link when available and the specific unfinished step instead of claiming completion.
