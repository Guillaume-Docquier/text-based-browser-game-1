import type { Logger } from "@guillaume-docquier/tools-ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
  }
}
