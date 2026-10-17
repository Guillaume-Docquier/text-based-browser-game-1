import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerColorSchema } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { ActionDefinitionIdSchema } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { TurnStatusSchema } from "shared/domain/turns/TurnStatus.ts"
import { FleetSchema } from "shared/domain/world/fleets/Fleet.ts"
import { GalaxySchema } from "shared/domain/world/Galaxy.ts"
import { z } from "zod"
import { PlayerViewResourcesSchema } from "#api/gameplay/PlayerViewResources.ts"

export type PlayerViewPlayer = z.infer<typeof PlayerViewPlayerSchema>
export const PlayerViewPlayerSchema = z.object({
  id: PlayerIdSchema,
  color: PlayerColorSchema,
  isReady: z.boolean(),
})

export type PlayerViewAction = z.infer<typeof PlayerViewActionSchema>
export const PlayerViewActionSchema = z.object({
  id: ActionIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
  selectedTargets: SelectedTargetsSchema.nullable(),
  canAfford: z.boolean(),
})

export type PlayerView = z.infer<typeof PlayerViewSchema>
export const PlayerViewSchema = z.object({
  gameId: GameIdSchema,
  player: PlayerViewPlayerSchema,
  opponents: z.record(PlayerIdSchema, PlayerViewPlayerSchema),
  galaxy: GalaxySchema,
  fleets: z.array(FleetSchema).readonly(),
  turn: z.number(),
  turnStatus: TurnStatusSchema,
  turnEndsAt: z.date(),
  resources: PlayerViewResourcesSchema,
  ruleset: RulesetSchema,
  actions: z.array(PlayerViewActionSchema),
})
