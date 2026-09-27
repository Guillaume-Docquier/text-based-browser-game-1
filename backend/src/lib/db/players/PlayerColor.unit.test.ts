import { describe, expect, it } from "vitest"
import { PLAYER_COLOR_PRIORITY, PlayerColor } from "#lib/db/players/PlayerColor.ts"

describe("PLAYER_COLOR_PRIORITY", () => {
  it("should include every player color exactly once", () => {
    // Arrange
    const allPlayerColors = Object.values(PlayerColor).toSorted()

    // Act
    const prioritizedColors = PLAYER_COLOR_PRIORITY.toSorted()

    // Assert
    expect(prioritizedColors).toStrictEqual(allPlayerColors)
  })
})
