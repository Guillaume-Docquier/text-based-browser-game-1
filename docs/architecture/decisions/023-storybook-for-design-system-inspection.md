# Storybook For Design System Inspection

## Status

Accepted

## Context

Reusable frontend components live in `frontend/src/components`, but inspecting them currently requires finding or creating an application page that renders each relevant state. This makes design-system review slower and couples component inspection to feature development.

The project needs an isolated sandbox for manually reviewing shared components and their variants. It does not currently need Storybook-based interaction tests, accessibility tests, visual regression tests, or CI publication.

## Decision

Use Storybook 10 with the React Vite framework as the local design-system sandbox.

Stories are colocated with the components in `frontend/src/components` and use the `*.stories.tsx` suffix. Storybook only discovers stories in that directory. Global application styles are loaded in the Storybook preview so components render with the same Tailwind, Shadcn, font, and theme definitions as the frontend.

Storybook uses a minimal Vite configuration containing the Tailwind plugin instead of loading the application Vite configuration. This keeps component inspection independent from application environment variables, backend proxy configuration, and TanStack Router generation.

Storybook remains a manual inspection tool. We do not install or configure Storybook test runners, interaction testing, accessibility testing, visual regression testing, or CI workflows.

## Consequences

Shared components and their important variants can be inspected without navigating the application or satisfying application runtime dependencies. Component changes should add or update colocated stories when that improves design-system coverage.

The frontend now carries Storybook-specific development dependencies and configuration. Stories are typechecked with the rest of the frontend source, and Storybook upgrades must remain compatible with the frontend's React, Vite, and Tailwind versions.
