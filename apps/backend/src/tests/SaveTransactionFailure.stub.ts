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
      get: (target, property): unknown =>
        property === "transaction" ? this.observeTransaction.bind(this, target) : boundProperty(target, property),
    })
  }

  private async observeTransaction<T>(
    database: Database,
    operation: (tx: Transaction) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    return await database.transaction(async (tx) => {
      const observation = observeActionsInsert(tx)
      const value = await operation(observation.transaction)
      if (observation.insertedNextActions()) this.completeSaveCallback()
      return value
    }, config)
  }

  private completeSaveCallback(): void {
    this.completedSaveCallbacks++
    if (!this.armed) return
    this.armed = false
    this.failures++
    throw new Error("Test abort after production save writes and awaited actions insert")
  }

  public armNextSave(): void {
    this.armed = true
  }
}

function boundProperty(target: object, property: string | symbol): unknown {
  const value: unknown = Reflect.get(target, property)
  return typeof value === "function" ? value.bind(target) : value
}

function observeActionsInsert(tx: Transaction): Readonly<{ transaction: Transaction; insertedNextActions: () => boolean }> {
  let insertedNextActions = false
  const transaction = new Proxy(tx, {
    get: (target, key): unknown => {
      if (key !== "insert") return boundProperty(target, key)
      return (table: unknown): unknown => {
        if (table === actionsTable) insertedNextActions = true
        const insert: unknown = Reflect.get(target, "insert")
        if (typeof insert !== "function") throw new Error("Transaction insert must be callable")
        return Reflect.apply(insert, target, [table])
      }
    },
  })
  return { transaction, insertedNextActions: () => insertedNextActions }
}
