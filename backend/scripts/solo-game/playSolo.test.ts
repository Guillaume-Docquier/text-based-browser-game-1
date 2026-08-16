import { stripVTControlCharacters } from "node:util"
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
    const plainPromptMessages = promptMessages.map(stripVTControlCharacters)
    const plainOutput = output.map(stripVTControlCharacters)
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
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("TURN REJECTED"))
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("Missing 8 MONEY"))
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("SELECTED ACTIONS  ·  2"))
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("01  Make More Money"))
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("02  Make More Money"))
    expect(plainPromptMessages.every((message) => message.includes("CURRENT TURN"))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes("EMPIRE STATE"))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes("COMMAND"))).toBe(true)
    expect(plainOutput.filter((line) => line === "━".repeat(72))).toHaveLength(4)
    expect(plainOutput.filter((line) => line.includes("RESOLVED TURN"))).toHaveLength(4)
    expect(plainOutput).not.toContainEqual(expect.stringContaining("CURRENT TURN"))
    expect(plainOutput.join("\n")).toContain("14 available")
    expect(plainOutput.join("\n")).toContain("SUBMITTED ACTIONS  ·  2")
    expect(plainOutput.at(-1)).toBe("You won on turn 4.")
  })
})
