import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

const allowedComments = "cosmic-empires(allowed-comments)"

describe("global lint rules in test files", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  describe.each([
    ["root", "fixture.test.ts"],
    ["backend", "packages/backend/src/fixture.test.ts"],
    ["frontend", "packages/frontend/src/fixture.test.ts"],
    ["frontend TSX", "packages/frontend/src/fixture.test.tsx"],
    ["shared", "packages/shared/src/fixture.test.ts"],
  ])("%s test files", (_scope, path) => {
    it("should allow an INTENT comment", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // INTENT: Keep the default available before startup.
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should allow a CONSTRAINT comment", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // CONSTRAINT: The protocol reserves the first identifier.
        export const firstId = 2
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should allow an oxlint disable directive", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // oxlint-disable-next-line no-debugger
        debugger
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should allow a TypeScript expect-error directive", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // @ts-expect-error: Exercise an invalid value.
        export const count: number = "invalid"
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should reject an ordinary comment", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // Set the default limit.
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })

    it.each(["Arrange", "Act", "Assert"])("should allow %s", async (phase) => {
      // Arrange
      const fixture = {
        path,
        code: `
        // ${phase}
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should reject a block comment with an allowed prefix", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        /* Arrange */
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })

    it("should require the prefix at the start of the comment text", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // This is the Arrange section.
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })
  })
})
