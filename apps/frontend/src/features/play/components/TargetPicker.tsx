import type { TargetDefinition, TargetId } from "@api-types"
import type { ReactElement } from "react"
import { getFleetTargetDependency } from "shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import { SearchSelect } from "@/components/search-select.tsx"
import { formatRulesetTerm } from "@/features/play/effectDefinitionToRulesText.ts"
import type { TargetOption } from "./targetOptions.ts"

/**
 * Selects an entity for one Action Definition target slot.
 */
export function TargetPicker({
  targetTag,
  targetDefinition,
  options,
  value,
  disabled,
  onChange,
}: {
  targetTag: string
  targetDefinition: TargetDefinition
  options: readonly TargetOption[]
  value: TargetId | undefined
  disabled: boolean
  onChange: (targetId: TargetId) => void
}): ReactElement {
  const label = formatRulesetTerm(targetTag)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">{label} target</span>
      <SearchSelect
        label={`${label} target`}
        options={options}
        value={value}
        disabled={disabled}
        allowSingleOptionSelection={targetDefinition.constraints.some((constraint) => getFleetTargetDependency(constraint) !== undefined)}
        placeholder={
          options.length === 0 ? `No ${targetDefinition.targetType.toLowerCase()} targets available` : `Choose ${label.toLowerCase()}`
        }
        onValueChange={onChange}
      />
    </div>
  )
}
