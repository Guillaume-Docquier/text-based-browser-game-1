import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

const workspaceBoundaries = "boundaries(dependencies)"
const backend = "packages/backend/src/boundary-fixture.ts"
const frontend = "packages/frontend/src/boundary-fixture.ts"
const shared = "packages/shared/src/boundary-fixture.ts"

describe("workspace boundaries", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  it.each([
    { path: backend, project: "backend" },
    { path: frontend, project: "frontend" },
  ])("should allow the $project to import shared values", async ({ path }) => {
    // Arrange
    const fixture = {
      path,
      code: `
        import { AliasSchema } from "shared/domain/accounts/Alias.ts"

        export const schemas = { alias: AliasSchema }
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual([])
  })

  it("should allow named frontend type imports from the backend contract alias", async () => {
    // Arrange
    const fixture = {
      path: frontend,
      code: `
        import type { GameDetails } from "@api-types"

        export type Props = { game: GameDetails }
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual([])
  })

  it.each([
    {
      behavior: "a backend value import from a relative frontend path",
      path: backend,
      code: `
        import { formatTurnStatus } from "../../frontend/src/lib/formatTurnStatus.ts"

        export const formatters = { formatTurnStatus }
      `,
    },
    {
      behavior: "a shared type import from a relative backend path",
      path: shared,
      code: `
        import type { GameDetails } from "../../backend/src/api/types.ts"

        export type Props = { game: GameDetails }
      `,
    },
    {
      behavior: "a shared import from the frontend package name",
      path: shared,
      code: `
        import { formatTurnStatus } from "frontend/src/lib/formatTurnStatus.ts"

        export const formatters = { formatTurnStatus }
      `,
    },
    {
      behavior: "a shared type import from the contract alias",
      path: shared,
      code: `
        import type { GameDetails } from "@api-types"

        export type Props = { game: GameDetails }
      `,
    },
    {
      behavior: "a frontend runtime import from the contract alias",
      path: frontend,
      code: `
        // oxlint-disable-next-line import/no-unassigned-import -- Isolate the workspace boundary for side-effect imports.
        import "@api-types"
      `,
    },
    {
      behavior: "a frontend namespace type import from the contract alias",
      path: frontend,
      code: `
        // oxlint-disable-next-line import/no-namespace -- Isolate the contract import restriction.
        import type * as ApiTypes from "@api-types"

        export type Props = { game: ApiTypes.GameDetails }
      `,
    },
    {
      behavior: "a frontend inline type import from the contract alias",
      path: frontend,
      code: `
        // oxlint-disable-next-line import/consistent-type-specifier-style -- Isolate the contract import restriction.
        import { type GameDetails } from "@api-types"

        export type Props = { game: GameDetails }
      `,
    },
    {
      behavior: "a frontend value import from a relative backend path",
      path: frontend,
      code: `
        import { createApi } from "../../backend/src/api/createApi.ts"

        export const api = { createApi }
      `,
    },
    {
      behavior: "a frontend type import from the backend contract via a relative path",
      path: frontend,
      code: `
        import type { GameDetails } from "../../backend/src/api/types.ts"

        export type Props = { game: GameDetails }
      `,
    },
    {
      behavior: "a frontend type import from the backend contract via a different TypeScript alias",
      path: frontend,
      code: `
        import type { GameDetails } from "@/../../backend/src/api/types"

        export type Props = { game: GameDetails }
      `,
    },
    {
      behavior: "a frontend type re-export from the contract alias",
      path: frontend,
      code: `
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Isolate the workspace boundary for named re-exports.
        export type { GameDetails } from "@api-types"
      `,
    },
    {
      behavior: "a frontend wildcard re-export from a backend package path",
      path: frontend,
      code: `
        // oxlint-disable-next-line oxc/no-barrel-file -- Isolate the workspace boundary for wildcard re-exports.
        export * from "backend/src/api/createApi.ts"
      `,
    },
  ])("should reject $behavior", async ({ path, code }) => {
    // Arrange
    const fixture = { path, code }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual([workspaceBoundaries])
  })
})
