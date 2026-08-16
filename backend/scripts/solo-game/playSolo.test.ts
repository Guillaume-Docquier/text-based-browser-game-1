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
      { command: "REMOVE_ACTION", actionSubmissionId: "turn-1-WIN_THE_GAME-1" },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "ADD_ACTION", actionDefinitionId: MakeMoreMoney.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: WinTheGame.id },
      { command: "SUBMIT_TURN" },
    ]
    const output: string[] = []
    const promptMessages: string[] = []

    // Act
    const session = await playSolo({
      prompt: async ({ message }) => {
        promptMessages.push(message)
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
              [ResourceType.MONEY]: 4,
            },
            actionSubmissions: [],
          },
        },
        winnerPlayerId: "solo-player",
      },
    })
    expect(selections).toEqual([])
    expect(promptMessages).toContainEqual(expect.stringContaining("Turn was not resolved:\n  Win The Game: Missing 8 MONEY"))
    expect(promptMessages).toContainEqual(expect.stringContaining("Selected actions:\n  1. Make More Money\n  2. Make More Money"))
    expect(output.filter((line) => line === "────────────────────────────────────────")).toHaveLength(4)
    expect(output.filter((line) => line.endsWith("— resolved"))).toEqual([
      "Turn 1 — resolved",
      "Turn 2 — resolved",
      "Turn 3 — resolved",
      "Turn 4 — resolved",
    ])
    expect(output).not.toContain("Turn 1 — open")
    expect(output.join("\n")).toContain(
      "Turn 3 — resolved\nResources:\n  MONEY: 14\nSubmitted actions:\n  1. Make More Money\n  2. Make More Money",
    )
    expect(output.at(-1)).toBe("You won on turn 4.")
  })
})
