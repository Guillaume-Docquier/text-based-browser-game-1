import { Assert } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"
import { MakeMoreMoney } from "#lib/ruleset/v1/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/ruleset/v1/action-definitions/win-the-game.ts"
import { playSolo, type SoloGameSelection } from "./playSolo.ts"

describe("playSolo", () => {
  it("should collect actions and resolve turns until the player wins", async () => {
    // Arrange
    const selections: SoloGameSelection[] = [
      { command: "ADD_ACTION", actionDefinitionId: WinTheGame.id },
      { command: "SUBMIT_TURN" },
      { command: "REMOVE_ACTION", actionSubmissionId: "turn-1-WIN_THE_GAME" },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: WinTheGame.id },
      { command: "SUBMIT_TURN" },
    ]
    const output: string[] = []

    // Act
    const session = await playSolo({
      prompt: async () => {
        const selection = selections.shift()
        Assert.isDefined(selection)
        return selection
      },
      writeLine: (line) => {
        output.push(line)
      },
    })

    // Assert
    expect(session).toEqual({
      turn: 4,
      state: {
        players: {
          "solo-player": {
            id: "solo-player",
            resources: {
              [ResourceType.MONEY]: 1,
            },
            actionSubmissions: [],
          },
        },
        winnerPlayerId: "solo-player",
      },
    })
    expect(selections).toEqual([])
    expect(output).toContain("Turn was not resolved:")
    expect(output).toContain("  Win The Game: Missing 8 MONEY")
    expect(output.at(-1)).toBe("You won on turn 4.")
  })
})
