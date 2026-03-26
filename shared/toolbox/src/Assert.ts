import { AssertionError } from "./errors/AssertionError.ts"
import type { EnumType, ConstructorType } from "./utility-types.ts"
import { TypeGuard } from "./TypeGuard.ts"

/**
 * From Wikipedia
 * In computer programming, [...] an assertion is a predicate connected to a point in the program, that always should evaluate to true at that point in code execution.
 * Assertions can help a programmer read the code, help a compiler compile it, or help the program detect its own defects.
 *
 * In english, an assertion helps express and enforce expectations in scenarios where it is complicated or impossible to represent the system
 * accurately using Typescript.
 *
 * Assertions work by throwing when the expectation is not met, hopefully stopping the program.
 * This follows the fail fast mentality, where you should stop a program as soon as you detect an error, to prevent further errors and state corruption.
 *
 * The methods in this module will throw an {@link AssertionError}, with an `isFatal: true` property so that you can decide to not catch this class of errors, if you want.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- This is necessary to create Typescript Assertion functions
export class Assert {
  /**
   * Asserts that an instance is an instance of the given class constructor.
   * This function will throw a {@link AssertionError} if this is not the case, and narrow to the expected type otherwise.
   *
   * @example
   * ```ts
   * const mySomething = new Something()
   * Assert.isInstanceOf(DriveAddressV3, mySomething) // Will throw
   *
   * const myDriveAddress = new DriveAddressV3()
   * Assert.isInstanceOf(DriveAddressV3, myDriveAddress)
   * myDriveAddress // DriveAddressV3
   * ```
   */
  public static isInstanceOf<TType>(
    this: void,
    expectedClass: ConstructorType<TType>,
    maybeInstanceOf: unknown,
    paramName?: string,
  ): asserts maybeInstanceOf is TType {
    if (!(maybeInstanceOf instanceof expectedClass)) {
      throw new AssertionError(
        "Not an instance of the expected class.",
        {
          paramName,
          expected: expectedClass.name,
          received: maybeInstanceOf?.constructor.name ?? typeof maybeInstanceOf,
        },
        Assert.isInstanceOf,
      )
    }
  }

  /**
   * Asserts that something is defined (not null and not undefined).
   * This function will throw a {@link AssertionError} if this is not the case, and narrow to the expected type otherwise.
   *
   * @example
   * ```ts
   * const somethingNotDefined: number | undefined = undefined
   * Assert.isDefined(somethingNotDefined) // Will throw!
   *
   * const somethingDefined: number | undefined = 1
   * Assert.isDefined(somethingDefined)
   * somethingDefined // number
   * ```
   */
  public static isDefined<TType>(this: void, maybeDefined: TType | undefined | null, paramName?: string): asserts maybeDefined is TType {
    if (maybeDefined === undefined || maybeDefined === null) {
      throw new AssertionError(
        "Not defined.",
        {
          paramName,
          expected: "neither null nor undefined",
          received: formatPrimitiveValue(maybeDefined),
        },
        Assert.isDefined,
      )
    }
  }

  /**
   * Asserts that something is a member of an enum.
   * This function will throw a {@link AssertionError} if this is not the case, and narrow to the expected type otherwise.
   *
   * @example
   * ```ts
   * enum MyEnum {
   *   ONE: "ONE"
   * }
   *
   * const notAnEnumMember = "hello"
   * Assert.isEnumMember(MyEnum, notAnEnumMember) // Will throw!
   *
   * const enumMember = MyEnum.ONE
   * Assert.isEnumMember(MyEnum, enumMember)
   * enumMember // MyEnum
   *
   * const enumMemberString = "ONE"
   * Assert.isEnumMember(MyEnum, enumMemberString)
   * enumMemberString // MyEnum
   * ```
   */
  public static isEnumMember<TEnum extends EnumType>(
    this: void,
    theEnum: TEnum,
    maybeEnumValue: unknown,
    paramName?: string,
  ): asserts maybeEnumValue is TEnum[keyof TEnum] {
    if (!TypeGuard.isEnumMember(theEnum, maybeEnumValue)) {
      throw new AssertionError(
        "Not a member of the enum.",
        {
          paramName,
          expected: `one of [${Object.values(theEnum)
            .map((value) => formatPrimitiveValue(value, { quoteStrings: true }))
            .join(", ")}]`,
          received: formatPrimitiveValue(maybeEnumValue),
        },
        Assert.isEnumMember,
      )
    }
  }

  /**
   * Asserts that a value is one of a known set.
   * For best results, you should pass a constant or `as const` value.
   * This function will throw a {@link AssertionError} if this is not the case, and narrow to the expected type otherwise.
   *
   * @example
   * ```ts
   * const notOneOf = "hello"
   * Assert.isOneOf([0, 1, 2] as const, notOneOf) // Will throw!
   *
   * const oneOf = 2
   * Assert.isOneOf([0, 1, 2] as const, oneOf)
   * oneOf // 0 | 1 | 2
   * ```
   */
  public static isOneOf<TExpectedValue>(
    this: void,
    expectedValues: readonly TExpectedValue[],
    maybeOneOf: unknown,
    paramName?: string,
  ): asserts maybeOneOf is TExpectedValue {
    if (expectedValues.every((value) => value !== maybeOneOf)) {
      throw new AssertionError(
        "Not one of the expected values.",
        {
          paramName,
          expected: `one of [${expectedValues.map((value) => formatPrimitiveValue(value, { quoteStrings: true })).join(", ")}]`,
          received: formatPrimitiveValue(maybeOneOf),
        },
        Assert.isOneOf,
      )
    }
  }

  /**
   * Asserts that a condition is truthy.
   * This function will throw a {@link AssertionError} if this is not the case.
   *
   * @example
   * ```ts
   * const a: boolean = true
   * const b: number = 2
   * Assert.isTrue(a && b === 2)
   * // a: true, b: 2
   * ```
   */
  public static isTrue(this: void, condition: boolean, paramName?: string): asserts condition {
    if (!condition) {
      throw new AssertionError(
        "Expected condition to be true.",
        {
          paramName,
          expected: "a true value",
          received: formatPrimitiveValue(condition),
        },
        Assert.isTrue,
      )
    }
  }

  /**
   * Asserts that you've exhausted all possible values for something.
   * This is useful to make sure switch case statements handle all possible cases.
   * This function is meant to be a Typescript type check, and will throw if it is invoked at runtime.
   * If this function is called at runtime, it means your types are wrong.
   *
   * @example
   * ```ts
   * const value: "a" | 1 | null = null
   *
   * switch(value) {
   *   case "a":
   *     break
   *   case 1:
   *     break
   *   case null:
   *     break
   *   default:
   *     Assert.isExhausted(value) // no error, will never get called if the types are correct
   * }
   *
   * switch(value) {
   *   case "a":
   *     break
   *   case 1:
   *     break
   *   default:
   *     Assert.isExhausted(value) // error! `null` cannot be assigned to `never`, will throw at runtime
   * }
   * ```
   */
  public static isExhausted(this: void, value: never): asserts value is never {
    throw new AssertionError(
      "Assert.isExhausted should never actually get called, your types are lying to you.",
      {
        expected: "never",
        received: value,
      },
      Assert.isExhausted,
    )
  }
}

/**
 * `quoteStrings` will put strings inside single quote for nicer output when you know the string will be nested inside a double quoted string
 * `quoteStrings` only applies if `value` is a string. It will not affect strings within objects or arrays if `value` is an object or array.
 */
function formatPrimitiveValue(value: unknown, { quoteStrings = false }: { quoteStrings?: boolean } = {}): string | number {
  // prettier-ignore
  return value === undefined ? "undefined"
    : TypeGuard.isString(value) ? quoteStrings ? `'${value}'` : value
      : TypeGuard.isNumber(value) ? value
        : JSON.stringify(value)
}
