import { stripVTControlCharacters } from "node:util"
import { Assert } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { MakeMoreMoney } from "#lib/rulesets/standard/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
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
    const promptChoices: Array<Array<{ readonly name: string; readonly description: string | undefined }>> = []
    const promptPositions: Array<{ readonly defaultIndex: number; readonly selectedIndex: number }> = []
    const terminalEvents: Array<{ readonly type: "output" | "prompt"; readonly value: string }> = []

    // Act
    const session = await playSolo({
      prompt: async ({ message, choices, default: defaultSelection }) => {
        promptMessages.push(message)
        promptChoices.push(
          choices.map((choice) => ({
            name: stripVTControlCharacters(choice.name),
            description: choice.description,
          })),
        )
        terminalEvents.push({ type: "prompt", value: stripVTControlCharacters(message) })
        const selection = selections.shift()
        Assert.isDefined(selection)
        promptPositions.push({
          defaultIndex: choices.findIndex((choice) => choice.value === defaultSelection),
          selectedIndex: choices.findIndex((choice) => JSON.stringify(choice.value) === JSON.stringify(selection)),
        })
        return selection
      },
      writeLine: (line) => {
        output.push(line)
        terminalEvents.push({ type: "output", value: stripVTControlCharacters(line) })
      },
    })

    // Assert
    const plainPromptMessages = promptMessages.map(stripVTControlCharacters)
    const plainOutput = output.map(stripVTControlCharacters)
    expect(session).toEqual({
      turn: 4,
      state: {
        actionSubmissions: [],
        players: {
          "solo-player": {
            id: "solo-player",
            resources: {
              [ResourceType.MONEY]: 4,
            },
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
    expect(plainPromptMessages.every((message) => message.includes("Standard Ruleset"))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes("EMPIRE STATE"))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes("COMMAND"))).toBe(true)
    expect(plainPromptMessages.find((message) => message.includes("SELECTED ACTIONS  ·  2"))).not.toContain("costs 2 MONEY")
    expect(promptChoices.flat()).toContainEqual({
      name: "+ Make More Money",
      description: "STANDARD DIRECTIVE  ·  costs 2 MONEY  ·  gains 5 MONEY",
    })
    expect(promptChoices.flat()).toContainEqual({
      name: "− #1 Make More Money",
      description: undefined,
    })
    expect(promptChoices.flat().every((choice) => !choice.name.includes("Queue") && !choice.name.includes("Remove"))).toBe(true)
    expect(promptPositions.slice(0, 2)).toEqual([
      { defaultIndex: 0, selectedIndex: 2 },
      { defaultIndex: 2, selectedIndex: 0 },
    ])
    expect(plainOutput.filter((line) => line.trim() === "━".repeat(72))).toHaveLength(3)
    expect(plainOutput.filter((line) => line.includes("RESOLVED TURN"))).toHaveLength(4)
    expect(plainOutput).toContainEqual(expect.stringContaining("STANDARD RULESET PLAYTEST"))
    expect(plainOutput).not.toContainEqual(expect.stringContaining("CURRENT TURN"))
    const firstResolvedTurnIndex = plainOutput.findIndex((line) => line.includes("RESOLVED TURN"))
    const firstResolvedTurnSeparatorIndex = plainOutput.findIndex(
      (line, index) => index > firstResolvedTurnIndex && line.trim() === "━".repeat(72),
    )
    const firstResolvedTurnOutput = plainOutput.slice(firstResolvedTurnIndex, firstResolvedTurnSeparatorIndex).join("\n")
    expect(firstResolvedTurnOutput).toContain("2 available")
    expect(firstResolvedTurnOutput).not.toContain("5 available")
    expect(plainOutput.join("\n")).toContain("14 available")
    expect(plainOutput.join("\n")).toContain("SUBMITTED ACTIONS  ·  2")
    expect(plainOutput.at(-1)).toBe("You won on turn 4.")
    const firstSeparatorIndex = terminalEvents.findIndex((event) => event.type === "output" && event.value.trim() === "━".repeat(72))
    expect(terminalEvents[firstSeparatorIndex + 1]).toMatchObject({
      type: "prompt",
      value: expect.stringContaining("TURN 02"),
    })
  })
})
