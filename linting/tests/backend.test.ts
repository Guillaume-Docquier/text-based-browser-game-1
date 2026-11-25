import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

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

  it.each([
    {
      dependency: "a repository value through the backend alias",
      entryDiagnostics: [],
      createDiagnostics: ["boundaries(dependencies)"],
      code: `
        import { AccountsRepository } from "#api/accounts/accounts.repository.ts"

        export const constructors = { AccountsRepository }
      `,
    },
    {
      dependency: "a repository type through a relative path",
      entryDiagnostics: [],
      createDiagnostics: [],
      code: `
        import type { AccountsRepository } from "./accounts/accounts.repository.ts"

        export type Services = { accounts: AccountsRepository }
      `,
    },
    {
      dependency: "a use-case value through the backend alias",
      entryDiagnostics: ["boundaries(dependencies)"],
      createDiagnostics: [],
      code: `
        import { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"

        export const constructors = { FinishOnboardingUseCase }
      `,
    },
    {
      dependency: "a use-case type from a module with the UseCase suffix",
      entryDiagnostics: ["boundaries(dependencies)"],
      createDiagnostics: [],
      code: `
        import type { GetGameDetailsUseCase } from "./games/getGameDetailsUseCase.ts"

        export type Operations = { getGameDetails: GetGameDetailsUseCase }
      `,
    },
    {
      dependency: "a use-case type referenced with an import expression",
      entryDiagnostics: ["boundaries(dependencies)"],
      createDiagnostics: [],
      code: `
        // oxlint-disable-next-line typescript/consistent-type-imports -- Isolate the boundary check for type import expressions.
        export type Operations = { getGameDetails: import("./games/getGameDetailsUseCase.ts").GetGameDetailsUseCase }
      `,
    },
  ])("should enforce the API composition boundaries for $dependency", async ({ code, entryDiagnostics, createDiagnostics }) => {
    // Arrange
    const entry = { path: "packages/backend/src/api/entry.api.ts", code }
    const create = { path: "packages/backend/src/api/createApi.ts", code }

    // Act
    const entryResult = await session.lint(entry)
    const createResult = await session.lint(create)

    // Assert
    expect(entryResult).toStrictEqual(entryDiagnostics)
    expect(createResult).toStrictEqual(createDiagnostics)
  })
})
