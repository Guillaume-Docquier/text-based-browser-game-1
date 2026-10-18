# Use Railway Infrastructure as Code

## Status

Accepted

Supersedes [ADR-001](./001-the-case-against-iac.md).

## Context

The original decision to configure Railway in its dashboard reflected the absence of project-level infrastructure as code. Railway now supports a project-level TypeScript configuration in `.railway/railway.ts`. Its older per-service `railway.json` format stops being read on December 1, 2026, so the existing backend and frontend configuration must be migrated.

The deployed project also contains resources and settings outside those two files. Recreating only the settings visible in the repository could remove or alter existing services, networking, or database resources when applied.

## Decision

Use Railway's project-level Infrastructure as Code to describe the existing Railway project in one `.railway/railway.ts` file. Import the live configuration before editing it, preserve the existing resource names and settings, and review `railway config plan` before applying a change. Merge the deletion of the per-service `railway.json` files only after the live Config as Code cutover and IaC apply succeed.

Keep existing environment variable values in Railway. The migration does not copy secrets into source control or change their values. Use Railway's unmanaged-variable migration mode for existing service variables.

## Consequences

The project's infrastructure becomes reviewable with the application code, including resources that Config as Code could not describe. A migration or later change can affect the whole environment, so plans must be checked for unintended resource or variable changes before applying. Railway CLI authentication and a coordinated cutover are required; merging a file alone does not apply it to Railway.
