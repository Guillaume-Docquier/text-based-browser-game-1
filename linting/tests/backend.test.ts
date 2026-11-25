import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

const repositoryValue = `
  import { AccountsRepository } from "#api/accounts/accounts.repository.ts"

  export const constructors = { AccountsRepository }
`

const repositoryType = `
  import type { AccountsRepository } from "./accounts/accounts.repository.ts"

  export type Services = { accounts: AccountsRepository }
`

const useCaseValue = `
  import { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"

  export const constructors = { FinishOnboardingUseCase }
`

const useCaseType = `
  import type { GetGameDetailsUseCase } from "./games/getGameDetailsUseCase.ts"

  export type Operations = { getGameDetails: GetGameDetailsUseCase }
`

const useCaseTypeExpression = `
  // oxlint-disable-next-line typescript/consistent-type-imports -- Isolate the boundary check for type import expressions.
  export type Operations = { getGameDetails: import("./games/getGameDetailsUseCase.ts").GetGameDetailsUseCase }
`

describe("backend lint rules", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  it.each([
    {
      behavior: "reject returning an awaited void expression in a regular module",
      path: "packages/backend/src/api/gameplay/updateReadiness.useCase.ts",
      expected: ["typescript(no-confusing-void-expression)"],
    },
    {
      behavior:
        "allow returning an awaited void expression in a router because routers and their tests intentionally return awaited void outputs to streamline the router handlers",
      path: "packages/backend/src/api/gameplay/gameplay.router.ts",
      expected: [],
    },
  ])("should $behavior", async ({ path, expected }) => {
    // Arrange
    const fixture = {
      path,
      code: `
        export const updateReadiness = async (execute: () => Promise<void>): Promise<void> => await execute()
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(expected)
  })

  describe("entry.api.ts boundaries", () => {
    it.each([
      { behavior: "allow repository values", code: repositoryValue, expected: [] },
      { behavior: "allow repository types", code: repositoryType, expected: [] },
      { behavior: "reject use-case values", code: useCaseValue, expected: ["boundaries(dependencies)"] },
      { behavior: "reject type-only imports from a UseCase module", code: useCaseType, expected: ["boundaries(dependencies)"] },
      { behavior: "reject use-case types in import expressions", code: useCaseTypeExpression, expected: ["boundaries(dependencies)"] },
    ])("should $behavior", async ({ code, expected }) => {
      // Arrange
      const fixture = { path: "packages/backend/src/api/entry.api.ts", code }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual(expected)
    })
  })

  describe("createApi.ts boundaries", () => {
    it.each([
      { behavior: "reject repository values", code: repositoryValue, expected: ["boundaries(dependencies)"] },
      { behavior: "allow repository types for injected dependencies", code: repositoryType, expected: [] },
      { behavior: "allow use-case constructors", code: useCaseValue, expected: [] },
      { behavior: "allow use-case types", code: useCaseType, expected: [] },
      { behavior: "allow use-case types in import expressions under the boundary rule", code: useCaseTypeExpression, expected: [] },
    ])("should $behavior", async ({ code, expected }) => {
      // Arrange
      const fixture = { path: "packages/backend/src/api/createApi.ts", code }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual(expected)
    })
  })
})
