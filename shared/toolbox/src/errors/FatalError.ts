/**
 * An error that should be fatal and crash your application.
 * It adds the isFatal flag to the error, letting you know that it is fatal.
 * You can also use `instanceof FatalError` to verify this.
 *
 * It also allows you to pass a structured context to the error alongside the error message.
 */
export class FatalError<TContext extends Record<string, unknown>> extends Error {
  public readonly isFatal = true
  public readonly context: TContext

  /**
   * @param message
   * @param context
   * @param caller You can pass the caller to remove them (and all other callers after them) from the stack trace. This is useful if you raise an error for someone else and you want the stack trace to point to them.
   */
  constructor(message: string, context: TContext, caller?: (...args: never) => unknown | undefined) {
    // Putting the context in the error message allows us to see it in the console when the error is uncaught, otherwise it's lost
    super(`${message} ${JSON.stringify(context, null, 2)}`)

    // We can't use "this.constructor.name" because when code gets bundled, the class names get mangled and you get a useless name
    this.name = "FatalError"
    this.context = structuredClone(context)

    if (caller !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This is making me crazy, captureStackTrace exists in all browsers, but you need to use node types. This shared package shouldn't use node types.
      ;(Error as any).captureStackTrace(this, caller)
    }
  }
}
