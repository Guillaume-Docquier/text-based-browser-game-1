import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect } from "vitest"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/auth/auth.service.ts"
import { TestHeaderAuthProvider } from "#api/auth/TestHeaderAuthProvider.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { GamesRepository } from "#api/games/games.repository.ts"
import { createCreateTransaction } from "#lib/db/createDb.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"

const outageCases = [
  { operation: "listings", message: "Game listings could not be loaded." },
  { operation: "details", message: "Game details could not be loaded." },
  { operation: "creationSettings", message: "Game creation settings could not be loaded." },
  { operation: "create", message: "Game could not be created." },
  { operation: "onboarding", message: "Onboarding could not be completed." },
  { operation: "membership", message: "Game membership could not be checked." },
  { operation: "playerView", message: "Player view could not be loaded." },
  { operation: "join", message: "Game could not be joined." },
  { operation: "leave", message: "Game could not be left." },
  { operation: "start", message: "Game could not be started." },
  { operation: "readiness", message: "Readiness could not be updated." },
  { operation: "actionSubmission", message: "Action submission could not be updated." },
] as const

describe("API error reporting", () => {
  integrationTest.for(outageCases)(
    "should report a safe server error for $operation when the database is unavailable",
    async ({ operation, message }, { db, unavailableDb }) => {
      // Arrange
      const services = await createApiStub({ db })
      using setupServer = new ApiServer(services)
      const creator = await setupServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const action = initialView.actions[0]
      Assert.isDefined(action)

      const { logger, clock } = services
      const api = await createApi({
        ...services,
        authService: new AuthService({
          logger,
          authProvider: new TestHeaderAuthProvider(),
          accountsRepository: services.accountsRepository,
        }),
        accountsRepository: new AccountsRepository({ db: unavailableDb, logger }),
        gamesRepository:
          operation === "playerView" || operation === "readiness" || operation === "actionSubmission"
            ? services.gamesRepository
            : new GamesRepository({ db: unavailableDb, logger }),
        gameplayRepository: new GameplayRepository({ db: unavailableDb, logger, clock }),
        createTransaction: createCreateTransaction(unavailableDb),
      })
      using outageServer = new ApiServer({ api, accountsRepository: services.accountsRepository })
      const player = outageServer.createClientForAccount(creator.account)
      const anonymous = await outageServer.createClient({ authenticated: false })

      // Act
      const request = (async (): Promise<unknown> => {
        switch (operation) {
          case "listings":
            return await anonymous.client.games.getListings.query()
          case "details":
            return await anonymous.client.games.getById.query({ gameId: createdGameId })
          case "creationSettings":
            return await player.client.games.getCreationSettings.query()
          case "create":
            return await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
          case "onboarding":
            return await player.client.accounts.finishOnboarding.mutate({ alias: "Nova" })
          case "membership":
          case "playerView":
            return await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
          case "join":
            return await player.client.games.join.mutate({ gameId: createdGameId })
          case "leave":
            return await player.client.games.leave.mutate({ gameId: createdGameId })
          case "start":
            return await player.client.games.startGame.mutate({ gameId: createdGameId })
          case "readiness":
            return await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: initialView.turn, isReady: true })
          case "actionSubmission":
            return await player.client.gameplay.updateActionSubmission.mutate({
              gameId: createdGameId,
              turn: initialView.turn,
              submittedActionTargets: { actionId: action.id, selectedTargets: {} },
            })
          default:
            Assert.isExhausted(operation)
            return operation
        }
      })()

      // Assert
      await expect(request).rejects.toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message })
      await expect(creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })).resolves.toStrictEqual(initialView)
    },
  )
})
