# Use Explicit IPv4 Loopback For Local Services

## Status

Accepted

## Context

Local development and tests run directly on the host, following [ADR-002](./002-avoid-docker-for-dev.md). Autonomous agents create isolated Git worktrees with separate application ports and their own pnpm-managed Node executable paths.

When a local server listens on all network interfaces, Windows Firewall can request permission for inbound network access. Its [application rules use full executable paths](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules#applications-rules), so allowing Node in one worktree does not cover a different worktree's executable. Repeated prompts require a human to be present and interrupt unattended agent workflows.

Our local application servers and test clients communicate on the same computer. They do not need inbound access from other computers. Approving each executable or suppressing firewall notifications would add machine-specific setup to a workflow that should run autonomously.

`localhost` is a hostname that can resolve to IPv4 loopback (`127.0.0.1`) or IPv6 loopback (`::1`). Using the IPv4 literal for both listeners and clients keeps them on the same address family without relying on name resolution or client fallback behavior.

## Decision

Hardcode `127.0.0.1` for application-owned local development and test HTTP server bindings, and use the same address for their direct local HTTP clients. This covers the local backend, integration test servers, Vite development server, Storybook, and browser test servers.

Keep the loopback address fixed across worktrees. Continue assigning distinct ports through the worktree setup workflow. The address does not need a per-worktree environment variable or firewall allowance.

Deployed services retain the network bindings their hosting environment requires. The Railway backend continues to listen on `::` so the reverse proxy can reach it through Railway's IPv6 internal network, consistent with [ADR-005](./005-reverse-proxy.md). The mechanism for selecting a deployment binding is a separate configuration decision.

## Consequences

Local servers remain accessible to browsers, proxies, and tests on the same computer while avoiding the need to grant inbound network access for each worktree's Node executable. This supports autonomous agent runs without a human accepting firewall prompts.

Local services are accessible only from this computer. Testing from another device or from a separate container or virtual machine requires an explicit binding change and review of the resulting network access. IPv6-specific local testing also requires a deliberate alternative binding.

The repeated literal is intentional: it records a stable local networking convention at each listener and client. New local servers and test tooling must follow it, while deployment bindings must remain appropriate for the hosting environment.

Socket and connectivity checks can verify the configured bindings. Whether Windows stops prompting must be confirmed during normal worktree use; additional prompts should trigger inspection of the tool's actual listeners.
