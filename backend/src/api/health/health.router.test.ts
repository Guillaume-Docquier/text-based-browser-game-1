import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"

it("should return an empty successful health check", async () => {
  // Arrange
  const { api } = await createApiStub()
  const server = createServer(api)
  server.listen(0)

  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
    const address = server.address() as AddressInfo

    // Act
    const response = await fetch(`http://127.0.0.1:${address.port}/health`)

    // Assert
    expect({
      status: response.status,
      body: await response.text(),
    }).toEqual({
      status: 200,
      body: "",
    })
  } finally {
    server.closeAllConnections()
  }
})
