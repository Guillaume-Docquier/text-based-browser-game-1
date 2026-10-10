---
name: close-task
description: Close a completed Cosmic Empires task by disposing of its worktree resources, removing its worktree and local branch when applicable, and archiving the Codex thread. Use when the user asks to close or clean up a finished task.
---

# Close a task

Invoking this skill authorizes cleanup of the current task and archiving its Codex thread. It does not authorize discarding unfinished work, merging or closing a PR, or deleting a remote branch.

## Identify the checkout

Use `git rev-parse --show-toplevel` and `git worktree list --porcelain` to capture the current checkout's absolute path, local branch (if any), and the main checkout's path. The first worktree entry is the main checkout.

If this is the main checkout, skip resource, worktree, and branch removal and proceed to thread archival.

For a linked worktree, verify that its work is committed and pushed, or otherwise recoverable, before removing it. Preserve any needed ignored files separately. If unfinished work would be lost, report it and ask how to handle it before cleanup; do not silently discard it.

## Dispose of worktree resources

Run from the worktree's repository root, while its configuration still exists:

```powershell
pnpm wtd
```

This is the stable entry point for disposing of worktree services and resources. Confirm that the worktree's `.env` selects its dedicated Compose project before running it; never target the main checkout's database or change environment variables yourself.

Wait for successful completion before removing the worktree. If disposal fails, report the failure and leave the worktree and thread available for retry.

## Remove the worktree and local branch

Move shell operations to the main checkout before removal. Remove only the captured worktree path:

- For a Codex-managed worktree attached to this task, find its exact identity with `list_artifacts` and use `archive_worktree`. This removes the checkout while retaining a recoverable snapshot. The Codex thread still needs to be archived separately.
- For an unmanaged worktree, use `git worktree remove` with the captured absolute path. Do not force removal of unpreserved changes.

After successful worktree removal, delete its captured local branch, if any, from the main checkout using `git branch -D`. This repository always squash-merges, so `git branch -d` cannot reliably recognize merged task branches. Before deletion, verify that the branch tip is recoverable from a remote branch or the managed worktree's saved snapshot. Do not delete `main` or a branch used by another worktree.

If worktree or branch removal fails, report the remaining cleanup and keep the thread open for retry.

## Archive the thread

After cleanup succeeds, call `set_thread_archived` with `archived: true`, omitting `threadId` to archive the current Codex thread. Confirm the result and report the completed cleanup briefly.
