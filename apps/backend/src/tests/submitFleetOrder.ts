import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import type { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"

/**
 * The caller selects the operation's source, destination, allocation and instance.
 */
type FleetOrder = Readonly<{
  side: FleetActionsScenario
  actionId: string
  source: FleetId
  destination: PlanetId
  amount: number
  mapping?: Readonly<{ source: string; destination: string; strength: string }>
}>

/**
 * Target and input bindings used by the authored fleet operations ruleset.
 */
export const authoredFleetOrderMapping = { source: "craft", destination: "world", strength: "force" } as const

/**
 * Submits the caller's explicit fleet selection in the current collecting turn.
 */
export async function submitFleetOrder({
  side,
  actionId,
  source,
  destination,
  amount,
  mapping = { source: "fleet", destination: "planet", strength: "strength" },
}: FleetOrder): Promise<void> {
  const view = await side.view()
  await side.player.client.gameplay.updateActionSubmission.mutate({
    gameId: side.gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId,
      selectedTargets: { [mapping.source]: source, [mapping.destination]: destination },
      selectedInputs: { [mapping.strength]: amount },
    },
  })
}
