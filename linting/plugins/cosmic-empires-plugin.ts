import { allowedComments } from "./allowed-comments.ts"
import { noRenamedImports } from "./no-renamed-imports.ts"
import { workspaceBoundaries } from "./workspace-boundaries.ts"

export default {
  meta: {
    name: "cosmic-empires",
  },
  rules: {
    "allowed-comments": allowedComments,
    "no-renamed-imports": noRenamedImports,
    "workspace-boundaries": workspaceBoundaries,
  },
}
