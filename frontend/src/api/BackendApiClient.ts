export class BackendApiClient {
  private readonly baseUrl = "/api"

  public async getTick(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/tick`)
    const body = (await response.json()) as { tick: number }

    return body.tick
  }

  public async incrementTick(): Promise<void> {
    await fetch(`${this.baseUrl}/tick`, { method: "POST" })
  }
}
