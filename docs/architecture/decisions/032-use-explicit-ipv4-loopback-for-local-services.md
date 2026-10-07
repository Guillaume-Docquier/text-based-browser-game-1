# Use Explicit IPv4 Loopback For Local Services

## Status

Rejected

### Amendment history

- 2026-10-06: Rejected after confirming that Vite 8.3.2 probes wildcard addresses during startup even when configured to bind to `127.0.0.1`. The decision does not prevent the Windows Firewall prompts it was intended to eliminate. The prompt in itself is also annoying, but doesn't prevent the app from working.

## Context

Local development and tests run directly on the host, following [ADR-002](./002-avoid-docker-for-dev.md). Autonomous agents create isolated Git worktrees with separate application ports and their own pnpm-managed Node executable paths.

When a local server listens on all network interfaces, Windows Firewall can request permission for inbound network access. Its [application rules use full executable paths](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules#applications-rules), so allowing Node in one worktree does not cover a different worktree's executable. Repeated prompts require a human to be present and interrupt unattended agent workflows.

Our local application servers and test clients communicate on the same computer. They do not need inbound access from other computers. Approving each executable or suppressing firewall notifications would add machine-specific setup to a workflow that should run autonomously.

`localhost` is a hostname that can resolve to IPv4 loopback (`127.0.0.1`) or IPv6 loopback (`::1`). Using the IPv4 literal for both listeners and clients keeps them on the same address family without relying on name resolution or client fallback behavior.

Investigation of Vite 8.3.2 showed that its port availability check temporarily listens on wildcard addresses before starting the configured HTTP listener. This occurs even with `host: "127.0.0.1"` and `strictPort: true`, without any plugins. These temporary listeners can trigger Windows Firewall even though Vite reports a loopback URL once startup completes.

## Decision

Reject the project-wide requirement to hardcode `127.0.0.1` for local servers and their clients as a solution to repeated Windows Firewall prompts.

The original decision applied this requirement to the local backend, integration test servers, Vite, Storybook, and browser test servers, while retaining Railway's `::` binding. Configuring those listeners does not control temporary listeners opened internally by development tools.

## Consequences

This ADR no longer mandates explicit IPv4 loopback literals for local services. Loopback binding still limits access to the configured listener, but it does not guarantee that the process avoids Windows Firewall prompts.

Resolving the remaining prompts requires addressing the development tool's startup listeners. Inspecting only the final listening address or printed URL can miss the temporary wildcard probes.
