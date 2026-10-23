import { defineConfig } from "lint-staged/config"

export default defineConfig({
  "*": () => "gitleaks git --staged --redact",
  "*.{md,json,yml,yaml,css,html}": "oxfmt --no-error-on-unmatched-pattern",
  "*.{js,jsx,ts,tsx}": ["oxlint --fix", "oxfmt --no-error-on-unmatched-pattern"],
})
