import { mkdtempDisposable, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createGalaxyCommand } from "./command-galaxy.ts"

describe("map-gen galaxy", () => {
  it("should write the galaxy to the requested path and the system samples beside it", async () => {
    // Arrange
    await using directory = await mkdtempDisposable(path.join(tmpdir(), "map-gen-"))
    const output = path.join(directory.path, "custom.svg")

    // Act
    await createGalaxyCommand().parseAsync(["spiral", "--grid", "--seed", "1234", "--output", output], { from: "user" })

    // Assert
    expect((await readdir(directory.path)).sort()).toStrictEqual(["custom-systems.svg", "custom.svg"])
  })
})
