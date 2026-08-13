import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"

export type ResolvedTargets = {
  [TargetTag in keyof ActionDefinition["targets"]]: string
}
