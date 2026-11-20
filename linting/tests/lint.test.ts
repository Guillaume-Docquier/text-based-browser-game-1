import { describe, expect, it } from "vitest"
import { lint } from "./lint.ts"

describe("lint fixtures", () => {
  it("should run type-aware rules on the snippet", () => {
    const diagnostics = lint({
      code: `
        Promise.resolve(1)
      `,
    })

    expect(diagnostics).toStrictEqual(["typescript(no-floating-promises)"])
  })

  it("should discover the backend config from a repository-relative path", () => {
    const diagnostics = lint({
      path: "packages/backend/src/example/current-time.ts",
      code: `
        export const currentTime = Date.now()
      `,
    })

    expect(diagnostics).toStrictEqual(["eslint(no-restricted-globals)"])
  })
})
