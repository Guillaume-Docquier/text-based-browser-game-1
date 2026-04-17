# shadcn Preset Migration for Frontend

## Summary

Migrate the existing Vite frontend to shadcn using preset `b3SRblUw7`, then modernize every route to use shadcn primitives and any needed app-level reusable components under `frontend/src/components/`. Remove the old local design system entirely so `frontend/src/design-system/` is deleted and no imports remain.

## Key Changes

- Initialize shadcn inside the existing `frontend/` app using the existing-project flow, not the scaffold flow:
  - do the required manual Vite/existing-project setup steps first
  - run `pnpm dlx shadcn@latest init --yes` from `frontend/`
  - apply the target preset afterward with `pnpm dlx shadcn@latest apply --preset b3SRblUw7 --yes` if the preset is not handled during initialization
  - do not use `--template vite` in this repo because this is already an existing Vite project
- Configure shadcn without introducing `@/*` aliases:
  - preserve the existing `@api-types` alias
  - do not add `@/*` path aliases in TS config or `resolve.alias` in Vite because of the current TanStack Router + Vite incompatibility already documented in the repo
  - if the shadcn CLI assumes alias-based imports, immediately normalize generated imports to relative paths
  - accept the generated `components.json`, but adapt any alias fields or generated code so the app compiles without `@/*`
- Keep shadcn-generated primitives in `frontend/src/components/ui/` and place any non-primitive shared frontend components directly under `frontend/src/components/`, using relative imports between frontend source files.
- Add only the primitives needed by the current app. Baseline set:
  `button`, `input`, `label`, `card`, `badge`, `alert`, `skeleton`, `separator`, `select`
- Replace the existing design-system primitives as follows:
  - `TextInput` -> shadcn `Input`
  - `NumberInput` -> shadcn `Input` with `type="number"` and existing integer parsing preserved in route logic
  - `Skeleton` -> shadcn `Skeleton`
  - `ErrorMessage` -> page-local shadcn `Alert`; keep logging explicit in the route branch instead of inside a reusable render-side-effect component
- Modernize each route with shadcn-based layout and controls while preserving current behavior and data flow:
  - `__root.tsx`: rebuild header/nav/auth actions with shadcn buttons and separators; keep Router/Clerk/TanStack behavior unchanged
  - `/`: convert to a proper hero/landing page using card/button styling from the preset
  - `/games`: card-based list view with search input, clearer empty state, skeleton rows, status badges, and a primary CTA for new game
  - `/games/new`: form card with labeled fields, shadcn select for turn unit, consistent disabled/loading button states
  - `/games/$gameId`: lobby detail card, player list, status badge, grouped action buttons for join/leave/start/open
  - `/play/$gameId`: dashboard-style status cards for current tick, money, and countdown; keep countdown logic unchanged
  - `/sign-in` and `/sign-up`: wrap Clerk widgets in a shadcn page shell/card so these routes match the rest of the app; Clerk internals stay provided by Clerk
- After all routes are migrated, delete `frontend/src/design-system/` and remove any dead imports/classes left over from the old design system.

## Public Interfaces / Constraints

- No backend changes.
- No route-path changes.
- No behavioral changes to fetching, mutations, auth guards, or countdown math.
- Do not introduce module-global stateful UI helpers; stay consistent with repo constraints.
- New reusable frontend components must live in `frontend/src/components/`, not in a revived `design-system` directory.
- Do not rely on `@/*` imports anywhere in frontend code until the TanStack Router + Vite issue is no longer relevant for this project.

## Test Plan

- Run:
  - `pnpm lint`
  - `pnpm --dir frontend typecheck`
  - `pnpm --dir backend typecheck`
  - `pnpm --dir frontend build`
- Manual smoke test:
  - home page renders with new hero styling
  - games list loads, filters, shows empty state, and links still work
  - create game form validates and submits
  - lobby actions still render correctly by game state
  - play screen still shows countdown/tick/resources
  - sign-in and sign-up routes render correctly inside the new shell
  - confirm no imports from `frontend/src/design-system`
  - confirm `frontend/src/design-system/` is deleted

## Assumptions

- “Modernize with shadcn” means use shadcn primitives and preset-driven styling for all app-owned pages; Clerk auth widgets themselves are not rewritten.
- Use the preset’s generated theme/tokens as the new source of truth instead of preserving the current hand-written palette exactly.
- It is acceptable to create a small number of app-level shared components in `frontend/src/components/` when that reduces duplication across routes.
- The implementation must work with relative imports for shadcn components and utils instead of the usual `@/` import style.
