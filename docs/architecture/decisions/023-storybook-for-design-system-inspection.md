# Storybook For Design System Inspection

## Status

Accepted

### Amendment history

- 2026-09-30: Allow selected application components alongside shared design-system components, with separate Design System and Application sidebar sections, so feature states can be inspected without mixing them into the design system.

- 2026-10-01: Add browser component testing with the Vitest addon so isolated UI behavior can move out of end-to-end tests.

- 2026-11-15: Consolidate frontend component tests in Storybook play functions so each interaction is maintained with its story.

- 2026-11-15: Allow colocated Vitest browser tests that reuse portable stories for verification-only sequences and native input. Keep visual examples available for manual inspection without automatic test interactions.

## Context

Inspecting reusable frontend components through application pages requires finding or creating a page that renders each relevant state. This makes design-system review slower and couples component inspection to feature development.

The project needs an isolated sandbox for manually reviewing shared components and their variants, as well as selected application components with useful standalone states. Isolated component behavior also needs automated coverage so end-to-end tests can focus on user flows and resulting application state.

Running verification sequences whenever a story opens interrupts manual inspection. CSS hover tests also need a browser automation driver, which the ordinary Storybook preview does not provide. Keeping all such checks in play functions forces environment-specific branches.

## Decision

Use Storybook with the React Vite framework as the local component-inspection sandbox, with Design System first in the sidebar and Application second.

Stories are colocated with their components and use the `*.stories.tsx` suffix. Storybook discovers stories throughout the frontend source. Shared design-system components use titles starting with `Design System/`; application components use `Application/`. Load global application styles in the Storybook preview so components render with the same styles, fonts, and themes as the frontend.

Storybook uses a minimal Vite configuration containing the Tailwind plugin instead of loading the application Vite configuration. This keeps component inspection independent of application environment variables, backend proxy configuration, and route generation.

Use the Storybook Vitest addon to run colocated stories as component tests in Chromium through Vitest browser mode. Keep visual examples static and provide a stateful story when manual interaction is useful. Play functions remain suitable for sequences that demonstrate a useful component state; assertions in those functions use `storybook/test`.

Put verification-only interaction sequences in colocated `*.browser.test.tsx` files. Reuse the stories through Storybook's portable stories API, applying the shared preview annotations and styles. Run these files in a separate Vitest project with the Playwright provider. Use `vitest` assertions and native `vitest/browser` interactions, including for CSS hover. Keep test controls and decorators in these files and avoid test-mode branches in stories.

Both projects reuse the minimal Storybook Vite configuration and remain independent of application environment variables, live authentication, and backend services. Component-test commands include both projects so local verification and CI retain the interaction coverage.

## Consequences

Shared components and selected application components can be inspected without navigating the application or satisfying application runtime dependencies. Stories remain independent of live authentication and backend services. Component changes should add or update colocated stories when that improves inspection of meaningful states; application components do not all require stories.

The frontend carries Storybook and browser-testing development dependencies and configuration. Browser binaries are required locally and in CI; component tests can run without starting the application services. Stories are typechecked with the rest of the frontend source, and Storybook upgrades must remain compatible with the frontend's React, Vite, and Tailwind versions.

Verification-only tests do not run when a story opens or appear in its sidebar entry. They require a separate Vitest project and explicit portable-story setup. Storybook's focused story-test tools do not run these files; contributors must also run the browser project or the combined test script. Native pointer position can persist between tests, so tests establish their starting pointer and focus state.
