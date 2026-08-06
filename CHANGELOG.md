# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
