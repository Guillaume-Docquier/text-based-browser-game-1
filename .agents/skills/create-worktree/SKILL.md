---
name: create-worktree
description: Create and set up a Cosmic Empires Git worktree with isolated services. Use whenever creating a worktree for this repository or setting up a newly created worktree.
---

# Create and set up a worktree

After creating a worktree, run setup from the **new worktree's repository root**:

```powershell
pnpm wts
```

Wait for the command to finish successfully. It installs all dependencies, copies the main checkout's `.env`, assigns dedicated backend, frontend, and database ports, and creates, migrates, and seeds a dedicated database container. This gives the worktree a fully isolated local development environment. Let `pnpm wts` manage these settings; no manual environment variable or port edits are needed.

Run subsequent development and test commands from this worktree so they use its configuration.

## Port conflict

If the assigned ports don't work, run `pnpm wts` again to get new ports.

## Storybook

Start Storybook from the worktree root:

```powershell
pnpm storybook
```

Storybook uses a random port. Read its startup output and use the URL it reports.

## End-to-end tests

End-to-end tests automatically use the worktree's assigned backend and frontend ports and database configuration. No additional port wiring or Playwright configuration changes are needed.
