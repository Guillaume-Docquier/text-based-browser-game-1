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

## Implementation Phases

### Phase 1: Prepare shadcn in the existing frontend

Goal: establish the shadcn foundation in `frontend/` without breaking the existing app structure.

Steps:

- Review the current frontend setup so generated shadcn files land in the correct locations for this repo.
- Complete the manual existing-project/Vite setup required before CLI initialization.
- Run shadcn initialization from `frontend/` using the existing-project flow, then apply preset `b3SRblUw7` if it is not applied during init.
- Normalize any generated config or source imports so the app uses relative imports instead of `@/*`.
- Preserve the existing `@api-types` alias and avoid introducing any new alias-based frontend import pattern.

Definition of done:

- `components.json` and required shadcn support files exist and match repo constraints.
- The frontend compiles with shadcn installed and no `@/*` dependency introduced.
- The baseline primitives needed for this migration are available under `frontend/src/components/ui/`.

### Phase 2: Establish shared app-level UI building blocks

Goal: create the minimum reusable app-owned components needed to migrate routes cleanly.

Steps:

- Add any shared non-primitive components under `frontend/src/components/`.
- Keep these components thin and route-focused, using shadcn primitives rather than recreating a design system layer.
- Replace old reusable patterns only where reuse is still justified across multiple routes.
- Ensure error, loading, and empty-state presentation patterns are compatible with the route behaviors described above.

Definition of done:

- Shared app components exist only where they reduce duplication materially.
- No new UI abstraction recreates `frontend/src/design-system/`.
- Shared components use relative imports and existing frontend architecture patterns.

### Phase 3: Migrate global layout and entry routes

Goal: convert the global shell and simple top-level routes first so the app has a consistent shadcn frame.

Steps:

- Rebuild `__root.tsx` header, navigation, and auth actions with shadcn primitives while preserving Router, Clerk, and TanStack behavior.
- Migrate `/` into the new hero/landing page treatment defined in this spec.
- Wrap `/sign-in` and `/sign-up` in the new app shell/card presentation without modifying Clerk-provided internals.

Definition of done:

- Root layout behavior is unchanged apart from presentation.
- Public/auth routes visually align with the new preset-driven styling.
- No auth flows or route guards regress.

### Phase 4: Migrate game management routes

Goal: modernize the CRUD and lobby flows before touching the live play screen.

Steps:

- Migrate `/games` to the new card/list presentation with search, empty state, skeletons, badges, and primary CTA.
- Migrate `/games/new` to the new form-card layout with labeled controls and shadcn select usage for turn unit.
- Migrate `/games/$gameId` to the new lobby detail layout with grouped actions and status presentation.
- Preserve all existing route data loading, mutation wiring, conditional rendering, and integer parsing behavior.

Definition of done:

- The games list, create flow, and lobby flow behave exactly as before.
- All route-level controls use shadcn primitives or app-level components built from them.
- Loading, disabled, and empty states are visibly improved without changing business logic.

### Phase 5: Migrate the live play route

Goal: restyle the gameplay screen last so the more stateful route is updated after the shared patterns are stable.

Steps:

- Rebuild `/play/$gameId` using dashboard-style shadcn cards and supporting primitives.
- Preserve the existing countdown logic, tick display, and resource presentation semantics.
- Reuse app-level components from earlier phases only when they already fit cleanly.

Definition of done:

- The play screen keeps the same data flow and timing behavior.
- The route matches the new visual system and remains readable for active gameplay.

### Phase 6: Remove the old design system and verify the migration

Goal: finish the cutover cleanly so only the shadcn-based UI remains.

Steps:

- Remove all remaining imports from `frontend/src/design-system/`.
- Delete `frontend/src/design-system/` after confirming nothing still depends on it.
- Clean up dead classes, wrappers, or compatibility code left behind by the migration.
- Run the required verification commands and perform the manual smoke test from this spec.

Definition of done:

- `frontend/src/design-system/` no longer exists.
- No frontend source imports the old design system.
- Lint, typecheck, and build pass, and the manual smoke checks complete successfully.

### Recommended agent execution model

Use the phases above as strict sequencing boundaries:

- Complete Phase 1 before route migration begins.
- Complete Phase 2 before broad route conversion to avoid duplicating ad hoc components.
- Phases 3, 4, and 5 may be split across agents by route ownership, but each agent must preserve behavior and use the shared shadcn foundation established earlier.
- Phase 6 should be treated as a final integration pass after all route work is merged.

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
