import { fileURLToPath } from "node:url"
import { describe, expect, it, onTestFinished } from "vitest"
import { createVitest } from "vitest/node"

describe("backend Vitest configuration", () => {
  it.each([false, true])("should propagate root watch mode (%s) to every project", async (watch) => {
    // Arrange
    const vitest = await createVitest(
      { root: fileURLToPath(new URL("../..", import.meta.url)), watch, reporters: [] },
      // Reproduce interactive defaults that disagree with the CLI's resolved watch mode.
      { test: { watch: !watch } },
    )
    onTestFinished(async () => {
      await vitest.close()
    })

    // Act
    const projectWatchModes = vitest.projects.map((project) => ({ name: project.name, watch: project.config.watch }))

    // Assert
    expect(vitest.config.watch).toBe(watch)
    expect(projectWatchModes).toStrictEqual([
      { name: "types", watch },
      { name: "unit", watch },
      { name: "integration", watch },
      { name: "concurrency", watch },
    ])
  })
})
