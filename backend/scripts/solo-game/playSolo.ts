import { stripVTControlCharacters, styleText } from "node:util"
import { Assert, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { select } from "@inquirer/prompts"
import { createSeededRng } from "#lib/createSeededRng.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { ResolvedAction } from "#lib/rules-engine/turn-resolution/ResolvedAction.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import type { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

const SOLO_PLAYER_ID = "solo-player"
const UI_WIDTH = 72
const PANEL_CONTENT_WIDTH = UI_WIDTH - 4
const TURN_SEPARATOR = "\n" + "━".repeat(UI_WIDTH) + "\n"

const UiStyle = {
  accent: (text: string): string => styleText(["bold", "cyan"], text),
  action: (text: string): string => styleText(["bold", "magenta"], text),
  danger: (text: string): string => styleText(["bold", "red"], text),
  history: (text: string): string => styleText("dim", text),
  muted: (text: string): string => styleText("gray", text),
  positive: (text: string): string => styleText(["bold", "green"], text),
  resource: (text: string): string => styleText(["bold", "yellow"], text),
  warning: (text: string): string => styleText(["bold", "yellow"], text),
}

/** A command selected from the interactive solo-game prompt. */
export type SoloGameSelection =
  | { readonly command: "ADD_ACTION"; readonly actionDefinitionId: string }
  | { readonly command: "REMOVE_ACTION"; readonly actionSubmissionId: string }
  | { readonly command: "SUBMIT_TURN" }
  | { readonly command: "QUIT" }

type SoloGameChoice = {
  readonly name: string
  readonly description?: string
  readonly value: SoloGameSelection
}

type SoloGamePromptOptions = {
  readonly message: string
  readonly choices: readonly SoloGameChoice[]
  readonly default: SoloGameSelection
}

type SoloGameSession = {
  turn: number
  state: TurnState
}

type PlaySoloOptions = {
  readonly prompt?: (options: SoloGamePromptOptions) => Promise<SoloGameSelection>
  readonly rng?: Rng
  readonly writeLine?: (line: string) => void
}

type TurnDashboardState =
  | {
      readonly status: "open"
      readonly turnResolutionError: ResolveTurnError | undefined
    }
  | {
      readonly status: "resolved"
      readonly resolvedActions: readonly ResolvedAction[]
    }

/**
 * Runs a complete in-memory solo game against StandardRuleset.
 *
 * @param options - Optional CLI boundaries used to prompt, generate deterministic random values, and render output.
 * @returns The final in-memory session after the player wins or quits.
 */
export async function playSolo({
  prompt = promptWithInquirer,
  rng = createSeededRng(),
  writeLine = (line) => {
    console.log(line)
  },
}: PlaySoloOptions = {}): Promise<SoloGameSession> {
  const session = createSoloGameSession()
  let nextActionSubmissionNumber = 1
  let highlightedChoiceIndex = 0
  let turnResolutionError: ResolveTurnError | undefined

  writeLine("")
  writeLine(UiStyle.accent(`✦  COSMIC EMPIRES  ·  ${StandardRuleset.name.toUpperCase()} PLAYTEST  ✦`))
  writeLine(UiStyle.muted("Interactive in-memory rules-engine session"))
  writeLine("")

  while (session.state.winnerPlayerId === undefined) {
    const choices = createChoices(session)
    const highlightedChoice = choices[Math.min(highlightedChoiceIndex, choices.length - 1)]
    Assert.isDefined(highlightedChoice)
    const selection = await prompt({
      message: formatTurnDashboard(session, { status: "open", turnResolutionError }).join("\n"),
      choices,
      default: highlightedChoice.value,
    })
    const selectedChoiceIndex = choices.findIndex((choice) => getSelectionKey(choice.value) === getSelectionKey(selection))
    Assert.isTrue(selectedChoiceIndex >= 0)
    highlightedChoiceIndex = selectedChoiceIndex

    switch (selection.command) {
      case "ADD_ACTION":
        addAction(session, selection.actionDefinitionId, nextActionSubmissionNumber)
        nextActionSubmissionNumber += 1
        turnResolutionError = undefined
        break
      case "REMOVE_ACTION":
        removeAction(session, selection.actionSubmissionId)
        turnResolutionError = undefined
        break
      case "SUBMIT_TURN": {
        const submittedTurn = structuredClone(session)
        const result = resolveTurn(session.state, StandardRuleset, rng)
        if (Result.isFailure(result)) {
          turnResolutionError = result.error
          break
        }

        submittedTurn.state.winnerPlayerId = result.value.winnerPlayerId
        writeResolvedTurn(submittedTurn, result.value.resolvedActions, writeLine)
        session.state = {
          actionSubmissions: [],
          players: result.value.players,
          winnerPlayerId: result.value.winnerPlayerId,
        }
        turnResolutionError = undefined

        if (session.state.winnerPlayerId === undefined) {
          session.turn += 1
        }
        break
      }
      case "QUIT":
        writeLine("Game ended without a winner.")
        return session
      default:
        Assert.isExhausted(selection)
    }
  }

  writeLine(`You won on turn ${session.turn}.`)
  return session
}

function createSoloGameSession(): SoloGameSession {
  return {
    turn: 1,
    state: {
      actionSubmissions: [],
      players: {
        [SOLO_PLAYER_ID]: {
          id: SOLO_PLAYER_ID,
          resources: {
            [ResourceType.MONEY]: 2,
          },
        },
      },
      winnerPlayerId: undefined,
    },
  }
}

async function promptWithInquirer({ message, choices, default: defaultSelection }: SoloGamePromptOptions): Promise<SoloGameSelection> {
  return await select(
    {
      message,
      choices,
      default: defaultSelection,
      loop: false,
      pageSize: 12,
      theme: {
        prefix: "",
        icon: {
          cursor: UiStyle.accent("❯"),
        },
        style: {
          description: UiStyle.muted,
          message: (text: string) => text,
        },
      },
    },
    {
      clearPromptOnDone: true,
    },
  )
}

function getSelectionKey(selection: SoloGameSelection): string {
  switch (selection.command) {
    case "ADD_ACTION":
      return `${selection.command}:${selection.actionDefinitionId}`
    case "REMOVE_ACTION":
      return `${selection.command}:${selection.actionSubmissionId}`
    case "SUBMIT_TURN":
    case "QUIT":
      return selection.command
    default:
      Assert.isExhausted(selection)
      return ""
  }
}

function createChoices(session: SoloGameSession): SoloGameChoice[] {
  const addActionChoices = Object.values(StandardRuleset.actionDefinitions).map((actionDefinition) => ({
    name: UiStyle.positive(`+ ${actionDefinition.name}`),
    description: formatActionDescription(actionDefinition),
    value: {
      command: "ADD_ACTION" as const,
      actionDefinitionId: actionDefinition.id,
    },
  }))
  const actionCounts = new Map<string, number>()
  const removeActionChoices = session.state.actionSubmissions.map((actionSubmission) => {
    const actionDefinition = StandardRuleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)
    const actionCount = (actionCounts.get(actionDefinition.id) ?? 0) + 1
    actionCounts.set(actionDefinition.id, actionCount)

    return {
      name: UiStyle.warning(`− #${actionCount} ${actionDefinition.name}`),
      value: {
        command: "REMOVE_ACTION" as const,
        actionSubmissionId: actionSubmission.id,
      },
    }
  })

  return [
    {
      name: UiStyle.accent(`▶ Resolve Turn ${session.turn}`),
      description: `${session.state.actionSubmissions.length} selected ${session.state.actionSubmissions.length === 1 ? "action" : "actions"} will be submitted to the rules engine`,
      value: { command: "SUBMIT_TURN" },
    },
    ...addActionChoices,
    ...removeActionChoices,
    {
      name: UiStyle.muted("× Exit playtest"),
      description: "End this in-memory session without a winner",
      value: { command: "QUIT" },
    },
  ]
}

