---
name: dispatch-ai-tasks
description: Dispatch eligible Cosmic Empires issues into separate Codex chats. Use only when explicitly requested by the user or an automation.
---

# Dispatch AI tasks

Invocation authorizes creating implementation chats. Only discover and dispatch; never read issue bodies/comments, implement, test, review, verify implementations, or send worker follow-ups. Do not modify repository files, issues, labels, project statuses, branches, worktrees, or PRs; workers own implementation, including moving issues to `In Progress`.

1. Freshly scan all pages of [GitHub project 7](https://github.com/users/Guillaume-Docquier/projects/7) through GitHub CLI/API, requesting only metadata. Eligible items are open issues in `Guillaume-Docquier/text-based-browser-game-1`, belonging to this exact project, with both `Approved` and `Good for AI` labels (case-insensitive) and project `Status` of `Backlog` or `To Do`. Exclude drafts, PRs, and all other or missing statuses.
2. Use `list_projects` to resolve the repository's local project on the current host. Immediately before each creation, recheck eligibility and existing chats for duplicates. Skip previously dispatched issues; report blocked or failed chats for human attention instead of redispatching. Do not rely on previous run history being present.
3. Call `create_thread` once per remaining eligible issue, without a batch limit or waiting for implementations:
   - Target: resolved project, environment `local`; workers handle worktree setup.
   - Model: `gpt-6.1-sol`; `thinking`: `high`.
   - Title: `Implement #<issue-number>: <issue-title>`.
   - Entire prompt: `Implement <full GitHub issue URL>`.

   No prompt additions, subagents, forks, or terminal substitutes. Resolve pending creations through app status tools; never use temporary client IDs where chat IDs are required. Inspect existing chats before retrying failed or uncertain creations.

4. Finish after dispatching. Report confirmed creations with issue URL, chat ID, and host ID, plus failures, access/tool blockers, or ambiguous candidates. Continue past isolated failures; never claim unconfirmed success. Stay quiet when nothing is new or actionable.
