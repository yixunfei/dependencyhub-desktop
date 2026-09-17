# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `npm run verify:i18n` now also runs a hardcoded-CJK ratchet backed by
  `scripts/i18n-cjk-baseline.json`: no file may exceed its recorded count and no
  new file may introduce hardcoded CJK, so the untranslated backlog can only
  shrink. `--update` tightens the baseline and refuses to raise a value.
- `shared/workspaceKinds.ts` becomes the single source of truth for the
  `WorkspaceKind` union. The renderer previously declared 35 of the 57 kinds the
  discovery service produces; the two lists are now one, so drift is impossible
  rather than merely discouraged.
- `translate()` and `useT()` accept `{name}` parameters. `useT()` is memoized on
  the language, so `t` keeps a stable identity and can safely appear in a
  dependency array.

- AI dependency ecosystem group with three preview managers: **MCP Servers**,
  **Agent Skills**, and **Agent Rules & Prompts**, reachable from the new
  `/ai` workspace.
  - MCP inventory reads `.mcp.json`, `mcp.json`, `.cursor/mcp.json`,
    `.vscode/mcp.json`, `.workbuddy-ai/mcp.json`, `.claude/mcp.json`, and
    `claude_desktop_config.json`, including JSON-with-comments support.
  - Skills inventory scans `SKILL.md` files in every skill root and validates
    frontmatter, description length, duplicate names, and script/`allowed-tools`
    consistency.
  - Agent inventory classifies `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`,
    `.github/copilot-instructions.md`, `.github/instructions/*`, and
    `*/agents/*.md` files, and reports empty or frontmatter-less definitions.
- DependencyHub-managed lock evidence for AI dependencies (`mcp-lock.json`,
  `skills.lock.json`, `agents.lock.json`) recording source, version, and content
  hash, plus drift and stale-entry detection.
- Local AI dependency engine: `sync`, `install`, `remove`, `audit`, `tree`,
  `list`, and `lock` run without a package-manager CLI. Read-only operations
  re-scan the project; mutations rewrite manifests or lock files atomically
  behind a restorable backup and roll back on failure. AI managers refuse
  arbitrary custom commands instead of reporting a faked success.
- `npm run verify:ai-managers` covering inventory, plans, health findings, lock
  writes, dry-run no-write, declaration mutations, backup restore, failure
  rollback, and the governance integrations below; wired into the framework
  verification runner as the `ai` group.
- AI dependencies now flow through the existing governance chains:
  - SBOM exports (CycloneDX and SPDX) include MCP servers, skills, and agent
    instructions with `pkg:generic/mcp-server`, `pkg:generic/agent-skill`, and
    `pkg:generic/agent-instruction` package URLs.
  - Workspace discovery recognises AI markers, reporting an AI-only manifest
    directory as the new `ai-project` kind while a directory that also ships a
    language manifest keeps that ecosystem as its primary kind.
  - The lockfile drift report raises warning-level `missing-lockfile` findings
    for AI ecosystems that declare inputs without lock evidence.
- `npm run verify:i18n` (framework runner group `i18n`) guards the renderer
  dictionary: en-US/zh-CN key parity, duplicate keys that silently override each
  other, empty translations, and `t()` call sites that do not resolve.
- The framework runner now fails when a verification group is missing from
  `.github/workflows/quality.yml`, so a new group cannot pass locally and never
  run in CI. `legacy` stays deliberately excluded as the full regression.

### Changed
- The dictionary moved to `src/i18n/dictionaries.ts` and the literal fallback map
  to `src/i18n/literals.ts`; `src/i18n.ts` keeps the API. The dictionary had
  reached 1,522 lines and would have kept growing with every localization batch,
  and the 1,500-line engineering-debt limit is enforced, so it had to be split
  before any more keys could be added.
- The toolchain screens (global panel, project panel, status modal, and the
  `ToolVersions` page), the package modals (search card, list item, conflict,
  batch preview, detail, dependency tree, dependency health, security audit,
  version picker, tree viewer), the dependency-health reminder hook, and the
  language gate now resolve their copy through the dictionary. 13 renderer files
  cleared, 1,561 hardcoded CJK characters removed (9,100 -> 7,539).
- `useT()` is memoized on the language, so `t` keeps a stable identity between
  renders and can be listed in a dependency array without re-running the memo
  every render.
- Extended manager registry now declares 57 extended managers (was 54), and the
  AI managers are classified as declarative integrations.
- `ExtendedManagerWorkspace` accepts `customCommands: false` to hide quick and
  custom command affordances for managers that are executed locally.
- The Skills detection pattern now matches the standard `skills/<name>/SKILL.md`
  layout instead of only `skills/SKILL.md`, so skills are detected in ordinary
  repositories.
- `existingPatternMatches`, `readdirSafe`, and `wildcardToRegExp` moved to
  `electron/managers/patternFiles.ts`; the extended manager service and the
  supply chain previously carried byte-identical private copies.
