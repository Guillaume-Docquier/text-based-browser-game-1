import { describe, expect, it } from "vitest"
import { MAX_NB_SEATS } from "#shared/domain/games/GameConfiguration.ts"
import { PLAYER_COLOR_PRIORITY, PlayerColor } from "#shared/domain/players/PlayerColor.ts"

describe("PLAYER_COLOR_PRIORITY", () => {
  it("should include every player color exactly once", () => {
    // Arrange
    const allPlayerColors = Object.values(PlayerColor).toSorted()

    // Act
    const prioritizedColors = PLAYER_COLOR_PRIORITY.toSorted()

    // Assert
    expect(prioritizedColors).toStrictEqual(allPlayerColors)
  })

  it(`should contain ${MAX_NB_SEATS} colors`, () => {
    // Assert
    expect(PLAYER_COLOR_PRIORITY).toHaveLength(MAX_NB_SEATS)
  })
})
