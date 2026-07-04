declare const brand: unique symbol
declare const baseType: unique symbol

type AnyBrand = Branded<unknown, unknown>
type TypeOf<TBrand extends AnyBrand> = TBrand[typeof baseType]

/**
 * Type utility to create branded types.
 *
 * @example
 * ```ts
 * type UserId = Branded<string, "userId">
 * function getUser(userId: UserId): User {}
 *
 * const str = "a string"
 * const userId = branded<UserId>("user id")
 *
 * getUser(str) // S2345: Argument of type string is not assignable to parameter of type UserId
 * getUser(userId) // works!
 * ```
 */
export type Branded<TType, TBrand> = TType & { [brand]: TBrand } & { [baseType]: TType }

/**
 * Brands a value.
 * This is just type gymnastics to declare intent, the value is returned as-is at runtime.
 */
export function branded<TBrand extends AnyBrand>(value: TypeOf<TBrand>): TBrand {
  return value as TBrand
}