function addAction(session: SoloGameSession, actionDefinitionId: string, actionSubmissionNumber: number): void {
  const player = getSoloPlayer(session)
  const actionDefinition = StandardRuleset.actionDefinitions[actionDefinitionId]
  Assert.isDefined(actionDefinition)

  session.state = {
    ...session.state,
    actionSubmissions: [
      ...session.state.actionSubmissions,
      {
        id: `turn-${session.turn}-${actionDefinition.id}-${actionSubmissionNumber}`,
        submittedByPlayerId: player.id,
        actionDefinitionId: actionDefinition.id,
        targets: {
          self: player.id,
        },
      },
    ],
  }
}

function removeAction(session: SoloGameSession, actionSubmissionId: string): void {
  const actionSubmissions = session.state.actionSubmissions
  const actionSubmissionIndex = actionSubmissions.findIndex((actionSubmission) => actionSubmission.id === actionSubmissionId)
  Assert.isTrue(actionSubmissionIndex >= 0)

  session.state = {
    ...session.state,
    actionSubmissions: actionSubmissions.filter((_, index) => index !== actionSubmissionIndex),
  }
}

function getSoloPlayer(session: SoloGameSession): TurnState["players"][string] {
  const player = session.state.players[SOLO_PLAYER_ID]
  Assert.isDefined(player)
  return player
}

