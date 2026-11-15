/**
 * You roll back transactions by throwing errors.
 * The built-in drizzle functionality for this is to call tx.rollback(), which throws an error.
 * However, TS doesn't know that it throws and breaks the control flow semantics, notably when dealing with Results.
 */
export class TransactionRollbackError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "TransactionRollbackError"
  }
}
