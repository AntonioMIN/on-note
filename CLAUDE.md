# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VS Code extension scaffold (`on-note`, "Feat and easy note taking"). Currently only a `Hello World` command exists — the note-taking feature set is not yet implemented.

## Commands

Package manager is **pnpm** (see `.npmrc` and `pnpm-lock.yaml`).

- `pnpm run compile` — type-check, lint, then one-shot esbuild bundle to `dist/extension.js`.
- `pnpm run watch` — runs `watch:esbuild` and `watch:tsc` in parallel (npm-run-all). Use this during development; F5 in VS Code launches the Extension Development Host against this output.
- `pnpm run package` — production build (`--production` → minified, no sourcemaps).
- `pnpm run check-types` — `tsc --noEmit` only.
- `pnpm run lint` — `biome check --write src` (apply lint fixes + formatter).
- `pnpm test` — runs `@vscode/test-cli` (`vscode-test`). `pretest` first runs `compile-tests` (tsc → `out/`) **and** `compile` (esbuild → `dist/`), because tests are loaded from `out/test/**/*.test.js` while the extension itself is loaded from `dist/extension.js`.
- Single test: there is no npm script — filter via mocha grep, e.g. `npx vscode-test --grep "Sample test"` after `pnpm run compile-tests`.

## Architecture

Two separate TypeScript build pipelines coexist and you need to respect the split:

1. **esbuild** (`esbuild.js`) bundles `src/extension.ts` → `dist/extension.js` as CommonJS for Node, with `vscode` marked external. This is what `package.json#main` points at and what ships.
2. **tsc** (`tsconfig.json`, `rootDir: src`) compiles the same sources to `out/` during `compile-tests`. The test runner (`.vscode-test.mjs`) only looks at `out/test/**/*.test.js`, so tests never run through esbuild.

Consequence: changing tsconfig `rootDir` or the esbuild `entryPoints`/`outfile` will break one or both flows. The `pretest` script runs both builds sequentially on purpose — don't collapse them.

Extension entry is `activate(context)` in [src/extension.ts](src/extension.ts); commands must be both registered via `vscode.commands.registerCommand` _and_ declared in `package.json#contributes.commands` to appear in the command palette.

## Toolchain notes

- Target: VS Code `^1.116.0`, Node types `22.x`, TS target ES2022 / module Node16, strict mode on.
- Biome 2.x (`biome.json`) handles both linting and formatting; the `lint` script runs `biome check`. Editor format-on-save uses the `biomejs.biome` extension (recommended in `.vscode/extensions.json`).
- `.vscodeignore` controls what gets packaged into the `.vsix` — only `dist/`, `README.md`, etc. ship; `src/` and `out/` do not.