function formatTurnDashboard(session: SoloGameSession, dashboardState: TurnDashboardState): string[] {
  const player = getSoloPlayer(session)
  const isOpen = dashboardState.status === "open"
  const statusBadge = isOpen ? UiStyle.warning("● OPEN") : UiStyle.positive("✓ RESOLVED")
  const lines = [
    ...createPanel(
      isOpen ? "CURRENT TURN" : "RESOLVED TURN",
      [alignSides(UiStyle.accent(`TURN ${session.turn.toString().padStart(2, "0")}`), statusBadge), UiStyle.muted(StandardRuleset.name)],
      isOpen ? "cyan" : "green",
    ),
    "",
  ]

  const resourceLines: string[] = []
  for (const [resourceType, quantity] of Object.entries(player.resources)) {
    resourceLines.push(alignSides(UiStyle.muted(resourceType), UiStyle.resource(`${quantity} available`)))
  }
  lines.push(...createPanel("EMPIRE STATE", resourceLines, "blue"), "")

  const actionLines: string[] = []
  if (session.state.actionSubmissions.length === 0) {
    actionLines.push(UiStyle.muted("No orders selected"))
  } else {
    for (const [index, actionSubmission] of session.state.actionSubmissions.entries()) {
      const actionDefinition = StandardRuleset.actionDefinitions[actionSubmission.actionDefinitionId]
      Assert.isDefined(actionDefinition)
      const orderNumber = (index + 1).toString().padStart(2, "0")
      actionLines.push(`${UiStyle.action(orderNumber)}  ${styleText("bold", actionDefinition.name)}`)

      if (dashboardState.status === "resolved") {
        const resolvedAction = dashboardState.resolvedActions.find((candidate) => candidate.actionSubmission.id === actionSubmission.id)
        Assert.isDefined(resolvedAction)
        actionLines.push(...resolvedAction.actionOutcomes.map((outcome) => `    ${formatActionOutcome(outcome)}`))
      }
    }
  }
  const actionPanelTitle = `${isOpen ? "SELECTED ACTIONS" : "SUBMITTED ACTIONS"}  ·  ${session.state.actionSubmissions.length}`
  lines.push(...createPanel(actionPanelTitle, actionLines, "magenta"))

  if (session.state.winnerPlayerId !== undefined) {
    lines.push("", ...createPanel("VICTORY", [UiStyle.positive(`★ ${session.state.winnerPlayerId} won the game`)], "green"))
  }

  if (dashboardState.status === "open" && dashboardState.turnResolutionError !== undefined) {
    lines.push("", ...formatTurnResolutionFailure(dashboardState.turnResolutionError))
  }

  if (isOpen) {
    lines.push(
      "",
      ...createPanel(
        "COMMAND",
        [
          styleText("bold", "Choose what your empire does next."),
          UiStyle.muted("Select actions, revise the selection, or resolve the turn."),
        ],
        "yellow",
      ),
    )
  }

  return lines
}

