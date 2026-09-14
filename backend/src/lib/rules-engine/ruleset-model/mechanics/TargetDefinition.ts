import type { TargetRequirement } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

export type TargetDefinition = TargetRequirement &
  Readonly<{
    /**
     * The key to use on the submitted action's selected targets to find the target id.
     * This is not the id of the actual target.
     */
    tag: string
  }>
