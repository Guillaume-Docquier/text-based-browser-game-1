import { mkdtempDisposable, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createMapGenProgram } from "./program.ts"

describe("map-gen previews", () => {
  it("should write both patterns, galaxy overviews and system samples to the selected preview directory", async () => {
    // Arrange
    await using directory = await mkdtempDisposable(path.join(tmpdir(), "map-gen-"))
    const program = createMapGenProgram()

    // Act
    await program.parseAsync(["previews", "--output-dir", directory.path], { from: "user" })

    // Assert
    expect((await readdir(directory.path)).sort()).toStrictEqual([
      "cluster-galaxy-systems.svg",
      "cluster-galaxy.svg",
      "cluster.svg",
      "spiral-galaxy-systems.svg",
      "spiral-galaxy.svg",
      "spiral.svg",
    ])
  })
})
