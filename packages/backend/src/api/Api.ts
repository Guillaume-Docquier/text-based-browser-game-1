import { once } from "node:events"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { FatalError } from "@guillaume-docquier/tools-ts"
import type { Express } from "express"

type ListenCallback = (error?: Error) => void
type TcpListenArgs =
  | [port: number, hostname: string, backlog: number, callback?: ListenCallback]
  | [port: number, hostname: string, callback?: ListenCallback]
  | [port: number, backlog: number, callback?: ListenCallback]
  | [port: number, callback?: ListenCallback]
type ListenArgs =
  | TcpListenArgs
  | [callback?: ListenCallback]
  | [path: string, callback?: ListenCallback]
  | [handle: object, callback?: ListenCallback]

type StartUpdates = (signal: AbortSignal) => { ready: Promise<void>; stopped: Promise<void> }

export class Api {
  private readonly server: Server
  private readonly lifetime: AbortController
  private readonly startUpdates: StartUpdates
  private updatesStopped: Promise<void> | undefined
  private closed: Promise<void> | undefined

  public constructor({ app, lifetime, startUpdates }: { app: Express; lifetime: AbortController; startUpdates: StartUpdates }) {
    this.server = createServer((request, response) => {
      if (lifetime.signal.aborted) {
        response.writeHead(503, { Connection: "close" }).end()
        return
      }
      app(request, response)
    })
    this.lifetime = lifetime
    this.startUpdates = startUpdates
    this.server.once("close", () => {
      this.lifetime.abort()
    })
  }

  public async listen(...args: TcpListenArgs): Promise<AddressInfo>
  public async listen(...args: ListenArgs): Promise<AddressInfo | string>
  public async listen(...args: ListenArgs): Promise<AddressInfo | string> {
    const { signal } = this.lifetime
    signal.throwIfAborted()
    if (this.updatesStopped !== undefined) {
      throw new FatalError("The API has already started", {})
    }

    const { ready, stopped } = this.startUpdates(signal)
    this.updatesStopped = stopped
    const lastArgument = args.at(-1)
    const callback = typeof lastArgument === "function" ? lastArgument : undefined
    const bindArguments = callback === undefined ? args : args.slice(0, -1)

    let address: AddressInfo | string
    try {
      await Promise.race([
        ready,
        stopped.then(() => {
          signal.throwIfAborted()
          throw new FatalError("Turn state updates stopped before becoming ready", {})
        }),
      ])
      signal.throwIfAborted()
      Reflect.apply(this.server.listen.bind(this.server), undefined, bindArguments)
      await once(this.server, "listening", { signal })
      const boundAddress = this.server.address()
      if (boundAddress === null) {
        throw new FatalError("The API server did not bind an address", {})
      }
      address = boundAddress
    } catch (error) {
      await Promise.allSettled([this.close()])
      if (Error.isError(error)) {
        callback?.(error)
      }
      throw error
    }

    callback?.()
    return address
  }

  public async close(): Promise<void> {
    if (this.closed === undefined) {
      const serverClosed = new Promise<void>((resolve, reject) => {
        this.server.close((error) => {
          if (error !== undefined && !("code" in error && error.code === "ERR_SERVER_NOT_RUNNING")) {
            reject(error)
            return
          }
          resolve()
        })
      })
      this.closed = Promise.all([serverClosed, this.updatesStopped]).then(() => undefined)
      this.lifetime.abort()
    }

    await this.closed
  }
}
