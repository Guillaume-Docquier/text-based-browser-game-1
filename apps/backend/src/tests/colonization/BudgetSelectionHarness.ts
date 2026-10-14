import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { Action, Fleet, Planet, PlayerView } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"

type BudgetSelectionContext = Readonly<{
  client: AuthenticatedApiClient["client"]
  gameId: PlayerView["gameId"]
  readView: () => PlayerView
  stationary: Fleet
  target: Planet
  home: Planet
  moveAction: Action
}>
type MoveSelection = Readonly<{ strength: number }>
type ColonizeSelection = Readonly<{ actionId: string; selectedFleetId?: string; selectedPlanetId?: string }>
type CancelSelection = Readonly<{ actionId: string }>

/** Submits budget scenario edits against the current public Turn. */
export class BudgetSelectionHarness {
  private readonly context: BudgetSelectionContext
  public constructor(context: BudgetSelectionContext) {
    this.context = context
  }
  public readonly submitMove = async ({ strength }: MoveSelection): Promise<void> => {
    const context = this.context
    await this.update({
      actionId: context.moveAction.id,
      selectedTargets: { fleet: context.stationary.id, planet: context.home.id },
      selectedInputs: { strength },
    })
  }
  public readonly submitColonize = async ({ actionId, selectedFleetId, selectedPlanetId }: ColonizeSelection): Promise<void> => {
    const context = this.context
    await this.update({
      actionId,
      selectedTargets: { fleet: selectedFleetId ?? context.stationary.id, planet: selectedPlanetId ?? context.target.id },
      selectedInputs: {},
    })
  }
  public readonly cancelAction = async ({ actionId }: CancelSelection): Promise<void> => {
    await this.update({ actionId, selectedTargets: null, selectedInputs: null })
  }
  public readonly currentView = async (): Promise<PlayerView> =>
    await this.context.client.gameplay.getPlayerView.query({ gameId: this.context.gameId })
  private async update(submittedActionTargets: DeepUnbranded<SubmittedActionTargetsDto>): Promise<void> {
    await this.context.client.gameplay.updateActionSubmission.mutate({
      gameId: this.context.gameId,
      turn: this.context.readView().turn,
      submittedActionTargets,
    })
  }
}