function formatTurnResolutionFailure(error: ResolveTurnError): string[] {
  switch (error.type) {
    case "INVALID_SUBMISSIONS":
      return createPanel(
        "TURN REJECTED",
        [
          UiStyle.danger("✕ The rules engine refused these actions."),
          UiStyle.muted("Revise the selected actions, then resolve the turn again."),
          "",
          ...error.issues.flatMap((issue) => [
            styleText("bold", issue.actionDefinitionName ?? issue.actionDefinitionId),
            `  ${UiStyle.danger(issue.issue)}`,
          ]),
        ],
        "red",
      )
    case "FAILED_TO_RESOLVE_PHASES":
      return createPanel(
        "TURN REJECTED",
        [
          UiStyle.danger("✕ A Phase failed to resolve."),
          UiStyle.danger(`Error: ${JSON.stringify(error.error, null, 2)}`),
          UiStyle.muted("The turn state was not advanced."),
        ],
        "red",
      )
    case "UNRESOLVED_EFFECTS":
      return createPanel(
        "TURN REJECTED",
        [
          UiStyle.danger("✕ An Effect was not resolved."),
          UiStyle.danger(`Effects: ${JSON.stringify(error.effects, null, 2)}`),
          UiStyle.muted("The turn state was not advanced."),
        ],
        "red",
      )
    default:
      Assert.isExhausted(error)
      return []
  }
}

function writeResolvedTurn(session: SoloGameSession, resolvedActions: readonly ResolvedAction[], writeLine: (line: string) => void): void {
  for (const line of formatTurnDashboard(session, { status: "resolved", resolvedActions })) {
    writeLine(UiStyle.history(line))
  }

  if (session.state.winnerPlayerId === undefined) {
    writeLine(UiStyle.muted(TURN_SEPARATOR))
  }
}

function formatActionOutcome(outcome: EffectOutcome): string {
  switch (outcome.type) {
    case "RESOLVED":
      return `${UiStyle.positive("✓")} ${outcome.result}`
    case "PREVENTED":
      return `${UiStyle.warning("○")} ${outcome.reason}`
    default:
      Assert.isExhausted(outcome)
      return ""
  }
}

function formatActionDescription(actionDefinition: ActionDefinition): string {
  return `${actionDefinition.tier} ${actionDefinition.type}  ·  ${formatActionSummary(actionDefinition)}`
}

function formatActionSummary(actionDefinition: ActionDefinition): string {
  const costs = actionDefinition.costs.map((cost) => `${cost.quantity} ${cost.resourceType}`)
  const effects = actionDefinition.mechanics.map(formatMechanic)
  const formattedCosts = costs.length === 0 ? "no cost" : `costs ${costs.join(", ")}`

  return `${formattedCosts}  ·  ${effects.join(", ")}`
}

function formatMechanic(mechanic: Mechanic): string {
  switch (mechanic.type) {
    case "RESOURCE_LOSS":
      return `pays ${mechanic.quantity} ${mechanic.resourceType}`
    case "RESOURCE_GAIN":
      return `gains ${mechanic.quantity} ${mechanic.resourceType}`
    case "VICTORY":
      return "wins the game"
  }
}

type PanelTone = "blue" | "cyan" | "green" | "magenta" | "red" | "yellow"

function createPanel(title: string, lines: readonly string[], tone: PanelTone): string[] {
  const titleLabel = ` ${title} `
  const topRightBorderWidth = UI_WIDTH - titleLabel.length - 3
  Assert.isTrue(topRightBorderWidth >= 0)

  return [
    `${stylePanelBorder("╭─", tone)}${stylePanelTitle(titleLabel, tone)}${stylePanelBorder(`${"─".repeat(topRightBorderWidth)}╮`, tone)}`,
    ...lines.map((line) => `${stylePanelBorder("│", tone)} ${fitPanelLine(line)} ${stylePanelBorder("│", tone)}`),
    stylePanelBorder(`╰${"─".repeat(UI_WIDTH - 2)}╯`, tone),
  ]
}

function fitPanelLine(line: string): string {
  const visibleLine = stripVTControlCharacters(line)
  if (visibleLine.length > PANEL_CONTENT_WIDTH) {
    return `${visibleLine.slice(0, PANEL_CONTENT_WIDTH - 1)}…`
  }

  return `${line}${" ".repeat(PANEL_CONTENT_WIDTH - visibleLine.length)}`
}

function alignSides(left: string, right: string): string {
  const spacing = PANEL_CONTENT_WIDTH - stripVTControlCharacters(left).length - stripVTControlCharacters(right).length
  if (spacing <= 0) {
    return `${left} ${right}`
  }

  return `${left}${" ".repeat(spacing)}${right}`
}

function stylePanelBorder(text: string, tone: PanelTone): string {
  return styleText(tone, text)
}

function stylePanelTitle(text: string, tone: PanelTone): string {
  return styleText(["bold", tone], text)
}
