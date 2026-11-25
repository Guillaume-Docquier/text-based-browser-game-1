import { extendWorkspaceRules, filePath, WorkspaceBoundaries } from "../../linting/boundaries.ts"

export const Boundaries = {
  settings: WorkspaceBoundaries.settings,
  rules: extendWorkspaceRules([
    {
      from: filePath("packages/backend/src/api/entry.api.ts"),
      disallow: { to: filePath("packages/backend/src/**/*{.useCase,UseCase}.ts") },
      message: "Create use cases in createApi.ts. Keep use-case types and values out of entry.api.ts.",
    },
    {
      from: filePath("packages/backend/src/api/createApi.ts"),
      disallow: { to: filePath("packages/backend/src/**/*{.repository,Repository}.ts"), dependency: { kind: "value" } },
      message: "Create repositories in entry.api.ts and import only their types in createApi.ts.",
    },
  ]),
}
