import { z } from "zod"
import { InputTagSchema, type InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema, type PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"

/**
 * Maps Action Definition input tags to validated player-selected values.
 */
export type SelectedInputs = Readonly<Record<InputTag, PositiveInteger>>

export const SelectedInputsSchema = z.record(InputTagSchema, PositiveIntegerSchema).readonly() satisfies z.ZodType<SelectedInputs>
