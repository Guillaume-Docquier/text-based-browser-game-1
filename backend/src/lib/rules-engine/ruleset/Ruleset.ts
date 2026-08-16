import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"

export type Ruleset = {
  readonly actionDefinitions: Readonly<Record<string, ActionDefinition>>
}
