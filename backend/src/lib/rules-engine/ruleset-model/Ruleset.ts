import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"

export type Ruleset = {
  readonly actionDefinitions: Readonly<Record<string, ActionDefinition>>
}
