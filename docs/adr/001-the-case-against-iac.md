# The Case Against Infrastructure As Code (IaC)

## Status

Accepted

## Context

Railway's Config as Code covers only part of service config (mainly build/deploy). It does not model full project infrastructure such as environment variables and networking. Terraform support exists via community provider, but official, complete IaC support is still limited.

## Decision

Use Railway UI/manual configuration for now. Revisit Terraform or fuller IaC if project complexity increases.

## Consequences

Infrastructure state lives in the UI, so recovery/history is weaker than declarative IaC.

Operational settings are harder to audit because configured values are mixed with all available options.
