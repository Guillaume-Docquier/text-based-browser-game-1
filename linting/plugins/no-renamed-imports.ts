import type { RuleTester } from "oxlint/plugins-dev"

type OxlintRule = Parameters<RuleTester["run"]>[1]
type RuleVisitor = ReturnType<NonNullable<OxlintRule["create"]>>

export const noRenamedImports = {
  create(context): RuleVisitor {
    return {
      ImportSpecifier(specifier): void {
        const importedName = specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name
        const localName = specifier.local.name
        if (localName === importedName) {
          return
        }

        const declaration = specifier.parent
        const source = declaration.type === "ImportDeclaration" ? declaration.source.value : ""
        const isBaseUi = source === "@base-ui/react" || source.startsWith("@base-ui/react/")
        if (isBaseUi && localName === `${importedName}Primitive`) {
          return
        }

        context.report({ node: specifier, message: "Use the exported name for named imports." })
      },
    }
  },
} satisfies OxlintRule
