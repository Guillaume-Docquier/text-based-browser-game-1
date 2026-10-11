import type { PgTransactionConfig } from "drizzle-orm/pg-core"
import type { Database, Transaction } from "#lib/db/createDb.ts"
import { actionsTable } from "#lib/db/schema.ts"

/** Abort only a real save that has finished its next-turn actions insert. */
export class SaveTransactionFailure {
  public readonly db: Database
  public completedSaveCallbacks = 0
  public failures = 0
  private armed = false

  public constructor(db: Database) {
    this.db = new Proxy(db, {
      get: (target, property): unknown => {
        if (property === "transaction") {
          return async <T>(operation: (tx: Transaction) => Promise<T>, config?: PgTransactionConfig): Promise<T> =>
            await target.transaction(async (tx) => {
              let insertedNextActions = false
              const observed = new Proxy(tx, {
                get: (transaction, key): unknown => {
                  if (key === "insert") {
                    return (table: unknown): unknown => {
                      if (table === actionsTable) insertedNextActions = true
                      const insert: unknown = Reflect.get(transaction, "insert")
                      if (typeof insert !== "function") throw new Error("Transaction insert must be callable")
                      return Reflect.apply(insert, transaction, [table])
                    }
                  }
                  const value: unknown = Reflect.get(transaction, key)
                  return typeof value === "function" ? value.bind(transaction) : value
                },
              })
              const value = await operation(observed)
              if (insertedNextActions) {
                this.completedSaveCallbacks++
                if (this.armed) {
                  this.armed = false
                  this.failures++
                  throw new Error("Test abort after production save writes and awaited actions insert")
                }
              }
              return value
            }, config)
        }
        const value: unknown = Reflect.get(target, property)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }

  public armNextSave(): void {
    this.armed = true
  }
}
