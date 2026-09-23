import type { Branded } from "@guillaume-docquier/tools-ts"
import { describe, expectTypeOf, it } from "vitest"
import type { DeepUnbranded } from "#lib/validation/DeepUnbranded.ts"

type Id = Branded<"Id", string>

describe("DeepUnbranded", () => {
  it("should preserve nested object, array, union, and record structure when unbranding", () => {
    // Arrange
    type Input = Readonly<{
      optional?: Id | null
      tuple: readonly [Id, { id: Id }]
      byId: Readonly<Record<Id, { id: Id }>>
    }>
    type Expected = Readonly<{
      optional?: string | null
      tuple: readonly [string, { id: string }]
      byId: Readonly<Record<string, { id: string }>>
    }>

    // Act
    type DeepUnbrandedInput = DeepUnbranded<Input>

    // Assert
    expectTypeOf<DeepUnbrandedInput>().toExtend<Expected>()
    expectTypeOf<Expected>().toExtend<DeepUnbrandedInput>()
  })
})
