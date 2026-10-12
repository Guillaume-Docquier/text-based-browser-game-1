import type { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Structured validation reasons. Presentation belongs to the calling boundary.
 */
export type TargetValidationIssue =
  | Readonly<{ type: "WRONG_TARGET_TYPE"; expected: TargetType; received: TargetType }>
  | Readonly<{ type: "TARGET_NOT_OWNED"; targetType: TargetType }>
  | Readonly<{ type: "INVALID_TARGET_CONSTRAINT"; constraintType: string; targetType: TargetType }>

export type ActionValidationIssue =
  | TargetValidationIssue
  | Readonly<{ type: "ACTION_DEFINITION_NOT_FOUND" }>
  | Readonly<{ type: "MISSING_TARGET"; targetTag: string }>
  | Readonly<{ type: "UNEXPECTED_TARGET"; targetTag: string }>
  | Readonly<{ type: "EMPTY_TARGET"; targetTag: string; targetType: TargetType }>
  | Readonly<{ type: "UNKNOWN_TARGET"; targetTag: string; targetType: TargetType; targetId: string }>
  | Readonly<{ type: "INSUFFICIENT_RESOURCE"; resourceType: ResourceType; shortage: number }>
