import { PostgresRepository } from "#db/PostgresRepository.ts"
import { usersTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"
import type { NullToUndefined } from "../utilityTypes.ts"

export type User = typeof usersTable.$inferSelect
type UserInsert = NullToUndefined<Omit<User, "id">>

export class UsersRepository extends PostgresRepository {
  public async findByAuthId({ authId }: { authId: string }): Promise<User | undefined> {
    return (await this.db.select().from(usersTable).where(eq(usersTable.clerk_id, authId)))[0]
  }

  public async insert(user: UserInsert): Promise<User | undefined> {
    return (
      await this.db
        .insert(usersTable)
        .values({
          clerk_id: user.clerk_id,
          email: user.email?.toLowerCase(),
        })
        .returning()
    )[0]
  }
}
