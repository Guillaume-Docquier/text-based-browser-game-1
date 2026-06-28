import { Logger } from "@guillaume-docquier/tools-ts"
import { Clock } from "#lib/Clock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createCreateTransaction, type Database } from "#lib/db/createDb.ts"
import { TickProcessor } from "#tick-processing/TickProcessor.ts"
import { TicksRepository } from "#tick-processing/ticks.repository.ts"

type TickProcessorServices = ConstructorParameters<typeof TickProcessor>[0]

export async function createTickProcessorStub({
  db,
  clock = Clock,
  ticksRepository,
}: { db?: Database; clock?: Clock; ticksRepository?: TicksRepository } = {}): Promise<
  TickProcessorServices & {
    tickProcessor: TickProcessor
  }
> {
  const logger = Logger.get()
  db ??= await createDbMock()

  const tickProcessorServices = {
    logger,
    clock,
    createTransaction: createCreateTransaction(db),
    ticksRepository: ticksRepository ?? new TicksRepository({ logger, clock, db }),
  } as const satisfies TickProcessorServices

  const tickProcessor = new TickProcessor(tickProcessorServices)

  return {
    ...tickProcessorServices,
    tickProcessor,
  }
}
