import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  createProtocolConnection,
  type Diagnostic,
  DiagnosticRefreshRequest,
  DiagnosticSeverity,
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

export class LintSession {
  private connection!: ProtocolConnection

  public async start(): Promise<void> {
    const oxlint = fileURLToPath(new URL("./bin/oxlint", import.meta.resolve("oxlint/package.json")))
    const child = spawn(process.execPath, [oxlint, "--lsp"], { cwd: root, stdio: ["pipe", "pipe", "inherit"], windowsHide: true })
    const connection = createProtocolConnection(child.stdout, child.stdin)
    this.connection = connection
    connection.onClose(() => {
      connection.dispose()
    })
    connection.onRequest(DiagnosticRefreshRequest.type, () => undefined)
    connection.listen()
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri: root.href,
      capabilities: { textDocument: { diagnostic: {} }, workspace: { diagnostics: { refreshSupport: true } } },
      workspaceFolders: [{ uri: root.href, name: "Cosmic Empires" }],
    })
    await connection.sendNotification(InitializedNotification.type, {})
  }

  public async stop(): Promise<void> {
    await this.connection.sendRequest(ShutdownRequest.type)
    await this.connection.sendNotification(ExitNotification.type)
    this.connection.end()
  }

  public async lint({ code, path: fixturePath = "fixture.ts" }: { code: string; path?: string }): Promise<Array<Diagnostic["code"]>> {
    const uri = pathToFileURL(path.resolve(fileURLToPath(root), fixturePath)).href
    const languageId = fixturePath.endsWith(".tsx") ? "typescriptreact" : "typescript"
    await this.connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId, version: 1, text: code },
    })
    try {
      const report = await this.connection.sendRequest(DocumentDiagnosticRequest.type, { textDocument: { uri } })
      assert(report.kind === DocumentDiagnosticReportKind.Full)
      return report.items.filter((diagnostic) => diagnostic.severity !== DiagnosticSeverity.Hint).map((diagnostic) => diagnostic.code)
    } finally {
      await this.connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri } })
    }
  }
}
