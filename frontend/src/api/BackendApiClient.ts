import type { Game } from "@backend"

export class BackendApiClient {
  private readonly baseUrl = "/api"

  public async getGames(): Promise<Game[]> {
    const response = await fetch(`${this.baseUrl}/games`, { method: "GET" })
    const body = await response.json()

    return body.games
  }

  public async getGame({ gameId }: { gameId: number }): Promise<Game> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}`, { method: "GET" })
    const body = await response.json()

    return body.game
  }
}
