# Use Railway Infrastructure as Code

## Status

Accepted

Supersedes [ADR-001](./001-the-case-against-iac.md).

## Context

The original decision to configure Railway in its dashboard reflected the absence of project-level infrastructure as code. Railway now supports a project-level TypeScript configuration in `.railway/railway.ts`. Its older per-service `railway.json` format stops being read on December 1, 2026, so the existing backend and frontend configuration must be migrated.

The deployed project also contains resources and settings outside those two files. Recreating only the settings visible in the repository could remove or alter existing services, networking, or database resources when applied.

## Decision

Use Railway's project-level Infrastructure as Code to describe the Railway project via `.railway/railway.ts`.

Keep existing environment variable values in Railway because we don't want to commit secrets.

## Consequences

The project's infrastructure becomes reviewable with the application code, including resources that Config as Code could not describe. Most infra work can be done via CLI and version controlled files instead of via click-ops in Railway.
