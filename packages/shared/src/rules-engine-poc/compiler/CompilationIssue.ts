/**
 * A recoverable authoring or submission error, located in the original input.
 */
export type CompilationIssue = Readonly<{ path: readonly PropertyKey[]; message: string }>
