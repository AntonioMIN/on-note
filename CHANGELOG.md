# Change Log

All notable changes to the "on-note" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-04-20

### Added
- Initial release.
- Sidebar webview note editor mounted in a dedicated activity bar view container.
- Note management commands: `New Note`, `Open Note`, `Rename Note`, `Delete Note` — accessible from the view title bar or the Command Palette.
- Live Markdown syntax highlighting in the editor (via Prism).
- Autosave ~500ms after the last keystroke.
- Persistent storage under the extension's `globalStorageUri`, shared across workspaces.
