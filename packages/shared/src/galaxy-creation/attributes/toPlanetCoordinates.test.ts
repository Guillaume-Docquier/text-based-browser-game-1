import { describe, expect, it } from "vitest"
import { PlanetCoordinatesSchema } from "#shared/domain/world/planets/PlanetCoordinates.ts"
import { StarCoordinatesSchema } from "#shared/domain/world/stars/StarCoordinates.ts"
import { toOrbitCoordinates } from "#shared/galaxy-creation/attributes/toOrbitCoordinates.ts"
import { toPlanetCoordinates } from "#shared/galaxy-creation/attributes/toPlanetCoordinates.ts"
import { toStarCoordinates } from "#shared/galaxy-creation/attributes/toStarCoordinates.ts"

describe("galaxy coordinates", () => {
  it("should preserve the region and cell order when converting fractional star positions", () => {
    // Arrange
    const star = { x: 12.75, y: 34.25 }

    // Act
    const coordinates = toStarCoordinates(star)

    // Assert
    expect(coordinates).toBe("31:42")
  })

  it("should preserve fractional distances in AU", () => {
    // Arrange
    const orbitDistanceAU = 4.4

    // Act
    const orbit = toOrbitCoordinates(orbitDistanceAU)
    const coordinates = toPlanetCoordinates({ starCoordinates: "31:42", orbitDistanceAU })

    // Assert
    expect(orbit).toBe("4.4")
    expect(coordinates).toBe("31:42:4.4")
  })

  it("should preserve acceptance of existing free-form coordinate strings", () => {
    // Arrange
    const starCoordinates = "0:0"
    const planetCoordinates = "legacy-coordinate"

    // Act
    const starResult = StarCoordinatesSchema.safeParse(starCoordinates)
    const planetResult = PlanetCoordinatesSchema.safeParse(planetCoordinates)

    // Assert
    expect(starResult).toStrictEqual({ success: true, data: starCoordinates })
    expect(planetResult).toStrictEqual({ success: true, data: planetCoordinates })
  })
})
