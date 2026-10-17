---
name: pick-up-ai-tasks
description: Dispatch approved Cosmic Empires GitHub project issues marked Good for AI into separate Codex implementation chats. Use when asked to pick up AI tasks or when invoked by the dispatcher automation.
---

# Pick up AI tasks

Scan the [cosmic-empires project](https://github.com/users/Guillaume-Docquier/projects/7) and create one independent Codex chat per eligible issue. Invoking this workflow authorizes those chat creations. The dispatcher only discovers and dispatches tasks; implementation belongs to the new chats.

## Discover eligible issues

Use repository `Guillaume-Docquier/text-based-browser-game-1`. Read project 7 through GitHub CLI or the available API, following pagination until all items have been inspected. If filtering repository issues by labels first, verify each candidate's membership and status in this exact project. Do not infer project membership from labels or the project title alone.

An eligible item must:

- Be an open GitHub issue in this repository and project, rather than a draft item or pull request.
- Have both existing issue labels `Approved` and `Good for AI` (compare label names case-insensitively).
- Have project `Status` equal to `Backlog` or `Todo`.
- Have no existing implementation chat or open implementation PR for the issue.

Inspect current project fields, not the issue's open/closed state alone. Issues in `In Progress`, `Dev Done`, `Released`, `Rejected`, or `Blocked` are not ready for dispatch. A missing or unknown status is not ready either.

Use the desktop app's chat-listing and chat-reading tools to identify existing implementations by their full issue URL. Include pinned chats and inspect candidate chats when their summaries are inconclusive. Inspect linked/open implementation PRs as well. A recent-chat listing is not proof that an older implementation does not exist; use the current project status and the available chat/PR evidence together. If the evidence for a candidate remains ambiguous, report it and skip that issue rather than creating a second implementation.

## Dispatch

Use the desktop app's `list_projects` tool to resolve this repository's local project on the current host. Use `create_thread` for each issue, with:

- Target: that local project, with environment type `local`. The implementation workflow handles its own worktree setup.
- Model: `gpt-6.1-sol`.
- Reasoning effort: `high` (the `thinking` argument).
- Title: `Implement #<issue-number>: <issue-title>`.
- Prompt: exactly `Implement <full GitHub issue URL>`.

For example, the entire prompt for issue 123 is:

```text
Implement https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/123
```

Do not append instructions, a skill invocation, a plan, or implementation details to that prompt. Do not substitute a subagent, a fork of the dispatcher, or a terminal process for a separate chat.

Recheck the issue's labels, project membership, status, and duplicate evidence immediately before each creation. Dispatch each remaining eligible issue once; do not impose an arbitrary batch limit. Do not wait for an implementation to finish before dispatching the next issue.

Record the returned chat ID and host ID with the issue URL in the dispatcher's run result. If creation returns a pending operation, resolve it with the app's status tools; do not pass a temporary client ID to tools requiring a chat ID. If a creation fails or its outcome is uncertain, inspect existing chats before retrying. Do not automatically redispatch an issue whose existing implementation is blocked or failed; report that chat for human attention.

If required GitHub access or app tools are unavailable, report the specific blocker. Do not simulate dispatch or claim success without a confirmed created chat. Continue with unrelated eligible issues when a failure is isolated to one issue.

## Dispatcher boundary and result

Do not change repository files, GitHub issues, labels, project statuses, branches, worktrees, or PRs. Do not implement, test, review, merge, or send follow-up instructions to implementation chats. Workers own the implementation workflow, including moving their issue to `In Progress`.

Finish after dispatching. Report each dispatched issue with its chat ID and any creation failures or ambiguous candidates requiring attention. Stay quiet when there is nothing new or actionable. Each scheduled invocation performs a fresh scan; never assume a previous dispatcher's chat history is present.
