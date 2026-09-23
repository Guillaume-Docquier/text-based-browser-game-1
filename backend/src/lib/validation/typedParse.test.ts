import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, expectTypeOf, it } from "vitest"
import { z } from "zod"
import { typedParse, safeTypedParse } from "./typedParse.ts"

type Id = Branded<"Id", string>
const IdSchema = z
  .string()
  .min(2)
  .transform(branded<Id>)

type Entity = Branded<
  "Entity",
  Readonly<{
    id: Id
    children: ReadonlyArray<{ id: Id; count: number }>
  }>
>
const EntitySchema = z
  .object({
    id: IdSchema,
    children: z
      .array(
        z.object({
          id: IdSchema,
          count: z.number(),
        }),
      )
      .readonly(),
  })
  .transform(branded<Entity>)

const WidenedEntitySchema: z.ZodType<Entity> = EntitySchema

describe("typedParse", () => {
  describe("typedParse", () => {
    it("should accept complete unbranded objects and return branded output", () => {
      // Arrange
      const input = { id: "parent", children: [{ id: "child", count: 1 }] }

      // Act
      const entity = typedParse(WidenedEntitySchema, input)

      // Assert
      expectTypeOf(entity).toEqualTypeOf<Entity>()
      expect(entity).toStrictEqual(input)
    })

    it("should still check refinements that TypeScript cannot express", () => {
      // Arrange
      const tooShort = "x"

      // Act
      const operation = (): Id => typedParse(IdSchema, tooShort)

      // Assert
      expectTypeOf<Parameters<typeof typedParse<typeof IdSchema>>[1]>().toEqualTypeOf<string>()
      expect(operation).toThrow(Error)
    })

    it("should reject incomplete object types at compile time", () => {
      // Arrange
      const missingRootKey = { id: "parent" }
      const missingNestedKey = { id: "parent", children: [{ id: "child" }] }
      const wrongNestedKey = { id: "parent", children: [{ id: "child", amount: 1 }] }

      // Act & Assert
      expectTypeOf(missingRootKey).not.toExtend<Parameters<typeof typedParse<typeof WidenedEntitySchema>>[1]>()
      expectTypeOf(missingNestedKey).not.toExtend<Parameters<typeof typedParse<typeof WidenedEntitySchema>>[1]>()
      expectTypeOf(wrongNestedKey).not.toExtend<Parameters<typeof typedParse<typeof WidenedEntitySchema>>[1]>()
    })
  })

  describe("safeTypedParse", () => {
    it("should accept complete unbranded objects and return branded output", () => {
      // Arrange
      const input = { id: "parent", children: [{ id: "child", count: 1 }] }

      // Act
      const result = safeTypedParse(WidenedEntitySchema, input)

      // Assert
      expectTypeOf(result).toEqualTypeOf<z.ZodSafeParseResult<Entity>>()
      expect(result).toStrictEqual({ success: true, data: input })
    })

    it("should still check refinements that TypeScript cannot express", () => {
      // Arrange
      const tooShort = "x"

      // Act
      const result = safeTypedParse(IdSchema, tooShort)

      // Assert
      expectTypeOf<Parameters<typeof safeTypedParse<typeof IdSchema>>[1]>().toEqualTypeOf<string>()
      expect(result.success).toBe(false)
    })

    it("should reject incomplete object types at compile time", () => {
      // Arrange
      const missingRootKey = { id: "parent" }
      const missingNestedKey = { id: "parent", children: [{ id: "child" }] }
      const wrongNestedKey = { id: "parent", children: [{ id: "child", amount: 1 }] }

      // Act & Assert
      expectTypeOf(missingRootKey).not.toExtend<Parameters<typeof safeTypedParse<typeof WidenedEntitySchema>>[1]>()
      expectTypeOf(missingNestedKey).not.toExtend<Parameters<typeof safeTypedParse<typeof WidenedEntitySchema>>[1]>()
      expectTypeOf(wrongNestedKey).not.toExtend<Parameters<typeof safeTypedParse<typeof WidenedEntitySchema>>[1]>()
    })
  })
})
