export class BackendApiClient {
  private readonly baseUrl: string

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public async getTick(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/tick`)
    const body = (await response.json()) as { tick: number }

    return body.tick
  }

  public async incrementTick(): Promise<void> {
    await fetch(`${this.baseUrl}/tick`, { method: "POST" })
  }
}
