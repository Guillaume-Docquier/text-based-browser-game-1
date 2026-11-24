import { allowedComments } from "./allowed-comments.ts"
import { noRenamedImports } from "./no-renamed-imports.ts"

export default {
  meta: {
    name: "cosmic-empires",
  },
  rules: {
    "allowed-comments": allowedComments,
    "no-renamed-imports": noRenamedImports,
  },
}
