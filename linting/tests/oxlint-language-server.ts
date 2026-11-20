import { spawn } from "node:child_process"
import { once } from "node:events"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { MessagePort, parentPort, workerData } from "node:worker_threads"
import {
  createProtocolConnection,
  DiagnosticRefreshRequest,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DocumentDiagnosticReportKind,
  DocumentDiagnosticRequest,
  ExitNotification,
  InitializedNotification,
  InitializeRequest,
  type ProtocolConnection,
  ShutdownRequest,
} from "vscode-languageserver-protocol/node"

const root = new URL("../..", import.meta.url)
const oxlint = fileURLToPath(new URL("./bin/oxlint", import.meta.resolve("oxlint/package.json")))
const languageIds = new Map([
  [".js", "javascript"],
  [".cjs", "javascript"],
  [".mjs", "javascript"],
  [".jsx", "javascriptreact"],
  [".tsx", "typescriptreact"],
])

export type LintRequest = {
  filePath: string
  code: string
  completed: Int32Array
}

const port: unknown = workerData
if (!(port instanceof MessagePort) || parentPort === null) {
  throw new Error("Oxlint language server worker requires a message port")
}

await runOxlint(port, parentPort)

async function runOxlint(port: MessagePort, ready: MessagePort): Promise<void> {
  const child = spawn(process.execPath, [oxlint, "--lsp"], { cwd: fileURLToPath(root), windowsHide: true })
  const connection = createProtocolConnection(child.stdout, child.stdin)
  let stderr = ""
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-4000)
  })
  connection.onClose(() => {
    connection.dispose()
  })

  try {
    await initialize(connection)
    await serveRequests(connection, port, ready)
    await connection.sendRequest(ShutdownRequest.type)
    await connection.sendNotification(ExitNotification.type)
  } catch (cause) {
    throw new Error(`Oxlint language server failed.\n${stderr}`, { cause })
  } finally {
    connection.dispose()
    child.stdin.end()
    if (child.exitCode === null && child.signalCode === null) {
      await once(child, "close", { signal: AbortSignal.timeout(2000) }).catch(() => child.kill())
    }
  }
}

async function initialize(connection: ProtocolConnection): Promise<void> {
  connection.onRequest(DiagnosticRefreshRequest.type, () => undefined)
  connection.listen()
  const { capabilities } = await connection.sendRequest(InitializeRequest.type, {
    processId: process.pid,
    rootUri: root.href,
    workspaceFolders: [{ uri: root.href, name: "Cosmic Empires" }],
    capabilities: { textDocument: { diagnostic: {} }, workspace: { diagnostics: { refreshSupport: true } } },
  })
  if (capabilities.diagnosticProvider === undefined) {
    throw new Error("Oxlint language server did not advertise document diagnostics")
  }
  await connection.sendNotification(InitializedNotification.type, {})
}

async function serveRequests(connection: ProtocolConnection, port: MessagePort, ready: MessagePort): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    port.on("message", (request: LintRequest) => {
      replyWithDiagnostics(connection, port, request).catch(reject)
    })
    port.once("close", resolve)
    ready.postMessage("ready", [])
  })
}

async function replyWithDiagnostics(connection: ProtocolConnection, port: MessagePort, request: LintRequest): Promise<void> {
  try {
    port.postMessage(await lintDocument(connection, request))
  } catch (cause) {
    port.postMessage(new Error(`Oxlint language server failed to lint ${request.filePath}`, { cause }))
  } finally {
    Atomics.store(request.completed, 0, 1)
    Atomics.notify(request.completed, 0)
  }
}

async function lintDocument(connection: ProtocolConnection, { filePath, code }: LintRequest): Promise<string[]> {
  const uri = pathToFileURL(filePath).href
  const languageId = languageIds.get(path.extname(filePath)) ?? "typescript"
  await connection.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: { uri, languageId, version: 1, text: code } })

  try {
    const report = await connection.sendRequest(DocumentDiagnosticRequest.type, { textDocument: { uri } })
    if (report.kind !== DocumentDiagnosticReportKind.Full) {
      throw new Error(`Expected a full diagnostic report for ${filePath}`)
    }
    return report.items.map(({ code, message }) => {
      if (typeof code !== "string") {
        const text = typeof message === "string" ? message : message.value
        throw new Error(`Oxlint reported a diagnostic without a code for ${filePath}: ${text}`)
      }
      return code
    })
  } finally {
    await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri } })
  }
}
