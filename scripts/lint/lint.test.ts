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

  it("should apply package overrides for a source path", () => {
    const diagnostics = lint({
      config: "packages/backend/oxlint.config.ts",
      path: "src/example/current-time.ts",
      code: `
        export const currentTime = Date.now()
      `,
    })

    expect(diagnostics).toStrictEqual(["eslint(no-restricted-globals)"])
  })
})
