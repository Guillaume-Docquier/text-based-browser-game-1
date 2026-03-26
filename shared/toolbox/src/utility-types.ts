/**
 *
 * Utility type that represents the constructor of a given class or function.
 * You must define the generic type argument, otherwise a default type of unknown will be used.
 *
 * @example
 * ```ts
 * class CustomNode {
 *   private name: string
 *   constructor(name: string) {
 *     this.name = name
 *   }
 * }
 *
 * function findObjectsOfType(type: ConstructorType<CustomNode>, objects: any): CustomNode[] {
 *   return objects.filter((obj: any) => obj instanceof type)
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- We need flexibility for our arguments
export type ConstructorType<T = unknown> = new (...args: any[]) => T

/**
 * A broad type for an enum-like object key.
 */
export type EnumKeyType = string | number | symbol

/**
 * A broad type for an enum-like object value.
 */
export type EnumValueType = string | number

/**
 * A broad type for an enum-like object.
 */
export type EnumType = Record<EnumKeyType, EnumValueType>

/**
 * The Prettify helper is a utility type that takes an object type and makes the hover overlay more readable.
 * @example
 * ```ts
 * // shows up as { a: string; } & { b: number; } & { c: boolean; }
 * type Intersected = {
 *   a: string;
 * } & {
 *   b: number;
 * } & {
 *   c: boolean;
 * }
 *
 * // shows up as { a: string, b: number, c: boolean; }
 * type PrettyIntersected = Prettify<Intersected>
 * ```
 *
 * For more information, see https://www.totaltypescript.com/concepts/the-prettify-helper
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

/**
 * This utility type is similar to Omit, but distributes the omission over a discriminated type union
 * @example
 * ```
 * type A = {
 *   type: "A"
 *   id: string
 *   aThing: number
 * }
 *
 * type B = {
 *   type: "B"
 *   id: string
 *   bThing: string
 * }
 *
 * type Letter = A | B
 *
 * type LetterWithoutIdUsingOmit = Omit<Letter, "id"> // Does not work: { type: "A" | "B" }
 * type LetterWithoutIdUsingOmitOverUnion = OmitOverUnion<Letter, "id"> // { type: "A"; aThing: number } | { type: "B"; bThing: string }
 * ```
 *
 * See: https://github.com/microsoft/TypeScript/issues/31501#issuecomment-1280579305
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- This is legit
export type OmitOverUnion<T, K extends keyof any> = T extends any ? Omit<T, K> : never

/**
 * With great power comes great responsibility.
 * Use responsibly and cautiously.
 *
 * Removes readonly modifiers from the targeted properties.
 * @example
 * ```ts
 * type Car = {
 *   readonly numberOfDoors: number
 *   readonly numberOfWheels: number
 * }
 *
 * const car: Mutable<Car, "numberOfDoors"> = { numberOfDoors: 2, numberOfWheels: 4 }
 *
 * car.numberOfDoors = 10 // Works
 * car.numberOfWheels = 10 // TS2540: Cannot assign to numberOfWheels because it is a read-only property.
 * ```
 *
 * @deprecated THIS IS DANGEROUS TO USE AND YOU PROBABLY SHOULD NOT
 */
export type Mutable<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P]
} & {
  -readonly [P in K]: T[P]
}

/**
 * This is not the same as Partial<TObject>.
 * It doesn't make TObject Partial, it makes a property of TObject Partial.
 *
 * @example
 * ```ts
 * type Data = { a: number, b: { deep: { object: string }}}
 *
 * type DataPartial = Partial<Data>
 * // ^? { a?: number, b?: { deep: { object: string }}}
 *
 * type DataWithPartialProperties = PartialProperties<Data, "b">
 * // ^? { a: number, b: { deep?: { object: string }}}
 *
 * type DataPartialWithPartialProperties = Partial<PartialProperties<Data, "b">>
 * // ^? { a?: number, b?: { deep?: { object: string }}}
 * ```
 */
export type PartialProperties<TObject, TKey extends keyof TObject> = Omit<TObject, TKey> & {
  [TProperty in TKey]: Partial<TObject[TProperty]>
}

/**
 * Like keyof T, but for the values.
 *
 * @example
 * ```ts
 * type ResponsesByStatus = {
 *   200: { message: string }
 *   400: { reason: string }
 *   500: { error: string }
 * }
 *
 * type Responses = ValueOf<ResponsesByStatus>
 * // ^? { message: string } | { reason: string } | { error: string }
 * ```
 */
export type ValueOf<T> = T[keyof T]
