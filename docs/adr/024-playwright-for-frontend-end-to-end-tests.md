# Playwright For Frontend End-to-End Tests

## Status

Accepted

## Context

The frontend has backend integration tests and a Storybook sandbox for manual component inspection, but it does not have automated coverage for browser routing, rendered accessibility semantics, or Clerk-authenticated behavior.

The initial browser suite only needs to run locally. It should exercise production frontend code without introducing selector-only markup or making the normal frontend quality gate depend on developer credentials.

## Decision

Use Playwright with Chromium for frontend end-to-end tests in `frontend/playwright`.

Tests select elements by semantic roles and accessible names. Production test IDs must not be added solely to make E2E selection easier.

Use strict page objects in `frontend/playwright/pages`. Tests instantiate the page objects they need. Every page object receives Playwright's `Page` in its constructor, exposes a parameterless `goto()` method, and owns the semantic locators and thin interaction methods for that page. Page objects do not make assertions, encode scenarios, or contain business decisions.

Use Clerk's Playwright helpers with a project-based setup. The setup obtains a Clerk testing token, signs in an existing development user by email, and stores the resulting browser state in the gitignored `frontend/playwright/.clerk` directory. Authenticated test projects reuse that state.

Local E2E configuration reads `frontend/.env`. The existing `VITE_CLERK_PUBLISHABLE_KEY` is also provided to Clerk's test helper as `CLERK_PUBLISHABLE_KEY`; developers must separately configure `CLERK_SECRET_KEY` and `E2E_CLERK_USER_EMAIL`.

The E2E suite is not part of `frontend checks`. It has dedicated local commands because it requires Clerk credentials, a Clerk development user, and an installed browser. CI integration is deferred.

## Consequences

The frontend gains browser-level coverage for public routes, protected-route redirects, and authenticated rendering. Tests are coupled to user-visible semantics rather than implementation details.

Developers must install Playwright's Chromium build once and maintain a Clerk development test user. Authentication state and Playwright output remain local and are not committed.
