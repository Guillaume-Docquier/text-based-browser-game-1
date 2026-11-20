import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

const allowedComments = "cosmic-empires(allowed-comments)"

describe("global lint rules in source files", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  describe.each([
    ["root", "fixture.ts"],
    ["backend", "packages/backend/src/fixture.ts"],
    ["frontend", "packages/frontend/src/fixture.ts"],
    ["shared", "packages/shared/src/fixture.ts"],
  ])("%s source files", (_scope, path) => {
    it("should allow an INTENT comment", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // INTENT: Keep the default available before startup.
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should allow a CONSTRAINT comment", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // CONSTRAINT: The protocol reserves the first identifier.
        export const firstId = 2
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should allow an oxlint disable directive", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // oxlint-disable-next-line no-debugger
        debugger
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should allow a TypeScript expect-error directive", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // @ts-expect-error: Exercise an invalid value.
        export const count: number = "invalid"
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should reject an ordinary comment", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // Set the default limit.
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })

    it.each(["Arrange", "Act", "Assert"])("should reject %s", (phase) => {
      // Arrange
      const fixture = {
        path,
        code: `
        // ${phase}
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })

    it("should reject a block comment with an allowed prefix", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        /* INTENT: Keep the default available before startup. */
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })

    it("should require the prefix at the start of the comment text", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        // An example of an INTENT: comment.
        export const defaultLimit = 10
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([allowedComments])
    })

    it("should reject an unhandled promise returned by a callback", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        export function saveTurn(save: () => Promise<void>): void {
          save()
        }
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual(["typescript(no-floating-promises)"])
    })

    it("should allow a call to a synchronous callback", () => {
      // Arrange
      const fixture = {
        path,
        code: `
        export function saveTurn(save: () => void): void {
          save()
        }
      `,
      }

      // Act
      const diagnostics = session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })
  })
})
