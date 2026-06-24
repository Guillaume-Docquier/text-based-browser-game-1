# Playwright For Frontend End-to-End Tests

## Status

Accepted

## Context

The backend has good integration feature oriented tests, but the frontend has nothing. Unit tests could be used easily, but that wouldn't be feature oriented and would leave a gap in our testing: authentication.

## Decision

Use Playwright with Chromium for frontend end-to-end (e2e) tests in `frontend/playwright`.

The e2e tests should test real user flows with real authentication, real backend, real everything.

Railway supports PR environments, but for now we won't hook the e2e tests to the CI to avoid costs.

We've set up the `e2e+clerk_test@example.com` in the Clerk dev env for use in tests.

## Consequences

We'll have e2e tests offering good coverage of the system, but the tests will be run locally only. This is fine since I'm the only contributor right now.
