# Development & Release Guide

All commands and procedures needed to develop, test, package, and publish the On Note extension.

> Package manager is **pnpm**. Do not use `npm` or `yarn`.

---

## 1. Environment Setup

```bash
pnpm install
```

Open this folder in VS Code and press **F5** to launch the **Extension Development Host** for manual testing. `.vscode/launch.json` loads [dist/extension.js](dist/extension.js), so **the first time** you must run `pnpm run compile` (or `pnpm run watch`) at least once to produce `dist/`.

---

## 2. Day-to-day Development

| Command | Purpose |
|---|---|
| `pnpm run watch` | Runs `esbuild --watch` + `tsc --watch --noEmit` in parallel. Keep this running while you code — every save triggers an incremental rebuild. |
| `pnpm run watch:esbuild` | Bundle-only watch (skips type-checking, fastest feedback). |
| `pnpm run watch:tsc` | Type-check-only watch (no bundling). |
| `pnpm run compile` | One-shot: type-check → lint → esbuild. Use when you just want a single clean build. |
| `pnpm run check-types` | `tsc --noEmit` type check only. |
| `pnpm run lint` | Biome lint + auto-format (`biome check --write src`). |

### Why there are two build pipelines

This project runs **esbuild** and **tsc** side by side on purpose:

- **esbuild** ([esbuild.js](esbuild.js)) bundles [src/extension.ts](src/extension.ts) and [src/webview/editor.ts](src/webview/editor.ts) into `dist/extension.js` and `dist/webview.js`. This is what ships.
- **tsc** ([tsconfig.json](tsconfig.json)) compiles the same sources to `out/` purely for the test runner. `@vscode/test-cli` loads tests from [out/test/**/*.test.js](out/test) and never goes through esbuild.

Do **not** collapse these two flows — changing `tsconfig` `rootDir` or esbuild `entryPoints`/`outfile` will break one or the other. See [CLAUDE.md](CLAUDE.md).

---

## 3. Testing

```bash
pnpm test
```

The `pretest` hook automatically runs `compile-tests` (tsc → `out/`) + `compile` (esbuild → `dist/`) + `lint`. Tests then execute inside a **real VS Code instance** via mocha, picking up the files declared in [.vscode-test.mjs](.vscode-test.mjs) (`out/test/**/*.test.js`).

### Running a single test

There is no dedicated npm script. Use mocha's `--grep`:

```bash
pnpm run compile-tests
npx vscode-test --grep "validateNoteName"
```

### Test file locations

- [src/test/extension.test.ts](src/test/extension.test.ts) — mocha `suite` / `test` style.

---

## 4. Production Build

```bash
pnpm run package
```

Runs `check-types` → `lint` → `esbuild --production` (minified, no source maps). Output lands in [dist/](dist/). The `vsce:package` script wraps this output into the final `.vsix`, so **this command must succeed before you publish**.

---

## 5. Packaging (.vsix)

```bash
pnpm run vsce:package
```

Produces `on-note-<version>.vsix` in the project root. The `--no-dependencies` flag is built in, which keeps `vsce` compatible with pnpm's non-flat `node_modules` layout.

### Preview the package contents

```bash
npx vsce ls --no-dependencies
```

Lists every file that would be included **without actually packaging**. The output should only contain:

- `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`
- `dist/extension.js`, `dist/webview.js`
- `media/on-note-icon.png`, `media/on-note.svg`, `media/on-note-color.svg`

If you see `src/`, `node_modules/`, `CLAUDE.md`, `pnpm-lock.yaml`, or anything else leak in, add the offender to [.vscodeignore](.vscodeignore).

### Install the .vsix locally

```bash
code --install-extension on-note-0.0.1.vsix
```

Or run **Extensions: Install from VSIX...** from the Command Palette. After installing, verify that the On Note view appears in the activity bar and that all four commands (`New/Open/Rename/Delete Note`) work end-to-end.

---

## 6. Bumping the Version

Bump the version before publishing (follow SemVer):

