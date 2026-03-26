import { FatalError } from "./FatalError.ts"
import { AssertionError } from "./AssertionError.ts"

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- This is necessary to create Typescript Assertion functions
export class Rethrow {
  /**
   * Use Rethrow.ifFatal to catch only errors that are not Fatal.
   * Additionally, this function will narrow the type of the error to Error.
   * If the given error is not an instance of Error, it will throw a AssertionError
   *
   * @example
   * ```ts
   * try {
   *   myFunction()
   * } catch(error: unknown) {
   *   Rethrow.ifFatal(error) // Will rethrow any FatalError, so you can catch only what should be caught.
   *   console.log(error.message) // Ok because the type has been narrowed.
   * }
   * ```
   *
   * ```ts
   * try {
   *   throw 1
   * } catch(error: unknown) {
   *   Rethrow.ifFatal(error) // Will throw AssertionError because we didn't throw an instance of Error. You should.
   * }
   * ```
   */
  public static ifFatal(this: void, maybeError: unknown): asserts maybeError is Error {
    if (!(maybeError instanceof Error)) {
      throw new AssertionError(
        "The error is not not an Error.",
        { expected: "Error", received: JSON.stringify(maybeError, null, 2) },
        Rethrow.ifFatal,
      )
    }

    if (maybeError instanceof FatalError) {
      throw maybeError
    }
  }
}
