#!/bin/sh

# Keeps the pnpm version in mise.toml synced with packageJson.devEngines.packageManager.version
version=$(jq -r '.devEngines.packageManager.version' package.json)
sed -i "s/^pnpm = .*/pnpm = \"$version\"/" mise.toml

git add mise.toml
