import { describe, expect, it } from "vitest"
import { PLANET_NAME_MAX_LENGTH, PlanetNameSchema } from "#game-rules/models/PlanetName.ts"

describe("PlanetNameSchema", () => {
  it("should accept names at the inclusive length limits", () => {
    // Arrange
    const shortestName = "A"
    const longestName = "A".repeat(PLANET_NAME_MAX_LENGTH)

    // Act
    const shortestResult = PlanetNameSchema.safeParse(shortestName)
    const longestResult = PlanetNameSchema.safeParse(longestName)

    // Assert
    expect(shortestResult).toMatchObject({ success: true, data: shortestName })
    expect(longestResult).toMatchObject({ success: true, data: longestName })
  })

  it("should trim names before checking their length", () => {
    // Arrange
    const name = "  Earth  "

    // Act
    const result = PlanetNameSchema.safeParse(name)

    // Assert
    expect(result).toMatchObject({ success: true, data: "Earth" })
  })

  it.each(["", "   ", "A".repeat(PLANET_NAME_MAX_LENGTH + 1), "Earth\0"])("should reject an invalid name %j", (name) => {
    // Arrange
    const input = name

    // Act
    const result = PlanetNameSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
  })
})
