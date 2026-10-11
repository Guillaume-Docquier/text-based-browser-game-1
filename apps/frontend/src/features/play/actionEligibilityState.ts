import type { PlayerView } from "@api-types"
import { indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { ActionEligibilityState } from "shared/action-submission/actionEligibility.ts"
import { SubmittedActionSchema } from "shared/domain/turns/actions/Action.ts"
/** Preserve total stockpiles, positions, routes and submissions; decisions stay in shared. */
export function toActionEligibilityState(view: PlayerView): ActionEligibilityState {
  const resources = {
    INFLUENCE: view.resources.INFLUENCE.total,
    METAL: view.resources.METAL.total,
    FUEL: view.resources.FUEL.total,
    ENERGY: view.resources.ENERGY.total,
    COLONY: view.resources.COLONY.total,
  }
  return {
    gameId: view.gameId,
    turn: view.turn,
    players: indexBy(
      "id",
      [view.player, ...Object.values(view.opponents)].map((player) => ({ id: player.id, resources })),
    ),
    planets: indexBy(
      "id",
      view.galaxy.systems.flatMap((system) => system.planets),
    ),
    fleets: indexBy("id", view.fleets),
    submittedActions: view.actions.flatMap((action) =>
      action.status !== "SUBMITTED"
        ? []
        : [
            typedParse(SubmittedActionSchema, {
              ...action,
              playerId: view.player.id,
              selectedTargets: action.selectedTargets ?? {},
              selectedInputs: action.selectedInputs ?? {},
            }),
          ],
    ),
  }
}
