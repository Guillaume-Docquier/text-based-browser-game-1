import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { PlanetCoordinatesSchema } from "#shared/domain/world/planets/PlanetCoordinates.ts"
import { StarCoordinatesSchema } from "#shared/domain/world/stars/StarCoordinates.ts"
import { toOrbitCoordinates } from "#shared/galaxy-creation/toOrbitCoordinates.ts"
import { toPlanetCoordinates } from "#shared/galaxy-creation/toPlanetCoordinates.ts"
import { toStarCoordinates } from "#shared/galaxy-creation/toStarCoordinates.ts"

describe("galaxy coordinates", () => {
  it("should preserve the region and cell order when converting fractional star positions", () => {
    // Arrange
    const star = { x: 12.75, y: 34.25 }

    // Act
    const coordinates = toStarCoordinates(star)

    // Assert
    expect(coordinates).toBe("31:42")
  })

  it("should round orbital distances in AU and pad the orbit segment", () => {
    // Arrange
    const distance = Distance.in(Distance.create(4.4, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS)
    const star = { x: 0, y: 0 }
    const planet = { x: distance, y: 0 }

    // Act
    const orbit = toOrbitCoordinates({ star, planet })
    const coordinates = toPlanetCoordinates({ starCoordinates: "31:42", star, planet })

    // Assert
    expect(orbit).toBe("04")
    expect(coordinates).toBe("31:42:04")
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