```bash
# patch (0.0.1 → 0.0.2) — bug fixes
pnpm version patch

# minor (0.0.1 → 0.1.0) — new features, backwards compatible
pnpm version minor

# major (0.0.1 → 1.0.0) — breaking changes
pnpm version major
```

`pnpm version` updates `package.json`'s `version`, creates a git commit, and tags it as `v<version>` automatically.

Then:

1. Add a new section to [CHANGELOG.md](CHANGELOG.md) summarizing the changes.
2. Commit the CHANGELOG update.
3. `git push && git push --tags`.

---

## 7. Publishing to the VS Code Marketplace

### One-time setup: Publisher

1. Go to https://marketplace.visualstudio.com/manage and create the publisher **`stocel`** with an Azure DevOps account.
2. At https://dev.azure.com/ → **User Settings → Personal Access Tokens**, issue a PAT:
   - **Organization**: *All accessible organizations*
   - **Scopes**: *Custom defined* → **Marketplace → Manage** checked
3. Store the token locally:

```bash
npx vsce login stocel
# paste the PAT when prompted
```

### Publish

```bash
pnpm run vsce:publish
```

The `vscode:prepublish` hook runs `pnpm run package` first, so every publish uses a fresh production build.

### Bump and publish in one step

```bash
npx vsce publish patch --no-dependencies   # 0.0.1 → 0.0.2 and publish
npx vsce publish minor --no-dependencies
npx vsce publish major --no-dependencies
```

This skips `pnpm version` and lets `vsce` bump + publish atomically. You still need to create the git tag manually.

### Dry run (optional)

```bash
npx vsce package --no-dependencies
# upload the resulting .vsix via the Marketplace UI to smoke-test
```

---

## 8. Publishing to Open VSX (VSCodium, Cursor, Gitpod, ...)

### One-time setup: namespace and token

1. Sign in at https://open-vsx.org/ with your GitHub account.
2. Go to **User Settings → Access Tokens** and issue a token.
3. Create the namespace (must match the publisher ID):

```bash
npx ovsx create-namespace stocel -p <OVSX_TOKEN>
```

### Publish

```bash
pnpm run ovsx:publish -p <OVSX_TOKEN>
```

Or upload a pre-built `.vsix`:

```bash
npx ovsx publish on-note-0.0.1.vsix --no-dependencies -p <OVSX_TOKEN>
```

### Using an environment variable

Instead of passing `-p` every time:

```bash
export OVSX_PAT=<OVSX_TOKEN>
pnpm run ovsx:publish
```

---

## 9. Full Release Checklist

Run through this list before every public release:

1. `git status` — working tree clean.
2. Add a new section to [CHANGELOG.md](CHANGELOG.md).
3. `pnpm run package` — build succeeds.
4. `pnpm test` — all tests pass.
5. `npx vsce ls --no-dependencies` — review included files.
6. `pnpm run vsce:package` → install the generated `.vsix` locally and verify manually.
7. `pnpm version <patch|minor|major>` — bump version and tag.
8. `git push && git push --tags`.
9. `pnpm run vsce:publish` — Marketplace (takes 1–5 minutes to appear).
10. `pnpm run ovsx:publish -p $OVSX_PAT` — Open VSX.
11. Visit the Marketplace and Open VSX listings to confirm they rendered correctly.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `vsce: command not found` | Not installed globally | Use `npx vsce ...` or the `pnpm run vsce:*` scripts. |
| `vsce` fails with `ERR_INVALID_PACKAGE` | pnpm's non-flat `node_modules` | Always pass `--no-dependencies` (already built into the scripts). |
| Icon / README missing on Marketplace right after publish | CDN caching | Wait 5–10 minutes and reload. |
| `ENOENT: dist/extension.js` when pressing F5 | No initial build | Run `pnpm run compile` once. |
| `biome check` lint errors | Formatting / rule violations | Run `pnpm run lint` — it applies `--write` fixes automatically. |
| Tests can't find `out/test/...` | `compile-tests` didn't run | Just run `pnpm test`; the `pretest` hook handles it. |

---

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
