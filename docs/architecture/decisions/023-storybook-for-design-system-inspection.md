# Storybook For Design System Inspection

## Status

Accepted

### Amendment history

- 2026-09-30: Allow selected application components alongside shared design-system components, with separate Design System and Application sidebar sections, so feature states can be inspected without mixing them into the design system.

- 2026-10-01: Add browser component testing with the Vitest addon so isolated UI behavior can move out of end-to-end tests.

## Context

Reusable frontend components live in `frontend/src/components`, but inspecting them currently requires finding or creating an application page that renders each relevant state. This makes design-system review slower and couples component inspection to feature development.

The project needs an isolated sandbox for manually reviewing shared components and their variants, as well as selected application components with useful standalone states. Isolated component behavior also needs automated coverage so end-to-end tests can focus on user flows and resulting application state.

## Decision

Use Storybook 10 with the React Vite framework as the local component-inspection sandbox, with Design System first in the sidebar and Application second.

Stories are colocated with their components and use the `*.stories.tsx` suffix. Storybook discovers stories throughout `apps/frontend/src`. Shared components in `src/components` use titles starting with `Design System/`; feature components use `Application/`. Application is a broad section for now. Global application styles are loaded in the Storybook preview so components render with the same Tailwind, Shadcn, font, and theme definitions as the frontend.

Storybook uses a minimal Vite configuration containing the Tailwind plugin instead of loading the application Vite configuration. This keeps component inspection independent from application environment variables, backend proxy configuration, and TanStack Router generation.

Use the Storybook Vitest addon to run colocated stories as component tests in Chromium through Vitest browser mode. Write interaction and rendering assertions in story play functions using storybook/test. The test configuration reuses the minimal Storybook Vite configuration and remains independent of application environment variables, live authentication, and backend services.

Run the suite with pnpm --filter frontend storybook:test, watch it with pnpm --filter frontend storybook:test:watch, or use the Storybook testing panel. Install Chromium with pnpm --filter frontend e2e:install. Component tests own isolated UI states, keyboard behavior, hover, and focus presentation. End-to-end tests retain real navigation, authentication, submissions, and resulting application state. Keep automated accessibility checks, visual regression testing, and Storybook publication outside this decision.

## Consequences

Shared components and selected application components can be inspected without navigating the application or satisfying application runtime dependencies. Stories remain independent of live authentication and backend services. Component changes should add or update colocated stories when that improves inspection of meaningful states; application components do not all require stories.

The frontend carries Storybook and browser-testing development dependencies and configuration. Browser binaries are required locally and in CI; component tests can run without starting the application services. Stories are typechecked with the rest of the frontend source, and Storybook upgrades must remain compatible with the frontend's React, Vite, and Tailwind versions.
