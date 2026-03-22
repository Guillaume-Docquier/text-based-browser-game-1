export class BackendApiClient {
  private readonly baseUrl: string

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public async getTick(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/tick`, {
      headers: await this.headers(),
    })
    const body = (await response.json()) as { tick: number }

    return body.tick
  }

  public async incrementTick(): Promise<void> {
    await fetch(`${this.baseUrl}/tick`, {
      method: "POST",
      headers: await this.headers(),
    })
  }

  private async headers(): Promise<HeadersInit> {
    return {
      // @ts-expect-error -- Gotta fix this Clerk thing
      Authorization: `Bearer ${await Clerk.session.getToken()}`,
    }
  }
}
