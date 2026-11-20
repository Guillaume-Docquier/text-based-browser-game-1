import { once } from "node:events"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MessageChannel, type MessagePort, receiveMessageOnPort, Worker } from "node:worker_threads"
import { afterAll, beforeAll } from "vitest"
import type { LintRequest } from "./oxlint-language-server.ts"

const repositoryRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))
const timeoutMs = 15_000

type LintFixture = {
  code: string
  path?: string
}

type Session = {
  worker: Worker
  port: MessagePort
  failure?: Error
}

let session: Session | undefined

beforeAll(async () => {
  const { port1, port2 } = new MessageChannel()
  const worker = new Worker(new URL("./oxlint-language-server.ts", import.meta.url), {
    workerData: port2,
    transferList: [port2],
  })
  const active: Session = { worker, port: port1 }
  session = active
  worker.on("error", (cause) => {
    active.failure = cause instanceof Error ? cause : new Error("Oxlint language server worker failed", { cause })
  })
  worker.on("exit", (code) => {
    active.failure ??= new Error(`Oxlint language server worker exited with code ${code}`)
  })
  await once(worker, "message", { signal: AbortSignal.timeout(timeoutMs) })
}, timeoutMs * 2)

afterAll(async () => {
  if (session === undefined) {
    return
  }

  const { worker, port } = session
  session = undefined
  const exited = worker.threadId === -1 ? undefined : once(worker, "exit", { signal: AbortSignal.timeout(timeoutMs) })
  port.close()
  try {
    await exited
  } finally {
    await worker.terminate()
  }
}, timeoutMs * 2)

export function lint({ code, path: fixturePath = "fixture.ts" }: LintFixture): string[] {
  if (session === undefined) {
    throw new Error("Oxlint language server has not started")
  }
  if (session.failure !== undefined) {
    throw session.failure
  }

  const filePath = path.resolve(repositoryRoot, fixturePath)
  if (!filePath.startsWith(repositoryRoot + path.sep)) {
    throw new Error(`Expected a fixture path inside the repository, received ${fixturePath}`)
  }

  // INTENT: Wait for the worker so test bodies can keep using the synchronous lint API.
  const completed = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
  session.port.postMessage({ filePath, code, completed } satisfies LintRequest, [])
  if (Atomics.wait(completed, 0, 0, timeoutMs) === "timed-out") {
    session.failure = new Error(`Oxlint language server timed out linting ${fixturePath}`)
    throw session.failure
  }

  const response: unknown = receiveMessageOnPort(session.port)?.message
  return diagnosticCodes(response, fixturePath)
}

function diagnosticCodes(response: unknown, fixturePath: string): string[] {
  if (response instanceof Error) {
    throw response
  }
  if (Array.isArray(response) && response.every((code): code is string => typeof code === "string")) {
    return response
  }
  throw new Error(`Oxlint language server did not return diagnostic codes for ${fixturePath}`)
}
