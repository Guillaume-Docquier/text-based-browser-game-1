import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import type { Api } from "#api/Api.ts"
import { type AnonymousApiClient, type AuthenticatedApiClient, createApiClient } from "#testing/ApiClient.ts"

export class ApiServer {
  private readonly accountsRepository: AccountsRepository
  private readonly api: Api
  public readonly port: number

  public static async create({ api, accountsRepository }: { api: Api; accountsRepository: AccountsRepository }): Promise<ApiServer> {
    const { port } = await api.listen(0)
    return new ApiServer({ api, accountsRepository, port })
  }

  private constructor({ api, accountsRepository, port }: { api: Api; accountsRepository: AccountsRepository; port: number }) {
    this.accountsRepository = accountsRepository
    this.api = api
    this.port = port
  }

  public async createClient(args: { authenticated: true; id?: string }): Promise<AuthenticatedApiClient>
  public async createClient(args: { authenticated: false }): Promise<AnonymousApiClient>
  public async createClient({
    authenticated,
    id,
  }: {
    authenticated: boolean
    id?: string | undefined
  }): Promise<AuthenticatedApiClient | AnonymousApiClient> {
    return await createApiClient({ port: this.port, accountsRepository: this.accountsRepository, authenticated, id })
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.api.close()
  }
}
