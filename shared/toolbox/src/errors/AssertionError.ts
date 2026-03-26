import { FatalError } from "./FatalError.ts"

type AssertionContext = { paramName?: string | undefined; expected: string | number; received: string | number }

/**
 * An error used when the program assumptions are broken.
 * You should rely on typescript for this, but in cases where you cannot, you should assert aggressively and throw this error.
 * You should rely on the {@link Assert} module for most of your assertions, but if you have custom use cases, use this error.
 *
 * For example:
 * - You expect and api to always return a 200 status code and it did not.
 * - You expect a parameter to within a certain range and it isn't.
 * - You expect a value to be defined but it isn't.
 */
export class AssertionError extends FatalError<AssertionContext> {
  /**
   * @param message A message that describes the assertion.
   * @param context The assertion context.
   * @param caller You can pass the caller to remove them (and all other callers after them) from the stack trace. This is useful if you raise an error for someone else and you want the stack trace to point to them.
   */
  constructor(message: string, context: AssertionContext, caller?: (...args: never) => unknown | undefined) {
    super(message, cleanContext(context), caller)

    // We can't use "this.constructor.name" because when code gets bundled, the class names get mangled and you get a useless name
    this.name = "AssertionError"
  }
}

/**
 * Removes context.paramName if undefined.
 * That's because the Assert functions accept an optional paramName and the syntax to omit the key if it is undefined is ugly.
 */
function cleanContext(context: AssertionContext): AssertionContext {
  if (context.paramName === undefined) {
    delete context.paramName
  }

  return context
}
