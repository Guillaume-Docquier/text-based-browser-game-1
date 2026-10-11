import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { InputTagSchema, type InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
export type SelectedStrength = Branded<"SelectedStrength", number>
export const SelectedStrengthSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .transform(branded<SelectedStrength>)
export type SelectedInputs = Readonly<Record<InputTag, SelectedStrength>>
export const SelectedInputsSchema = z.record(InputTagSchema, SelectedStrengthSchema).readonly() satisfies z.ZodType<SelectedInputs>
