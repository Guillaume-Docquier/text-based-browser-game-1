import { describe, expect, it } from "vitest"
import { lint } from "./lint.ts"

const allowedComments = "cosmic-empires(allowed-comments)"

describe.each([
  ["root", "fixture.ts"],
  ["backend", "packages/backend/src/fixture.ts"],
  ["frontend", "packages/frontend/src/fixture.ts"],
  ["shared", "packages/shared/src/fixture.ts"],
])("global lint rules in %s", (_scope, path) => {
  it("should allow an INTENT line comment", () => {
    const diagnostics = lint({
      path,
      code: `
        // INTENT: Keep the default available before startup.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should reject an ordinary line comment", () => {
    const diagnostics = lint({
      path,
      code: `
        // Set the default limit.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })

  it.each(["Arrange", "Act", "Assert"])("should reject %s in a source file", (phase) => {
    const diagnostics = lint({
      path,
      code: `
        // ${phase}
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })
})

describe("comment policy in source files", () => {
  it("should allow a CONSTRAINT block comment after leading whitespace", () => {
    const diagnostics = lint({
      code: `
        /*
          CONSTRAINT: The protocol reserves the first identifier.
        */
        export const firstId = 2
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should allow an oxlint disable directive", () => {
    const diagnostics = lint({
      code: `
        // oxlint-disable-next-line no-debugger
        debugger
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should allow a TypeScript expect-error directive", () => {
    const diagnostics = lint({
      code: `
        // @ts-expect-error: Exercise an invalid value.
        export const count: number = "invalid"
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should reject an ordinary block comment", () => {
    const diagnostics = lint({
      code: `
        /* Set the default limit. */
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })

  it("should require the prefix at the start of the comment text", () => {
    const diagnostics = lint({
      code: `
        // An example of an INTENT: comment.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })

  it("should require the colon in the INTENT prefix", () => {
    const diagnostics = lint({
      code: `
        // INTENT Keep the default available before startup.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })
})
