import path from "node:path"
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import type { RuleTester } from "oxlint/plugins-dev"

type OxlintRule = Parameters<RuleTester["run"]>[1]
type Visitors = ReturnType<NonNullable<OxlintRule["create"]>>
type ImportSource = Parameters<NonNullable<Visitors["ImportDeclaration"]>>[0]["source"]
type Project = (typeof projectNames)[number]

const packagesDirectory = path.resolve(import.meta.dirname, "../../packages")
const projectNames = ["backend", "frontend", "shared"] as const
const contractAlias = "@api-types"
const contractFile = path.join(packagesDirectory, "backend/src/api/types.ts")
const contractImportMessage = 'Use import type { ... } from "@api-types" to import named backend contracts.'

const resolvers = {
  backend: createResolver("backend/tsconfig.json"),
  frontend: createResolver("frontend/tsconfig.app.json"),
  shared: createResolver("shared/tsconfig.package.json"),
} satisfies Record<Project, ReturnType<typeof createTypeScriptImportResolver>>

export const workspaceBoundaries = {
  create(context): Visitors {
    const importer = context.physicalFilename
    const importerProject = projectAt(importer)
    if (importerProject === undefined) {
      return {}
    }

    const checkImport = (source: ImportSource, isNamedTypeImport = false): void => {
      const specifier = source.value
      if (specifier === contractAlias) {
        if (importerProject !== "frontend") {
          context.report({ node: source, message: 'The "@api-types" alias is reserved for the frontend.' })
        } else if (!isNamedTypeImport || resolvers.frontend.resolve(specifier, importer).path !== contractFile) {
          context.report({ node: source, message: contractImportMessage })
        }
        return
      }

      const targetProject = importedProject(specifier, importer, importerProject)
      if (targetProject === undefined || targetProject === importerProject || targetProject === "shared") {
        return
      }

      const message =
        importerProject === "frontend"
          ? contractImportMessage
          : `The ${importerProject} project cannot import from the ${targetProject} project.`
      context.report({ node: source, message })
    }

    return {
      ImportDeclaration(node): void {
        const isNamedTypeImport =
          node.importKind === "type" &&
          node.specifiers.length > 0 &&
          node.specifiers.every((specifier) => specifier.type === "ImportSpecifier")
        checkImport(node.source, isNamedTypeImport)
      },
      ExportNamedDeclaration(node): void {
        if (node.source !== null) {
          checkImport(node.source)
        }
      },
      ExportAllDeclaration(node): void {
        checkImport(node.source)
      },
      TSImportType(node): void {
        checkImport(node.source)
      },
      TSExternalModuleReference(node): void {
        checkImport(node.expression)
      },
    }
  },
} satisfies OxlintRule

function createResolver(tsconfig: string): ReturnType<typeof createTypeScriptImportResolver> {
  return createTypeScriptImportResolver({
    alwaysTryTypes: false,
    tsconfig: { configFile: path.join(packagesDirectory, tsconfig) },
  })
}

function projectAt(filename: string): Project | undefined {
  const [directory] = path.relative(packagesDirectory, filename).split(path.sep, 1)
  return projectNames.find((project) => directory === project)
}

function importedProject(specifier: string, importer: string, importerProject: Project): Project | undefined {
  if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
    const directProject = projectAt(path.resolve(path.dirname(importer), specifier))
    if (directProject !== undefined && directProject !== importerProject) {
      return directProject
    }
  }

  const [packageName] = specifier.split("/", 1)
  const workspacePackage = projectNames.find((project) => packageName === project)
  if (workspacePackage !== undefined) {
    return workspacePackage
  }

  const resolution = resolvers[importerProject].resolve(specifier, importer)
  return typeof resolution.path === "string" ? projectAt(resolution.path) : undefined
}
