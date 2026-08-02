import { Logger } from "@guillaume-docquier/tools-ts"
import { Clock } from "#lib/Clock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createCreateTransaction, type Database } from "#lib/db/createDb.ts"
import { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

type TurnProcessorServices = ConstructorParameters<typeof TurnProcessor>[0]

export async function createTurnProcessorStub({
  db,
  clock = Clock,
  turnsRepository,
}: { db?: Database; clock?: Clock; turnsRepository?: TurnsRepository } = {}): Promise<
  TurnProcessorServices & {
    turnProcessor: TurnProcessor
  }
> {
  const logger = Logger.get()
  db ??= await createDbMock()

  const turnProcessorServices = {
    logger,
    clock,
    createTransaction: createCreateTransaction(db),
    turnsRepository: turnsRepository ?? new TurnsRepository({ logger, clock, db }),
  } as const satisfies TurnProcessorServices

  const turnProcessor = new TurnProcessor(turnProcessorServices)

  return {
    ...turnProcessorServices,
    turnProcessor,
  }
}
