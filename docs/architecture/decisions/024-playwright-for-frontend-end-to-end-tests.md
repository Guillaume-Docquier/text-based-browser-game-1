# Playwright For Frontend End-to-End Tests

## Status

Accepted

### Amendment history

- 2026-08-09: Added CI execution using GitHub hosted Postgres service

## Context

The backend has good integration feature oriented tests, but the frontend has nothing. Unit tests could be used easily, but that wouldn't be feature oriented and would leave a gap in our testing: authentication.

## Decision

Use Playwright with Chromium for frontend end-to-end (e2e) tests in `frontend/playwright`.

The e2e tests should test real user flows with real authentication, real backend, real everything.

Run the e2e tests in CI using a GitHub Actions Postgres service. Playwright starts the backend and frontend, and the backend applies migrations on boot. The tests create their own scenario data, so the
database does not need a separate seed step.

We've set up the `e2e+clerk_test@example.com` in the Clerk dev env for use in tests.

### Guidelines

- favor role based selectors over test ids.
- implement strict Page Object Models (POM) that expose the page functionality. POMs are dumb, they don't own test assertions or test setup code, they are simply an abstraction over the actual page.
- organize tests by vertical slices

## Consequences

e2e tests are enforced with every change.

However, the secrets are now in GitHub Actions, so they can be stolen by an external contributor running a workflow on our repository. That being said, they're dev credentials, so the blast radius is limited.

We also now have 4 Postgres versions to keep in sync:

- dev setup via docker compose
- prod via a Railway service
- concurrency tests via dev containers
- GitHub via services

Using Railway PR environments would remove on version, as it would be the same as prod.