- The sidebar and the `/workspace` landing page now render through the renderer
  dictionary instead of hardcoded Chinese, so an English-default install no
  longer shows Chinese section headings and buttons.
- The workspace landing page reuses the shared `ProjectPathBar` instead of its
  own directory picker, so the recent-directory dropdown, full-path tooltip, and
  history clearing work identically everywhere.

### Fixed
- `channelLabel` returned the Chinese label `预览版` for an unknown prerelease
  channel, so an English install showed Chinese inside the version picker
  tooltip. It now resolves the generic channel through the dictionary.
- `formatShortDate` hardcoded the `zh-CN` locale, so dates were formatted with
  Chinese conventions regardless of the interface language. It takes a locale and
  the two call sites pass the active language. `PackageDetailModal` did the same
  with long month names and is fixed alongside it.
- The renderer declared 35 of the 57 `WorkspaceKind` values the discovery service
  can produce, so 22 kinds had no renderer-side representation. Both sides now
  read the shared union.
- The workspace landing page rendered the current directory as a raw absolute
  path with no truncation and no tooltip; it now uses the shared path bar.
- Npm project actions (`install`, `check updates`, `update all`, `audit`,
  `dependency tree`, `refresh`, `open package.json`) stayed clickable with no
  project selected and failed against an empty path. They are now disabled, so
  the empty state points at the select-directory action instead.
- Removed the duplicated directory-selection handler and the now-unused
  `pathLabel`/`pathValue` styles from the workspace landing page.

## [1.0.3] - 2026-09-17

### Fixed
- Prevent deadlocks in nested project mutations and serialize competing writes.
- Stop command process trees on cancellation, timeout, or output overflow before
  restoring project files; preserve failure and recovery details through Electron IPC.
- Reject stale inventory, operation plan, restore, and health report responses after
  project changes, and support independent retries for failed health reports.
- Fix empty-project rendering, manifest watching, and manager capability detection.
- Propagate build and packaging failures and select native package formats correctly.
  The all-platform release command now requests every platform explicitly.
- Use a supported PNG packaging icon and read the About version from app metadata.
- Restrict privileged window navigation to the application document or exact development origin.

### Changed
- Split health-center actions and panels by responsibility; add regression checks
  for concurrency, IPC, release scripts, and engineering debt in CI.
- Update Electron, Vite, electron-builder, routing, and transitive dependencies.
- Require Node.js 22.12 or newer for development.

## [1.0.2] - 2026-08-06

### Changed
- Renamed the desktop product to **DependencyHub Desktop** to reflect its
  multi-ecosystem project dependency and engineering governance scope.
- Updated package metadata, Electron app identity, GitHub links, installer
  naming, About dialog text, README, and contributor documentation.
- Changed the distributable package name to `dependencyhub-desktop` while
  retaining the existing `.npmDesktopManager` project data directory for
  non-destructive local state continuity.

## [1.0.1] - 2026-08-06

### Added
- Unified project workspace with manifest and lockfile discovery.
- Built-in dependency managers for npm, pip, Maven, Gradle, Cargo, Go Modules,
  Flutter pub, and C/C++ projects using CMake, vcpkg, or Conan.
- Cross-ecosystem search, dependency health dashboards, lockfile drift checks,
  registry reachability, workspace governance, and extended ecosystem discovery.
- Supply-chain policy evaluation, audit evidence, CI evidence, release approvals,
  release exceptions, rollback planning, integrity verification, signatures,
  provenance attestations, and production readiness gates.
- Project/global toolchain overrides, plugin catalog improvements, operation
  history, and safer credential storage and usage tracking.
- Framework, release-integrity, release-signature, and release-trust verification
  scripts.

### Changed
- Reorganized the renderer around domain and feature modules with lazy-loaded
  manager routes.
- Expanded the product positioning from an npm-only desktop utility to a
  multi-ecosystem project dependency management platform.
- Rewrote the bilingual README with release downloads, screenshots, workflow
  comparisons, reproducible performance checks, and troubleshooting guidance.
- Updated the desktop stack to Electron 42, React 19, TypeScript 6, Ant Design 6,
  Vite 8, and Zustand 5.

### Security
- Added release readiness checks and explicit handling for credentials,
  dependency policies, registry failures, CI evidence, approvals, and release
  artifact trust.

## [1.0.0] - 2024-01-XX

### Added
- Package search with detailed information
- Project dependency management (install, uninstall, update)
- Global dependency management
- Publish to npm or private registry
- Security vulnerability scanning and fixing
- Dependency tree visualization
- Version management for packages
- Light and dark theme support
- npm configuration editor
- Cache management
- File watcher for package.json changes
- Detailed package information modal
- Download statistics and dependency information

### Technical Details
- Built with Electron 28+
- React 18 with TypeScript
- Ant Design 5.x UI components
- Zustand for state management
- Vite 5 for fast development and building
- electron-builder for cross-platform packaging
