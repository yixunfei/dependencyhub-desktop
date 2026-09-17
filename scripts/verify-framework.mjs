import { build } from 'esbuild'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const repoRoot = process.cwd()
const workDir = await mkdtemp(join(tmpdir(), 'npm-manager-framework-verify-'))
const outputFile = join(workDir, 'framework-verifier.mjs')

const runner = String.raw`
import { readFeatureSource } from './scripts/feature-source.mjs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { execFile as execFileCallback } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import {
  IMPLEMENTED_MANAGER_IDS,
  MANAGER_DEFINITIONS,
  getImplementedManagerDefinitions,
  getPlannedManagerDefinitions
} from './shared/managerRegistry'
import { ExtendedManagerService } from './electron/services/extendedManager'
import { CredentialVaultStore, createBase64CredentialCipher } from './electron/services/credentialVaultCore'
import { CiEvidenceService } from './electron/services/ciEvidence'
import { AuditEvidenceService } from './electron/services/auditEvidence'
import { VulnerabilityRemediationPlanService } from './electron/services/vulnerabilityRemediationPlan'
import { ReleaseApprovalService } from './electron/services/releaseApproval'
import { ReleaseExceptionService } from './electron/services/releaseException'
import { RegistryReachabilityService } from './electron/services/registryReachability'
import { CredentialUsageService } from './electron/services/credentialUsage'
import { CredentialRotationPlanService } from './electron/services/credentialRotationPlan'
import { AutomationSafetyPlanService } from './electron/services/automationSafetyPlan'
import { DependencyOwnershipPlanService } from './electron/services/dependencyOwnershipPlan'
import { PolicyAsCodePackService } from './electron/services/policyAsCodePack'
import { LockfileDriftService } from './electron/services/lockfileDrift'
import { RuntimePinningService } from './electron/services/runtimePinning'
import { OfflineCacheReadinessService } from './electron/services/offlineCacheReadiness'
import { ReleaseRiskProfileService } from './electron/services/releaseRiskProfile'
import { CiIntegrationPlanService } from './electron/services/ciIntegrationPlan'
import { DependencyAutomationPlanService } from './electron/services/dependencyAutomationPlan'
import { DependencyUpgradePlaybookService } from './electron/services/dependencyUpgradePlaybook'
import { DependencyRollbackPlanService } from './electron/services/dependencyRollbackPlan'
import { DependencyImpactAnalysisService } from './electron/services/dependencyImpactAnalysis'
import { DependencyChangeApprovalPacketService } from './electron/services/dependencyChangeApprovalPacket'
import { DependencyChangeCalendarService } from './electron/services/dependencyChangeCalendar'
import { DependencyChangeExecutionRecordService } from './electron/services/dependencyChangeExecutionRecord'
import { WorkspaceDiscoveryService } from './electron/services/workspaceDiscovery'
import { WorkspaceGovernanceService } from './electron/services/workspaceGovernance'
import { DependencyHealthDashboardService } from './electron/services/dependencyHealthDashboard'
import { ReportArtifactIndexService } from './electron/services/reportArtifactIndex'
import { ReleaseEvidenceCompletenessService } from './electron/services/releaseEvidenceCompleteness'
import { ReleaseProvenanceAttestationService } from './electron/services/releaseProvenanceAttestation'
import { ReleaseIntegrityVerificationService } from './electron/services/releaseIntegrityVerification'
import { ReleaseSignatureService } from './electron/services/releaseSignature'
import { ReleaseTrustPolicyService } from './electron/services/releaseTrustPolicy'
import { FrameworkCoverageService } from './electron/services/frameworkCoverage'
import {
  classifyOperationHistoryRecord,
  exportOperationHistory,
  listOperationHistory,
  recordOperationHistory
} from './electron/services/operationHistory'
import { SupplyChainService } from './electron/services/supplyChain'
import { ThirdPartyNoticesService } from './electron/services/thirdPartyNotices'
import { DEFAULT_READINESS_POLICY, ReadinessGateService } from './electron/services/readinessGate'

const checks: string[] = []
const phaseStartedAt = new Map<string, number>()
const phaseDurations: Array<{ phase: string; durationMs: number }> = []
  const execFile = promisify(execFileCallback)

  async function timedList(service: ExtendedManagerService, projectPath: string, managerId: string) {
    const startedAt = Date.now()
    console.log('[legacy:extended-list] start ' + managerId)
    const result = await service.list(projectPath, managerId as any)
    console.log('[legacy:extended-list] done ' + managerId + ' ' + (Date.now() - startedAt) + 'ms')
    return result
  }

function phaseStart(name: string) {
  phaseStartedAt.set(name, Date.now())
  console.log('[legacy:' + name + '] start')
}
function phaseEnd(name: string) {
  const started = phaseStartedAt.get(name)
  if (!started) return
  const durationMs = Date.now() - started
  phaseDurations.push({ phase: name, durationMs })
  console.log('[legacy:' + name + '] done ' + durationMs + 'ms')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
  checks.push(message)
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8')
}

async function createFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'dependency-hub-fixture-'))
  await writeJson(join(cwd, 'package.json'), {
    name: 'fixture-app',
    version: '1.0.0',
    packageManager: 'npm@10.0.0',
    engines: { node: '>=22 <23' },
    workspaces: ['apps/*'],
    dependencies: { react: '^19.0.0' },
    devDependencies: { vite: '^8.0.0' }
  })
  await writeFile(join(cwd, '.nvmrc'), '22.13.0\n', 'utf-8')
  await writeJson(join(cwd, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      '': { name: 'fixture-app', version: '1.0.0' },
      'node_modules/react': { version: '19.2.0', license: 'MIT' },
      'node_modules/vite': { version: '8.0.13', license: 'MIT' }
    }
  })
  await mkdir(join(cwd, 'apps', 'admin'), { recursive: true })
  await writeJson(join(cwd, 'apps', 'admin', 'package.json'), {
    name: '@fixture/admin',
    version: '1.0.0',
    dependencies: { antd: '^6.0.0' }
  })
  await mkdir(join(cwd, 'packages', 'web'), { recursive: true })
  await writeJson(join(cwd, 'packages', 'web', 'package.json'), {
    name: '@fixture/web',
    version: '1.1.0',
    dependencies: { react: '^19.0.0' }
  })
  await writeFile(join(cwd, 'pnpm-workspace.yaml'), [
    'packages:',
    "  - 'packages/*'"
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '.npmrc'), [
    'registry=https://registry.example.test/npm/',
    '@private:registry=https://down.example.test/npm/',
    '@corp:registry=https://registry.internal/npm/'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, '.github'), { recursive: true })
  await writeFile(join(cwd, '.github', 'CODEOWNERS'), [
    '/package.json @org/platform',
    '/package-lock.json @org/platform',
    '/requirements.txt @org/python',
    '/pyproject.toml @org/python',
    '/packages/web/ @org/web',
    '/java/service/ @org/backend',
    '/go/services/api/ @org/backend',
    '/Dockerfile @org/platform',
    '/Chart.yaml @org/platform'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, '.github', 'workflows'), { recursive: true })
  await writeFile(join(cwd, '.github', 'workflows', 'ci.yml'), [
    'name: verifier-ci',
    'on: [push]',
    'jobs:',
    '  test:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v5.1.0',
    '      - uses: actions/setup-python@main',
    '      - uses: docker/build-push-action@v6'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '.gitlab-ci.yml'), [
    'include:',
    '  - project: devops/templates',
    '    ref: v2.3.0',
    '    file: node.yml',
    '  - template: Jobs/SAST.gitlab-ci.yml',
    '  - component: gitlab.com/components/secret-detection@1.2.0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '.pre-commit-config.yaml'), [
    'repos:',
    '  - repo: https://github.com/pre-commit/pre-commit-hooks',
    '    rev: v4.6.0',
    '    hooks:',
    '      - id: trailing-whitespace',
    '  - repo: https://github.com/astral-sh/ruff-pre-commit',
    '    rev: v0.5.0',
    '    hooks:',
    '      - id: ruff',
    '  - repo: https://github.com/example/floating-hooks',
    '    rev: master',
    '    hooks:',
    '      - id: floating-hook'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'MODULE.bazel'), [
    'module(name = "fixture_bazel", version = "0.1.0")',
    'bazel_dep(name = "rules_jvm_external", version = "6.3")',
    'bazel_dep(name = "rules_python", version = "0.36.0")',
    'archive_override(',
    '  module_name = "rules_fixture",',
    '  urls = ["https://example.test/rules_fixture-1.2.3.tar.gz"],',
    ')'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'MODULE.bazel.lock'), '{"lockFileVersion": 1}\n', 'utf-8')
  await writeFile(join(cwd, 'WORKSPACE.bazel'), [
    'load("@rules_jvm_external//:defs.bzl", "maven_install")',
    'maven_install(',
    '  artifacts = ["com.google.guava:guava:33.0.0-jre"],',
    ')',
    'http_archive(',
    '  name = "rules_java",',
    '  urls = ["https://github.com/bazelbuild/rules_java/releases/download/7.6.0/rules_java-7.6.0.tar.gz"],',
    ')'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, '3rdparty', 'python'), { recursive: true })
  await writeFile(join(cwd, 'pants.toml'), [
    '[GLOBAL]',
    'pants_version = "2.22.0"',
    'backend_packages = ["pants.backend.python", "pants.backend.shell"]',
    'plugins = ["pantsbuild.pants.contrib.go==2.22.0"]',
    '',
    '[python.resolves]',
    'python-default = "3rdparty/python/default.lock"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'BUILD.pants'), [
    'python_requirement(',
    '  name = "requests",',
    '  requirements = ["requests==2.32.3"],',
    ')',
    'python_requirements(name = "requirements", source = "requirements.txt")'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '3rdparty', 'python', 'default.lock'), '# pants lock placeholder\n', 'utf-8')
  await writeFile(join(cwd, '.buckconfig'), [
    '[cells]',
    'root = .',
    '[repositories]',
    'third_party = third_party'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'BUCK'), [
    'maven_jar(',
    '  name = "guava",',
    '  id = "com.google.guava:guava:33.0.0-jre",',
    ')',
    'http_archive(',
    '  name = "zlib",',
    '  urls = ["https://zlib.net/zlib-1.3.1.tar.gz"],',
    '  strip_prefix = "zlib-1.3.1",',
    ')'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'fixture.opam'), [
    'opam-version: "2.0"',
    'depends: [',
    '  "ocaml" {>= "5.1"}',
    '  "dune" {>= "3.14"}',
    '  "yojson" {>= "2.1.0"}',
    ']'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'dune-project'), [
    '(lang dune 3.14)',
    '(name fixture_ocaml)',
    '(package',
    ' (name fixture_ocaml)',
    ' (depends lwt (alcotest :with-test)))'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'cpanfile'), [
    "requires 'Mojolicious', '>= 9.37';",
    "requires 'DBI';",
    "test_requires 'Test::More', '>= 1.302';"
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'fixture.rockspec'), [
    'package = "fixture"',
    'version = "1.0.0-1"',
    'dependencies = {',
    '  "lua >= 5.4",',
    '  "luasocket >= 3.1.0",',
    '  "inspect == 3.1.3"',
    '}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'shard.yml'), [
    'name: fixture-crystal',
    'version: 0.1.0',
    'dependencies:',
    '  kemal:',
    '    github: kemalcr/kemal',
    '    version: "~> 1.4.0"',
    'development_dependencies:',
    '  ameba:',
    '    github: crystal-ameba/ameba',
    '    version: "~> 1.6.0"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'shard.lock'), 'version: 2.0\nshards: []\n', 'utf-8')
  await writeFile(join(cwd, 'build.zig.zon'), [
    '.{',
    '  .name = .fixture_zig,',
    '  .version = "0.1.0",',
    '  .dependencies = .{',
    '    .zlib = .{',
    '      .url = "https://example.test/zlib-1.3.1.tar.gz",',
    '      .hash = "1220abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",',
    '    },',
    '  },',
    '}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'build.zig'), [
    'const std = @import("std");',
    'pub fn build(b: *std.Build) void {',
    '  _ = b.dependency("zlib", .{});',
    '}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Brewfile'), [
    'tap "homebrew/cask"',
    'brew "git", version: "2.45.0"',
    'cask "visual-studio-code"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'packages.config'), [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<packages>',
    '  <package id="git" version="2.45.0" />',
    '  <package id="nodejs-lts" version="22.13.0" />',
    '</packages>'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'scoopfile.json'), {
    buckets: [{ Name: 'main', Source: 'https://github.com/ScoopInstaller/Main' }],
    apps: [{ Name: 'ripgrep', Version: '14.1.1', Bucket: 'main' }, 'fd@10.2.0']
  })
  await writeJson(join(cwd, 'winget-export.json'), {
    Sources: [{
      SourceDetails: { Name: 'winget' },
      Packages: [
        { PackageIdentifier: 'Git.Git', Version: '2.45.0' },
        { PackageIdentifier: 'OpenJS.NodeJS.LTS', Version: '22.13.0' }
      ]
    }]
  })
  await writeFile(join(cwd, '.tool-versions'), [
    'nodejs 22.13.0',
    'python 3.12.8'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'mise.toml'), [
    '[tools]',
    'node = "22.13.0"',
    'python = ["3.12.8"]'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '.sdkmanrc'), [
    'java=17.0.10-tem',
    'gradle=8.10'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'apt-packages.txt'), [
    'curl=8.5.0-2ubuntu10',
    'git >= 1:2.43.0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'dnf-packages.txt'), [
    'git-2.45.0',
    'openssl >= 3.2.1'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'apk-packages.txt'), [
    'curl=8.5.0-r0',
    'openssl-3.2.1-r0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'pacman-packages.txt'), [
    'git 2.45.0-1',
    'base-devel'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'flake.nix'), [
    '{',
    '  inputs = {',
    '    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";',
    '    flake-utils.url = "github:numtide/flake-utils";',
    '  };',
    '  outputs = { self, nixpkgs, flake-utils }: {',
    '    devShells.x86_64-linux.default = let',
    '      pkgs = import nixpkgs { system = "x86_64-linux"; };',
    '    in pkgs.mkShell {',
    '      packages = with pkgs; [ git curl nodejs_22 python312 ];',
    '      buildInputs = [ pkgs.openssl ];',
    '    };',
    '  };',
    '}'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'flake.lock'), {
    nodes: {
      root: { inputs: { nixpkgs: 'nixpkgs', 'flake-utils': 'flake-utils' } },
      nixpkgs: {
        locked: {
          type: 'github',
          owner: 'NixOS',
          repo: 'nixpkgs',
          ref: 'nixos-24.05',
          rev: 'abcdef1234567890'
        }
      },
      'flake-utils': {
        locked: {
          type: 'github',
          owner: 'numtide',
          repo: 'flake-utils',
          rev: '1234567890abcdef'
        }
      }
    }
  })
  await mkdir(join(cwd, 'audit-reports'), { recursive: true })
  await writeJson(join(cwd, 'audit-reports', 'npm-audit.json'), {
    auditReportVersion: 2,
    vulnerabilities: {
      lodash: {
        name: 'lodash',
        severity: 'high',
        via: [{
          source: 1106913,
          title: 'Command Injection in lodash',
          url: 'https://github.com/advisories/GHSA-test-lodash',
          range: '<4.17.21'
        }],
        effects: [],
        range: '<4.17.21',
        fixAvailable: { name: 'lodash', version: '4.17.21' }
      }
    },
    metadata: { vulnerabilities: { high: 1 } }
  })
  await writeJson(join(cwd, 'audit-reports', 'pip-audit.json'), {
    dependencies: [{
      name: 'requests',
      version: '2.32.0',
      vulns: [{
        id: 'PYSEC-2024-001',
        aliases: ['CVE-2024-0001'],
        description: 'Verifier Python advisory',
        fix_versions: ['2.32.3']
      }]
    }]
  })
  await writeJson(join(cwd, 'audit-reports', 'trivy.json'), {
    Results: [{
      Target: 'Dockerfile',
      Type: 'dockerfile',
      Class: 'config',
      Vulnerabilities: [{
        VulnerabilityID: 'CVE-2024-TRIVY',
        PkgName: 'openssl',
        InstalledVersion: '1.0.0',
        FixedVersion: '1.0.2',
        Severity: 'CRITICAL',
        Title: 'Verifier container advisory',
        Description: 'Container package vulnerability',
        PrimaryURL: 'https://example.test/CVE-2024-TRIVY'
      }]
    }]
  })
  await writeFile(join(cwd, 'pnpm-lock.yaml'), [
    'lockfileVersion: 9.0',
    'packages:',
    '  /left-pad@1.3.0:',
    '    resolution: {integrity: sha512-test}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'requirements.txt'), [
    'requests==2.32.3',
    'fastapi>=0.110'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'pyproject.toml'), [
    '[project]',
    'dependencies = ["fastapi>=0.110", "uvicorn==0.29.0"]',
    '',
    '[[tool.poetry.source]]',
    'name = "internal"',
    'url = "https://registry.example.test/pypi/simple"',
    '',
    '[tool.poetry.dependencies]',
    'python = "^3.12"',
    'attrs = "^23.2.0"',
    '',
    '[tool.poetry.group.dev.dependencies]',
    'pytest = "^8.2.0"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'uv.lock'), [
    'version = 1',
    'revision = 1'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'poetry.lock'), [
    '# lockfile fixture'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Pipfile'), [
    '[packages]',
    'flask = "==3.0.0"',
    '',
    '[dev-packages]',
    'ruff = "*"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'environment.yml'), [
    'name: fixture',
    'dependencies:',
    '  - python=3.12',
    '  - numpy=1.26'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'renv.lock'), {
    R: { Version: '4.4.0' },
    Packages: {
      dplyr: { Package: 'dplyr', Version: '1.1.4', Source: 'Repository' },
      ggplot2: { Package: 'ggplot2', Version: '3.5.1', Source: 'Repository' }
    }
  })
  await writeFile(join(cwd, 'DESCRIPTION'), [
    'Package: fixtureR',
    'Version: 0.1.0',
    'Imports:',
    '    dplyr (>= 1.1.4),',
    '    ggplot2'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Project.toml'), [
    'name = "FixtureJulia"',
    'uuid = "11111111-1111-1111-1111-111111111111"',
    '',
    '[deps]',
    'CSV = "336ed68f-0bac-5ca0-87d4-7b16caf5d00b"',
    'DataFrames = "a93c6f00-e57d-5684-b7b6-d8193f3e46c0"',
    '',
    '[compat]',
    'CSV = "0.10"',
    'DataFrames = "1.6"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Manifest.toml'), [
    'julia_version = "1.11.0"',
    'manifest_format = "2.0"',
    '',
    '[[deps.CSV]]',
    'uuid = "336ed68f-0bac-5ca0-87d4-7b16caf5d00b"',
    'version = "0.10.14"',
    '',
    '[[deps.DataFrames]]',
    'uuid = "a93c6f00-e57d-5684-b7b6-d8193f3e46c0"',
    'version = "1.6.1"'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'deno.json'), {
    imports: {
      '@std/assert': 'jsr:@std/assert@1.0.13',
      lodash: 'npm:lodash@4.17.21'
    },
    tasks: {
      test: 'deno test'
    }
  })
  await writeFile(join(cwd, 'deno.lock'), [
    '{',
    '  "version": "4",',
    '  "specifiers": {',
    '    "jsr:@std/assert@1.0.13": "1.0.13"',
    '  }',
    '}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Package.swift'), [
    'import PackageDescription',
    '',
    'let package = Package(',
    '  name: "FixturePackage",',
    '  dependencies: [',
    '    .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0")',
    '  ]',
    ')'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Package.resolved'), [
    '{ "pins": [] }'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Podfile'), [
    "platform :ios, '14.0'",
    "target 'Fixture' do",
    "  pod 'AFNetworking', '~> 4.0'",
    'end'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Podfile.lock'), [
    'PODS:',
    '  - AFNetworking (4.0.1)'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'pom.xml'), [
    '<project>',
    '  <modelVersion>4.0.0</modelVersion>',
    '  <groupId>com.example</groupId>',
    '  <artifactId>fixture-parent</artifactId>',
    '  <version>1.0.0</version>',
    '  <modules>',
    '    <module>java/service</module>',
    '  </modules>',
    '  <repositories>',
    '    <repository>',
    '      <id>fixture</id>',
    '      <url>https://repo.example.test/maven</url>',
    '    </repository>',
    '  </repositories>',
    '</project>'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'java', 'service'), { recursive: true })
  await writeFile(join(cwd, 'java', 'service', 'pom.xml'), [
    '<project>',
    '  <modelVersion>4.0.0</modelVersion>',
    '  <groupId>com.example</groupId>',
    '  <artifactId>fixture-service</artifactId>',
    '  <version>1.0.0</version>',
    '</project>'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'settings.gradle'), [
    "pluginManagement { repositories { maven { url 'https://repo.example.test/gradle' } } }",
    "include ':gradle-app'"
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'gradle-app'), { recursive: true })
  await writeFile(join(cwd, 'gradle-app', 'build.gradle'), [
    'plugins { id "java" }',
    'repositories { mavenCentral() }',
    'dependencies { implementation "com.google.guava:guava:33.0.0-jre" }'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Cargo.toml'), [
    '[package]',
    'name = "fixture"',
    'version = "0.1.0"',
    '',
    '[workspace]',
    'members = ["crates/core"]',
    '',
    '[dependencies]',
    'serde = "1.0"'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'crates', 'core'), { recursive: true })
  await writeFile(join(cwd, 'crates', 'core', 'Cargo.toml'), [
    '[package]',
    'name = "fixture-core"',
    'version = "0.2.0"',
    '',
    '[dependencies]',
    'serde = "1.0"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Cargo.lock'), [
    '[[package]]',
    'name = "serde"',
    'version = "1.0.197"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'go.mod'), [
    'module example.com/fixture',
    '',
    'go 1.22',
    '',
    'require github.com/google/uuid v1.6.0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'go.sum'), [
    'github.com/google/uuid v1.6.0 h1:testhash',
    'github.com/google/uuid v1.6.0/go.mod h1:testhash'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'go', 'services', 'api'), { recursive: true })
  await writeFile(join(cwd, 'go.work'), [
    'go 1.22',
    '',
    'use (',
    '  ./go/services/api',
    ')'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'go', 'services', 'api', 'go.mod'), [
    'module example.com/fixture/api',
    '',
    'go 1.22',
    '',
    'require github.com/google/uuid v1.6.0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'pubspec.yaml'), [
    'name: fixture_flutter',
    'dependencies:',
    '  http: ^1.2.0',
    'dev_dependencies:',
    '  lints: ^3.0.0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'pubspec.lock'), [
    'packages:',
    '  http:',
    '    dependency: "direct main"',
    '    description:',
    '      name: http',
    '    source: hosted',
    '    version: "1.2.2"'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'composer.json'), {
    require: { 'monolog/monolog': '^3.0' }
  })
  await writeJson(join(cwd, 'composer.lock'), {
    packages: [
      { name: 'monolog/monolog', version: '3.5.0', license: ['MIT'] }
    ]
  })
  await writeFile(join(cwd, 'Fixture.csproj'), [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '  <ItemGroup>',
    '    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />',
    '  </ItemGroup>',
    '</Project>'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'packages.lock.json'), {
    version: 1,
    dependencies: {
      'net8.0': {
        'Newtonsoft.Json': {
          type: 'Direct',
          requested: '[13.0.3, )',
          resolved: '13.0.3'
        }
      }
    }
  })
  await writeFile(join(cwd, 'Gemfile'), [
    'source "https://rubygems.org"',
    'gem "rack", "~> 3.0"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Gemfile.lock'), [
    'GEM',
    '  remote: https://rubygems.org/',
    '  specs:',
    '    rack (3.0.8)',
    '',
    'PLATFORMS',
    '  ruby',
    '',
    'DEPENDENCIES',
    '  rack (~> 3.0)'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Dockerfile'), [
    'FROM node:22-alpine',
    'RUN apk add --no-cache curl'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'docker-compose.yml'), [
    'services:',
    '  db:',
    '    image: postgres:latest'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Chart.yaml'), [
    'apiVersion: v2',
    'name: fixture-chart',
    'version: 0.1.0',
    'dependencies:',
    '  - name: redis',
    '    version: 19.6.2',
    '    repository: https://charts.bitnami.com/bitnami'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Chart.lock'), [
    'dependencies:',
    '  - name: redis',
    '    repository: https://charts.bitnami.com/bitnami',
    '    version: 19.6.2',
    'digest: sha256:test',
    'generated: "2026-07-08T00:00:00Z"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'kustomization.yaml'), [
    'resources:',
    '  - github.com/acme/platform/base?ref=v1.2.0',
    'components:',
    '  - ../components/logging',
    'images:',
    '  - name: ghcr.io/acme/api',
    '    newTag: 1.4.2',
    'helmCharts:',
    '  - name: redis',
    '    version: 19.6.2',
    '    repo: https://charts.bitnami.com/bitnami'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'helmfile.yaml'), [
    'repositories:',
    '  - name: bitnami',
    '    url: https://charts.bitnami.com/bitnami',
    'releases:',
    '  - name: cache',
    '    chart: bitnami/redis',
    '    version: 19.6.2'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'skaffold.yaml'), [
    'apiVersion: skaffold/v4beta11',
    'kind: Config',
    'build:',
    '  artifacts:',
    '    - image: ghcr.io/acme/api:1.4.2',
    'deploy:',
    '  helm:',
    '    releases:',
    '      - name: api',
    '        remoteChart: oci://ghcr.io/acme/charts/api',
    '        version: 0.8.0'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'applications'), { recursive: true })
  await writeFile(join(cwd, 'applications', 'fixture-app.yaml'), [
    'apiVersion: argoproj.io/v1alpha1',
    'kind: Application',
    'metadata:',
    '  name: fixture-app',
    'spec:',
    '  source:',
    '    repoURL: https://github.com/acme/platform-config',
    '    targetRevision: v1.2.3',
    '    chart: fixture-chart'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'flux-system'), { recursive: true })
  await writeFile(join(cwd, 'flux-system', 'sync.yaml'), [
    'apiVersion: source.toolkit.fluxcd.io/v1',
    'kind: GitRepository',
    'metadata:',
    '  name: platform-config',
    'spec:',
    '  url: https://github.com/acme/platform-config',
    '  ref:',
    '    tag: v1.2.3',
    '---',
    'apiVersion: source.toolkit.fluxcd.io/v1',
    'kind: GitRepository',
    'metadata:',
    '  name: floating-platform',
    'spec:',
    '  url: https://github.com/acme/floating-platform',
    '  ref:',
    '    branch: main',
    '---',
    'apiVersion: helm.toolkit.fluxcd.io/v2',
    'kind: HelmRelease',
    'metadata:',
    '  name: cache',
    'spec:',
    '  chart:',
    '    spec:',
    '      chart: redis',
    '      version: 19.6.2'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'main.tf'), [
    'terraform {',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = "~> 5.0"',
    '    }',
    '    random = { source = "hashicorp/random", version = "3.6.0" }',
    '  }',
    '}',
    '',
    'module "vpc" {',
    '  source  = "terraform-aws-modules/vpc/aws"',
    '  version = "5.8.1"',
    '}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '.terraform.lock.hcl'), [
    'provider "registry.terraform.io/hashicorp/aws" {',
    '  version = "5.54.1"',
    '  constraints = "~> 5.0"',
    '}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'requirements.yml'), [
    'collections:',
    '  - name: community.general',
    '    version: 8.6.0',
    'roles:',
    '  - name: geerlingguy.nginx',
    '    version: 3.1.0'
  ].join('\n'), 'utf-8')
  await mkdir(join(cwd, 'project'), { recursive: true })
  await writeFile(join(cwd, 'build.sbt'), [
    'ThisBuild / scalaVersion := "2.13.14"',
    '',
    'libraryDependencies += "com.typesafe" % "config" % "1.4.3"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'project', 'plugins.sbt'), [
    'addSbtPlugin("com.github.sbt" % "sbt-native-packager" % "1.10.4")'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'dependency-lock.sbt'), [
    '// verifier lock placeholder'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'project.clj'), [
    '(defproject fixture-clojure "0.1.0"',
    '  :dependencies [[org.clojure/clojure "1.11.3"]',
    '                 [ring/ring-core "1.12.1"]])'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'mix.exs'), [
    'defmodule Fixture.MixProject do',
    '  use Mix.Project',
    '  def project, do: [app: :fixture, version: "0.1.0", deps: deps()]',
    '  defp deps do',
    '    [',
    '      {:phoenix, "~> 1.7"},',
    '      {:jason, "~> 1.4", only: :dev}',
    '    ]',
    '  end',
    'end'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'mix.lock'), [
    '%{"phoenix": {:hex, :phoenix, "1.7.14", "checksum", [:mix], [], "hexpm", "checksum"}}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'rebar.config'), [
    '{deps, [',
    '  {cowboy, "2.10.0"}',
    ']}.' 
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'rebar.lock'), [
    '{"1.2.0",[{<<"cowboy">>,{pkg,<<"cowboy">>,<<"2.10.0">>},0}]}'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'fixture.cabal'), [
    'cabal-version: 3.0',
    'name: fixture-haskell',
    'version: 0.1.0.0',
    '',
    'library',
    '  exposed-modules: Fixture',
    '  build-depends: base >=4.16 && <5, aeson >= 2.2'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'cabal.project'), [
    'packages: .'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'cabal.project.freeze'), [
    'constraints: any.aeson ==2.2.3.0'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'stack.yaml'), [
    'resolver: lts-22.43',
    'packages:',
    '  - .',
    'extra-deps:',
    '  - warp-3.3.31'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'stack.yaml.lock'), [
    '# verifier lock placeholder'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'package.yaml'), [
    'name: fixture-stack',
    'dependencies:',
    '  - base >=4.16',
    '  - text >=2.0'
  ].join('\n'), 'utf-8')
  return cwd
}

function hasComponent(report: any, managerId: string, name: string, version?: string) {
  return report.components.some((component: any) => (
    component.managerId === managerId &&
    component.name === name &&
    (!version || component.version === version)
  ))
}

function hasComponentFrom(report: any, managerId: string, name: string, sourceFile: string) {
  return report.components.some((component: any) => (
    component.managerId === managerId &&
    component.name === name &&
    component.sourceFile === sourceFile
  ))
}

async function main() {
  phaseStart('framework-main')
  const implemented = getImplementedManagerDefinitions()
  const planned = getPlannedManagerDefinitions()
  const ids = MANAGER_DEFINITIONS.map((manager) => manager.id)
  assert(new Set(ids).size === ids.length, 'manager registry has unique IDs')
  assert(implemented.length >= 8, 'manager registry exposes implemented ecosystems')
  assert(planned.length >= 10, 'manager registry exposes planned/extended ecosystems')
  assert(IMPLEMENTED_MANAGER_IDS.every((id) => implemented.some((manager) => manager.id === id)), 'implemented manager ID list matches registry definitions')
  assert(implemented.every((manager) => manager.route && manager.tools.length > 0 && manager.productionTools.length > 0), 'implemented managers have routes, tools, and production tools')
  assert(['pnpm', 'yarn', 'bun'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/node'), 'modern Node managers route to the dedicated Node workspace')
  assert(['uv', 'poetry', 'pipenv', 'conda'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/python'), 'Python environment managers route to the dedicated Python workspace')
  assert(['nuget', 'composer', 'bundler'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/backend'), 'backend package managers route to the dedicated Backend workspace')
  assert(['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/cloud'), 'cloud-native and GitOps managers route to the dedicated Cloud workspace')
  assert(['deno', 'swiftpm', 'cocoapods'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/platform'), 'platform managers route to the dedicated Platform workspace')
  assert(['sbt', 'leiningen', 'mix', 'rebar3', 'cabal', 'stack'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/polyglot'), 'polyglot managers route to the dedicated Polyglot workspace')
  assert(['renv', 'julia'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/data'), 'data science managers route to the dedicated Data workspace')
  assert(['terraform', 'opentofu', 'ansible'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/infra'), 'infrastructure managers route to the dedicated Infra workspace')
  assert(['github-actions', 'gitlab-ci', 'pre-commit'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/automation'), 'automation managers route to the dedicated Automation workspace')
  assert(['bazel', 'pants', 'buck'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/build'), 'build system managers route to the dedicated Build workspace')
  assert(['opam', 'cpan', 'luarocks', 'shards', 'zig'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/systems'), 'systems and scripting managers route to the dedicated Systems workspace')
  assert(['homebrew', 'chocolatey', 'scoop', 'winget', 'asdf', 'mise', 'sdkman', 'apt', 'dnf', 'apk', 'pacman', 'nix'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/runtime'), 'system package, Linux, Nix, and runtime managers route to the dedicated Runtime workspace')
  assert(['mcp', 'skills', 'ai-agents'].every((id) => MANAGER_DEFINITIONS.find((manager) => manager.id === id)?.route === '/ai'), 'AI dependency managers route to the dedicated AI workspace')
  const appSource = await readFile(join(process.cwd(), 'src', 'App.tsx'), 'utf-8')
  const layoutSource = await readFile(join(process.cwd(), 'src', 'components', 'Layout', 'MainLayout.tsx'), 'utf-8')
  const hubSource = await readFile(join(process.cwd(), 'src', 'features', 'workspace', 'ManagerHub.tsx'), 'utf-8')
  const multiManagerSource = await readFile(join(process.cwd(), 'src', 'features', 'workspace', 'MultiManager.tsx'), 'utf-8')
  const searchFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'search', 'Search.tsx'), 'utf-8')
  const toolVersionsFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'toolchains', 'ToolVersions.tsx'), 'utf-8')
  const settingsFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'settings', 'Settings.tsx'), 'utf-8')
  const workspaceGroupsSource = await readFile(join(process.cwd(), 'src', 'domain', 'managers', 'workspaces.ts'), 'utf-8')
  const npmManagerSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'npm', 'NpmManagerPage.tsx'), 'utf-8')
  const npmProjectScopeSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'npm', 'scopes', 'project', 'Project.tsx'), 'utf-8')
  const npmGlobalScopeSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'npm', 'scopes', 'global', 'Global.tsx'), 'utf-8')
  const npmPublishScopeSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'npm', 'scopes', 'publish', 'Publish.tsx'), 'utf-8')
  const nodeWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'node', 'NodePackageManagersPage.tsx'), 'utf-8')
  const pythonWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'python', 'PythonEnvironmentManagersPage.tsx'), 'utf-8')
  const backendWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'backend', 'BackendPackageManagersPage.tsx'), 'utf-8')
  const cloudWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'cloud', 'CloudNativeManagersPage.tsx'), 'utf-8')
  const platformWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'platform', 'PlatformManagersPage.tsx'), 'utf-8')
  const polyglotWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'polyglot', 'PolyglotManagersPage.tsx'), 'utf-8')
  const dataWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'data', 'DataScienceManagersPage.tsx'), 'utf-8')
  const infraWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'infra', 'InfrastructureManagersPage.tsx'), 'utf-8')
  const automationWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'automation', 'AutomationManagersPage.tsx'), 'utf-8')
  const buildWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'build', 'BuildSystemsManagersPage.tsx'), 'utf-8')
  const systemsWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'systems', 'SystemsManagersPage.tsx'), 'utf-8')
  const runtimeWorkspaceSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'runtime', 'RuntimeManagersPage.tsx'), 'utf-8')
  const extendedEcosystemsSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'extended', 'ExtendedEcosystems.tsx'), 'utf-8')
  const cargoFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'cargo', 'Cargo.tsx'), 'utf-8')
  const gradleFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'gradle', 'Gradle.tsx'), 'utf-8')
  const goFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'go', 'Go.tsx'), 'utf-8')
  const flutterFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'flutter', 'Flutter.tsx'), 'utf-8')
  const nativeFeatureSource = await readFile(join(process.cwd(), 'src', 'features', 'managers', 'native', 'Native.tsx'), 'utf-8')
  const extendedWorkspaceSource = await readFeatureSource(join(process.cwd(), 'src', 'features', 'managers', 'extended', 'ExtendedManagerWorkspace.tsx'))
  const healthCenterEntrySource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'HealthCenter.tsx'), 'utf-8')
  const healthCenterSource = await readFeatureSource(join(process.cwd(), 'src', 'features', 'health', 'HealthCenter.tsx'))
  // UI copy lives in the dictionary now, so a source-text assertion on a label has to
  // look in two places: the key at the call site, and the value in the dictionary.
  const dictionarySource = await readFile(join(process.cwd(), 'src', 'i18n', 'dictionaries.ts'), 'utf-8')
  const healthWorkflowsSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'workflows.ts'), 'utf-8')
  const workflowSectionNavSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'components', 'WorkflowSectionNav.tsx'), 'utf-8')
  const workflowSectionHeaderSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'components', 'WorkflowSectionHeader.tsx'), 'utf-8')
  const automationGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'automationGovernance', 'AutomationGovernanceOverview.tsx'), 'utf-8')
  const ciIntegrationPlanPanelSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'automationGovernance', 'CiIntegrationPlanPanel.tsx'), 'utf-8')
  const evidenceGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'evidenceGovernance', 'EvidenceGovernanceOverview.tsx'), 'utf-8')
  const policyGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'policyGovernance', 'PolicyGovernanceOverview.tsx'), 'utf-8')
  const reproducibilityGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'reproducibilityGovernance', 'ReproducibilityGovernanceOverview.tsx'), 'utf-8')
  const releaseGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'releaseGovernance', 'ReleaseGovernanceOverview.tsx'), 'utf-8')
  const riskGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'riskGovernance', 'RiskGovernanceOverview.tsx'), 'utf-8')
  const workspaceGovernanceOverviewSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'workspaceGovernance', 'WorkspaceGovernanceOverview.tsx'), 'utf-8')
  const healthCenterStylesSource = await readFile(join(process.cwd(), 'src', 'features', 'health', 'HealthCenter.module.css'), 'utf-8')
  const frameworkCoverageSource = await readFile(join(process.cwd(), 'electron', 'services', 'frameworkCoverage.ts'), 'utf-8')
  const releaseProvenanceSource = await readFile(join(process.cwd(), 'electron', 'services', 'releaseProvenanceAttestation.ts'), 'utf-8')
  const releaseIntegritySource = await readFile(join(process.cwd(), 'electron', 'services', 'releaseIntegrityVerification.ts'), 'utf-8')
  const releaseSignatureSource = await readFile(join(process.cwd(), 'electron', 'services', 'releaseSignature.ts'), 'utf-8')
  const releaseTrustPolicySource = await readFile(join(process.cwd(), 'electron', 'services', 'releaseTrustPolicy.ts'), 'utf-8')
  const dependencyUpgradePlaybookSource = await readFile(join(process.cwd(), 'electron', 'services', 'dependencyUpgradePlaybook.ts'), 'utf-8')
  const dependencyRollbackPlanSource = await readFile(join(process.cwd(), 'electron', 'services', 'dependencyRollbackPlan.ts'), 'utf-8')
  const dependencyImpactAnalysisSource = await readFile(join(process.cwd(), 'electron', 'services', 'dependencyImpactAnalysis.ts'), 'utf-8')
  const dependencyChangeApprovalPacketSource = await readFile(join(process.cwd(), 'electron', 'services', 'dependencyChangeApprovalPacket.ts'), 'utf-8')
  const dependencyChangeCalendarSource = await readFile(join(process.cwd(), 'electron', 'services', 'dependencyChangeCalendar.ts'), 'utf-8')
  const dependencyChangeExecutionRecordSource = await readFile(join(process.cwd(), 'electron', 'services', 'dependencyChangeExecutionRecord.ts'), 'utf-8')
  const releaseIntegrityCliSource = await readFile(join(process.cwd(), 'scripts', 'verify-release-integrity.mjs'), 'utf-8')
  const releaseSignatureCliSource = await readFile(join(process.cwd(), 'scripts', 'verify-release-signature.mjs'), 'utf-8')
  const releaseTrustCliSource = await readFile(join(process.cwd(), 'scripts', 'verify-release-trust.mjs'), 'utf-8')
  const packageJsonSource = await readFile(join(process.cwd(), 'package.json'), 'utf-8')
  const readinessPolicyEditorSource = await readFile(join(process.cwd(), 'src', 'features', 'policies', 'ReadinessPolicyEditor.tsx'), 'utf-8')
  const mainProcessSource = await readFile(join(process.cwd(), 'electron', 'main.ts'), 'utf-8')
  const preloadSource = await readFile(join(process.cwd(), 'electron', 'preload.ts'), 'utf-8')
  assert(appSource.includes('NodePackageManagersPage') && appSource.includes('/node'), 'app routes include the modern Node manager workspace')
  assert(appSource.includes('PythonEnvironmentManagersPage') && appSource.includes('/python'), 'app routes include the Python environment manager workspace')
  assert(appSource.includes('BackendPackageManagersPage') && appSource.includes('/backend'), 'app routes include the Backend package manager workspace')
  assert(appSource.includes('CloudNativeManagersPage') && appSource.includes('/cloud'), 'app routes include the Cloud Native manager workspace')
  assert(appSource.includes('PlatformManagersPage') && appSource.includes('/platform'), 'app routes include the Platform manager workspace')
  assert(appSource.includes('PolyglotManagersPage') && appSource.includes('/polyglot'), 'app routes include the Polyglot manager workspace')
  assert(appSource.includes('DataScienceManagersPage') && appSource.includes('/data'), 'app routes include the Data manager workspace')
  assert(appSource.includes('InfrastructureManagersPage') && appSource.includes('/infra'), 'app routes include the Infra manager workspace')
  assert(appSource.includes('AutomationManagersPage') && appSource.includes('/automation'), 'app routes include the Automation manager workspace')
  assert(appSource.includes('BuildSystemsManagersPage') && appSource.includes('/build'), 'app routes include the Build manager workspace')
  assert(appSource.includes('SystemsManagersPage') && appSource.includes('/systems'), 'app routes include the Systems and scripting manager workspace')
  assert(appSource.includes('RuntimeManagersPage') && appSource.includes('/runtime'), 'app routes include the system package and runtime manager workspace')
  assert(['./features/search/Search', './features/workspace/ManagerHub', './features/workspace/MultiManager', './features/settings/Settings', './features/toolchains/ToolVersions', './features/health/HealthCenter', './features/managers/extended/ExtendedEcosystems'].every((path) => appSource.includes(path)), 'app routes load workspace, search, settings, toolchain, health, and extended ecosystem pages from feature modules')
  assert(!['./pages/Search/Search', './pages/ManagerHub/ManagerHub', './pages/MultiManager/MultiManager', './pages/Settings/Settings', './pages/ToolVersions/ToolVersions', './pages/HealthCenter/HealthCenter', './pages/ExtendedEcosystems/ExtendedEcosystems'].some((path) => appSource.includes(path)), 'app routes no longer load product feature pages from legacy pages modules')
  assert(['./features/managers/cargo/Cargo', './features/managers/gradle/Gradle', './features/managers/go/Go', './features/managers/flutter/Flutter', './features/managers/native/Native'].every((path) => appSource.includes(path)), 'app routes load stable Cargo, Gradle, Go, Flutter, and Native pages from feature modules')
  assert(!['./pages/Cargo/Cargo', './pages/Gradle/Gradle', './pages/Go/Go', './pages/Flutter/Flutter', './pages/Native/Native'].some((path) => appSource.includes(path)), 'app routes no longer load stable manager pages from legacy pages modules')
  assert(workspaceGroupsSource.includes('MANAGER_WORKSPACE_GROUPS') && workspaceGroupsSource.includes('NPM_WORKSPACE_SCOPES') && workspaceGroupsSource.includes("legacyRoutes: ['/project', '/global', '/publish', '/multi-manager']"), 'manager workspace groups centralize ecosystem routes and npm legacy scope compatibility')
  assert(['/npm', '/node', '/python', '/backend', '/cloud', '/platform', '/polyglot', '/data', '/infra', '/automation', '/build', '/systems', '/runtime'].every((route) => workspaceGroupsSource.includes("route: '" + route + "'")), 'manager workspace group map covers all first-class ecosystem workspaces')
  assert(layoutSource.includes('MANAGER_WORKSPACE_GROUPS') && layoutSource.includes('findWorkspaceGroupByPath') && layoutSource.includes('groupedManagerIds'), 'main navigation is generated from the shared manager workspace group map')
  assert(hubSource.includes('MANAGER_WORKSPACE_GROUPS') && hubSource.includes('workspaceGroups.map') && hubSource.includes("t('workspace.unifiedWorkspaces')"), 'manager hub renders grouped ecosystem workspaces from the shared map with a localized section heading')
  assert(multiManagerSource.includes('compatibility launcher') || multiManagerSource.includes('getImplementedManagerDefinitions'), 'multi-manager compatibility launcher lives under the workspace feature module')
  assert(searchFeatureSource.includes('SearchType') && toolVersionsFeatureSource.includes('GlobalToolchainPanel') && settingsFeatureSource.includes('GlobalToolchainPanel') && healthCenterSource.includes('DependencyPolicyEditor') && extendedEcosystemsSource.includes('getPlannedManagerDefinitions'), 'workspace, search, toolchain, settings, health, and extended ecosystem feature modules expose their expected product surfaces')
  assert(npmManagerSource.includes('NPM_WORKSPACE_SCOPES') && npmManagerSource.includes('initialScope') && npmManagerSource.includes('switchScope'), 'npm workbench scopes are sourced from the shared workspace map')
  assert(npmManagerSource.includes('./scopes/project/Project') && npmManagerSource.includes('./scopes/global/Global') && npmManagerSource.includes('./scopes/publish/Publish'), 'npm workbench imports project, global, and publish scopes from the npm feature module')
  assert([npmProjectScopeSource, npmGlobalScopeSource, npmPublishScopeSource].every((source) => source.includes("from '../../../../../stores/appStore'") && !source.includes("from '../../stores/appStore'")), 'npm project/global/publish scope pages live under the feature module with corrected shared imports')
  assert([cargoFeatureSource, gradleFeatureSource, goFeatureSource, flutterFeatureSource, nativeFeatureSource].every((source) => source.includes("from '../../../stores/appStore'") && source.includes('RuntimeManagerSwitch')), 'stable Cargo, Gradle, Go, Flutter, and Native manager pages live under feature modules with corrected shared imports')
  assert(['npm', 'Node+', 'Python+', 'Backend+', 'Cloud+', 'Platform+', 'Polyglot+', 'Data+', 'Infra+', 'Automation+', 'Build+', 'Systems+', 'Runtime+'].every((label) => workspaceGroupsSource.includes(label)), 'shared manager workspace group map exposes all sidebar and hub labels')
  assert(['pnpm', 'yarn', 'bun'].every((id) => nodeWorkspaceSource.includes(id)), 'modern Node manager workspace covers pnpm, Yarn, and Bun')
  assert(['uv', 'poetry', 'pipenv', 'conda'].every((id) => pythonWorkspaceSource.includes(id)), 'Python manager workspace covers uv, Poetry, Pipenv, and Conda')
  assert(['nuget', 'composer', 'bundler'].every((id) => backendWorkspaceSource.includes(id)), 'Backend manager workspace covers NuGet, Composer, and Bundler')
  assert(['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux'].every((id) => cloudWorkspaceSource.includes(id)), 'Cloud manager workspace covers Docker, Helm, Kustomize, Helmfile, Skaffold, Argo CD, and Flux')
  assert(['deno', 'swiftpm', 'cocoapods'].every((id) => platformWorkspaceSource.includes(id)), 'Platform manager workspace covers Deno, SwiftPM, and CocoaPods')
  assert(['sbt', 'leiningen', 'mix', 'rebar3', 'cabal', 'stack'].every((id) => polyglotWorkspaceSource.includes(id)), 'Polyglot manager workspace covers sbt, Leiningen, Mix, rebar3, Cabal, and Stack')
  assert(['renv', 'julia'].every((id) => dataWorkspaceSource.includes(id)), 'Data manager workspace covers R/renv and Julia Pkg')
  assert(['terraform', 'opentofu', 'ansible'].every((id) => infraWorkspaceSource.includes(id)), 'Infra manager workspace covers Terraform, OpenTofu, and Ansible Galaxy')
  assert(['github-actions', 'gitlab-ci', 'pre-commit'].every((id) => automationWorkspaceSource.includes(id)), 'Automation manager workspace covers GitHub Actions, GitLab CI, and pre-commit')
  assert(['bazel', 'pants', 'buck'].every((id) => buildWorkspaceSource.includes(id)), 'Build manager workspace covers Bazel, Pants, and Buck')
  assert(['opam', 'cpan', 'luarocks', 'shards', 'zig'].every((id) => systemsWorkspaceSource.includes(id)), 'Systems manager workspace covers OCaml/opam, Perl/CPAN, LuaRocks, Crystal Shards, and Zig')
  assert(['homebrew', 'chocolatey', 'scoop', 'winget', 'asdf', 'mise', 'sdkman', 'apt', 'dnf', 'apk', 'pacman', 'nix'].every((id) => runtimeWorkspaceSource.includes(id)), 'Runtime manager workspace covers Homebrew, Chocolatey, Scoop, winget, asdf, mise, SDKMAN, Linux package managers, and Nix')
  assert([nodeWorkspaceSource, pythonWorkspaceSource, backendWorkspaceSource, cloudWorkspaceSource, platformWorkspaceSource, polyglotWorkspaceSource, dataWorkspaceSource, infraWorkspaceSource, automationWorkspaceSource, buildWorkspaceSource, systemsWorkspaceSource, runtimeWorkspaceSource].every((source) => source.includes('ExtendedManagerWorkspace') && source.includes('config')), 'extended ecosystem pages are config wrappers around the shared workspace component')
  assert(extendedWorkspaceSource.includes('ExtendedManagerWorkspaceConfig') && extendedWorkspaceSource.includes('window.electronAPI.managers.plan') && extendedWorkspaceSource.includes('window.electronAPI.managers.execute') && extendedWorkspaceSource.includes('restoreBackup'), 'shared extended workspace owns structured operation planning, execution, and backup restore UI')
  assert(mainProcessSource.includes('WorkspaceDiscoveryService') && preloadSource.includes('workspaceDiscovery'), 'Electron IPC exposes workspace discovery reports and exports')
  assert(mainProcessSource.includes('WorkspaceGovernanceService') && preloadSource.includes('workspaceGovernance'), 'Electron IPC exposes workspace governance reports and exports')
  assert(mainProcessSource.includes('export-evidence-markdown') && preloadSource.includes('exportEvidenceMarkdown'), 'Electron IPC exposes workspace release evidence exports')
  assert(mainProcessSource.includes('export-workspace-sboms') && preloadSource.includes('exportWorkspaceSboms'), 'Electron IPC exposes workspace batch SBOM exports')
  assert(mainProcessSource.includes('export-release-bundle') && preloadSource.includes('exportReleaseBundle'), 'Electron IPC exposes aggregate release bundle exports')
  assert(mainProcessSource.includes('export-release-dashboard') && preloadSource.includes('exportReleaseDashboard'), 'Electron IPC exposes HTML release review dashboard exports')
  assert(mainProcessSource.includes('dependency-health-dashboard:export-html') && preloadSource.includes('dependencyHealthDashboard') && preloadSource.includes('exportHtml'), 'Electron IPC exposes dependency health dashboard HTML exports')
  assert(mainProcessSource.includes('report-artifacts:report') && mainProcessSource.includes('report-artifacts:export-markdown') && preloadSource.includes('reportArtifacts') && preloadSource.includes('exportMarkdown'), 'Electron IPC exposes report artifact library indexes and exports')
  assert(mainProcessSource.includes('release-evidence-completeness:report') && mainProcessSource.includes('release-evidence-completeness:export-markdown') && preloadSource.includes('releaseEvidenceCompleteness'), 'Electron IPC exposes release evidence completeness checks and exports')
  assert(mainProcessSource.includes('release-provenance-attestation:report') && mainProcessSource.includes('release-provenance-attestation:export-markdown') && preloadSource.includes('releaseProvenanceAttestation'), 'Electron IPC exposes release provenance attestation reports and exports')
  assert(mainProcessSource.includes('release-integrity-verification:report') && mainProcessSource.includes('release-integrity-verification:export-markdown') && preloadSource.includes('releaseIntegrityVerification'), 'Electron IPC exposes release integrity verification reports and exports')
  assert(mainProcessSource.includes('release-signature:report') && mainProcessSource.includes('release-signature:verify') && mainProcessSource.includes('release-signature:export-json') && preloadSource.includes('releaseSignature'), 'Electron IPC exposes release signature reports, verification, and exports')
  assert(mainProcessSource.includes('release-trust-policy:report') && mainProcessSource.includes('release-trust-policy:export-markdown') && preloadSource.includes('releaseTrustPolicy'), 'Electron IPC exposes release trust policy reports and exports')
  assert(mainProcessSource.includes('framework-coverage:report') && mainProcessSource.includes('framework-coverage:export-markdown') && preloadSource.includes('frameworkCoverage') && preloadSource.includes('exportMarkdown'), 'Electron IPC exposes framework coverage reports and exports')
  assert(frameworkCoverageSource.includes('FrameworkCoverageService') && frameworkCoverageSource.includes('MANAGER_DEFINITIONS') && frameworkCoverageSource.includes('framework-coverage.md') && frameworkCoverageSource.includes('Follow-up Gaps'), 'framework coverage service exports registry-backed one-stop coverage and gap reports')
  assert(releaseProvenanceSource.includes('ReleaseProvenanceAttestationService') && releaseProvenanceSource.includes('release-provenance-attestation') && releaseProvenanceSource.includes('Evidence Digests') && releaseProvenanceSource.includes('collectGitInfo'), 'release provenance service exports source, bundle, evidence, and digest attestations')
  assert(releaseIntegritySource.includes('ReleaseIntegrityVerificationService') && releaseIntegritySource.includes('release-integrity-verification') && releaseIntegritySource.includes('Artifact Verification') && releaseIntegritySource.includes('SHA-256 mismatch'), 'release integrity service exports post-bundle artifact verification and tamper findings')
  assert(packageJsonSource.includes('verify:release-integrity') && releaseIntegrityCliSource.includes('--optional') && releaseIntegrityCliSource.includes('requiredMismatchArtifactCount') && releaseIntegrityCliSource.includes('process.exitCode = 1'), 'release integrity CLI is exposed as an npm script with optional CI mode and non-zero failure behavior')
  assert(releaseSignatureSource.includes('ReleaseSignatureService') && releaseSignatureSource.includes('release-signature') && releaseSignatureSource.includes('HMAC-SHA256') && releaseSignatureSource.includes('NPM_MANAGER_RELEASE_SIGNING_KEY') && releaseSignatureSource.includes('stableStringify'), 'release signature service exports canonical signed release evidence envelopes without self-referencing the signature artifact')
  assert(packageJsonSource.includes('verify:release-signature') && releaseSignatureCliSource.includes('--optional') && releaseSignatureCliSource.includes('NPM_MANAGER_RELEASE_SIGNING_KEY') && releaseSignatureCliSource.includes('process.exitCode = 1'), 'release signature CLI is exposed as an npm script with optional CI mode and non-zero failure behavior')
  assert(releaseTrustPolicySource.includes('ReleaseTrustPolicyService') && releaseTrustPolicySource.includes('release-trust-policy') && releaseTrustPolicySource.includes('Release signature verification') && releaseTrustPolicySource.includes('Release evidence completeness') && releaseTrustPolicySource.includes('Release approval evidence'), 'release trust policy service consolidates signature, integrity, provenance, evidence, approval, and exception checks')
  assert(packageJsonSource.includes('verify:release-trust') && releaseTrustCliSource.includes('--optional') && releaseTrustCliSource.includes('allow-blocked') && releaseTrustCliSource.includes('process.exitCode = 1'), 'release trust CLI is exposed as an npm script with optional mode and non-zero blocked behavior')
  assert(mainProcessSource.includes('export-remediation-markdown') && preloadSource.includes('exportRemediationMarkdown'), 'Electron IPC exposes workspace remediation plan exports')
  assert(mainProcessSource.includes('export-update-plan-markdown') && preloadSource.includes('exportUpdatePlanMarkdown'), 'Electron IPC exposes workspace dependency update plan exports')
  assert(mainProcessSource.includes('supply-chain:license-report') && preloadSource.includes('exportLicenseMarkdown'), 'Electron IPC exposes license compliance matrix reports and exports')
  assert(mainProcessSource.includes('third-party-notices:report') && mainProcessSource.includes('third-party-notices:export-text') && preloadSource.includes('thirdPartyNotices') && preloadSource.includes('exportText'), 'Electron IPC exposes third-party notice reports and exports')
  assert(mainProcessSource.includes('credential-usage:report') && preloadSource.includes('credentialUsage'), 'Electron IPC exposes credential usage map reports and exports')
  assert(mainProcessSource.includes('credential-rotation-plan:plan') && preloadSource.includes('credentialRotationPlan'), 'Electron IPC exposes credential rotation plans and exports')
  assert(mainProcessSource.includes('lockfile-drift:report') && preloadSource.includes('lockfileDrift'), 'Electron IPC exposes lockfile drift reports and exports')
  assert(mainProcessSource.includes('runtime-pinning:report') && preloadSource.includes('runtimePinning'), 'Electron IPC exposes runtime pinning reports and exports')
  assert(mainProcessSource.includes('offline-cache-readiness:report') && preloadSource.includes('offlineCacheReadiness'), 'Electron IPC exposes offline cache readiness reports and exports')
  assert(mainProcessSource.includes('release-risk-profile:report') && preloadSource.includes('releaseRiskProfile'), 'Electron IPC exposes release risk profile reports and exports')
  assert(mainProcessSource.includes('ci-integration-plan:plan') && preloadSource.includes('ciIntegrationPlan') && preloadSource.includes('exportGithubActions'), 'Electron IPC exposes CI integration plans and GitHub Actions workflow exports')
  assert(mainProcessSource.includes('dependency-automation-plan:plan') && preloadSource.includes('dependencyAutomationPlan') && preloadSource.includes('exportDependabot') && preloadSource.includes('exportRenovate'), 'Electron IPC exposes dependency automation plans and Dependabot/Renovate exports')
  assert(mainProcessSource.includes('release-exception:record') && preloadSource.includes('releaseException'), 'Electron IPC exposes release exception evidence APIs')
  assert(mainProcessSource.includes('automation-safety-plan:plan') && preloadSource.includes('automationSafetyPlan'), 'Electron IPC exposes automation safety plans and exports')
  assert(mainProcessSource.includes('dependency-ownership-plan:plan') && preloadSource.includes('dependencyOwnershipPlan') && preloadSource.includes('exportCodeowners'), 'Electron IPC exposes dependency ownership plans and suggested CODEOWNERS exports')
  assert(mainProcessSource.includes('dependency-upgrade-playbook:report') && mainProcessSource.includes('dependency-upgrade-playbook:export-markdown') && preloadSource.includes('dependencyUpgradePlaybook'), 'Electron IPC exposes dependency upgrade playbook reports and exports')
  assert(mainProcessSource.includes('dependency-rollback-plan:report') && mainProcessSource.includes('dependency-rollback-plan:export-markdown') && preloadSource.includes('dependencyRollbackPlan'), 'Electron IPC exposes dependency rollback plans and exports')
  assert(mainProcessSource.includes('dependency-impact-analysis:report') && mainProcessSource.includes('dependency-impact-analysis:export-markdown') && preloadSource.includes('dependencyImpactAnalysis'), 'Electron IPC exposes dependency impact analysis reports and exports')
  assert(mainProcessSource.includes('dependency-change-approval-packet:report') && mainProcessSource.includes('dependency-change-approval-packet:export-markdown') && preloadSource.includes('dependencyChangeApprovalPacket'), 'Electron IPC exposes dependency change approval packets and exports')
  assert(mainProcessSource.includes('dependency-change-calendar:report') && mainProcessSource.includes('dependency-change-calendar:export-markdown') && mainProcessSource.includes('dependency-change-calendar:export-ics') && mainProcessSource.includes('dependency-change-calendar:export-freeze-gate') && preloadSource.includes('dependencyChangeCalendar') && preloadSource.includes('exportTicketTemplate'), 'Electron IPC exposes dependency change calendars, ICS calendars, freeze gates, and ticket templates')
  assert(mainProcessSource.includes('dependency-change-execution-record:report') && mainProcessSource.includes('dependency-change-execution-record:export-markdown') && preloadSource.includes('dependencyChangeExecutionRecord'), 'Electron IPC exposes dependency change execution records and exports')
  assert(mainProcessSource.includes('policy-as-code-pack:report') && preloadSource.includes('policyAsCodePack') && preloadSource.includes('exportPolicyJson'), 'Electron IPC exposes policy-as-code packs and policy JSON exports')
  assert(mainProcessSource.includes('audit-evidence:import-file') && mainProcessSource.includes('audit-evidence:export-html') && preloadSource.includes('auditEvidence') && preloadSource.includes('exportHtml'), 'Electron IPC exposes audit evidence import, export, and dashboard APIs')
  assert(mainProcessSource.includes('vulnerability-remediation-plan:plan') && mainProcessSource.includes('vulnerability-remediation-plan:export-markdown') && preloadSource.includes('vulnerabilityRemediationPlan') && preloadSource.includes('exportJson'), 'Electron IPC exposes vulnerability remediation plans and exports')
  assert(healthCenterSource.includes('Scan workspaces') && healthCenterSource.includes('Workspace discovery'), 'health center exposes workspace discovery controls and findings')
  assert(healthCenterSource.includes('Govern workspaces') && healthCenterSource.includes('Workspace governance'), 'health center exposes workspace governance controls and findings')
  assert(healthCenterSource.includes('Export evidence') && healthCenterSource.includes('exportWorkspaceReleaseEvidence'), 'health center exposes workspace release evidence export controls')
  assert(healthCenterSource.includes('Export SBOMs') && healthCenterSource.includes('Export SPDXs') && healthCenterSource.includes('exportWorkspaceSboms'), 'health center exposes workspace batch SBOM export controls')
  assert(healthCenterSource.includes('Export bundle') && healthCenterSource.includes('exportReleaseBundle'), 'health center exposes aggregate release bundle export controls')
  assert(healthCenterSource.includes('Review dashboard') && healthCenterSource.includes('exportReleaseDashboard'), 'health center exposes release review dashboard export controls')
  assert(healthCenterSource.includes('Dependency health dashboard') && healthCenterSource.includes('exportDependencyHealthDashboard'), 'health center exposes dependency health dashboard export controls')
  assert(['Inventory & SBOM', 'Evidence Intake', 'Release Decisions', 'Registry & Credentials', 'Reproducibility Reports', 'Automation & Ownership', 'Workspace & Release Exports', 'Snapshot & Policies', 'Navigation'].every((label) => dictionarySource.includes("'" + label + "'")) && ['health.groupInventorySbom', 'health.groupEvidenceIntake', 'health.groupReleaseDecisions', 'health.groupRegistryCredentials', 'health.groupReproducibilityReports', 'health.groupAutomationOwnership', 'health.groupWorkspaceReleaseExports', 'health.groupSnapshotPolicies', 'health.groupNavigation'].every((key) => healthCenterSource.includes("t('" + key + "')")) && healthCenterSource.includes('styles.toolGroup'), 'health center groups production actions by workflow instead of presenting one flat button wall')
  assert(['health-inventory', 'health-risk', 'health-automation', 'health-policy', 'health-workspaces', 'health-evidence', 'health-reproducibility', 'health-operations'].every((anchor) => healthWorkflowsSource.includes(anchor)) && healthCenterSource.includes("from './components'") && healthCenterSource.includes('WorkflowSectionNav') && healthCenterSource.includes('WorkflowSectionHeader') && workflowSectionNavSource.includes('HEALTH_WORKFLOW_SECTIONS') && workflowSectionHeaderSource.includes('HealthWorkflowSectionId'), 'health center workflow navigation and section headers are driven by shared workflow metadata and reusable components')
  assert(healthCenterSource.includes("from './automationGovernance'") && healthCenterSource.includes('AutomationGovernanceOverview') && automationGovernanceOverviewSource.includes('Automation governance cockpit') && ['ciIntegrationPlan', 'dependencyAutomationPlan', 'credentialRotationPlan', 'automationSafetyPlan', 'dependencyOwnershipPlan', 'dependencyUpgradePlaybook', 'dependencyImpactAnalysis', 'dependencyChangeCalendar', 'dependencyChangeExecutionRecord', 'reportArtifactIndex'].every((signal) => automationGovernanceOverviewSource.includes(signal)), 'health center automation governance overview is isolated in an automation submodule that summarizes CI, dependency automation, credential, safety, ownership, upgrade, impact, calendar, execution, and report signals')
  assert(healthCenterSource.includes("from './evidenceGovernance'") && healthCenterSource.includes('EvidenceGovernanceOverview') && evidenceGovernanceOverviewSource.includes('Evidence operations cockpit') && ['operationHistory', 'ciEvidence', 'auditEvidence', 'vulnerabilityRemediationPlan', 'releaseApprovals', 'releaseExceptions', 'reportArtifactIndex'].every((signal) => evidenceGovernanceOverviewSource.includes(signal)), 'health center evidence governance overview is isolated in an evidence submodule that summarizes CI, audit, remediation, approval, exception, report, and operation signals')
  assert(healthCenterSource.includes("from './policyGovernance'") && healthCenterSource.includes('PolicyGovernanceOverview') && policyGovernanceOverviewSource.includes('Policy governance cockpit') && ['readinessReport', 'policyEvaluation', 'licenseReport', 'thirdPartyNotices', 'policyAsCodePack', 'registryReport', 'credentialRotationPlan'].every((signal) => policyGovernanceOverviewSource.includes(signal)), 'health center policy governance overview is isolated in a policy submodule that summarizes readiness policy, dependency policy, license, notices, policy-as-code, registry, and credential signals')
  assert(healthCenterSource.includes("from './reproducibilityGovernance'") && healthCenterSource.includes('ReproducibilityGovernanceOverview') && reproducibilityGovernanceOverviewSource.includes('Reproducibility cockpit') && ['snapshots', 'snapshotDiff', 'dependencyDiff', 'offlineCacheReport', 'dependencyRollbackPlan', 'releaseRiskProfile', 'readinessReport', 'reportArtifactIndex'].every((signal) => reproducibilityGovernanceOverviewSource.includes(signal)), 'health center reproducibility governance overview is isolated in a reproducibility submodule that summarizes snapshots, dependency diffs, rollback, offline cache, release risk, readiness, and report signals')
  assert(healthCenterSource.includes("from './releaseGovernance'") && healthCenterSource.includes('ReleaseGovernanceOverview') && releaseGovernanceOverviewSource.includes('Release governance cockpit') && ['releaseRiskProfile', 'releaseEvidenceCompleteness', 'releaseIntegrityVerification', 'releaseSignature', 'releaseTrustPolicy', 'dependencyChangeApprovalPacket', 'dependencyChangeCalendar', 'dependencyChangeExecutionRecord'].every((signal) => releaseGovernanceOverviewSource.includes(signal)), 'health center release governance overview is isolated in a release governance submodule that summarizes risk, evidence, integrity, signature, trust, and dependency-change execution signals')
  assert(healthCenterSource.includes("from './riskGovernance'") && healthCenterSource.includes('RiskGovernanceOverview') && !healthCenterEntrySource.includes('Risk governance cockpit') && riskGovernanceOverviewSource.includes('Risk governance cockpit') && ['releaseRiskProfile', 'dependencyDiff', 'auditEvidence', 'vulnerabilityRemediationPlan', 'licenseReport', 'registryReport', 'credentialRotationPlan', 'readinessReport', 'reportArtifactIndex'].every((signal) => riskGovernanceOverviewSource.includes(signal)) && riskGovernanceOverviewSource.includes('aggregateStatus') && riskGovernanceOverviewSource.includes('riskStatus'), 'health center risk governance overview is isolated in a risk submodule with complete release, dependency, vulnerability, license, registry, credential, readiness, and artifact status contracts')
  assert(healthCenterSource.includes("from './workspaceGovernance'") && healthCenterSource.includes('WorkspaceGovernanceOverview') && workspaceGovernanceOverviewSource.includes('Workspace governance cockpit') && ['workspaceReport', 'workspaceGovernanceReport', 'readinessReport', 'reportArtifactIndex', 'missingCiEvidenceWorkspaceCount', 'inheritedPolicyWorkspaceCount', 'missingSnapshotWorkspaceCount', 'floatingDeploymentRefCount'].every((signal) => workspaceGovernanceOverviewSource.includes(signal)), 'health center workspace governance overview is isolated in a workspace governance submodule that summarizes discovery, inherited sources, evidence gaps, reproducibility, operations, deployment, readiness, and report signals')
  assert(['.sectionNav', '.sectionNavLinks', '.workflowSection', '.workflowSectionHeader', '.workflowSectionTitle', '.workflowSectionMeta'].every((selector) => healthCenterStylesSource.includes(selector)), 'health center styles define responsive workflow navigation and section headers')
  assert(healthCenterSource.includes('Report library') && healthCenterSource.includes('refreshReportArtifactIndex') && healthCenterSource.includes('exportReportArtifactIndex') && healthCenterSource.includes('openReportArtifactDirectory') && healthCenterSource.includes('artifactCategoryFilter') && healthCenterSource.includes('artifactFormatFilter') && healthCenterSource.includes('artifactSearchTerm') && healthCenterSource.includes('reportArtifactRows'), 'health center exposes generated report artifact library controls, filters, search, folder opening, and tables')
  assert(healthCenterSource.includes('Release evidence completeness') && healthCenterSource.includes('refreshReleaseEvidenceCompleteness') && healthCenterSource.includes('exportReleaseEvidenceCompleteness') && healthCenterSource.includes('releaseEvidenceExpectedRows') && healthCenterSource.includes('integrityStatus') && healthCenterSource.includes('requiredIntegrityMismatchCount'), 'health center exposes release evidence completeness checks, integrity status, exports, and expected artifact tables')
  assert(healthCenterSource.includes('Release provenance attestation') && healthCenterSource.includes('refreshReleaseProvenanceAttestation') && healthCenterSource.includes('exportReleaseProvenanceAttestation') && healthCenterSource.includes('releaseProvenanceArtifactRows') && healthCenterSource.includes('Provenance JSON'), 'health center exposes release provenance checks, exports, and digest tables')
  assert(healthCenterSource.includes('Release integrity verification') && healthCenterSource.includes('refreshReleaseIntegrityVerification') && healthCenterSource.includes('exportReleaseIntegrityVerification') && healthCenterSource.includes('releaseIntegrityArtifactRows') && healthCenterSource.includes('Integrity JSON'), 'health center exposes post-bundle release integrity verification, exports, and artifact tables')
  assert(healthCenterSource.includes('Release signature') && healthCenterSource.includes('refreshReleaseSignature') && healthCenterSource.includes('exportReleaseSignature') && healthCenterSource.includes('releaseSignatureSourceRows') && healthCenterSource.includes('Signature JSON'), 'health center exposes release signature verification, exports, and signed-source tables')
  assert(healthCenterSource.includes('Release trust policy') && healthCenterSource.includes('refreshReleaseTrustPolicy') && healthCenterSource.includes('exportReleaseTrustPolicy') && healthCenterSource.includes('releaseTrustPolicyRows') && healthCenterSource.includes('Trust JSON'), 'health center exposes final release trust policy checks, exports, and trust tables')
  assert(healthCenterSource.includes('Framework coverage') && healthCenterSource.includes('frameworkCoverageRows') && healthCenterSource.includes('refreshFrameworkCoverage') && healthCenterSource.includes('exportFrameworkCoverage'), 'health center exposes framework coverage matrix and export controls')
  assert(healthCenterSource.includes('Export actions') && healthCenterSource.includes('exportRemediationPlan'), 'health center exposes remediation action plan export controls')
  assert(healthCenterSource.includes('Update plan') && healthCenterSource.includes('exportWorkspaceUpdatePlan'), 'health center exposes workspace dependency update plan export controls')
  assert(healthCenterSource.includes('License matrix') && healthCenterSource.includes('exportLicenseCompliance'), 'health center exposes license compliance matrix controls')
  assert(healthCenterSource.includes('Third-party notices') && healthCenterSource.includes('exportThirdPartyNotices') && healthCenterSource.includes('Notices JSON'), 'health center exposes third-party notice export controls')
  assert(healthCenterSource.includes('Credential map') && healthCenterSource.includes('exportCredentialUsage'), 'health center exposes credential usage map export controls')
  assert(healthCenterSource.includes('Credential rotation plan') && healthCenterSource.includes('exportCredentialRotationPlan'), 'health center exposes credential rotation summary and export controls')
  assert(dependencyUpgradePlaybookSource.includes('DependencyUpgradePlaybookService') && dependencyUpgradePlaybookSource.includes('security-hotfix') && dependencyUpgradePlaybookSource.includes('release-blocker') && dependencyUpgradePlaybookSource.includes('automation-onboarding') && dependencyUpgradePlaybookSource.includes('dependency-upgrade-playbook'), 'dependency upgrade playbook service synthesizes lane-based upgrade execution runbooks')
  assert(dependencyRollbackPlanSource.includes('DependencyRollbackPlanService') && dependencyRollbackPlanSource.includes('managed-snapshot') && dependencyRollbackPlanSource.includes('source-control-restore') && dependencyRollbackPlanSource.includes('dependency-rollback-plan'), 'dependency rollback plan service synthesizes snapshot, source-control, lockfile, and verification rollback runbooks')
  assert(dependencyImpactAnalysisSource.includes('DependencyImpactAnalysisService') && dependencyImpactAnalysisSource.includes('release-gate') && dependencyImpactAnalysisSource.includes('dependency-impact-analysis') && dependencyImpactAnalysisSource.includes('ciJobs'), 'dependency impact analysis service synthesizes blast-radius matrices from risk, CI, ownership, upgrade, and rollback sources')
  assert(dependencyChangeApprovalPacketSource.includes('DependencyChangeApprovalPacketService') && dependencyChangeApprovalPacketSource.includes('Approval Checklist') && dependencyChangeApprovalPacketSource.includes('dependency-change-approval-packet') && dependencyChangeApprovalPacketSource.includes('release-trust-policy'), 'dependency change approval packet service synthesizes review-ready approval checklists from impact, rollback, trust, approval, and exception sources')
  assert(dependencyChangeCalendarSource.includes('DependencyChangeCalendarService') && dependencyChangeCalendarSource.includes('Freeze Windows') && dependencyChangeCalendarSource.includes('Change Windows') && dependencyChangeCalendarSource.includes('VCALENDAR') && dependencyChangeCalendarSource.includes('Dependency Change Freeze Gate') && dependencyChangeCalendarSource.includes('Dependency Change Ticket') && dependencyChangeCalendarSource.includes('dependency-change-calendar'), 'dependency change calendar service synthesizes change windows, freeze windows, ICS calendars, CI freeze gates, and change-ticket templates from approval and impact sources')
  assert(dependencyChangeExecutionRecordSource.includes('DependencyChangeExecutionRecordService') && dependencyChangeExecutionRecordSource.includes('Dependency Change Execution Record') && dependencyChangeExecutionRecordSource.includes('operation-history') && dependencyChangeExecutionRecordSource.includes('ci-evidence') && dependencyChangeExecutionRecordSource.includes('dependency-change-execution-record'), 'dependency change execution record service synthesizes post-change execution audit records from calendar, approval, CI, and operation history sources')
  assert(healthCenterSource.includes('Lock drift') && healthCenterSource.includes('exportLockfileDrift'), 'health center exposes lockfile drift export controls')
  assert(healthCenterSource.includes('Runtime pins') && healthCenterSource.includes('exportRuntimePinning'), 'health center exposes runtime pinning export controls')
  assert(healthCenterSource.includes('Offline cache') && healthCenterSource.includes('exportOfflineCacheReadiness'), 'health center exposes offline cache readiness export controls')
  assert(healthCenterSource.includes('Release risk profile') && healthCenterSource.includes('exportReleaseRiskProfile'), 'health center exposes release risk profile summary and export controls')
  assert(healthCenterSource.includes('CiIntegrationPlanPanel') && healthCenterSource.includes('exportCiIntegrationPlan') && healthCenterSource.includes('GitHub Actions') && !healthCenterEntrySource.includes('Deployment release gates') && ciIntegrationPlanPanelSource.includes('CI integration plan') && ciIntegrationPlanPanelSource.includes('Deployment release gates') && ciIntegrationPlanPanelSource.includes('deploymentWarningCount'), 'health center exposes CI integration plan summary, deployment gates, and workflow export controls through the automation details module')
  assert(healthCenterSource.includes('Dependency automation plan') && healthCenterSource.includes('exportDependencyAutomationPlan') && healthCenterSource.includes('Dependabot') && healthCenterSource.includes('Renovate'), 'health center exposes dependency automation plan and config export controls')
  assert(healthCenterSource.includes('Automation safety plan') && healthCenterSource.includes('exportAutomationSafetyPlan'), 'health center exposes automation safety plan summary and export controls')
  assert(healthCenterSource.includes('Dependency ownership plan') && healthCenterSource.includes('exportDependencyOwnershipPlan') && healthCenterSource.includes('CODEOWNERS'), 'health center exposes dependency ownership plan summary and CODEOWNERS export controls')
  assert(healthCenterSource.includes('Dependency upgrade playbook') && healthCenterSource.includes('exportDependencyUpgradePlaybook') && healthCenterSource.includes('dependencyUpgradeLanes') && healthCenterSource.includes('Playbook JSON'), 'health center exposes dependency upgrade playbook exports, lane summaries, and playbook item tables')
  assert(healthCenterSource.includes('Dependency rollback plan') && healthCenterSource.includes('exportDependencyRollbackPlan') && healthCenterSource.includes('dependencyRollbackItems') && healthCenterSource.includes('Rollback JSON'), 'health center exposes dependency rollback plan exports, rollback coverage summaries, and rollback item tables')
  assert(healthCenterSource.includes('Dependency impact analysis') && healthCenterSource.includes('exportDependencyImpactAnalysis') && healthCenterSource.includes('dependencyImpactItems') && healthCenterSource.includes('Impact JSON'), 'health center exposes dependency impact analysis exports, blast-radius summaries, and impact item tables')
  assert(healthCenterSource.includes('Dependency change approval packet') && healthCenterSource.includes('exportDependencyChangeApprovalPacket') && healthCenterSource.includes('dependencyApprovalChecklist') && healthCenterSource.includes('Approval JSON'), 'health center exposes dependency change approval packet exports, checklist summaries, participants, and scope tables')
  assert(healthCenterSource.includes('Dependency change calendar') && healthCenterSource.includes('exportDependencyChangeCalendar') && healthCenterSource.includes('dependencyChangeWindows') && healthCenterSource.includes('Calendar JSON') && healthCenterSource.includes('Calendar ICS') && healthCenterSource.includes('Freeze gate') && healthCenterSource.includes('Ticket template'), 'health center exposes dependency change calendar exports, ICS calendars, freeze gates, ticket templates, freeze windows, and schedule tables')
  assert(healthCenterSource.includes('Dependency change execution record') && healthCenterSource.includes('exportDependencyChangeExecutionRecord') && healthCenterSource.includes('dependencyExecutionRecords') && healthCenterSource.includes('Execution JSON'), 'health center exposes dependency change execution record exports, execution evidence summaries, and evidence gap tables')
  assert(healthCenterSource.includes('Policy-as-code pack') && healthCenterSource.includes('exportPolicyAsCodePack') && healthCenterSource.includes('Policy workflow') && healthCenterSource.includes('Deployment policy gate') && healthCenterSource.includes('Required evidence artifact') && healthCenterSource.includes('deploymentPolicyGateCount'), 'health center exposes policy-as-code pack summary, deployment policy gates, required evidence artifacts, and workflow export controls')
  assert(healthCenterSource.includes('Audit evidence') && healthCenterSource.includes('Audit dashboard') && healthCenterSource.includes('importAuditEvidence') && healthCenterSource.includes('exportAuditEvidence'), 'health center exposes audit evidence import, export, and dashboard controls')
  assert(healthCenterSource.includes('Vulnerability remediation') && healthCenterSource.includes('exportVulnerabilityRemediationPlan') && healthCenterSource.includes('Remediation JSON'), 'health center exposes vulnerability remediation plan summaries and exports')
  assert(readinessPolicyEditorSource.includes('blockOnLockfileDrift') && readinessPolicyEditorSource.includes('blockOnRuntimePinning') && readinessPolicyEditorSource.includes('blockOnFloatingContainerTags') && readinessPolicyEditorSource.includes('blockOnFloatingDeploymentRefs') && readinessPolicyEditorSource.includes('blockOnMissingDeploymentBaselines'), 'readiness policy editor exposes reproducibility, deployment-reference, and deployment-baseline gate controls')
  assert(readinessPolicyEditorSource.includes('blockOnMissingCredentialEndpoints') && readinessPolicyEditorSource.includes('blockOnInsecureCredentialUsage') && readinessPolicyEditorSource.includes('blockOnWeakCredentialMatches'), 'readiness policy editor exposes credential usage gate controls')
  assert(readinessPolicyEditorSource.includes('blockOnCriticalAuditFindings') && readinessPolicyEditorSource.includes('maxHighAuditFindings') && readinessPolicyEditorSource.includes('auditEvidenceMaxAgeDays'), 'readiness policy editor exposes vulnerability audit gate controls')
  assert(healthCenterSource.includes('Approve exception') && healthCenterSource.includes('Export exceptions') && healthCenterSource.includes('recordReleaseException'), 'health center exposes release exception controls')
  assert(healthCenterSource.includes('Gate source') && healthCenterSource.includes('readinessPolicySource'), 'health center exposes workspace readiness gate inheritance state')
  assert(healthCenterSource.includes('Snapshot source') && healthCenterSource.includes('snapshotSource'), 'health center exposes workspace snapshot inheritance state')
  assert(healthCenterSource.includes('CI source') && healthCenterSource.includes('ciEvidenceSource'), 'health center exposes workspace CI evidence inheritance state')
  assert(healthCenterSource.includes('Approval source') && healthCenterSource.includes('releaseApprovalSource'), 'health center exposes workspace release approval inheritance state')
  assert(healthCenterSource.includes('Exception source') && healthCenterSource.includes('releaseExceptionSource'), 'health center exposes workspace release exception inheritance state')

  phaseEnd('static-contracts')
  phaseStart('fixture-governance')
  const cwd = await createFixture()
  phaseStart('extended-parsers')
  try {
    const workspaceDiscovery = new WorkspaceDiscoveryService()
    const workspaceReport = await workspaceDiscovery.report(cwd)
    assert(workspaceReport.summary.workspaceCount >= 7, 'workspace discovery finds root and cross-ecosystem subprojects')
    assert(workspaceReport.workspaces.some((workspace) => workspace.kind === 'npm-workspace' && workspace.relativePath === 'apps/admin'), 'workspace discovery expands package.json workspaces')
    assert(workspaceReport.workspaces.some((workspace) => workspace.kind === 'pnpm-workspace' && workspace.relativePath === 'packages/web'), 'workspace discovery expands pnpm workspace packages')
    assert(workspaceReport.workspaces.some((workspace) => workspace.kind === 'cargo-member' && workspace.relativePath === 'crates/core'), 'workspace discovery expands Cargo workspace members')
    assert(workspaceReport.workspaces.some((workspace) => workspace.kind === 'maven-module' && workspace.relativePath === 'java/service'), 'workspace discovery expands Maven modules')
    assert(workspaceReport.workspaces.some((workspace) => workspace.kind === 'gradle-project' && workspace.relativePath === 'gradle-app'), 'workspace discovery expands Gradle included projects')
    assert(workspaceReport.workspaces.some((workspace) => workspace.kind === 'go-work-module' && workspace.relativePath === 'go/services/api'), 'workspace discovery expands go.work modules')
    assert(workspaceReport.summary.managers.includes('npm') && workspaceReport.summary.managers.includes('cargo') && workspaceReport.summary.managers.includes('go'), 'workspace discovery summarizes managers across workspace nodes')
    assert(['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Cloud and GitOps managers from repository manifests')
    assert(['sbt', 'leiningen', 'mix', 'rebar3', 'cabal', 'stack'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Polyglot managers from repository manifests')
    assert(['renv', 'julia'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Data managers from repository manifests')
    assert(['terraform', 'opentofu', 'ansible'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Infra managers from repository manifests')
    assert(['github-actions', 'gitlab-ci', 'pre-commit'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Automation managers from repository manifests')
    assert(['bazel', 'pants', 'buck'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Build managers from repository manifests')
    assert(['opam', 'cpan', 'luarocks', 'shards', 'zig'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes Systems and scripting managers from repository manifests')
    assert(['homebrew', 'chocolatey', 'scoop', 'winget', 'asdf', 'mise', 'sdkman', 'apt', 'dnf', 'apk', 'pacman', 'nix'].every((id) => workspaceReport.summary.managers.includes(id)), 'workspace discovery summarizes system package, Linux, Nix, and runtime managers from repository manifests')
    const exportedWorkspaceReport = await workspaceDiscovery.exportMarkdown(cwd)
    const exportedWorkspaceText = await readFile(exportedWorkspaceReport.path, 'utf-8')
    assert(exportedWorkspaceText.includes('Workspace Discovery Report') && exportedWorkspaceText.includes('packages/web'), 'workspace discovery exports markdown reports')

    const governancePolicy = new SupplyChainService()
    await governancePolicy.savePolicy(cwd, {
      requirePinnedVersions: false,
      disallowPrerelease: false,
      requireKnownLicenses: false,
      blockedManagers: [],
      blockedPackages: ['antd'],
      blockedLicenses: [],
      allowedLicenses: [],
      allowedManagers: [],
      packageRules: []
    })
    const governanceSnapshot = await governancePolicy.createSnapshot(cwd, {
      reason: 'workspace governance root snapshot',
      source: 'manual'
    })
    assert(governanceSnapshot.files.some((file) => file.file === 'packages/web/package.json'), 'repository snapshots capture nested workspace dependency files')
    const governanceApprovals = new ReleaseApprovalService()
    await governanceApprovals.record(cwd, {
      reviewer: 'release-board',
      decision: 'approved',
      scope: 'release',
      decidedAt: new Date(Date.now() - 60000).toISOString(),
      summary: 'root monorepo dependency release approved'
    })
    await governanceApprovals.record(join(cwd, 'apps', 'admin'), {
      reviewer: 'workspace-owner',
      decision: 'rejected',
      scope: 'dependency-change',
      decidedAt: new Date().toISOString(),
      summary: 'admin workspace needs changelog review'
    })
    const governanceCiEvidence = new CiEvidenceService()
    await governanceCiEvidence.record(cwd, {
      source: 'manual',
      provider: 'release-ci',
      workflow: 'monorepo smoke',
      status: 'success',
      finishedAt: new Date(Date.now() - 45000).toISOString(),
      totalTests: 9,
      passedTests: 9,
      failedTests: 0,
      summary: 'root workspace CI passed'
    })
    await governanceCiEvidence.record(join(cwd, 'apps', 'admin'), {
      source: 'manual',
      provider: 'release-ci',
      workflow: 'admin smoke',
      status: 'failed',
      finishedAt: new Date().toISOString(),
      totalTests: 5,
      passedTests: 4,
      failedTests: 1,
      summary: 'admin workspace CI failed'
    })
    const governanceAuditEvidence = new AuditEvidenceService()
    const governanceVulnerabilityRemediation = new VulnerabilityRemediationPlanService({
      auditEvidenceService: governanceAuditEvidence
    })
    const governanceReleaseExceptions = new ReleaseExceptionService()
    await governanceReleaseExceptions.record(cwd, {
      reviewer: 'release-risk-board',
      reason: 'Root workspace exception evidence inheritance smoke test',
      scope: 'policy-exception',
      checkIds: ['workspace-demo-exception'],
      decidedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      ticket: 'RISK-INHERIT'
    })
    const adminLocalException = await governanceReleaseExceptions.record(join(cwd, 'apps', 'admin'), {
      reviewer: 'admin-risk-board',
      reason: 'Admin workspace local exception override smoke test',
      scope: 'policy-exception',
      checkIds: ['ci-evidence'],
      decidedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    })
    await governanceReleaseExceptions.revoke(join(cwd, 'apps', 'admin'), adminLocalException.id, {
      reviewer: 'admin-risk-board',
      reason: 'Local exception intentionally revoked so root exception is not inherited'
    })
    const governanceRegistryReachability = new RegistryReachabilityService({
      checker: async () => ({
        status: 'reachable',
        statusCode: 200,
        message: 'workspace governance registry reachable'
      })
    })
    const governanceCredentialUsage = new CredentialUsageService({
      registryReachabilityService: governanceRegistryReachability,
      credentialVault: {
        status: () => ({ available: true, encrypted: true, storage: 'test-adapter' }),
        list: async () => []
      }
    })
    const governanceReadiness = new ReadinessGateService({
      supplyChainService: governancePolicy,
      ciEvidenceService: governanceCiEvidence,
      auditEvidenceService: governanceAuditEvidence,
      releaseApprovalService: governanceApprovals,
      releaseExceptionService: governanceReleaseExceptions,
      registryReachabilityService: governanceRegistryReachability,
      checkTool: async (tool) => ({ tool, available: true, version: String(tool) + ' 1.0.0' }),
      credentialVault: {
        status: () => ({ available: true, encrypted: true, storage: 'test-adapter' }),
        list: async () => []
      }
    })
    await governanceReadiness.savePolicy(cwd, {
      ...DEFAULT_READINESS_POLICY,
      blockOnMissingSnapshots: true,
      blockOnMissingCiEvidence: true,
      maxHighRiskDependencyChanges: 100,
      maxMediumRiskDependencyChanges: 100,
      requiredReleaseApprovals: 1,
      blockOnMissingReleaseApprovals: true
    })
    const governanceOfflineCache = new OfflineCacheReadinessService({
      workspaceDiscoveryService: workspaceDiscovery
    })
    const governanceDependencyAutomation = new DependencyAutomationPlanService({
      workspaceDiscoveryService: workspaceDiscovery
    })
    const governanceCredentialRotation = new CredentialRotationPlanService({
      dependencyAutomationPlanService: governanceDependencyAutomation
    })
    const governanceReleaseRiskProfile = new ReleaseRiskProfileService({
      supplyChainService: governancePolicy,
      readinessGateService: governanceReadiness,
      registryReachabilityService: governanceRegistryReachability,
      credentialUsageService: governanceCredentialUsage,
      workspaceDiscoveryService: workspaceDiscovery,
      offlineCacheReadinessService: governanceOfflineCache,
      auditEvidenceService: governanceAuditEvidence
    })
    const governanceCiIntegrationPlan = new CiIntegrationPlanService({
      workspaceDiscoveryService: workspaceDiscovery,
      readinessGateService: governanceReadiness,
      offlineCacheReadinessService: governanceOfflineCache,
      releaseRiskProfileService: governanceReleaseRiskProfile
    })
    const governanceAutomationSafety = new AutomationSafetyPlanService({
      dependencyAutomationPlanService: governanceDependencyAutomation,
      credentialRotationPlanService: governanceCredentialRotation,
      readinessGateService: governanceReadiness,
      releaseRiskProfileService: governanceReleaseRiskProfile
    })
    const governanceDependencyOwnership = new DependencyOwnershipPlanService({
      workspaceDiscoveryService: workspaceDiscovery,
      dependencyAutomationPlanService: governanceDependencyAutomation,
      automationSafetyPlanService: governanceAutomationSafety
    })
    const governancePolicyAsCode = new PolicyAsCodePackService({
      supplyChainService: governancePolicy,
      readinessGateService: governanceReadiness,
      dependencyAutomationPlanService: governanceDependencyAutomation,
      automationSafetyPlanService: governanceAutomationSafety,
      dependencyOwnershipPlanService: governanceDependencyOwnership,
      workspaceDiscoveryService: workspaceDiscovery
    })
    const workspaceGovernance = new WorkspaceGovernanceService({
      workspaceDiscoveryService: workspaceDiscovery,
      supplyChainService: governancePolicy,
      readinessGateService: governanceReadiness,
      releaseApprovalService: governanceApprovals,
      releaseExceptionService: governanceReleaseExceptions,
      ciEvidenceService: governanceCiEvidence,
      auditEvidenceService: governanceAuditEvidence,
      registryReachabilityService: governanceRegistryReachability,
      credentialUsageService: governanceCredentialUsage,
      offlineCacheReadinessService: governanceOfflineCache,
      releaseRiskProfileService: governanceReleaseRiskProfile,
      vulnerabilityRemediationPlanService: governanceVulnerabilityRemediation,
      ciIntegrationPlanService: governanceCiIntegrationPlan,
      dependencyAutomationPlanService: governanceDependencyAutomation,
      credentialRotationPlanService: governanceCredentialRotation,
      automationSafetyPlanService: governanceAutomationSafety,
      dependencyOwnershipPlanService: governanceDependencyOwnership,
      policyAsCodePackService: governancePolicyAsCode
    })
    const dependencyHealthDashboard = new DependencyHealthDashboardService({
      workspaceDiscoveryService: workspaceDiscovery,
      workspaceGovernanceService: workspaceGovernance,
      supplyChainService: governancePolicy,
      readinessGateService: governanceReadiness,
      lockfileDriftService: new LockfileDriftService({ workspaceDiscoveryService: workspaceDiscovery }),
      runtimePinningService: new RuntimePinningService({ workspaceDiscoveryService: workspaceDiscovery }),
      offlineCacheReadinessService: governanceOfflineCache,
      releaseRiskProfileService: governanceReleaseRiskProfile,
      credentialUsageService: governanceCredentialUsage,
      registryReachabilityService: governanceRegistryReachability,
      auditEvidenceService: governanceAuditEvidence
    })
    const reportArtifactIndex = new ReportArtifactIndexService()
    const releaseEvidenceCompleteness = new ReleaseEvidenceCompletenessService({
      reportArtifactIndexService: reportArtifactIndex,
      policyAsCodePackService: governancePolicyAsCode
    })
    const releaseProvenanceAttestation = new ReleaseProvenanceAttestationService({
      reportArtifactIndexService: reportArtifactIndex,
      releaseEvidenceCompletenessService: releaseEvidenceCompleteness
    })
    const releaseIntegrityVerification = new ReleaseIntegrityVerificationService()
    const releaseSignature = new ReleaseSignatureService()
    const releaseTrustPolicy = new ReleaseTrustPolicyService({
      releaseSignatureService: releaseSignature,
      releaseIntegrityVerificationService: releaseIntegrityVerification,
      releaseProvenanceAttestationService: releaseProvenanceAttestation,
      releaseEvidenceCompletenessService: releaseEvidenceCompleteness,
      releaseApprovalService: governanceApprovals,
      releaseExceptionService: governanceReleaseExceptions
    })
    const dependencyUpgradePlaybook = new DependencyUpgradePlaybookService({
      workspaceGovernanceService: workspaceGovernance,
      vulnerabilityRemediationPlanService: governanceVulnerabilityRemediation,
      releaseRiskProfileService: governanceReleaseRiskProfile,
      dependencyAutomationPlanService: governanceDependencyAutomation,
      dependencyOwnershipPlanService: governanceDependencyOwnership
    })
    const dependencyRollbackPlan = new DependencyRollbackPlanService({
      workspaceGovernanceService: workspaceGovernance
    })
    const dependencyImpactAnalysis = new DependencyImpactAnalysisService({
      workspaceGovernanceService: workspaceGovernance,
      dependencyUpgradePlaybookService: dependencyUpgradePlaybook,
      dependencyRollbackPlanService: dependencyRollbackPlan,
      releaseRiskProfileService: governanceReleaseRiskProfile,
      ciIntegrationPlanService: governanceCiIntegrationPlan,
      dependencyOwnershipPlanService: governanceDependencyOwnership
    })
    const dependencyChangeApprovalPacket = new DependencyChangeApprovalPacketService({
      dependencyImpactAnalysisService: dependencyImpactAnalysis,
      dependencyUpgradePlaybookService: dependencyUpgradePlaybook,
      dependencyRollbackPlanService: dependencyRollbackPlan,
      releaseTrustPolicyService: releaseTrustPolicy,
      releaseApprovalService: governanceApprovals,
      releaseExceptionService: governanceReleaseExceptions
    })
    const dependencyChangeCalendar = new DependencyChangeCalendarService({
      dependencyChangeApprovalPacketService: dependencyChangeApprovalPacket,
      dependencyImpactAnalysisService: dependencyImpactAnalysis
    })
    const dependencyChangeExecutionRecord = new DependencyChangeExecutionRecordService({
      dependencyChangeCalendarService: dependencyChangeCalendar,
      dependencyChangeApprovalPacketService: dependencyChangeApprovalPacket,
      ciEvidenceService: governanceCiEvidence
    })
    const frameworkCoverage = new FrameworkCoverageService()
    const workspaceGovernanceReport = await workspaceGovernance.report(cwd)
    const inheritedSnapshotWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'packages/web')
    const inheritedCiWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'packages/web')
    const failedCiWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'apps/admin')
    const inheritedApprovalWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'packages/web')
    const rejectedApprovalWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'apps/admin')
    const inheritedExceptionWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'packages/web')
    const localExceptionWorkspace = workspaceGovernanceReport.workspaces.find((node) => node.workspace.relativePath === 'apps/admin')
    assert(workspaceGovernanceReport.summary.workspaceCount === workspaceReport.summary.workspaceCount, 'workspace governance covers every discovered workspace')
    assert(workspaceGovernanceReport.summary.warning + workspaceGovernanceReport.summary.blocked > 0, 'workspace governance summarizes workspace release risks')
    assert(workspaceGovernanceReport.summary.inheritedPolicyWorkspaceCount > 0, 'workspace governance applies repository root policy inheritance to child workspaces')
    assert(workspaceGovernanceReport.summary.inheritedReadinessPolicyWorkspaceCount > 0, 'workspace governance applies repository root readiness policy inheritance to child workspaces')
    assert(workspaceGovernanceReport.summary.inheritedSnapshotWorkspaceCount > 0 && workspaceGovernanceReport.summary.inheritedSnapshotCoveredFileCount > 0, 'workspace governance applies repository root snapshot coverage to child workspaces')
    assert(workspaceGovernanceReport.summary.inheritedCiEvidenceWorkspaceCount > 0, 'workspace governance applies repository root CI evidence inheritance to child workspaces')
    assert(workspaceGovernanceReport.summary.failedCiEvidenceWorkspaceCount > 0, 'workspace governance summarizes failed workspace CI evidence')
    assert(workspaceGovernanceReport.summary.inheritedReleaseApprovalEvidenceWorkspaceCount > 0, 'workspace governance applies repository root release approval inheritance to child workspaces')
    assert(workspaceGovernanceReport.summary.rejectedReleaseApprovalWorkspaceCount > 0, 'workspace governance summarizes rejected workspace release approvals')
    assert(workspaceGovernanceReport.summary.inheritedReleaseExceptionEvidenceWorkspaceCount > 0, 'workspace governance applies repository root release exception inheritance to child workspaces')
    assert(workspaceGovernanceReport.summary.workspaceReleaseExceptionEvidenceCount > 0, 'workspace governance preserves workspace-local release exception overrides')
    assert(workspaceGovernanceReport.summary.activeReleaseExceptionCount > 0, 'workspace governance summarizes active release exceptions')
    assert(workspaceGovernanceReport.workspaces.some((node) => node.workspace.relativePath === 'apps/admin' && node.policySource === 'inherited-root' && node.status === 'blocked'), 'workspace governance blocks child workspaces on inherited root policy violations')
    assert(inheritedSnapshotWorkspace && inheritedSnapshotWorkspace.snapshotSource === 'inherited-root' && inheritedSnapshotWorkspace.snapshotCoveredFiles.includes('packages/web/package.json'), 'workspace governance inherits root snapshots only when they cover workspace files')
    assert(inheritedSnapshotWorkspace && inheritedSnapshotWorkspace.readinessPolicySource === 'inherited-root' && !inheritedSnapshotWorkspace.readinessBlockedChecks.some((item) => item.id === 'dependency-snapshots'), 'workspace governance feeds inherited snapshots into workspace readiness gates')
    assert(inheritedCiWorkspace && inheritedCiWorkspace.ciEvidenceSource === 'inherited-root' && inheritedCiWorkspace.latestCiStatus === 'success', 'workspace governance inherits root CI evidence into child release gates')
    assert(inheritedCiWorkspace && !inheritedCiWorkspace.findings.some((item) => item.id === 'workspace-ci-evidence' && item.summary.includes('No CI evidence')), 'inherited root CI evidence satisfies workspace CI requirements')
    assert(failedCiWorkspace && failedCiWorkspace.ciEvidenceSource === 'workspace' && failedCiWorkspace.latestCiStatus === 'failed' && failedCiWorkspace.status === 'blocked', 'workspace-local failed CI evidence overrides inherited root CI evidence')
    assert(inheritedApprovalWorkspace && inheritedApprovalWorkspace.releaseApprovalSource === 'inherited-root' && inheritedApprovalWorkspace.activeReleaseApprovalCount >= 1, 'workspace governance inherits root release approvals into child release gates')
    assert(inheritedApprovalWorkspace && !inheritedApprovalWorkspace.findings.some((item) => item.id === 'workspace-release-approvals' && item.summary.includes('No release approval')), 'inherited root approvals satisfy workspace release approval requirements')
    assert(rejectedApprovalWorkspace && rejectedApprovalWorkspace.releaseApprovalSource === 'workspace' && rejectedApprovalWorkspace.latestReleaseApprovalDecision === 'rejected' && rejectedApprovalWorkspace.status === 'blocked', 'workspace-local rejected release approvals override inherited root approvals')
    assert(inheritedExceptionWorkspace && inheritedExceptionWorkspace.releaseExceptionSource === 'inherited-root' && inheritedExceptionWorkspace.activeReleaseExceptionCount >= 1, 'workspace governance inherits root release exceptions into child release gates')
    assert(localExceptionWorkspace && localExceptionWorkspace.releaseExceptionSource === 'workspace' && localExceptionWorkspace.activeReleaseExceptionCount === 0 && localExceptionWorkspace.latestReleaseExceptionDecision === 'revoked', 'workspace-local release exception records override inherited root exceptions')
    assert(workspaceGovernanceReport.workspaces.some((node) => node.workspace.relativePath === 'packages/web' && node.componentCount > 0), 'workspace governance scans components per workspace partition')
    assert(workspaceGovernanceReport.workspaces.some((node) => node.workspace.relativePath === 'packages/web' && node.missingLockManagers.includes('npm')), 'workspace governance flags per-workspace missing lockfiles')
    const exportedWorkspaceGovernance = await workspaceGovernance.exportMarkdown(cwd)
    const exportedWorkspaceGovernanceText = await readFile(exportedWorkspaceGovernance.path, 'utf-8')
    assert(exportedWorkspaceGovernanceText.includes('Workspace Governance Report') && exportedWorkspaceGovernanceText.includes('Snapshot source') && exportedWorkspaceGovernanceText.includes('CI source') && exportedWorkspaceGovernanceText.includes('Approval source') && exportedWorkspaceGovernanceText.includes('Exception source') && exportedWorkspaceGovernanceText.includes('packages/web'), 'workspace governance exports markdown release reports')
    const exportedWorkspaceEvidence = await workspaceGovernance.exportEvidenceJson(cwd)
    const workspaceEvidenceManifest = JSON.parse(await readFile(exportedWorkspaceEvidence.path, 'utf-8'))
    assert(workspaceEvidenceManifest.workspaces.some((node) => node.workspace.relativePath === 'packages/web' && node.components.some((component) => component.name === 'react')), 'workspace release evidence manifest embeds per-workspace SBOM components')
    assert(workspaceEvidenceManifest.workspaces.some((node) => node.workspace.relativePath === 'packages/web' && node.snapshots.source === 'inherited-root' && node.snapshots.coveredFiles.includes('packages/web/package.json') && node.ciEvidence.source === 'inherited-root' && node.releaseApprovals.source === 'inherited-root' && node.releaseExceptions.source === 'inherited-root'), 'workspace release evidence manifest includes inherited snapshot, CI, approval, and exception evidence')
    const exportedWorkspaceEvidenceMarkdown = await workspaceGovernance.exportEvidenceMarkdown(cwd)
    const workspaceEvidenceMarkdownText = await readFile(exportedWorkspaceEvidenceMarkdown.path, 'utf-8')
    assert(workspaceEvidenceMarkdownText.includes('Workspace Release Evidence Manifest') && workspaceEvidenceMarkdownText.includes('Snapshot source') && workspaceEvidenceMarkdownText.includes('CI source') && workspaceEvidenceMarkdownText.includes('Approval source') && workspaceEvidenceMarkdownText.includes('Exception source') && workspaceEvidenceMarkdownText.includes('packages/web'), 'workspace release evidence exports markdown review artifacts')
    const remediationPlan = await workspaceGovernance.remediationPlan(cwd)
    assert(remediationPlan.summary.itemCount > 0 && remediationPlan.items.some((item) => item.scope === 'workspace' && item.workspaceRelativePath === 'apps/admin'), 'workspace remediation plan summarizes actionable project and workspace findings')
    assert(remediationPlan.items.some((item) => item.source === 'workspace-readiness' || item.source === 'workspace-governance'), 'workspace remediation plan links actions back to governance and readiness sources')
    assert(remediationPlan.summary.releaseRiskItemCount > 0 && remediationPlan.summary.deploymentItemCount > 0 && remediationPlan.items.some((item) => item.source === 'release-risk' && item.evidence.some((evidence) => evidence.includes('Category: deployment'))), 'workspace remediation plan turns release-risk deployment findings into project action items')
    const remediationMarkdown = await workspaceGovernance.exportRemediationMarkdown(cwd)
    const remediationMarkdownText = await readFile(remediationMarkdown.path, 'utf-8')
    assert(remediationMarkdownText.includes('Workspace Remediation Plan') && remediationMarkdownText.includes('Action Index') && remediationMarkdownText.includes('apps/admin') && remediationMarkdownText.includes('Release risk actions') && remediationMarkdownText.includes('Deployment actions'), 'workspace remediation plan exports Markdown action indexes')
    const remediationJson = await workspaceGovernance.exportRemediationJson(cwd)
    const remediationJsonPlan = JSON.parse(await readFile(remediationJson.path, 'utf-8'))
    assert(remediationJsonPlan.items.length === remediationPlan.items.length && remediationJsonPlan.summary.itemCount === remediationPlan.summary.itemCount, 'workspace remediation plan exports JSON action indexes')
    const updatePlan = await workspaceGovernance.updatePlan(cwd)
    assert(updatePlan.summary.itemCount >= workspaceGovernanceReport.summary.workspaceCount && updatePlan.items.some((item) => item.workspaceRelativePath === 'packages/web' && item.managerId === 'npm'), 'workspace dependency update plan creates manager-scoped plans for discovered workspaces')
    assert(updatePlan.items.some((item) => item.commands.some((command) => command.command === 'npm outdated')) && updatePlan.summary.mutatingCommandCount > 0, 'workspace dependency update plan includes inspect and mutating update commands')
    const exportedUpdatePlan = await workspaceGovernance.exportUpdatePlanMarkdown(cwd)
    const exportedUpdatePlanText = await readFile(exportedUpdatePlan.path, 'utf-8')
    assert(exportedUpdatePlanText.includes('Workspace Dependency Update Plan') && exportedUpdatePlanText.includes('npm outdated') && exportedUpdatePlanText.includes('packages/web'), 'workspace dependency update plan exports Markdown command review artifacts')
    const exportedUpdatePlanJson = await workspaceGovernance.exportUpdatePlanJson(cwd)
    const exportedUpdatePlanJsonData = JSON.parse(await readFile(exportedUpdatePlanJson.path, 'utf-8'))
    assert(exportedUpdatePlanJsonData.items.length === updatePlan.items.length && exportedUpdatePlanJsonData.summary.mutatingCommandCount === updatePlan.summary.mutatingCommandCount, 'workspace dependency update plan exports JSON command review artifacts')
    const lockfileDrift = new LockfileDriftService({ workspaceDiscoveryService: workspaceDiscovery })
    const lockfileDriftReport = await lockfileDrift.report(cwd)
    assert(lockfileDriftReport.summary.workspaceCount === workspaceReport.summary.workspaceCount && lockfileDriftReport.summary.findingCount > 0, 'lockfile drift report covers every discovered workspace and summarizes reproducibility findings')
    assert(lockfileDriftReport.summary.mixedNodeLockfileCount > 0 && lockfileDriftReport.workspaces.some((workspace) => workspace.workspace.relativePath === '.' && workspace.findings.some((finding) => finding.kind === 'mixed-node-lockfiles')), 'lockfile drift report detects mixed Node.js lockfile families')
    assert(lockfileDriftReport.summary.inheritedLockfileWorkspaceCount > 0 && lockfileDriftReport.workspaces.some((workspace) => workspace.workspace.relativePath === 'packages/web' && workspace.inheritedLockFiles.length > 0), 'lockfile drift report recognizes parent lockfile coverage for child workspaces')
    const exportedLockfileDrift = await lockfileDrift.exportMarkdown(cwd)
    const exportedLockfileDriftText = await readFile(exportedLockfileDrift.path, 'utf-8')
    assert(exportedLockfileDriftText.includes('Lockfile Drift Report') && exportedLockfileDriftText.includes('Workspace Matrix') && exportedLockfileDriftText.includes('packages/web'), 'lockfile drift report exports Markdown review artifacts')
    const exportedLockfileDriftJson = await lockfileDrift.exportJson(cwd)
    const exportedLockfileDriftJsonData = JSON.parse(await readFile(exportedLockfileDriftJson.path, 'utf-8'))
    assert(exportedLockfileDriftJsonData.summary.findingCount === lockfileDriftReport.summary.findingCount && exportedLockfileDriftJsonData.workspaces.length === lockfileDriftReport.workspaces.length, 'lockfile drift report exports JSON review artifacts')
    const runtimePinning = new RuntimePinningService({ workspaceDiscoveryService: workspaceDiscovery })
    const runtimePinningReport = await runtimePinning.report(cwd)
    assert(runtimePinningReport.summary.workspaceCount === workspaceReport.summary.workspaceCount && runtimePinningReport.summary.evidenceCount > 0, 'runtime pinning report covers every discovered workspace and records runtime evidence')
    assert(runtimePinningReport.workspaces.some((workspace) => workspace.workspace.relativePath === 'apps/admin' && workspace.evidence.some((item) => item.kind === 'node-runtime' && item.source === 'ancestor')), 'runtime pinning report inherits repository-level Node runtime evidence into child workspaces')
    assert(runtimePinningReport.summary.missingRuntimePinCount > 0 && runtimePinningReport.workspaces.some((workspace) => workspace.findings.some((finding) => finding.kind === 'missing-runtime-pin')), 'runtime pinning report flags missing runtime version pins')
    assert(runtimePinningReport.summary.floatingContainerTagCount > 0 && runtimePinningReport.workspaces.some((workspace) => workspace.findings.some((finding) => finding.kind === 'floating-container-tag')), 'runtime pinning report flags floating container image tags')
    const exportedRuntimePinning = await runtimePinning.exportMarkdown(cwd)
    const exportedRuntimePinningText = await readFile(exportedRuntimePinning.path, 'utf-8')
    assert(exportedRuntimePinningText.includes('Runtime Pinning Report') && exportedRuntimePinningText.includes('Workspace Matrix') && exportedRuntimePinningText.includes('postgres:latest'), 'runtime pinning report exports Markdown review artifacts')
    const exportedRuntimePinningJson = await runtimePinning.exportJson(cwd)
    const exportedRuntimePinningJsonData = JSON.parse(await readFile(exportedRuntimePinningJson.path, 'utf-8'))
    assert(exportedRuntimePinningJsonData.summary.evidenceCount === runtimePinningReport.summary.evidenceCount && exportedRuntimePinningJsonData.workspaces.length === runtimePinningReport.workspaces.length, 'runtime pinning report exports JSON review artifacts')
    const offlineCacheReport = await governanceOfflineCache.report(cwd)
    assert(offlineCacheReport.summary.workspaceCount === workspaceReport.summary.workspaceCount && offlineCacheReport.summary.offlineCommandManagerCount > 0, 'offline cache readiness report covers every discovered workspace and generates manager restore commands')
    assert(offlineCacheReport.summary.missingLockfileManagerCount > 0 && offlineCacheReport.workspaces.some((workspace) => workspace.findings.some((finding) => finding.kind === 'missing-lockfile')), 'offline cache readiness report flags managers without lockfile-backed restore evidence')
    assert(offlineCacheReport.summary.cacheConfigManagerCount > 0 && offlineCacheReport.workspaces.some((workspace) => workspace.evidence.some((item) => item.kind === 'registry-config' || item.kind === 'cache-config')), 'offline cache readiness report captures registry, mirror, and cache configuration evidence')
    const exportedOfflineCache = await governanceOfflineCache.exportMarkdown(cwd)
    const exportedOfflineCacheText = await readFile(exportedOfflineCache.path, 'utf-8')
    assert(exportedOfflineCacheText.includes('Offline Cache Readiness Report') && exportedOfflineCacheText.includes('Workspace Matrix') && exportedOfflineCacheText.includes('Offline restore command'), 'offline cache readiness report exports Markdown review artifacts')
    const exportedOfflineCacheJson = await governanceOfflineCache.exportJson(cwd)
    const exportedOfflineCacheJsonData = JSON.parse(await readFile(exportedOfflineCacheJson.path, 'utf-8'))
    assert(exportedOfflineCacheJsonData.summary.findingCount === offlineCacheReport.summary.findingCount && exportedOfflineCacheJsonData.workspaces.length === offlineCacheReport.workspaces.length, 'offline cache readiness report exports JSON review artifacts')
    const releaseRiskProfile = await governanceReleaseRiskProfile.report(cwd)
    assert(releaseRiskProfile.status !== 'ready' && releaseRiskProfile.summary.findingCount > 0 && releaseRiskProfile.topRisks.length > 0, 'release risk profile aggregates release-blocking and warning findings into a decision profile')
    assert(releaseRiskProfile.categories.some((category) => category.category === 'reproducibility' && category.findingCount > 0), 'release risk profile summarizes reproducibility findings from lockfile drift and runtime pinning')
    assert(releaseRiskProfile.categories.some((category) => category.category === 'deployment' && category.findingCount > 0) && releaseRiskProfile.summary.floatingDeploymentRefCount > 0 && releaseRiskProfile.summary.missingDeploymentBaselineCount > 0, 'release risk profile summarizes deployment reference and baseline findings as a dedicated risk category')
    assert(releaseRiskProfile.findings.some((finding) => finding.source === 'credential-usage') && releaseRiskProfile.findings.some((finding) => finding.source === 'lockfile-drift') && releaseRiskProfile.findings.some((finding) => finding.source === 'runtime-pinning') && releaseRiskProfile.findings.some((finding) => finding.source === 'offline-cache-readiness'), 'release risk profile normalizes credential, lockfile, runtime, and offline cache evidence into findings')
    assert(releaseRiskProfile.summary.offlineCacheFindingCount === offlineCacheReport.summary.findingCount && releaseRiskProfile.summary.missingOfflineCacheLockfileCount === offlineCacheReport.summary.missingLockfileManagerCount, 'release risk profile summarizes offline cache readiness findings')
    const exportedReleaseRiskProfile = await governanceReleaseRiskProfile.exportMarkdown(cwd)
    const exportedReleaseRiskProfileText = await readFile(exportedReleaseRiskProfile.path, 'utf-8')
    assert(exportedReleaseRiskProfileText.includes('Release Risk Profile') && exportedReleaseRiskProfileText.includes('Top Risks') && exportedReleaseRiskProfileText.includes('Reproducibility') && exportedReleaseRiskProfileText.includes('Deployment inputs') && exportedReleaseRiskProfileText.includes('Missing deployment baselines'), 'release risk profile exports Markdown decision artifacts')
    const exportedReleaseRiskProfileJson = await governanceReleaseRiskProfile.exportJson(cwd)
    const exportedReleaseRiskProfileJsonData = JSON.parse(await readFile(exportedReleaseRiskProfileJson.path, 'utf-8'))
    assert(exportedReleaseRiskProfileJsonData.summary.findingCount === releaseRiskProfile.summary.findingCount && exportedReleaseRiskProfileJsonData.categories.length >= 6, 'release risk profile exports JSON decision artifacts')
    const ciIntegrationPlan = await governanceCiIntegrationPlan.plan(cwd)
    assert(ciIntegrationPlan.summary.workspaceCount === workspaceReport.summary.workspaceCount && ciIntegrationPlan.jobs.some((job) => job.id === 'workspace-dependencies') && ciIntegrationPlan.summary.installCommandCount > 0, 'CI integration plan creates workspace matrix jobs from discovered managers')
    assert(ciIntegrationPlan.matrix.some((entry) => entry.managerIds.includes('npm')) && ciIntegrationPlan.matrix.some((entry) => entry.managerIds.includes('pnpm')) && ciIntegrationPlan.matrix.some((entry) => entry.managerIds.includes('pip') || entry.managerIds.includes('uv') || entry.managerIds.includes('poetry')), 'CI integration plan covers Node and Python ecosystem targets')
    assert(ciIntegrationPlan.matrix.some((entry) => entry.installCommands.some((command) => command.source === 'offline-cache' && command.command.includes('--offline'))) && ciIntegrationPlan.summary.offlineCommandCount > 0, 'CI integration plan reuses offline/cache restore commands')
    assert(ciIntegrationPlan.requiredSecrets.includes('NPM_TOKEN') && ciIntegrationPlan.workflowYaml.includes('actions/checkout@v4') && ciIntegrationPlan.workflowYaml.includes('actions/setup-node@v4') && ciIntegrationPlan.workflowYaml.includes('actions/setup-python@v5'), 'CI integration plan emits GitHub Actions setup and secret placeholders')
    assert(ciIntegrationPlan.workflowYaml.includes('npm ci --prefer-offline') && ciIntegrationPlan.workflowYaml.includes('pnpm install --frozen-lockfile --offline') && ciIntegrationPlan.workflowYaml.includes('npm run verify:framework --if-present') && ciIntegrationPlan.workflowYaml.includes('actions/upload-artifact@v4'), 'CI integration workflow includes frozen installs, framework verification, and artifact upload')
    assert(ciIntegrationPlan.summary.deploymentReferenceCount > 0 && ciIntegrationPlan.summary.floatingDeploymentRefCount > 0 && ciIntegrationPlan.summary.missingDeploymentBaselineCount > 0 && ciIntegrationPlan.summary.deploymentWarningCount > 0 && ciIntegrationPlan.warnings.some((warning) => warning.releaseRiskCategory === 'deployment'), 'CI integration plan promotes deployment reference and baseline risk into release evidence warnings')
    assert(ciIntegrationPlan.jobs.some((job) => job.id === 'release-evidence' && job.steps.some((step) => step.id === 'deployment-release-gate') && job.steps.some((step) => step.id === 'release-evidence-completeness')) && ciIntegrationPlan.workflowYaml.includes('Check deployment release gates') && ciIntegrationPlan.workflowYaml.includes('Check release evidence completeness') && ciIntegrationPlan.workflowYaml.includes('release-evidence-completeness.json') && ciIntegrationPlan.workflowYaml.includes('release-risk-profile.json'), 'CI integration workflow emits explicit deployment and release evidence completeness gates')
    const exportedCiPlan = await governanceCiIntegrationPlan.exportMarkdown(cwd)
    const exportedCiPlanText = await readFile(exportedCiPlan.path, 'utf-8')
    assert(exportedCiPlanText.includes('CI Integration Plan') && exportedCiPlanText.includes('Workspace Matrix') && exportedCiPlanText.includes('GitHub Actions Workflow') && exportedCiPlanText.includes('Deployment references') && exportedCiPlanText.includes('Missing deployment baselines'), 'CI integration plan exports Markdown review artifacts')
    const exportedCiPlanJson = await governanceCiIntegrationPlan.exportJson(cwd)
    const exportedCiPlanJsonData = JSON.parse(await readFile(exportedCiPlanJson.path, 'utf-8'))
    assert(exportedCiPlanJsonData.summary.workspaceCount === ciIntegrationPlan.summary.workspaceCount && exportedCiPlanJsonData.workflowYaml.includes('Dependency Governance'), 'CI integration plan exports JSON workflow artifacts')
    const exportedGithubActions = await governanceCiIntegrationPlan.exportGithubActions(cwd)
    const exportedGithubActionsText = await readFile(exportedGithubActions.path, 'utf-8')
    assert(exportedGithubActionsText.includes('name: Dependency Governance') && exportedGithubActionsText.includes('workspace-dependencies') && exportedGithubActionsText.includes('release-evidence') && exportedGithubActionsText.includes('Check deployment release gates') && exportedGithubActionsText.includes('Check release evidence completeness'), 'CI integration plan exports a GitHub Actions workflow file')
    const dependencyAutomationPlan = await governanceDependencyAutomation.plan(cwd)
    assert(dependencyAutomationPlan.summary.workspaceCount === workspaceReport.summary.workspaceCount && dependencyAutomationPlan.summary.dependabotTargetCount > 0 && dependencyAutomationPlan.summary.renovateTargetCount > 0, 'dependency automation plan creates Dependabot and Renovate targets from discovered managers')
    assert(dependencyAutomationPlan.dependabotYaml.includes('version: 2') && dependencyAutomationPlan.dependabotYaml.includes('package-ecosystem: "npm"') && dependencyAutomationPlan.dependabotYaml.includes('package-ecosystem: "gomod"') && dependencyAutomationPlan.dependabotYaml.includes('package-ecosystem: "docker"'), 'dependency automation plan emits Dependabot ecosystems for Node, Go, and Docker')
    assert(dependencyAutomationPlan.renovateJson.includes('"enabledManagers"') && dependencyAutomationPlan.renovateJson.includes('"npm"') && dependencyAutomationPlan.renovateJson.includes('"pip_requirements"') && dependencyAutomationPlan.renovateJson.includes('"dockerfile"'), 'dependency automation plan emits Renovate manager configuration')
    assert(dependencyAutomationPlan.requiredSecrets.includes('NPM_TOKEN') && dependencyAutomationPlan.requiredSecrets.includes('PYPI_TOKEN') && dependencyAutomationPlan.warnings.some((warning) => warning.source === 'registry-secrets'), 'dependency automation plan records private registry secret placeholders without reading secrets')
    const exportedAutomationPlan = await governanceDependencyAutomation.exportMarkdown(cwd)
    const exportedAutomationPlanText = await readFile(exportedAutomationPlan.path, 'utf-8')
    assert(exportedAutomationPlanText.includes('Dependency Automation Plan') && exportedAutomationPlanText.includes('Automation Targets') && exportedAutomationPlanText.includes('Dependabot') && exportedAutomationPlanText.includes('Renovate'), 'dependency automation plan exports Markdown review artifacts')
    const exportedAutomationPlanJson = await governanceDependencyAutomation.exportJson(cwd)
    const exportedAutomationPlanJsonData = JSON.parse(await readFile(exportedAutomationPlanJson.path, 'utf-8'))
    assert(exportedAutomationPlanJsonData.summary.targetCount === dependencyAutomationPlan.summary.targetCount && exportedAutomationPlanJsonData.dependabotYaml.includes('package-ecosystem'), 'dependency automation plan exports JSON configuration artifacts')
    const exportedDependabot = await governanceDependencyAutomation.exportDependabot(cwd)
    const exportedDependabotText = await readFile(exportedDependabot.path, 'utf-8')
    assert(exportedDependabotText.includes('version: 2') && exportedDependabotText.includes('groups:') && exportedDependabotText.includes('registries:'), 'dependency automation plan exports Dependabot YAML')
    const exportedRenovate = await governanceDependencyAutomation.exportRenovate(cwd)
    const exportedRenovateJson = JSON.parse(await readFile(exportedRenovate.path, 'utf-8'))
    assert(Array.isArray(exportedRenovateJson.enabledManagers) && exportedRenovateJson.enabledManagers.includes('npm') && exportedRenovateJson.packageRules.length > 0, 'dependency automation plan exports Renovate JSON')
    const automationSafetyPlan = await governanceAutomationSafety.plan(cwd)
    assert(automationSafetyPlan.summary.ruleCount > 0 && automationSafetyPlan.rules.some((rule) => rule.updateType === 'patch') && automationSafetyPlan.rules.some((rule) => rule.updateType === 'major'), 'automation safety plan creates update-type rules for automation targets')
    assert(automationSafetyPlan.status === 'blocked' && automationSafetyPlan.summary.blockedRuleCount > 0 && automationSafetyPlan.findings.some((finding) => finding.source === 'credential-rotation' || finding.source === 'readiness-gate'), 'automation safety plan blocks automated updates when production evidence has blockers')
    assert(automationSafetyPlan.renovateSafetyPreset.includes('dependencyDashboard') && automationSafetyPlan.renovateSafetyPreset.includes('automation-blocked'), 'automation safety plan emits a Renovate safety preset')
    const exportedAutomationSafety = await governanceAutomationSafety.exportMarkdown(cwd)
    const exportedAutomationSafetyText = await readFile(exportedAutomationSafety.path, 'utf-8')
    assert(exportedAutomationSafetyText.includes('Automation Safety Plan') && exportedAutomationSafetyText.includes('Safety Rules') && exportedAutomationSafetyText.includes('Renovate Safety Preset'), 'automation safety plan exports Markdown review artifacts')
    const exportedAutomationSafetyJson = await governanceAutomationSafety.exportJson(cwd)
    const exportedAutomationSafetyJsonData = JSON.parse(await readFile(exportedAutomationSafetyJson.path, 'utf-8'))
    assert(exportedAutomationSafetyJsonData.summary.ruleCount === automationSafetyPlan.summary.ruleCount && exportedAutomationSafetyJsonData.renovateSafetyPreset.includes('packageRules'), 'automation safety plan exports JSON policy artifacts')
    const dependencyOwnershipPlan = await governanceDependencyOwnership.plan(cwd)
    assert(dependencyOwnershipPlan.summary.assignmentCount > 0 && dependencyOwnershipPlan.assignments.some((assignment) => assignment.workspaceRelativePath === 'packages/web' && assignment.owners.includes('@org/web')), 'dependency ownership plan maps workspace managers to CODEOWNERS')
    assert(dependencyOwnershipPlan.summary.reviewRouteCount > 0 && dependencyOwnershipPlan.reviewRoutes.some((route) => route.managerId === 'npm' && route.owners.length > 0), 'dependency ownership plan maps automation safety routes to owners')
    assert(dependencyOwnershipPlan.summary.missingOwnerAssignmentCount > 0 && dependencyOwnershipPlan.suggestedCodeownersText.includes('@dependency-owners'), 'dependency ownership plan flags missing owners and emits suggested CODEOWNERS entries')
    const exportedOwnership = await governanceDependencyOwnership.exportMarkdown(cwd)
    const exportedOwnershipText = await readFile(exportedOwnership.path, 'utf-8')
    assert(exportedOwnershipText.includes('Dependency Ownership Plan') && exportedOwnershipText.includes('Owner Assignments') && exportedOwnershipText.includes('Suggested CODEOWNERS'), 'dependency ownership plan exports Markdown review artifacts')
    const exportedOwnershipJson = await governanceDependencyOwnership.exportJson(cwd)
    const exportedOwnershipJsonData = JSON.parse(await readFile(exportedOwnershipJson.path, 'utf-8'))
    assert(exportedOwnershipJsonData.summary.assignmentCount === dependencyOwnershipPlan.summary.assignmentCount && exportedOwnershipJsonData.reviewRoutes.length === dependencyOwnershipPlan.reviewRoutes.length, 'dependency ownership plan exports JSON routing artifacts')
    const exportedCodeowners = await governanceDependencyOwnership.exportCodeowners(cwd)
    const exportedCodeownersText = await readFile(exportedCodeowners.path, 'utf-8')
    assert(exportedCodeownersText.includes('Suggested dependency ownership entries') && exportedCodeownersText.includes('@dependency-owners'), 'dependency ownership plan exports suggested CODEOWNERS entries')
    const policyAsCodePack = await governancePolicyAsCode.report(cwd)
    assert(policyAsCodePack.summary.dependencyPolicyRuleCount > 0 && policyAsCodePack.summary.readinessGateCount > 0 && policyAsCodePack.pack.policies.dependencyPolicy && policyAsCodePack.pack.policies.readinessPolicy, 'policy-as-code pack normalizes dependency and readiness policies into a governance bundle')
    assert(policyAsCodePack.summary.deploymentPolicyGateCount >= 2 && policyAsCodePack.pack.enforcement.deploymentPolicyGates.some((gate) => gate.includes('floating deployment refs')) && policyAsCodePack.pack.ci.requiredArtifacts.includes('release-risk-profile.json') && policyAsCodePack.pack.ci.requiredArtifacts.includes('workspace-remediation-plan.json') && policyAsCodePack.pack.ci.requiredArtifacts.includes('vulnerability-remediation-plan.json') && policyAsCodePack.pack.ci.requiredArtifacts.includes('release-provenance-attestation.json') && policyAsCodePack.pack.ci.requiredArtifacts.includes('THIRD-PARTY-NOTICES.txt') && policyAsCodePack.pack.ci.requiredArtifacts.includes('third-party-notices.json'), 'policy-as-code pack exports deployment gate policy and required release evidence artifacts')
    assert(policyAsCodePack.pack.enforcement.automationSafetyRules.length === automationSafetyPlan.summary.ruleCount && policyAsCodePack.pack.enforcement.reviewRoutes.length === dependencyOwnershipPlan.summary.reviewRouteCount, 'policy-as-code pack carries automation safety rules and owner review routes')
    assert(policyAsCodePack.githubActionsWorkflow.includes('Dependency Policy Check') && policyAsCodePack.githubActionsWorkflow.includes('npm run verify:framework --if-present') && policyAsCodePack.githubActionsWorkflow.includes('npm run verify:release-integrity --if-present') && policyAsCodePack.githubActionsWorkflow.includes('npm run verify:release-signature --if-present') && policyAsCodePack.githubActionsWorkflow.includes('npm run verify:release-trust --if-present') && policyAsCodePack.githubActionsWorkflow.includes('Deployment evidence gate') && policyAsCodePack.githubActionsWorkflow.includes('Release evidence completeness gate') && policyAsCodePack.githubActionsWorkflow.includes('Release integrity verification gate') && policyAsCodePack.githubActionsWorkflow.includes('Release signature verification gate') && policyAsCodePack.githubActionsWorkflow.includes('Release trust policy gate'), 'policy-as-code pack emits a GitHub Actions policy check workflow')
    const exportedPolicyPack = await governancePolicyAsCode.exportMarkdown(cwd)
    const exportedPolicyPackText = await readFile(exportedPolicyPack.path, 'utf-8')
    assert(exportedPolicyPackText.includes('Policy-as-Code Pack') && exportedPolicyPackText.includes('Dependency Policy Rules') && exportedPolicyPackText.includes('Deployment Policy Gates') && exportedPolicyPackText.includes('GitHub Actions Workflow'), 'policy-as-code pack exports Markdown review artifacts')
    const exportedPolicyPackJson = await governancePolicyAsCode.exportJson(cwd)
    const exportedPolicyPackJsonData = JSON.parse(await readFile(exportedPolicyPackJson.path, 'utf-8'))
    assert(exportedPolicyPackJsonData.summary.dependencyPolicyRuleCount === policyAsCodePack.summary.dependencyPolicyRuleCount && exportedPolicyPackJsonData.summary.deploymentPolicyGateCount === policyAsCodePack.summary.deploymentPolicyGateCount && exportedPolicyPackJsonData.pack.enforcement.reviewRoutes.length === policyAsCodePack.pack.enforcement.reviewRoutes.length, 'policy-as-code pack exports JSON review artifacts')
    const exportedPolicyJson = await governancePolicyAsCode.exportPolicyJson(cwd)
    const exportedPolicyJsonData = JSON.parse(await readFile(exportedPolicyJson.path, 'utf-8'))
    assert(exportedPolicyJsonData.schemaVersion === '1.0.0' && exportedPolicyJsonData.enforcement.readinessGates.length > 0 && exportedPolicyJsonData.enforcement.deploymentPolicyGates.length > 0, 'policy-as-code pack exports a machine-readable governance policy JSON')
    const exportedPolicyWorkflow = await governancePolicyAsCode.exportGithubActions(cwd)
    const exportedPolicyWorkflowText = await readFile(exportedPolicyWorkflow.path, 'utf-8')
    assert(exportedPolicyWorkflowText.includes('name: Dependency Policy Check') && exportedPolicyWorkflowText.includes('Deployment evidence gate') && exportedPolicyWorkflowText.includes('Release evidence completeness gate') && exportedPolicyWorkflowText.includes('Release integrity verification gate') && exportedPolicyWorkflowText.includes('Release signature verification gate') && exportedPolicyWorkflowText.includes('Release trust policy gate') && exportedPolicyWorkflowText.includes('verify:release-integrity') && exportedPolicyWorkflowText.includes('verify:release-signature') && exportedPolicyWorkflowText.includes('verify:release-trust') && exportedPolicyWorkflowText.includes('release-evidence-completeness.json') && exportedPolicyWorkflowText.includes('release-risk-profile.json') && exportedPolicyWorkflowText.includes('vulnerability-remediation-plan.json') && exportedPolicyWorkflowText.includes('release-provenance-attestation.json') && exportedPolicyWorkflowText.includes('release-integrity-verification.json') && exportedPolicyWorkflowText.includes('release-signature.json') && exportedPolicyWorkflowText.includes('release-trust-policy.json') && exportedPolicyWorkflowText.includes('dependency-upgrade-playbook.json') && exportedPolicyWorkflowText.includes('dependency-rollback-plan.json') && exportedPolicyWorkflowText.includes('dependency-impact-analysis.json') && exportedPolicyWorkflowText.includes('dependency-change-approval-packet.json') && exportedPolicyWorkflowText.includes('dependency-change-calendar.json') && exportedPolicyWorkflowText.includes('dependency-change-calendar.ics') && exportedPolicyWorkflowText.includes('dependency-change-freeze-gate.yml') && exportedPolicyWorkflowText.includes('dependency-change-ticket-template.md') && exportedPolicyWorkflowText.includes('dependency-change-execution-record.json') && exportedPolicyWorkflowText.includes('THIRD-PARTY-NOTICES.txt') && exportedPolicyWorkflowText.includes('third-party-notices.json') && exportedPolicyWorkflowText.includes('actions/upload-artifact@v4'), 'policy-as-code pack exports a GitHub Actions workflow')
    const importedNpmAudit = await governanceAuditEvidence.importFromFile(cwd, join(cwd, 'audit-reports', 'npm-audit.json'))
    const importedPipAudit = await governanceAuditEvidence.importFromFile(cwd, join(cwd, 'audit-reports', 'pip-audit.json'))
    const importedTrivyAudit = await governanceAuditEvidence.importFromFile(cwd, join(cwd, 'audit-reports', 'trivy.json'))
    assert(importedNpmAudit.findings.some((finding) => finding.tool === 'npm-audit' && finding.packageName === 'lodash' && finding.severity === 'high'), 'audit evidence imports npm audit vulnerabilities')
    assert(importedPipAudit.findings.some((finding) => finding.tool === 'pip-audit' && finding.packageName === 'requests' && finding.fixedVersion?.includes('2.32.3')), 'audit evidence imports pip-audit vulnerabilities and fixes')
    assert(importedTrivyAudit.findings.some((finding) => finding.tool === 'trivy' && finding.severity === 'critical' && finding.managerId === 'docker'), 'audit evidence imports Trivy container vulnerabilities')
    const auditEvidenceReport = await governanceAuditEvidence.report(cwd)
    assert(auditEvidenceReport.summary.sourceCount === 3 && auditEvidenceReport.summary.findingCount >= 3 && auditEvidenceReport.summary.critical > 0 && auditEvidenceReport.summary.high > 0, 'audit evidence report summarizes imported scanner findings')
    const auditReadinessReport = await governanceReadiness.report(cwd)
    assert(auditReadinessReport.summary.auditEvidenceFindingCount === auditEvidenceReport.summary.findingCount && auditReadinessReport.summary.auditCriticalFindingCount === auditEvidenceReport.summary.critical, 'readiness gate summarizes imported vulnerability audit evidence')
    assert(auditReadinessReport.checks.some((check) => check.id === 'audit-evidence' && check.status === 'warning'), 'readiness gate warns on vulnerability audit findings using default non-blocking thresholds')
    const strictAuditReadinessReport = await governanceReadiness.reportWithPolicy(cwd, {
      ...auditReadinessReport.policy.policy,
      blockOnCriticalAuditFindings: true,
      blockOnHighAuditFindings: true
    })
    assert(strictAuditReadinessReport.checks.some((check) => check.id === 'audit-evidence' && check.status === 'blocked'), 'readiness gate can block release on critical or high vulnerability audit evidence')
    const auditReleaseRiskProfile = await governanceReleaseRiskProfile.report(cwd)
    assert(auditReleaseRiskProfile.findings.some((finding) => finding.source === 'audit-evidence' && finding.severity === 'critical') && auditReleaseRiskProfile.summary.auditCriticalFindingCount === auditEvidenceReport.summary.critical, 'release risk profile normalizes vulnerability audit evidence into security findings')
    const exportedAuditEvidence = await governanceAuditEvidence.exportMarkdown(cwd)
    const exportedAuditEvidenceText = await readFile(exportedAuditEvidence.path, 'utf-8')
    assert(exportedAuditEvidenceText.includes('Audit Evidence Report') && exportedAuditEvidenceText.includes('lodash') && exportedAuditEvidenceText.includes('requests'), 'audit evidence exports Markdown review artifacts')
    const exportedAuditEvidenceJson = await governanceAuditEvidence.exportJson(cwd)
    const exportedAuditEvidenceJsonData = JSON.parse(await readFile(exportedAuditEvidenceJson.path, 'utf-8'))
    assert(exportedAuditEvidenceJsonData.summary.findingCount === auditEvidenceReport.summary.findingCount && exportedAuditEvidenceJsonData.findings.some((finding) => finding.tool === 'trivy'), 'audit evidence exports JSON review artifacts')
    const exportedAuditEvidenceHtml = await governanceAuditEvidence.exportHtml(cwd)
    const exportedAuditEvidenceHtmlText = await readFile(exportedAuditEvidenceHtml.path, 'utf-8')
    assert(exportedAuditEvidenceHtmlText.includes('Audit Evidence Dashboard') && exportedAuditEvidenceHtmlText.includes('data-filter=\"critical\"') && exportedAuditEvidenceHtmlText.includes('lodash'), 'audit evidence exports an interactive HTML dashboard')
    const vulnerabilityRemediationPlan = await governanceVulnerabilityRemediation.plan(cwd)
    assert(vulnerabilityRemediationPlan.summary.itemCount > 0 && vulnerabilityRemediationPlan.summary.findingCount === auditEvidenceReport.summary.findingCount && vulnerabilityRemediationPlan.items.some((item) => item.packageName === 'lodash' && item.recommendedCommand.includes('npm install')) && vulnerabilityRemediationPlan.items.some((item) => item.packageName === 'requests' && item.verificationCommand.includes('pip-audit')), 'vulnerability remediation plan turns imported audit findings into manager-scoped remediation actions')
    const exportedVulnerabilityRemediation = await governanceVulnerabilityRemediation.exportMarkdown(cwd)
    const exportedVulnerabilityRemediationText = await readFile(exportedVulnerabilityRemediation.path, 'utf-8')
    assert(exportedVulnerabilityRemediationText.includes('Vulnerability Remediation Plan') && exportedVulnerabilityRemediationText.includes('Remediation Index') && exportedVulnerabilityRemediationText.includes('Recommended command'), 'vulnerability remediation plan exports Markdown action plans')
    const exportedVulnerabilityRemediationJson = await governanceVulnerabilityRemediation.exportJson(cwd)
    const exportedVulnerabilityRemediationJsonData = JSON.parse(await readFile(exportedVulnerabilityRemediationJson.path, 'utf-8'))
    assert(exportedVulnerabilityRemediationJsonData.summary.itemCount === vulnerabilityRemediationPlan.summary.itemCount && exportedVulnerabilityRemediationJsonData.items.some((item) => item.fixAvailable), 'vulnerability remediation plan exports JSON action metadata')
    const upgradePlaybook = await dependencyUpgradePlaybook.report(cwd)
    assert(upgradePlaybook.summary.itemCount > 0 && upgradePlaybook.lanes.some((lane) => lane.id === 'security-hotfix') && upgradePlaybook.lanes.some((lane) => lane.id === 'release-blocker' || lane.id === 'risk-review') && upgradePlaybook.items.some((item) => item.commands.length > 0 || item.verificationCommands.length > 0), 'dependency upgrade playbook synthesizes security, risk, update, automation, and ownership work into actionable lanes')
    assert(upgradePlaybook.items.some((item) => item.lane === 'security-hotfix' && item.packageName) && upgradePlaybook.items.some((item) => item.lane === 'automation-onboarding') && upgradePlaybook.items.some((item) => item.lane === 'ownership-routing'), 'dependency upgrade playbook includes security hotfix, automation onboarding, and ownership routing lanes')
    const exportedUpgradePlaybook = await dependencyUpgradePlaybook.exportMarkdown(cwd)
    const exportedUpgradePlaybookText = await readFile(exportedUpgradePlaybook.path, 'utf-8')
    assert(exportedUpgradePlaybookText.includes('Dependency Upgrade Playbook') && exportedUpgradePlaybookText.includes('Security Hotfix Lane') && exportedUpgradePlaybookText.includes('Routine Update Lane'), 'dependency upgrade playbook exports Markdown lane runbooks')
    const exportedUpgradePlaybookJson = await dependencyUpgradePlaybook.exportJson(cwd)
    const exportedUpgradePlaybookJsonData = JSON.parse(await readFile(exportedUpgradePlaybookJson.path, 'utf-8'))
    assert(exportedUpgradePlaybookJsonData.summary.itemCount === upgradePlaybook.summary.itemCount && exportedUpgradePlaybookJsonData.lanes.some((lane) => lane.id === 'automation-onboarding'), 'dependency upgrade playbook exports JSON lane runbooks')
    const rollbackPlan = await dependencyRollbackPlan.report(cwd)
    assert(rollbackPlan.summary.itemCount > 0 && rollbackPlan.items.some((item) => item.anchors.some((anchor) => anchor.kind === 'managed-snapshot')) && rollbackPlan.items.some((item) => item.commands.some((command) => command.includes('git restore'))) && rollbackPlan.items.some((item) => item.verificationCommands.length > 0), 'dependency rollback plan maps updates to managed snapshots, source-control restore commands, and verification commands')
    assert(rollbackPlan.items.some((item) => item.strategies.includes('manager-rehydrate')) && rollbackPlan.items.some((item) => item.anchors.some((anchor) => anchor.kind === 'lockfile' || anchor.kind === 'manifest')) && rollbackPlan.summary.snapshotCoveredItemCount > 0, 'dependency rollback plan summarizes rollback anchors and rehydration strategies')
    const exportedRollbackPlan = await dependencyRollbackPlan.exportMarkdown(cwd)
    const exportedRollbackPlanText = await readFile(exportedRollbackPlan.path, 'utf-8')
    assert(exportedRollbackPlanText.includes('Dependency Rollback Plan') && exportedRollbackPlanText.includes('Rollback Index') && exportedRollbackPlanText.includes('Commands:'), 'dependency rollback plan exports Markdown rollback runbooks')
    const exportedRollbackPlanJson = await dependencyRollbackPlan.exportJson(cwd)
    const exportedRollbackPlanJsonData = JSON.parse(await readFile(exportedRollbackPlanJson.path, 'utf-8'))
    assert(exportedRollbackPlanJsonData.summary.itemCount === rollbackPlan.summary.itemCount && exportedRollbackPlanJsonData.items.some((item) => item.strategies.includes('verification')), 'dependency rollback plan exports JSON rollback runbooks')
    const impactAnalysis = await dependencyImpactAnalysis.report(cwd)
    assert(impactAnalysis.summary.itemCount > 0 && impactAnalysis.items.some((item) => item.ciJobs.length > 0) && impactAnalysis.items.some((item) => item.owners.length > 0 || item.ownerStatus === 'missing') && impactAnalysis.items.some((item) => item.rollbackStatus), 'dependency impact analysis maps planned updates to CI jobs, owners, and rollback readiness')
    assert(impactAnalysis.items.some((item) => item.dimensions.includes('release-gate') || item.riskFindings.length > 0) && impactAnalysis.items.some((item) => item.verificationCommands.length > 0), 'dependency impact analysis summarizes release-gate risk and verification commands')
    const exportedImpactAnalysis = await dependencyImpactAnalysis.exportMarkdown(cwd)
    const exportedImpactAnalysisText = await readFile(exportedImpactAnalysis.path, 'utf-8')
    assert(exportedImpactAnalysisText.includes('Dependency Impact Analysis') && exportedImpactAnalysisText.includes('Impact Matrix') && exportedImpactAnalysisText.includes('Verification commands'), 'dependency impact analysis exports Markdown blast-radius matrices')
    const exportedImpactAnalysisJson = await dependencyImpactAnalysis.exportJson(cwd)
    const exportedImpactAnalysisJsonData = JSON.parse(await readFile(exportedImpactAnalysisJson.path, 'utf-8'))
    assert(exportedImpactAnalysisJsonData.summary.itemCount === impactAnalysis.summary.itemCount && exportedImpactAnalysisJsonData.items.some((item) => item.dimensions.includes('ci')), 'dependency impact analysis exports JSON blast-radius matrices')
    const workspaceCycloneDx = await workspaceGovernance.exportWorkspaceSboms(cwd, 'cyclonedx')
    const workspaceCycloneDxManifest = JSON.parse(await readFile(workspaceCycloneDx.path, 'utf-8'))
    const webCycloneDxArtifact = workspaceCycloneDxManifest.artifacts.find((artifact) => artifact.relativePath === 'packages/web')
    assert(workspaceCycloneDxManifest.workspaceCount === workspaceGovernanceReport.summary.workspaceCount && workspaceCycloneDxManifest.componentCount > 0, 'workspace batch CycloneDX export writes a root manifest for every workspace')
    assert(Boolean(webCycloneDxArtifact), 'workspace batch CycloneDX export includes child workspace artifacts')
    const webCycloneDx = JSON.parse(await readFile(webCycloneDxArtifact.path, 'utf-8'))
    assert(webCycloneDx.bomFormat === 'CycloneDX' && webCycloneDx.components.some((component) => component.name === 'react'), 'workspace batch CycloneDX artifact contains workspace dependency components')
    const workspaceSpdx = await workspaceGovernance.exportWorkspaceSboms(cwd, 'spdx')
    const workspaceSpdxManifest = JSON.parse(await readFile(workspaceSpdx.path, 'utf-8'))
    const webSpdxArtifact = workspaceSpdxManifest.artifacts.find((artifact) => artifact.relativePath === 'packages/web')
    assert(Boolean(webSpdxArtifact), 'workspace batch SPDX export includes child workspace artifacts')
    const webSpdx = JSON.parse(await readFile(webSpdxArtifact.path, 'utf-8'))
    assert(webSpdx.spdxVersion === 'SPDX-2.3' && webSpdx.packages.some((pkg) => pkg.name === 'react'), 'workspace batch SPDX artifact contains workspace dependency packages')
    const recursiveRootPolicyEvaluation = await governancePolicy.evaluatePolicy(cwd)
    assert(recursiveRootPolicyEvaluation.violations.some((violation) => violation.title === 'Package is blocked' && violation.packageName === 'antd'), 'root dependency policy evaluates packages declared by nested Node workspaces')
    const { policy: dependencyPolicyBeforeCiException } = await governancePolicy.getPolicy(cwd)
    await governancePolicy.savePolicy(cwd, {
      ...dependencyPolicyBeforeCiException,
      blockedPackages: []
    })
    await governanceCiEvidence.record(cwd, {
      source: 'manual',
      provider: 'release-ci',
      workflow: 'late release smoke',
      status: 'failed',
      finishedAt: new Date(Date.now() + 60000).toISOString(),
      totalTests: 3,
      passedTests: 2,
      failedTests: 1,
      summary: 'late root CI failed before exception review'
    })
    const failedRootReadiness = await governanceReadiness.report(cwd)
    assert(failedRootReadiness.checks.some((check) => check.id === 'ci-evidence' && check.status === 'blocked'), 'readiness gate blocks failed CI evidence before exception approval')
    const releaseExceptionRecord = await governanceReleaseExceptions.record(cwd, {
      reviewer: 'risk-board',
      reason: 'Temporary release exception for documented late CI flake',
      scope: 'policy-exception',
      checkIds: ['ci-evidence'],
      decidedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      ticket: 'RISK-123'
    })
    const exceptionedRootReadiness = await governanceReadiness.report(cwd)
    const exceptionedBlockedChecks = exceptionedRootReadiness.checks
      .filter((check) => check.status === 'blocked')
      .map((check) => check.id)
    assert(
      exceptionedRootReadiness.status !== 'blocked' && exceptionedRootReadiness.summary.activeReleaseExceptionCount >= 1 && exceptionedRootReadiness.summary.exceptionedCheckCount === 1,
      'active release exceptions can unblock reviewed readiness findings without using publish override (blocked: '
        + (exceptionedBlockedChecks.join(', ') || 'none')
        + '; active exceptions: ' + exceptionedRootReadiness.summary.activeReleaseExceptionCount
        + '; exceptioned checks: ' + exceptionedRootReadiness.summary.exceptionedCheckCount + ')'
    )
    assert(exceptionedRootReadiness.checks.some((check) => check.id === 'ci-evidence' && check.status === 'info' && check.summary.includes('Release exception accepted')), 'readiness gate annotates exceptioned checks with original evidence')
    const exportedReleaseExceptions = await governanceReleaseExceptions.exportMarkdown(cwd)
    const releaseExceptionMarkdown = await readFile(exportedReleaseExceptions.path, 'utf-8')
    assert(releaseExceptionMarkdown.includes('Release Exception Report') && releaseExceptionMarkdown.includes('ci-evidence'), 'release exceptions export markdown audit evidence')
    const releaseBundle = await workspaceGovernance.exportReleaseBundle(cwd)
    const releaseBundleManifest = JSON.parse(await readFile(releaseBundle.path, 'utf-8'))
    const releaseBundleMarkdown = await readFile(releaseBundle.markdownPath, 'utf-8')
    const releaseBundleKinds = new Set(releaseBundleManifest.artifacts.map((artifact) => artifact.kind))
    const requiredReleaseBundleArtifacts = releaseBundleManifest.artifacts.filter((artifact) => artifact.required)
    assert(releaseBundleManifest.summary.workspaceCount === workspaceGovernanceReport.summary.workspaceCount && releaseBundleManifest.summary.artifactCount >= 10, 'release bundle manifest summarizes workspace governance and exported artifacts')
    assert(['readiness', 'workspace-governance', 'workspace-release-evidence', 'remediation-plan', 'update-plan', 'workspace-sbom', 'root-sbom', 'license-compliance', 'third-party-notices', 'release-exception', 'audit-evidence', 'vulnerability-remediation-plan', 'release-provenance-attestation', 'credential-usage', 'credential-rotation-plan', 'automation-safety-plan', 'dependency-ownership-plan', 'dependency-upgrade-playbook', 'dependency-rollback-plan', 'dependency-impact-analysis', 'dependency-change-approval-packet', 'dependency-change-calendar', 'dependency-change-execution-record', 'policy-as-code-pack', 'lockfile-drift', 'runtime-pinning', 'offline-cache-readiness', 'release-risk-profile', 'ci-integration-plan', 'dependency-automation-plan'].every((kind) => releaseBundleKinds.has(kind)), 'release bundle includes readiness, workspace governance, release evidence, remediation, update plan, workspace SBOM, root SBOM, license compliance, third-party notices, release exception, audit evidence, vulnerability remediation, release provenance, credential usage, credential rotation, automation safety, dependency ownership, dependency change management evidence, policy-as-code, lockfile drift, runtime pinning, offline cache readiness, release risk profile, CI integration plan, and dependency automation artifacts')
    assert(requiredReleaseBundleArtifacts.every((artifact) => artifact.ok && artifact.sha256 && artifact.sizeBytes > 0), 'release bundle records digest and size for every required artifact')
    assert(releaseBundleMarkdown.includes('Release Bundle') && releaseBundleMarkdown.includes('Workspace CycloneDX SBOMs') && releaseBundleMarkdown.includes('Root CycloneDX SBOM') && releaseBundleMarkdown.includes('License compliance matrix') && releaseBundleMarkdown.includes('Third-party notices') && releaseBundleMarkdown.includes('Audit evidence') && releaseBundleMarkdown.includes('Vulnerability remediation plan') && releaseBundleMarkdown.includes('Release provenance attestation') && releaseBundleMarkdown.includes('Credential rotation plan') && releaseBundleMarkdown.includes('Automation safety plan') && releaseBundleMarkdown.includes('Dependency ownership plan') && releaseBundleMarkdown.includes('Dependency upgrade playbook') && releaseBundleMarkdown.includes('Dependency rollback plan') && releaseBundleMarkdown.includes('Dependency impact analysis') && releaseBundleMarkdown.includes('Dependency change approval packet') && releaseBundleMarkdown.includes('Dependency change calendar') && releaseBundleMarkdown.includes('Dependency change execution record') && releaseBundleMarkdown.includes('Policy-as-code pack') && releaseBundleMarkdown.includes('Lockfile drift report') && releaseBundleMarkdown.includes('Runtime pinning report') && releaseBundleMarkdown.includes('Offline cache readiness') && releaseBundleMarkdown.includes('Release risk profile') && releaseBundleMarkdown.includes('CI integration plan') && releaseBundleMarkdown.includes('Dependency automation plan'), 'release bundle exports a human-readable Markdown artifact index')
    const releaseDashboard = await workspaceGovernance.exportReleaseDashboard(cwd)
    const releaseDashboardHtml = await readFile(releaseDashboard.path, 'utf-8')
    assert(releaseDashboardHtml.includes('Release Review Dashboard') && releaseDashboardHtml.includes('Evidence Artifacts') && releaseDashboardHtml.includes('Dependency update plan') && releaseDashboardHtml.includes('Credential usage map') && releaseDashboardHtml.includes('Audit evidence') && releaseDashboardHtml.includes('Vulnerability remediation plan') && releaseDashboardHtml.includes('Release provenance attestation') && releaseDashboardHtml.includes('Credential rotation plan') && releaseDashboardHtml.includes('Automation safety plan') && releaseDashboardHtml.includes('Dependency ownership plan') && releaseDashboardHtml.includes('Dependency upgrade playbook') && releaseDashboardHtml.includes('Dependency rollback plan') && releaseDashboardHtml.includes('Dependency impact analysis') && releaseDashboardHtml.includes('Dependency change approval packet') && releaseDashboardHtml.includes('Dependency change calendar') && releaseDashboardHtml.includes('Dependency change execution record') && releaseDashboardHtml.includes('Policy-as-code pack') && releaseDashboardHtml.includes('Lockfile drift report') && releaseDashboardHtml.includes('Runtime pinning report') && releaseDashboardHtml.includes('Offline cache readiness') && releaseDashboardHtml.includes('Release risk profile') && releaseDashboardHtml.includes('CI integration plan') && releaseDashboardHtml.includes('Dependency automation plan') && releaseDashboardHtml.includes('License compliance') && releaseDashboardHtml.includes('Third-party notices') && releaseDashboard.bundleManifestPath === releaseDashboard.path.replace(/release-dashboard\.html$/, 'release-bundle-manifest.json'), 'release review dashboard exports HTML release evidence indexes from the aggregate bundle')
    const dependencyHealthDashboardExport = await dependencyHealthDashboard.exportHtml(cwd)
    const dependencyHealthDashboardHtml = await readFile(dependencyHealthDashboardExport.path, 'utf-8')
    assert(dependencyHealthDashboardExport.path.replace(/\\/g, '/').endsWith('.npmDesktopManager/reports/dependency-health-dashboard.html') && dependencyHealthDashboardExport.componentCount > 0 && dependencyHealthDashboardExport.riskCount > 0, 'dependency health dashboard exports aggregate production dependency health metadata')
    assert(dependencyHealthDashboardHtml.includes('Dependency Health Dashboard') && dependencyHealthDashboardHtml.includes('Readiness') && dependencyHealthDashboardHtml.includes('Dependency Policy') && dependencyHealthDashboardHtml.includes('License Compliance') && dependencyHealthDashboardHtml.includes('Workspace Governance') && dependencyHealthDashboardHtml.includes('Floating execution') && dependencyHealthDashboardHtml.includes('Floating deployment refs') && dependencyHealthDashboardHtml.includes('Missing deployment baselines'), 'dependency health dashboard exports consolidated HTML governance, policy, license, workspace, floating execution, deployment-reference, and deployment-baseline evidence')
    phaseEnd('extended-parsers')
    phaseStart('supply-chain-readiness')

    const frameworkCoverageReport = frameworkCoverage.report(cwd)
    assert(frameworkCoverageReport.summary.managerCount === MANAGER_DEFINITIONS.length && frameworkCoverageReport.routeGroups.some((group) => group.route === '/node' && group.managerIds.includes('pnpm')) && frameworkCoverageReport.summary.warningGapCount >= 0, 'framework coverage report summarizes registry managers, grouped workspace routes, and follow-up gaps')
    const exportedFrameworkCoverage = await frameworkCoverage.exportMarkdown(cwd)
    const exportedFrameworkCoverageText = await readFile(exportedFrameworkCoverage.path, 'utf-8')
    assert(exportedFrameworkCoverageText.includes('Dependency Framework Coverage') && exportedFrameworkCoverageText.includes('Workspace Routes') && exportedFrameworkCoverageText.includes('Manager Matrix') && exportedFrameworkCoverageText.includes('Follow-up Gaps') && exportedFrameworkCoverage.managerCount === MANAGER_DEFINITIONS.length, 'framework coverage exports Markdown manager coverage and gap matrix')
    const exportedFrameworkCoverageJson = await frameworkCoverage.exportJson(cwd)
    const exportedFrameworkCoverageJsonData = JSON.parse(await readFile(exportedFrameworkCoverageJson.path, 'utf-8'))
    assert(exportedFrameworkCoverageJsonData.managers.some((manager) => manager.id === 'npm' && manager.route === '/npm') && exportedFrameworkCoverageJsonData.routeGroups.some((group) => group.route === '/build') && exportedFrameworkCoverageJsonData.routeGroups.some((group) => group.route === '/systems') && exportedFrameworkCoverageJsonData.routeGroups.some((group) => group.route === '/runtime'), 'framework coverage exports JSON route and manager coverage')
    const releaseIntegrityVerificationReport = await releaseIntegrityVerification.report(cwd)
    assert(releaseIntegrityVerificationReport.status !== 'blocked' && releaseIntegrityVerificationReport.summary.artifactCount === releaseBundleManifest.summary.artifactCount && releaseIntegrityVerificationReport.summary.requiredMismatchArtifactCount === 0 && releaseIntegrityVerificationReport.summary.verifiedArtifactCount > 0, 'release integrity verification checks bundle artifact files against recorded digest and size metadata')
    const exportedReleaseIntegrityVerification = await releaseIntegrityVerification.exportMarkdown(cwd)
    const exportedReleaseIntegrityVerificationText = await readFile(exportedReleaseIntegrityVerification.path, 'utf-8')
    assert(exportedReleaseIntegrityVerificationText.includes('Release Integrity Verification') && exportedReleaseIntegrityVerificationText.includes('Artifact Verification') && exportedReleaseIntegrityVerificationText.includes('Provenance Attestation'), 'release integrity verification exports Markdown review artifacts')
    const exportedReleaseIntegrityVerificationJson = await releaseIntegrityVerification.exportJson(cwd)
    const exportedReleaseIntegrityVerificationJsonData = JSON.parse(await readFile(exportedReleaseIntegrityVerificationJson.path, 'utf-8'))
    assert(exportedReleaseIntegrityVerificationJsonData.summary.artifactCount === releaseIntegrityVerificationReport.summary.artifactCount && exportedReleaseIntegrityVerificationJsonData.artifacts.some((artifact) => artifact.status === 'verified' && artifact.actualSha256), 'release integrity verification exports JSON verification metadata')
    const releaseIntegrityCliPath = join(process.cwd(), 'scripts', 'verify-release-integrity.mjs')
    const releaseIntegrityCliResult = await execFile(process.execPath, [releaseIntegrityCliPath, cwd, '--json-only', '--quiet'], {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      timeout: 5_000,
      killSignal: 'SIGTERM'
    })
    const releaseIntegrityCliJsonData = JSON.parse(await readFile(join(cwd, '.npmDesktopManager', 'reports', 'release-integrity-verification.json'), 'utf-8'))
    assert(releaseIntegrityCliResult.stdout.includes('release integrity:') && releaseIntegrityCliJsonData.summary.artifactCount === releaseBundleManifest.summary.artifactCount && releaseIntegrityCliJsonData.status !== 'blocked', 'release integrity CLI verifies release bundle artifacts and writes JSON metadata')
    const previousReleaseSigningKey = process.env.NPM_MANAGER_RELEASE_SIGNING_KEY
    const previousReleaseSigner = process.env.NPM_MANAGER_RELEASE_SIGNER
    process.env.NPM_MANAGER_RELEASE_SIGNING_KEY = 'fixture-release-signing-key'
    process.env.NPM_MANAGER_RELEASE_SIGNER = 'framework-verifier'
    const releaseSignatureReport = await releaseSignature.report(cwd)
    assert(releaseSignatureReport.signature.status === 'signed' && releaseSignatureReport.summary.includedSourceCount === 3 && releaseSignatureReport.payload.sha256.length === 64, 'release signature service builds a signed canonical payload from release bundle, provenance, and integrity evidence')
    const exportedReleaseSignatureJson = await releaseSignature.exportJson(cwd)
    const exportedReleaseSignatureJsonData = JSON.parse(await readFile(exportedReleaseSignatureJson.path, 'utf-8'))
    assert(exportedReleaseSignatureJsonData.signature.status === 'signed' && exportedReleaseSignatureJsonData.signature.algorithm === 'HMAC-SHA256' && exportedReleaseSignatureJsonData.sources.every((source) => source.id !== 'release-signature') && exportedReleaseSignatureJsonData.payload.sources.length === 3, 'release signature exports signed JSON envelopes without self-referencing the release signature artifact')
    const verifiedReleaseSignature = await releaseSignature.verify(cwd)
    assert(verifiedReleaseSignature.verification.verified && verifiedReleaseSignature.summary.verificationStatus === 'verified', 'release signature service verifies exported signed envelopes against the current canonical payload')
    const exportedReleaseSignatureMarkdown = await releaseSignature.exportMarkdown(cwd)
    const exportedReleaseSignatureMarkdownText = await readFile(exportedReleaseSignatureMarkdown.path, 'utf-8')
    assert(exportedReleaseSignatureMarkdownText.includes('Release Signature') && exportedReleaseSignatureMarkdownText.includes('Signature Envelope') && exportedReleaseSignatureMarkdownText.includes('Signed Sources'), 'release signature exports Markdown reviewer evidence')
    const releaseSignatureCliPath = join(process.cwd(), 'scripts', 'verify-release-signature.mjs')
    const releaseSignatureCliResult = await execFile(process.execPath, [releaseSignatureCliPath, cwd, '--json-only', '--quiet'], {
      cwd: process.cwd(),
      env: { ...process.env, NPM_MANAGER_RELEASE_SIGNING_KEY: 'fixture-release-signing-key', NPM_MANAGER_RELEASE_SIGNER: 'framework-verifier' },
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      timeout: 5_000,
      killSignal: 'SIGTERM'
    })
    const releaseSignatureCliJsonData = JSON.parse(releaseSignatureCliResult.stdout)
    assert(releaseSignatureCliJsonData.verificationStatus === 'verified' && releaseSignatureCliJsonData.verified && releaseSignatureCliJsonData.payloadSha256 === exportedReleaseSignatureJsonData.payload.sha256, 'release signature CLI verifies exported signed envelopes against the current canonical payload')
    const releaseTrustPolicyReport = await releaseTrustPolicy.report(cwd)
    assert(releaseTrustPolicyReport.summary.checkCount >= 6 && releaseTrustPolicyReport.checks.some((item) => item.id === 'release-signature:verified' && item.status === 'passed') && releaseTrustPolicyReport.checks.some((item) => item.source === 'release-integrity') && releaseTrustPolicyReport.checks.some((item) => item.source === 'release-approval'), 'release trust policy consolidates signature, integrity, provenance, evidence, approval, and exception checks')
    const exportedReleaseTrustPolicy = await releaseTrustPolicy.exportMarkdown(cwd)
    const exportedReleaseTrustPolicyText = await readFile(exportedReleaseTrustPolicy.path, 'utf-8')
    assert(exportedReleaseTrustPolicyText.includes('Release Trust Policy') && exportedReleaseTrustPolicyText.includes('Trust Checks') && exportedReleaseTrustPolicyText.includes('Release signature verification'), 'release trust policy exports Markdown reviewer gate evidence')
    const exportedReleaseTrustPolicyJson = await releaseTrustPolicy.exportJson(cwd)
    const exportedReleaseTrustPolicyJsonData = JSON.parse(await readFile(exportedReleaseTrustPolicyJson.path, 'utf-8'))
    assert(exportedReleaseTrustPolicyJsonData.summary.checkCount === releaseTrustPolicyReport.summary.checkCount && exportedReleaseTrustPolicyJsonData.checks.some((item) => item.source === 'release-signature'), 'release trust policy exports JSON gate evidence')
    const releaseTrustCliPath = join(process.cwd(), 'scripts', 'verify-release-trust.mjs')
    const releaseTrustCliResult = await execFile(process.execPath, [releaseTrustCliPath, cwd, '--json-only', '--quiet', '--allow-blocked'], {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      timeout: 5_000,
      killSignal: 'SIGTERM'
    })
    const releaseTrustCliJsonData = JSON.parse(releaseTrustCliResult.stdout)
    assert(releaseTrustCliJsonData.checkCount === exportedReleaseTrustPolicyJsonData.summary.checkCount && typeof releaseTrustCliJsonData.signatureVerified === 'boolean', 'release trust CLI reads exported trust policy JSON and reports gate status')
    const approvalPacket = await dependencyChangeApprovalPacket.report(cwd)
    assert(approvalPacket.summary.checklistCount >= 6 && approvalPacket.checklist.some((item) => item.source === 'dependency-impact-analysis') && approvalPacket.checklist.some((item) => item.source === 'release-trust-policy') && approvalPacket.scope.some((item) => item.ciJobCount > 0 || item.verificationCommandCount > 0), 'dependency change approval packet consolidates impact, trust, CI, and verification evidence into a reviewer checklist')
    assert(approvalPacket.summary.scopeItemCount === impactAnalysis.summary.itemCount && approvalPacket.participants.length > 0 && ['approved', 'needs-review', 'blocked'].includes(approvalPacket.decision), 'dependency change approval packet summarizes affected scopes, participants, and final review decision')
    const exportedApprovalPacket = await dependencyChangeApprovalPacket.exportMarkdown(cwd)
    const exportedApprovalPacketText = await readFile(exportedApprovalPacket.path, 'utf-8')
    assert(exportedApprovalPacketText.includes('Dependency Change Approval Packet') && exportedApprovalPacketText.includes('Approval Checklist') && exportedApprovalPacketText.includes('Scope Matrix'), 'dependency change approval packet exports Markdown reviewer packets')
    const exportedApprovalPacketJson = await dependencyChangeApprovalPacket.exportJson(cwd)
    const exportedApprovalPacketJsonData = JSON.parse(await readFile(exportedApprovalPacketJson.path, 'utf-8'))
    assert(exportedApprovalPacketJsonData.summary.checklistCount === approvalPacket.summary.checklistCount && exportedApprovalPacketJsonData.checklist.some((item) => item.source === 'release-trust-policy'), 'dependency change approval packet exports JSON reviewer packets')
    const changeCalendar = await dependencyChangeCalendar.report(cwd)
    assert(changeCalendar.summary.windowCount === approvalPacket.summary.scopeItemCount && changeCalendar.windows.some((item) => item.requiredActions.length > 0) && changeCalendar.freezeWindows.some((item) => ['approval-blocked', 'trust-policy-blocked', 'rollback-blocked', 'missing-owner', 'active-exception', 'calendar-policy'].includes(item.reason)), 'dependency change calendar maps approval scopes to schedule windows and freeze windows')
    assert(changeCalendar.windows.some((item) => item.status === 'blocked' || item.status === 'needs-review' || item.status === 'scheduled') && changeCalendar.summary.verificationCommandCount > 0, 'dependency change calendar carries change statuses and verification coverage into schedule recommendations')
    const exportedChangeCalendar = await dependencyChangeCalendar.exportMarkdown(cwd)
    const exportedChangeCalendarText = await readFile(exportedChangeCalendar.path, 'utf-8')
    assert(exportedChangeCalendarText.includes('Dependency Change Calendar') && exportedChangeCalendarText.includes('Freeze Windows') && exportedChangeCalendarText.includes('Change Windows'), 'dependency change calendar exports Markdown scheduling runbooks')
    const exportedChangeCalendarJson = await dependencyChangeCalendar.exportJson(cwd)
    const exportedChangeCalendarJsonData = JSON.parse(await readFile(exportedChangeCalendarJson.path, 'utf-8'))
    assert(exportedChangeCalendarJsonData.summary.windowCount === changeCalendar.summary.windowCount && exportedChangeCalendarJsonData.windows.some((item) => item.requiredActions.length > 0), 'dependency change calendar exports JSON scheduling runbooks')
    const exportedChangeCalendarIcs = await dependencyChangeCalendar.exportIcs(cwd)
    const exportedChangeCalendarIcsText = await readFile(exportedChangeCalendarIcs.path, 'utf-8')
    assert(exportedChangeCalendarIcsText.includes('BEGIN:VCALENDAR') && exportedChangeCalendarIcsText.includes('BEGIN:VEVENT') && (exportedChangeCalendarIcsText.includes('DEPENDENCY-CHANGE') || exportedChangeCalendarIcsText.includes('DEPENDENCY-FREEZE')), 'dependency change calendar exports ICS calendar events for scheduled changes and freezes')
    const exportedChangeFreezeGate = await dependencyChangeCalendar.exportFreezeGate(cwd)
    const exportedChangeFreezeGateText = await readFile(exportedChangeFreezeGate.path, 'utf-8')
    assert(exportedChangeFreezeGateText.includes('Dependency Change Freeze Gate') && exportedChangeFreezeGateText.includes('dependency-change-calendar.json') && exportedChangeFreezeGateText.includes('process.exit(1)'), 'dependency change calendar exports a CI freeze gate workflow')
    const exportedChangeTicketTemplate = await dependencyChangeCalendar.exportTicketTemplate(cwd)
    const exportedChangeTicketTemplateText = await readFile(exportedChangeTicketTemplate.path, 'utf-8')
    assert(exportedChangeTicketTemplateText.includes('Dependency Change Ticket') && exportedChangeTicketTemplateText.includes('Freeze Window Review') && exportedChangeTicketTemplateText.includes('Final Sign-off'), 'dependency change calendar exports GitHub/GitLab-compatible change ticket templates')
    const signatureTamperPath = join(cwd, '.npmDesktopManager', 'reports', 'release-integrity-verification.json')
    const originalSignatureTamperText = await readFile(signatureTamperPath, 'utf-8')
    await writeFile(signatureTamperPath, originalSignatureTamperText + '\n', 'utf-8')
    const tamperedReleaseSignature = await releaseSignature.verify(cwd)
    assert(tamperedReleaseSignature.status === 'blocked' && tamperedReleaseSignature.summary.verificationStatus === 'mismatch', 'release signature verification blocks when a signed source evidence file changes after signing')
    const tamperedReleaseTrustPolicy = await releaseTrustPolicy.report(cwd)
    assert(tamperedReleaseTrustPolicy.checks.some((item) => item.id === 'release-signature:verified' && item.status === 'blocked'), 'release trust policy blocks when signed source evidence changes after signing')
    let releaseSignatureCliFailed = false
    try {
      await execFile(process.execPath, [releaseSignatureCliPath, cwd, '--json-only', '--quiet'], {
        cwd: process.cwd(),
        env: { ...process.env, NPM_MANAGER_RELEASE_SIGNING_KEY: 'fixture-release-signing-key', NPM_MANAGER_RELEASE_SIGNER: 'framework-verifier' },
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      timeout: 5_000,
      killSignal: 'SIGTERM'
      })
    } catch (error) {
      releaseSignatureCliFailed = true
      assert(String(error.stdout || '').includes('mismatch') || String(error.stderr || '').includes('mismatch'), 'release signature CLI reports payload mismatch after signed source tampering')
    }
    assert(releaseSignatureCliFailed, 'release signature CLI exits non-zero when signed source evidence is tampered')
    await writeFile(signatureTamperPath, originalSignatureTamperText, 'utf-8')
    if (previousReleaseSigningKey === undefined) {
      delete process.env.NPM_MANAGER_RELEASE_SIGNING_KEY
    } else {
      process.env.NPM_MANAGER_RELEASE_SIGNING_KEY = previousReleaseSigningKey
    }
    if (previousReleaseSigner === undefined) {
      delete process.env.NPM_MANAGER_RELEASE_SIGNER
    } else {
      process.env.NPM_MANAGER_RELEASE_SIGNER = previousReleaseSigner
    }
    const reportArtifactLibrary = await reportArtifactIndex.report(cwd)
    assert(reportArtifactLibrary.summary.artifactCount >= releaseBundleManifest.summary.artifactCount && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-health-dashboard.html') && artifact.format === 'html') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('framework-coverage.md') && artifact.category === 'inventory') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('vulnerability-remediation-plan.json') && artifact.category === 'security') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-upgrade-playbook.json') && artifact.category === 'automation') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-rollback-plan.json') && artifact.category === 'operations') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-impact-analysis.json') && artifact.category === 'risk') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-change-approval-packet.json') && artifact.category === 'policy') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-change-calendar.json') && artifact.category === 'operations') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-change-calendar.ics') && artifact.category === 'operations' && artifact.format === 'calendar') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-change-freeze-gate.yml') && artifact.category === 'operations' && artifact.format === 'yaml') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-change-ticket-template.md') && artifact.category === 'operations' && artifact.format === 'markdown') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('release-provenance-attestation.json') && artifact.category === 'release') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('release-integrity-verification.json') && artifact.category === 'release') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('release-signature.json') && artifact.category === 'release') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('release-trust-policy.json') && artifact.category === 'release') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('THIRD-PARTY-NOTICES.txt') && artifact.category === 'policy' && artifact.format === 'text') && reportArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.includes('release-bundle/release-dashboard.html') && artifact.category === 'release') && reportArtifactLibrary.artifacts.every((artifact) => artifact.sha256.length === 64 && artifact.sizeBytes > 0), 'report artifact library indexes generated dependency governance reports with categories, formats, sizes, and hashes')
    const exportedReportArtifactIndex = await reportArtifactIndex.exportMarkdown(cwd)
    const exportedReportArtifactIndexText = await readFile(exportedReportArtifactIndex.path, 'utf-8')
    assert(exportedReportArtifactIndexText.includes('Report Artifact Index') && exportedReportArtifactIndexText.includes('dependency-health-dashboard.html') && exportedReportArtifactIndexText.includes('release-bundle/release-dashboard.html'), 'report artifact library exports Markdown artifact indexes')
    const exportedReportArtifactIndexJson = await reportArtifactIndex.exportJson(cwd)
    const exportedReportArtifactIndexJsonData = JSON.parse(await readFile(exportedReportArtifactIndexJson.path, 'utf-8'))
    assert(exportedReportArtifactIndexJsonData.summary.artifactCount >= reportArtifactLibrary.summary.artifactCount && exportedReportArtifactIndexJsonData.artifacts.some((artifact) => artifact.relativePath.endsWith('report-artifact-index.md')), 'report artifact library exports JSON artifact indexes')
    const releaseProvenanceReport = await releaseProvenanceAttestation.report(cwd)
    assert(releaseProvenanceReport.project.name === 'fixture-app' && releaseProvenanceReport.summary.artifactCount > 0 && releaseProvenanceReport.artifacts.some((artifact) => artifact.sha256.length === 64) && releaseProvenanceReport.summary.releaseBundleArtifactCount === releaseBundleManifest.summary.artifactCount, 'release provenance attestation ties project metadata, release bundle summary, and artifact digests together')
    const releaseEvidenceCompletenessReport = await releaseEvidenceCompleteness.report(cwd)
    assert(releaseEvidenceCompletenessReport.status !== 'blocked' && releaseEvidenceCompletenessReport.summary.missingRequiredArtifactCount === 0 && releaseEvidenceCompletenessReport.summary.requiredIntegrityMismatchCount === 0 && releaseEvidenceCompletenessReport.summary.policyRequiredArtifactCount > 0 && releaseEvidenceCompletenessReport.summary.releaseBundleArtifactCount === releaseBundleManifest.summary.artifactCount, 'release evidence completeness checks policy-required artifacts against the release bundle and report library')
    assert(releaseEvidenceCompletenessReport.expectedArtifacts.some((artifact) => artifact.source === 'policy-as-code' && artifact.label === 'readiness-report.json' && artifact.status === 'present') && releaseEvidenceCompletenessReport.expectedArtifacts.some((artifact) => artifact.source === 'release-bundle' && artifact.required && artifact.status === 'present' && artifact.integrityStatus === 'verified'), 'release evidence completeness tracks policy and release-bundle expected artifacts with digest verification')
    const exportedReleaseEvidenceCompleteness = await releaseEvidenceCompleteness.exportMarkdown(cwd)
    const exportedReleaseEvidenceCompletenessText = await readFile(exportedReleaseEvidenceCompleteness.path, 'utf-8')
    assert(exportedReleaseEvidenceCompletenessText.includes('Release Evidence Completeness') && exportedReleaseEvidenceCompletenessText.includes('Expected Artifacts') && exportedReleaseEvidenceCompletenessText.includes('Integrity mismatches'), 'release evidence completeness exports Markdown review artifacts')
    const exportedReleaseEvidenceCompletenessJson = await releaseEvidenceCompleteness.exportJson(cwd)
    const exportedReleaseEvidenceCompletenessJsonData = JSON.parse(await readFile(exportedReleaseEvidenceCompletenessJson.path, 'utf-8'))
    assert(exportedReleaseEvidenceCompletenessJsonData.summary.expectedArtifactCount === releaseEvidenceCompletenessReport.summary.expectedArtifactCount && exportedReleaseEvidenceCompletenessJsonData.expectedArtifacts.some((artifact) => artifact.source === 'policy-as-code'), 'release evidence completeness exports JSON review artifacts')
    const tamperTarget = releaseBundleManifest.artifacts.find((artifact) => artifact.required && artifact.ok && artifact.path && artifact.sha256 && artifact.format === 'markdown') || releaseBundleManifest.artifacts.find((artifact) => artifact.required && artifact.ok && artifact.path && artifact.sha256)
    assert(Boolean(tamperTarget), 'release bundle has a required digest-backed artifact for integrity mismatch checks')
    await writeFile(tamperTarget.path, (await readFile(tamperTarget.path, 'utf-8')) + '\nTampered evidence marker.\n', 'utf-8')
    const tamperedReleaseEvidenceCompleteness = await releaseEvidenceCompleteness.report(cwd)
    assert(tamperedReleaseEvidenceCompleteness.status === 'blocked' && tamperedReleaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount > 0 && tamperedReleaseEvidenceCompleteness.findings.some((finding) => finding.title.includes('integrity mismatch')), 'release evidence completeness blocks required artifacts whose current hash no longer matches the release bundle manifest')
    const tamperedReleaseIntegrityVerification = await releaseIntegrityVerification.report(cwd)
    assert(tamperedReleaseIntegrityVerification.status === 'blocked' && tamperedReleaseIntegrityVerification.summary.requiredMismatchArtifactCount > 0 && tamperedReleaseIntegrityVerification.findings.some((finding) => finding.title.includes('digest or size mismatch')), 'release integrity verification blocks required bundle artifacts whose current digest or size has changed')
    let releaseIntegrityCliFailed = false
    try {
      await execFile(process.execPath, [releaseIntegrityCliPath, cwd, '--json-only', '--quiet'], {
        cwd: process.cwd(),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      timeout: 5_000,
      killSignal: 'SIGTERM'
      })
    } catch (error) {
      releaseIntegrityCliFailed = true
      assert(String(error.stdout || '').includes('blocked') || String(error.stderr || '').includes('blocked'), 'release integrity CLI reports blocked status after required artifact tampering')
    }
    assert(releaseIntegrityCliFailed, 'release integrity CLI exits non-zero when a required release bundle artifact is tampered')
    const exportedReleaseProvenance = await releaseProvenanceAttestation.exportMarkdown(cwd)
    const exportedReleaseProvenanceText = await readFile(exportedReleaseProvenance.path, 'utf-8')
    assert(exportedReleaseProvenanceText.includes('Release Provenance Attestation') && exportedReleaseProvenanceText.includes('Source / Git') && exportedReleaseProvenanceText.includes('Evidence Digests') && exportedReleaseProvenanceText.includes('fixture-app'), 'release provenance attestation exports Markdown source and digest evidence')
    const exportedReleaseProvenanceJson = await releaseProvenanceAttestation.exportJson(cwd)
    const exportedReleaseProvenanceJsonData = JSON.parse(await readFile(exportedReleaseProvenanceJson.path, 'utf-8'))
    assert(exportedReleaseProvenanceJsonData.summary.artifactCount >= releaseProvenanceReport.summary.artifactCount && exportedReleaseProvenanceJsonData.artifacts.some((artifact) => artifact.relativePath.endsWith('release-bundle/release-bundle-manifest.json')) && exportedReleaseProvenanceJsonData.summary.selfReferencedEvidenceCount >= 0, 'release provenance attestation exports JSON artifact digest metadata')
    await governanceReleaseExceptions.revoke(cwd, releaseExceptionRecord.id, {
      reviewer: 'risk-board',
      reason: 'Exception revoked after bundle export smoke test'
    })

    const extended = new ExtendedManagerService()
    console.log('[legacy:extended-detected] start')
    const detected = await extended.detected(cwd)
    console.log('[legacy:extended-detected] done')
    assert(detected.some((manager) => manager.id === 'pnpm' && manager.detected), 'extended detection identifies pnpm lockfile')
    assert(['uv', 'poetry', 'pipenv', 'conda'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Python environment manager files')
    assert(['nuget', 'composer', 'bundler'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies backend package manager files')
    assert(['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies cloud-native and GitOps manager files')
    assert(['deno', 'swiftpm', 'cocoapods'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies platform manager files')
    assert(['sbt', 'leiningen', 'mix', 'rebar3', 'cabal', 'stack'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Polyglot manager files')
    assert(['renv', 'julia'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Data manager files')
    assert(['terraform', 'opentofu', 'ansible'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Infra manager files')
    assert(['github-actions', 'gitlab-ci', 'pre-commit'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Automation manager files')
    assert(['bazel', 'pants', 'buck'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Build manager files')
    assert(['opam', 'cpan', 'luarocks', 'shards', 'zig'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies Systems and scripting manager files')
    assert(['homebrew', 'chocolatey', 'scoop', 'winget', 'asdf', 'mise', 'sdkman', 'apt', 'dnf', 'apk', 'pacman', 'nix'].every((id) => detected.some((manager) => manager.id === id && manager.detected)), 'extended detection identifies system package, Linux, Nix, and runtime manager files')
    assert(detected.some((manager) => manager.id === 'composer' && manager.detected), 'extended detection identifies composer manifest')
    assert(detected.some((manager) => manager.id === 'docker' && manager.detected), 'extended detection identifies Dockerfile')

    const pnpmDeps = await timedList(extended, cwd, 'pnpm')
    assert(pnpmDeps.some((dep) => dep.name === 'react' && dep.version === '^19.0.0'), 'extended pnpm parser reads package.json dependencies')

    const composerDeps = await timedList(extended, cwd, 'composer')
    assert(composerDeps.some((dep) => dep.name === 'monolog/monolog'), 'extended composer parser reads composer.json dependencies')

    const uvDeps = await timedList(extended, cwd, 'uv')
    assert(uvDeps.some((dep) => dep.name === 'fastapi' && dep.version === '>=0.110'), 'extended uv parser reads pyproject project dependencies')

    const poetryDeps = await timedList(extended, cwd, 'poetry')
    assert(poetryDeps.some((dep) => dep.name === 'attrs' && dep.version === '^23.2.0'), 'extended poetry parser reads pyproject poetry dependencies')

    const pipenvDeps = await timedList(extended, cwd, 'pipenv')
    assert(pipenvDeps.some((dep) => dep.name === 'flask' && dep.version === '==3.0.0'), 'extended pipenv parser reads Pipfile dependencies')

    const condaDeps = await timedList(extended, cwd, 'conda')
    assert(condaDeps.some((dep) => dep.name === 'numpy' && dep.version === '1.26'), 'extended conda parser reads environment.yml dependencies')

    const nugetDeps = await timedList(extended, cwd, 'nuget')
    assert(nugetDeps.some((dep) => dep.name === 'Newtonsoft.Json' && dep.version === '13.0.3'), 'extended nuget parser reads project package references')

    const bundlerDeps = await timedList(extended, cwd, 'bundler')
    assert(bundlerDeps.some((dep) => dep.name === 'rack' && dep.version === '3.0.8' && dep.requestedVersion === '~> 3.0'), 'extended Bundler inventory merges Gemfile constraints with lockfile resolutions')

    const dockerDeps = await timedList(extended, cwd, 'docker')
    assert(dockerDeps.some((dep) => dep.name === 'node' && dep.version === '22-alpine'), 'extended docker parser reads Dockerfile base images')
    assert(dockerDeps.some((dep) => dep.name === 'postgres' && dep.version === 'latest'), 'extended docker parser reads compose service images')

    const helmDeps = await timedList(extended, cwd, 'helm')
    assert(helmDeps.some((dep) => dep.name === 'redis' && dep.version === '19.6.2'), 'extended helm parser reads Chart.yaml dependencies')

    const kustomizeDeps = await timedList(extended, cwd, 'kustomize')
    assert(kustomizeDeps.some((dep) => dep.name === 'github.com/acme/platform/base' && dep.version === 'v1.2.0') && kustomizeDeps.some((dep) => dep.name === 'ghcr.io/acme/api' && dep.version === '1.4.2'), 'extended Kustomize parser reads remote bases, images, and versions')

    const helmfileDeps = await timedList(extended, cwd, 'helmfile')
    assert(helmfileDeps.some((dep) => dep.name === 'bitnami/redis' && dep.version === '19.6.2') && helmfileDeps.some((dep) => dep.name === 'bitnami' && dep.source === 'https://charts.bitnami.com/bitnami'), 'extended Helmfile parser reads repositories and release chart pins')

    const skaffoldDeps = await timedList(extended, cwd, 'skaffold')
    assert(skaffoldDeps.some((dep) => dep.name === 'ghcr.io/acme/api' && dep.version === '1.4.2') && skaffoldDeps.some((dep) => dep.name === 'oci://ghcr.io/acme/charts/api'), 'extended Skaffold parser reads artifact images and deploy chart references')

    const argoDeps = await timedList(extended, cwd, 'argocd')
    assert(argoDeps.some((dep) => dep.name === 'fixture-chart' && dep.version === 'v1.2.3' && dep.source === 'https://github.com/acme/platform-config'), 'extended Argo CD parser reads Application source revisions')

    const fluxDeps = await timedList(extended, cwd, 'flux')
    assert(fluxDeps.some((dep) => dep.name === 'platform-config' && dep.version === 'v1.2.3') && fluxDeps.some((dep) => dep.name === 'redis' && dep.version === '19.6.2'), 'extended Flux parser reads GitRepository and HelmRelease source pins')
    assert(fluxDeps.some((dep) => dep.name === 'floating-platform' && dep.version === 'main'), 'extended Flux parser preserves floating GitOps branch refs for production policy review')

    const denoDeps = await timedList(extended, cwd, 'deno')
    assert(denoDeps.some((dep) => dep.name === 'lodash' && dep.version === '4.17.21'), 'extended deno parser reads deno.json imports')

    const swiftDeps = await timedList(extended, cwd, 'swiftpm')
    assert(swiftDeps.some((dep) => dep.name === 'Alamofire' && dep.version === '5.8.0'), 'extended SwiftPM parser reads Package.swift dependencies')

    const podDeps = await timedList(extended, cwd, 'cocoapods')
    assert(podDeps.some((dep) => dep.name === 'AFNetworking' && dep.version === '~> 4.0'), 'extended CocoaPods parser reads Podfile dependencies')

    const sbtDeps = await timedList(extended, cwd, 'sbt')
    assert(sbtDeps.some((dep) => dep.name === 'com.typesafe:config' && dep.version === '1.4.3'), 'extended sbt parser reads build.sbt library dependencies')

    const leinDeps = await timedList(extended, cwd, 'leiningen')
    assert(leinDeps.some((dep) => dep.name === 'ring/ring-core' && dep.version === '1.12.1'), 'extended Leiningen parser reads project.clj dependencies')

    const mixDeps = await timedList(extended, cwd, 'mix')
    assert(mixDeps.some((dep) => dep.name === 'phoenix' && dep.version === '~> 1.7'), 'extended Mix parser reads mix.exs dependencies')

    const rebarDeps = await timedList(extended, cwd, 'rebar3')
    assert(rebarDeps.some((dep) => dep.name === 'cowboy' && dep.version === '2.10.0'), 'extended rebar3 parser reads rebar.config dependencies')

    const cabalDeps = await timedList(extended, cwd, 'cabal')
    assert(cabalDeps.some((dep) => dep.name === 'aeson' && dep.version === '>= 2.2'), 'extended Cabal parser reads .cabal build-depends')

    const stackDeps = await timedList(extended, cwd, 'stack')
    assert(stackDeps.some((dep) => dep.name === 'warp' && dep.version === '3.3.31') && stackDeps.some((dep) => dep.name === 'text' && dep.version === '>=2.0'), 'extended Stack parser reads stack.yaml and package.yaml dependencies')

    const renvDeps = await timedList(extended, cwd, 'renv')
    assert(renvDeps.some((dep) => dep.name === 'dplyr' && dep.version === '1.1.4'), 'extended renv parser reads renv.lock dependencies')

    const juliaDeps = await timedList(extended, cwd, 'julia')
    assert(juliaDeps.some((dep) => dep.name === 'DataFrames' && dep.version === '1.6') && juliaDeps.some((dep) => dep.name === 'CSV' && dep.version === '0.10.14'), 'extended Julia parser reads Project.toml compat and Manifest.toml dependencies')

    const terraformDeps = await timedList(extended, cwd, 'terraform')
    assert(terraformDeps.some((dep) => dep.name === 'hashicorp/aws' && dep.version === '5.54.1') && terraformDeps.some((dep) => dep.name === 'terraform-aws-modules/vpc/aws' && dep.version === '5.8.1'), 'extended Terraform parser reads provider locks and module dependencies')

    const tofuDeps = await timedList(extended, cwd, 'opentofu')
    assert(tofuDeps.some((dep) => dep.name === 'hashicorp/aws' && dep.version === '5.54.1'), 'extended OpenTofu parser reads Terraform-compatible provider locks')

    const ansibleDeps = await timedList(extended, cwd, 'ansible')
    assert(ansibleDeps.some((dep) => dep.name === 'community.general' && dep.version === '8.6.0') && ansibleDeps.some((dep) => dep.name === 'geerlingguy.nginx' && dep.version === '3.1.0'), 'extended Ansible parser reads Galaxy collection and role requirements')

    const githubActionsDeps = await timedList(extended, cwd, 'github-actions')
    assert(githubActionsDeps.some((dep) => dep.name === 'actions/checkout' && dep.version === 'v4') && githubActionsDeps.some((dep) => dep.name === 'actions/setup-node' && dep.version === 'v5.1.0'), 'extended GitHub Actions parser reads workflow action pins')

    const gitlabCiDeps = await timedList(extended, cwd, 'gitlab-ci')
    assert(gitlabCiDeps.some((dep) => dep.name === 'devops/templates' && dep.version === 'v2.3.0') && gitlabCiDeps.some((dep) => dep.name === 'gitlab.com/components/secret-detection' && dep.version === '1.2.0'), 'extended GitLab CI parser reads include project refs and components')

    const preCommitDeps = await timedList(extended, cwd, 'pre-commit')
    assert(preCommitDeps.some((dep) => dep.name === 'https://github.com/pre-commit/pre-commit-hooks' && dep.version === 'v4.6.0') && preCommitDeps.some((dep) => dep.name === 'https://github.com/astral-sh/ruff-pre-commit' && dep.version === 'v0.5.0'), 'extended pre-commit parser reads hook repository revisions')

    const bazelDeps = await timedList(extended, cwd, 'bazel')
    assert(bazelDeps.some((dep) => dep.name === 'rules_jvm_external' && dep.version === '6.3') && bazelDeps.some((dep) => dep.name === 'com.google.guava:guava' && dep.version === '33.0.0-jre'), 'extended Bazel parser reads bzlmod and maven_install dependencies')

    const pantsDeps = await timedList(extended, cwd, 'pants')
    assert(pantsDeps.some((dep) => dep.name === 'pantsbuild.pants' && dep.version === '2.22.0') && pantsDeps.some((dep) => dep.name === 'requests' && dep.version === '2.32.3'), 'extended Pants parser reads pants.toml plugins/resolves and BUILD python requirements')

    const buckDeps = await timedList(extended, cwd, 'buck')
    assert(buckDeps.some((dep) => dep.name === 'com.google.guava:guava' && dep.version === '33.0.0-jre') && buckDeps.some((dep) => dep.name === 'zlib' && dep.version === '1.3.1'), 'extended Buck parser reads Maven jars and external archives')

    const opamDeps = await timedList(extended, cwd, 'opam')
    assert(opamDeps.some((dep) => dep.name === 'dune' && dep.version?.includes('3.14')) && opamDeps.some((dep) => dep.name === 'yojson' && dep.version?.includes('2.1.0')), 'extended opam parser reads opam and dune-project dependencies')

    const cpanDeps = await timedList(extended, cwd, 'cpan')
    assert(cpanDeps.some((dep) => dep.name === 'Mojolicious' && dep.version === '>= 9.37') && cpanDeps.some((dep) => dep.name === 'Test::More' && dep.version === '>= 1.302'), 'extended CPAN parser reads cpanfile requirements')

    const luaDeps = await timedList(extended, cwd, 'luarocks')
    assert(luaDeps.some((dep) => dep.name === 'luasocket' && dep.version === '>= 3.1.0') && luaDeps.some((dep) => dep.name === 'inspect' && dep.version === '== 3.1.3'), 'extended LuaRocks parser reads rockspec dependency constraints')

    const shardDeps = await timedList(extended, cwd, 'shards')
    assert(shardDeps.some((dep) => dep.name === 'kemal' && dep.version === '~> 1.4.0') && shardDeps.some((dep) => dep.name === 'ameba' && dep.version === '~> 1.6.0'), 'extended Crystal Shards parser reads shard.yml dependencies')

    const zigDeps = await timedList(extended, cwd, 'zig')
    assert(zigDeps.some((dep) => dep.name === 'zlib' && dep.source?.includes('zlib-1.3.1')), 'extended Zig parser reads build.zig.zon and build.zig dependencies')

    const brewDeps = await timedList(extended, cwd, 'homebrew')
    assert(brewDeps.some((dep) => dep.name === 'git' && dep.version === '2.45.0') && brewDeps.some((dep) => dep.name === 'visual-studio-code' && dep.type === 'cask'), 'extended Homebrew parser reads Brewfile formulae, casks, and versions')

    const chocoDeps = await timedList(extended, cwd, 'chocolatey')
    assert(chocoDeps.some((dep) => dep.name === 'git' && dep.version === '2.45.0') && chocoDeps.some((dep) => dep.name === 'nodejs-lts' && dep.version === '22.13.0'), 'extended Chocolatey parser reads packages.config package pins')

    const scoopDeps = await timedList(extended, cwd, 'scoop')
    assert(scoopDeps.some((dep) => dep.name === 'ripgrep' && dep.version === '14.1.1') && scoopDeps.some((dep) => dep.name === 'fd' && dep.version === '10.2.0'), 'extended Scoop parser reads scoop export app and bucket manifests')

    const wingetDeps = await timedList(extended, cwd, 'winget')
    assert(wingetDeps.some((dep) => dep.name === 'Git.Git' && dep.version === '2.45.0') && wingetDeps.some((dep) => dep.name === 'OpenJS.NodeJS.LTS' && dep.version === '22.13.0'), 'extended winget parser reads exported package identifiers')

    const asdfDeps = await timedList(extended, cwd, 'asdf')
    assert(asdfDeps.some((dep) => dep.name === 'nodejs' && dep.version === '22.13.0') && asdfDeps.some((dep) => dep.name === 'python' && dep.version === '3.12.8'), 'extended asdf parser reads .tool-versions runtime pins')

    const miseDeps = await timedList(extended, cwd, 'mise')
    assert(miseDeps.some((dep) => dep.name === 'node' && dep.version === '22.13.0') && miseDeps.some((dep) => dep.name === 'python' && dep.version === '3.12.8'), 'extended mise parser reads mise.toml runtime pins')

    const sdkmanDeps = await timedList(extended, cwd, 'sdkman')
    assert(sdkmanDeps.some((dep) => dep.name === 'java' && dep.version === '17.0.10-tem') && sdkmanDeps.some((dep) => dep.name === 'gradle' && dep.version === '8.10'), 'extended SDKMAN parser reads .sdkmanrc candidate pins')

    const aptDeps = await timedList(extended, cwd, 'apt')
    assert(aptDeps.some((dep) => dep.name === 'curl' && dep.version === '8.5.0-2ubuntu10') && aptDeps.some((dep) => dep.name === 'git' && dep.version === '>= 1:2.43.0'), 'extended APT parser reads Debian package baseline pins and constraints')

    const dnfDeps = await timedList(extended, cwd, 'dnf')
    assert(dnfDeps.some((dep) => dep.name === 'git' && dep.version === '2.45.0') && dnfDeps.some((dep) => dep.name === 'openssl' && dep.version === '>= 3.2.1'), 'extended DNF parser reads RPM package baseline pins and constraints')

    const apkDeps = await timedList(extended, cwd, 'apk')
    assert(apkDeps.some((dep) => dep.name === 'curl' && dep.version === '8.5.0-r0') && apkDeps.some((dep) => dep.name === 'openssl' && dep.version === '3.2.1-r0'), 'extended apk parser reads Alpine package baseline pins')

    const pacmanDeps = await timedList(extended, cwd, 'pacman')
    assert(pacmanDeps.some((dep) => dep.name === 'git' && dep.version === '2.45.0-1') && pacmanDeps.some((dep) => dep.name === 'base-devel'), 'extended pacman parser reads Arch package baselines')

    const nixDeps = await timedList(extended, cwd, 'nix')
    assert(nixDeps.some((dep) => dep.name === 'nixpkgs' && dep.version === 'nixos-24.05') && nixDeps.some((dep) => dep.name === 'nodejs_22') && nixDeps.some((dep) => dep.name === 'flake-utils' && dep.source?.includes('numtide/flake-utils')), 'extended Nix parser reads flake inputs, lock nodes, and dev shell packages')

    const pnpmPlan = await extended.plan(cwd, 'pnpm', {
      operation: 'install',
      packageName: 'left-pad',
      version: '1.3.0',
      dev: true
    })
    assert(pnpmPlan.command === 'pnpm add left-pad@1.3.0 -D', 'extended planner builds pnpm add command')
    assert(pnpmPlan.mutating && pnpmPlan.backupFiles.length >= 2, 'extended planner marks mutating operations and previews backups')
    assert(pnpmPlan.dryRunSupported && pnpmPlan.dryRunCommand?.endsWith('--dry-run'), 'extended planner exposes pnpm dry-run command')

    const uvPlan = await extended.plan(cwd, 'uv', {
      operation: 'install',
      packageName: 'pytest',
      version: '8.2.0',
      dev: true
    })
    assert(uvPlan.command === 'uv add pytest==8.2.0 --dev', 'extended planner builds Python-aware uv add command')

    const pipenvPlan = await extended.plan(cwd, 'pipenv', {
      operation: 'install',
      packageName: 'httpx',
      version: '>=0.27',
      dev: true
    })
    assert(pipenvPlan.command === 'pipenv install httpx>=0.27 --dev', 'extended planner preserves Python version operators for pipenv')

    const condaPlan = await extended.plan(cwd, 'conda', {
      operation: 'install',
      packageName: 'numpy',
      version: '1.26'
    })
    assert(condaPlan.command === 'conda install -y numpy=1.26', 'extended planner builds Conda version specs')

    const composerPlan = await extended.plan(cwd, 'composer', {
      operation: 'install',
      packageName: 'psr/log',
      version: '^3.0'
    })
    assert(composerPlan.command === 'composer require psr/log:^3.0', 'extended planner builds Composer version constraints')

    const nugetPlan = await extended.plan(cwd, 'nuget', {
      operation: 'install',
      packageName: 'Serilog',
      version: '3.1.1'
    })
    assert(nugetPlan.command === 'dotnet add package Serilog --version 3.1.1', 'extended planner builds NuGet dotnet add package commands')

    const bundlerPlan = await extended.plan(cwd, 'bundler', {
      operation: 'install',
      packageName: 'rack',
      version: '3.0.8'
    })
    assert(bundlerPlan.command === 'bundle add rack --version 3.0.8', 'extended planner builds Bundler add commands')

    const opamPlan = await extended.plan(cwd, 'opam', {
      operation: 'install',
      packageName: 'yojson',
      version: '2.1.0'
    })
    assert(opamPlan.command === 'opam install -y yojson.2.1.0', 'extended planner builds opam version install commands')

    const luaPlan = await extended.plan(cwd, 'luarocks', {
      operation: 'install',
      packageName: 'luasocket',
      version: '3.1.0'
    })
    assert(luaPlan.command === 'luarocks install luasocket 3.1.0', 'extended planner builds LuaRocks install commands')

    const brewPlan = await extended.plan(cwd, 'homebrew', {
      operation: 'sync'
    })
    assert(brewPlan.command === 'brew bundle install --file Brewfile', 'extended planner builds Homebrew Bundle bootstrap commands')

    const chocoPlan = await extended.plan(cwd, 'chocolatey', {
      operation: 'install',
      packageName: 'git',
      version: '2.45.0'
    })
    assert(chocoPlan.command === 'choco install git -y --version 2.45.0', 'extended planner builds Chocolatey version install commands')

    const wingetPlan = await extended.plan(cwd, 'winget', {
      operation: 'install',
      packageName: 'Git.Git',
      version: '2.45.0'
    })
    assert(wingetPlan.command === 'winget install --id Git.Git -e --version 2.45.0', 'extended planner builds winget exact package install commands')

    const misePlan = await extended.plan(cwd, 'mise', {
      operation: 'install',
      packageName: 'node',
      version: '22.13.0'
    })
    assert(misePlan.command === 'mise use node@22.13.0', 'extended planner builds mise runtime pin commands')

    const aptPlan = await extended.plan(cwd, 'apt', {
      operation: 'install',
      packageName: 'curl',
      version: '8.5.0-2ubuntu10'
    })
    assert(aptPlan.command === 'apt-get install -y curl=8.5.0-2ubuntu10' && aptPlan.dryRunCommand === 'apt-get --simulate install -y curl=8.5.0-2ubuntu10', 'extended planner builds APT version install commands with simulate previews')

    const dnfPlan = await extended.plan(cwd, 'dnf', {
      operation: 'install',
      packageName: 'git',
      version: '2.45.0'
    })
    assert(dnfPlan.command === 'dnf install -y git-2.45.0' && dnfPlan.dryRunCommand === 'dnf install -y git-2.45.0 --assumeno', 'extended planner builds DNF version install commands with assumeno previews')

    const apkPlan = await extended.plan(cwd, 'apk', {
      operation: 'install',
      packageName: 'curl',
      version: '8.5.0-r0'
    })
    assert(apkPlan.command === 'apk add curl=8.5.0-r0', 'extended planner builds apk version install commands')

    const pacmanPlan = await extended.plan(cwd, 'pacman', {
      operation: 'install',
      packageName: 'git',
      version: '2.45.0-1'
    })
    assert(pacmanPlan.command === 'pacman -S --needed --noconfirm git' && pacmanPlan.warnings.some((warning) => warning.includes('version')), 'extended planner builds pacman install commands and warns about portable version pins')

    const nixPlan = await extended.plan(cwd, 'nix', {
      operation: 'install',
      packageName: 'nodejs_22'
    })
    assert(nixPlan.command === 'nix profile install nixpkgs#nodejs_22', 'extended planner builds Nix profile install commands')

    const dockerPlan = await extended.plan(cwd, 'docker', {
      operation: 'sync'
    })
    assert(dockerPlan.command === 'docker compose config' && !dockerPlan.mutating, 'extended planner builds read-only Docker compose validation commands')

    const helmPlan = await extended.plan(cwd, 'helm', {
      operation: 'update'
    })
    assert(helmPlan.command === 'helm dependency update' && helmPlan.mutating, 'extended planner builds Helm dependency update commands')

    const kustomizePlan = await extended.plan(cwd, 'kustomize', {
      operation: 'sync'
    })
    assert(kustomizePlan.command === 'kustomize build .' && !kustomizePlan.mutating, 'extended planner builds Kustomize render commands')

    const helmfilePlan = await extended.plan(cwd, 'helmfile', {
      operation: 'update'
    })
    assert(helmfilePlan.command === 'helmfile deps' && helmfilePlan.mutating, 'extended planner builds Helmfile dependency refresh commands')

    const skaffoldPlan = await extended.plan(cwd, 'skaffold', {
      operation: 'sync'
    })
    assert(skaffoldPlan.command === 'skaffold render' && !skaffoldPlan.mutating, 'extended planner builds Skaffold render commands')

    const argoPlan = await extended.plan(cwd, 'argocd', {
      operation: 'sync',
      packageName: 'fixture-app'
    })
    assert(argoPlan.command === 'argocd app diff fixture-app' && !argoPlan.mutating, 'extended planner builds Argo CD application diff commands')

    const fluxPlan = await extended.plan(cwd, 'flux', {
      operation: 'audit'
    })
    assert(fluxPlan.command === 'flux check' && !fluxPlan.mutating, 'extended planner builds Flux check commands')

    const denoPlan = await extended.plan(cwd, 'deno', {
      operation: 'install',
      packageName: 'npm:chalk',
      version: '5.3.0'
    })
    assert(denoPlan.command === 'deno add npm:chalk@5.3.0', 'extended planner builds Deno add commands')

    const swiftPlan = await extended.plan(cwd, 'swiftpm', {
      operation: 'sync'
    })
    assert(swiftPlan.command === 'swift package resolve' && swiftPlan.mutating, 'extended planner builds SwiftPM resolve commands')

    const podPlan = await extended.plan(cwd, 'cocoapods', {
      operation: 'sync'
    })
    assert(podPlan.command === 'pod install' && podPlan.mutating, 'extended planner builds CocoaPods install commands')

    const mixAuditPlan = await extended.plan(cwd, 'mix', {
      operation: 'audit'
    })
    assert(mixAuditPlan.command === 'mix hex.audit' && !mixAuditPlan.mutating, 'extended planner builds Mix Hex audit commands')

    const stackTreePlan = await extended.plan(cwd, 'stack', {
      operation: 'tree'
    })
    assert(stackTreePlan.command === 'stack ls dependencies' && !stackTreePlan.mutating, 'extended planner builds Stack dependency tree commands')

    const cabalLockPlan = await extended.plan(cwd, 'cabal', {
      operation: 'lock'
    })
    assert(cabalLockPlan.command === 'cabal freeze' && cabalLockPlan.mutating, 'extended planner builds Cabal freeze lock commands')

    const renvLockPlan = await extended.plan(cwd, 'renv', {
      operation: 'lock'
    })
    assert(renvLockPlan.command === 'rscript -e renv::snapshot()' && renvLockPlan.mutating, 'extended planner builds renv snapshot lock commands')

    const juliaSyncPlan = await extended.plan(cwd, 'julia', {
      operation: 'sync'
    })
    assert(juliaSyncPlan.command.includes('Pkg.instantiate()') && juliaSyncPlan.mutating, 'extended planner builds Julia instantiate commands')

    const terraformSyncPlan = await extended.plan(cwd, 'terraform', {
      operation: 'sync'
    })
    assert(terraformSyncPlan.command === 'terraform init' && terraformSyncPlan.mutating, 'extended planner builds Terraform init commands')

    const tofuUpdatePlan = await extended.plan(cwd, 'opentofu', {
      operation: 'update'
    })
    assert(tofuUpdatePlan.command === 'tofu init -upgrade' && tofuUpdatePlan.mutating, 'extended planner builds OpenTofu upgrade init commands')

    const ansibleSyncPlan = await extended.plan(cwd, 'ansible', {
      operation: 'sync'
    })
    assert(ansibleSyncPlan.command === 'ansible-galaxy collection install -r requirements.yml' && ansibleSyncPlan.mutating, 'extended planner builds Ansible Galaxy install commands')

    const githubActionsListPlan = await extended.plan(cwd, 'github-actions', {
      operation: 'list'
    })
    assert(githubActionsListPlan.command === 'gh workflow list' && !githubActionsListPlan.mutating, 'extended planner builds GitHub Actions workflow list commands')

    const gitlabLintPlan = await extended.plan(cwd, 'gitlab-ci', {
      operation: 'audit'
    })
    assert(gitlabLintPlan.command === 'glab ci lint' && !gitlabLintPlan.mutating, 'extended planner builds GitLab CI lint commands')

    const preCommitUpdatePlan = await extended.plan(cwd, 'pre-commit', {
      operation: 'update'
    })
    assert(preCommitUpdatePlan.command === 'pre-commit autoupdate' && preCommitUpdatePlan.mutating, 'extended planner builds pre-commit autoupdate commands')

    const bazelGraphPlan = await extended.plan(cwd, 'bazel', {
      operation: 'tree'
    })
    assert(bazelGraphPlan.command === 'bazel mod graph' && !bazelGraphPlan.mutating, 'extended planner builds Bazel module graph commands')

    const pantsLockPlan = await extended.plan(cwd, 'pants', {
      operation: 'lock'
    })
    assert(pantsLockPlan.command === 'pants generate-lockfiles' && pantsLockPlan.mutating, 'extended planner builds Pants lockfile generation commands')

    const buckAuditPlan = await extended.plan(cwd, 'buck', {
      operation: 'audit'
    })
    assert(buckAuditPlan.command === 'buck2 audit dependencies //...' && !buckAuditPlan.mutating, 'extended planner builds Buck dependency audit commands')

    const supplyChain = new SupplyChainService()
    const report = await supplyChain.report(cwd)
    assert(report.componentCount > 10, 'supply-chain report aggregates multiple ecosystem components')
    assert(hasComponent(report, 'npm', 'react', '^19.0.0'), 'supply-chain report includes npm manifest dependencies')
    assert(hasComponent(report, 'npm', 'react', '19.2.0'), 'supply-chain report includes npm lockfile dependencies')
    assert(hasComponent(report, 'pip', 'requests', '2.32.3'), 'supply-chain report includes pip requirements')
    assert(hasComponent(report, 'cargo', 'serde', '1.0.197'), 'supply-chain report includes Cargo.lock dependencies')
    assert(hasComponent(report, 'go', 'github.com/google/uuid', 'v1.6.0'), 'supply-chain report includes go.sum dependencies')
    assert(hasComponent(report, 'flutter', 'http', '1.2.2'), 'supply-chain report includes pubspec.lock dependencies')
    assert(hasComponent(report, 'composer', 'monolog/monolog', '3.5.0'), 'supply-chain report includes composer.lock dependencies')
    assert(hasComponent(report, 'nuget', 'Newtonsoft.Json', '13.0.3'), 'supply-chain report includes packages.lock.json dependencies')
    assert(hasComponent(report, 'bundler', 'rack', '3.0.8'), 'supply-chain report includes Gemfile.lock dependencies')
    assert(hasComponent(report, 'docker', 'node', '22-alpine'), 'supply-chain report includes Dockerfile base image dependencies')
    assert(hasComponent(report, 'docker', 'postgres', 'latest'), 'supply-chain report includes compose image dependencies')
    assert(hasComponentFrom(report, 'helm', 'redis', 'Chart.lock'), 'supply-chain report includes Helm Chart.lock dependencies')
    assert(report.components.some((component) => component.managerId === 'helm' && component.packageUrl === 'pkg:helm/redis@19.6.2'), 'supply-chain report assigns package URLs to Helm components')
    assert(hasComponent(report, 'kustomize', 'github.com/acme/platform/base', 'v1.2.0'), 'supply-chain report includes Kustomize remote bases')
    assert(hasComponent(report, 'helmfile', 'bitnami/redis', '19.6.2'), 'supply-chain report includes Helmfile release chart pins')
    assert(hasComponent(report, 'skaffold', 'ghcr.io/acme/api', '1.4.2'), 'supply-chain report includes Skaffold artifact images')
    assert(hasComponent(report, 'argocd', 'fixture-chart', 'v1.2.3'), 'supply-chain report includes Argo CD Application sources')
    assert(hasComponent(report, 'flux', 'platform-config', 'v1.2.3') && hasComponent(report, 'flux', 'redis', '19.6.2'), 'supply-chain report includes Flux source and HelmRelease pins')
    assert(hasComponent(report, 'flux', 'floating-platform', 'main'), 'supply-chain report includes floating Flux branch refs for deployment gate review')
    assert(report.components.some((component) => component.managerId === 'kustomize' && component.packageUrl === 'pkg:generic/kustomize/github.com%2Facme%2Fplatform%2Fbase@v1.2.0'), 'supply-chain report assigns package URLs to Kustomize components')
    assert(report.components.some((component) => component.managerId === 'helmfile' && component.packageUrl === 'pkg:generic/helmfile/bitnami%2Fredis@19.6.2'), 'supply-chain report assigns package URLs to Helmfile components')
    assert(report.components.some((component) => component.managerId === 'argocd' && component.packageUrl === 'pkg:generic/argocd/fixture-chart@v1.2.3'), 'supply-chain report assigns package URLs to Argo CD components')
    assert(hasComponent(report, 'deno', 'lodash', '4.17.21'), 'supply-chain report includes Deno imports')
    assert(hasComponent(report, 'swiftpm', 'Alamofire', '5.8.0'), 'supply-chain report includes SwiftPM dependencies')
    assert(hasComponent(report, 'cocoapods', 'AFNetworking', '~> 4.0'), 'supply-chain report includes CocoaPods dependencies')
    assert(hasComponent(report, 'sbt', 'com.typesafe:config', '1.4.3'), 'supply-chain report includes sbt dependencies')
    assert(hasComponent(report, 'leiningen', 'ring/ring-core', '1.12.1'), 'supply-chain report includes Leiningen dependencies')
    assert(hasComponent(report, 'mix', 'phoenix', '~> 1.7'), 'supply-chain report includes Mix dependencies')
    assert(hasComponent(report, 'rebar3', 'cowboy', '2.10.0'), 'supply-chain report includes rebar3 dependencies')
    assert(hasComponent(report, 'cabal', 'aeson', '>= 2.2'), 'supply-chain report includes Cabal dependencies')
    assert(hasComponent(report, 'stack', 'warp', '3.3.31'), 'supply-chain report includes Stack dependencies')
    assert(report.components.some((component) => component.managerId === 'mix' && component.packageUrl?.startsWith('pkg:hex/phoenix@')), 'supply-chain report assigns package URLs to Hex components')
    assert(report.components.some((component) => component.managerId === 'cabal' && component.packageUrl?.startsWith('pkg:hackage/aeson@')), 'supply-chain report assigns package URLs to Hackage components')
    assert(hasComponent(report, 'renv', 'dplyr', '1.1.4'), 'supply-chain report includes renv dependencies')
    assert(hasComponent(report, 'julia', 'DataFrames', '1.6.1'), 'supply-chain report includes Julia dependencies')
    assert(report.components.some((component) => component.managerId === 'renv' && component.packageUrl === 'pkg:cran/dplyr@1.1.4'), 'supply-chain report assigns package URLs to CRAN components')
    assert(report.components.some((component) => component.managerId === 'julia' && component.packageUrl === 'pkg:julia/DataFrames@1.6.1'), 'supply-chain report assigns package URLs to Julia components')
    assert(hasComponent(report, 'terraform', 'hashicorp/aws', '5.54.1'), 'supply-chain report includes Terraform provider lock dependencies')
    assert(hasComponent(report, 'opentofu', 'hashicorp/aws', '5.54.1'), 'supply-chain report includes OpenTofu provider lock dependencies')
    assert(hasComponent(report, 'ansible', 'community.general', '8.6.0'), 'supply-chain report includes Ansible Galaxy collection dependencies')
    assert(report.components.some((component) => component.managerId === 'terraform' && component.packageUrl === 'pkg:terraform/hashicorp%2Faws@5.54.1'), 'supply-chain report assigns package URLs to Terraform components')
    assert(report.components.some((component) => component.managerId === 'ansible' && component.packageUrl === 'pkg:ansible/community.general@8.6.0'), 'supply-chain report assigns package URLs to Ansible Galaxy components')
    assert(hasComponent(report, 'github-actions', 'actions/checkout', 'v4'), 'supply-chain report includes GitHub Actions dependencies')
    assert(hasComponent(report, 'github-actions', 'actions/setup-python', 'main'), 'supply-chain report includes floating GitHub Actions refs for policy review')
    assert(hasComponent(report, 'gitlab-ci', 'devops/templates', 'v2.3.0'), 'supply-chain report includes GitLab CI include dependencies')
    assert(hasComponent(report, 'pre-commit', 'https://github.com/pre-commit/pre-commit-hooks', 'v4.6.0'), 'supply-chain report includes pre-commit hook dependencies')
    assert(hasComponent(report, 'pre-commit', 'https://github.com/example/floating-hooks', 'master'), 'supply-chain report includes floating pre-commit hook refs for policy review')
    assert(report.components.some((component) => component.managerId === 'github-actions' && component.packageUrl === 'pkg:githubactions/actions%2Fcheckout@v4'), 'supply-chain report assigns package URLs to GitHub Actions components')
    assert(report.components.some((component) => component.managerId === 'pre-commit' && component.packageUrl === 'pkg:pre-commit/https%3A%2F%2Fgithub.com%2Fpre-commit%2Fpre-commit-hooks@v4.6.0'), 'supply-chain report assigns package URLs to pre-commit components')
    assert(hasComponent(report, 'bazel', 'rules_jvm_external', '6.3'), 'supply-chain report includes Bazel module dependencies')
    assert(hasComponent(report, 'pants', 'requests', '2.32.3'), 'supply-chain report includes Pants BUILD dependencies')
    assert(hasComponent(report, 'buck', 'com.google.guava:guava', '33.0.0-jre'), 'supply-chain report includes Buck Maven jar dependencies')
    assert(report.components.some((component) => component.managerId === 'bazel' && component.packageUrl === 'pkg:bazel/rules_jvm_external@6.3'), 'supply-chain report assigns package URLs to Bazel components')
    assert(report.components.some((component) => component.managerId === 'buck' && component.packageUrl === 'pkg:buck/com.google.guava%3Aguava@33.0.0-jre'), 'supply-chain report assigns package URLs to Buck components')
    assert(hasComponent(report, 'opam', 'yojson', '>= 2.1.0'), 'supply-chain report includes opam dependencies')
    assert(hasComponent(report, 'cpan', 'Mojolicious', '>= 9.37'), 'supply-chain report includes CPAN dependencies')
    assert(hasComponent(report, 'luarocks', 'luasocket', '>= 3.1.0'), 'supply-chain report includes LuaRocks dependencies')
    assert(hasComponent(report, 'shards', 'kemal', '~> 1.4.0'), 'supply-chain report includes Crystal Shards dependencies')
    assert(report.components.some((component) => component.managerId === 'zig' && component.name === 'zlib' && component.packageUrl?.startsWith('pkg:zig/zlib')), 'supply-chain report includes Zig dependencies with package URLs')
    assert(report.components.some((component) => component.managerId === 'opam' && component.packageUrl === 'pkg:opam/yojson@%3E%3D%202.1.0'), 'supply-chain report assigns package URLs to opam components')
    assert(report.components.some((component) => component.managerId === 'cpan' && component.packageUrl === 'pkg:cpan/Mojolicious@%3E%3D%209.37'), 'supply-chain report assigns package URLs to CPAN components')
    assert(report.components.some((component) => component.managerId === 'luarocks' && component.packageUrl === 'pkg:luarocks/luasocket@%3E%3D%203.1.0'), 'supply-chain report assigns package URLs to LuaRocks components')
    assert(hasComponent(report, 'homebrew', 'git', '2.45.0'), 'supply-chain report includes Homebrew Bundle dependencies')
    assert(hasComponent(report, 'chocolatey', 'nodejs-lts', '22.13.0'), 'supply-chain report includes Chocolatey package pins')
    assert(hasComponent(report, 'scoop', 'ripgrep', '14.1.1'), 'supply-chain report includes Scoop app pins')
    assert(hasComponent(report, 'winget', 'Git.Git', '2.45.0'), 'supply-chain report includes winget package identifiers')
    assert(hasComponent(report, 'asdf', 'nodejs', '22.13.0'), 'supply-chain report includes asdf runtime pins')
    assert(hasComponent(report, 'mise', 'node', '22.13.0'), 'supply-chain report includes mise runtime pins')
    assert(hasComponent(report, 'sdkman', 'java', '17.0.10-tem'), 'supply-chain report includes SDKMAN candidate pins')
    assert(hasComponent(report, 'apt', 'curl', '8.5.0-2ubuntu10'), 'supply-chain report includes APT package baselines')
    assert(hasComponent(report, 'dnf', 'git', '2.45.0'), 'supply-chain report includes DNF package baselines')
    assert(hasComponent(report, 'apk', 'openssl', '3.2.1-r0'), 'supply-chain report includes apk package baselines')
    assert(hasComponent(report, 'pacman', 'git', '2.45.0-1'), 'supply-chain report includes pacman package baselines')
    assert(hasComponent(report, 'nix', 'nixpkgs', 'nixos-24.05') && report.components.some((component) => component.managerId === 'nix' && component.name === 'nodejs_22'), 'supply-chain report includes Nix flake inputs and dev shell packages')
    assert(report.components.some((component) => component.managerId === 'homebrew' && component.packageUrl === 'pkg:brew/git@2.45.0'), 'supply-chain report assigns package URLs to Homebrew components')
    assert(report.components.some((component) => component.managerId === 'chocolatey' && component.packageUrl === 'pkg:chocolatey/nodejs-lts@22.13.0'), 'supply-chain report assigns package URLs to Chocolatey components')
    assert(report.components.some((component) => component.managerId === 'scoop' && component.packageUrl === 'pkg:generic/scoop/ripgrep@14.1.1'), 'supply-chain report assigns package URLs to Scoop components')
    assert(report.components.some((component) => component.managerId === 'winget' && component.packageUrl === 'pkg:generic/winget/Git.Git@2.45.0'), 'supply-chain report assigns package URLs to winget components')
    assert(report.components.some((component) => component.managerId === 'asdf' && component.packageUrl === 'pkg:generic/asdf/nodejs@22.13.0'), 'supply-chain report assigns package URLs to asdf components')
    assert(report.components.some((component) => component.managerId === 'apt' && component.packageUrl === 'pkg:deb/debian/curl@8.5.0-2ubuntu10'), 'supply-chain report assigns package URLs to APT components')
    assert(report.components.some((component) => component.managerId === 'dnf' && component.packageUrl === 'pkg:rpm/git@2.45.0'), 'supply-chain report assigns package URLs to DNF components')
    assert(report.components.some((component) => component.managerId === 'apk' && component.packageUrl === 'pkg:apk/alpine/openssl@3.2.1-r0'), 'supply-chain report assigns package URLs to apk components')
    assert(report.components.some((component) => component.managerId === 'pacman' && component.packageUrl === 'pkg:alpm/arch/git@2.45.0-1'), 'supply-chain report assigns package URLs to pacman components')
    assert(report.components.some((component) => component.managerId === 'nix' && component.packageUrl === 'pkg:generic/nix/nixpkgs@nixos-24.05'), 'supply-chain report assigns package URLs to Nix components')
    const licenseReport = await supplyChain.licenseReport(cwd)
    assert(licenseReport.summary.licenseCount > 0 && licenseReport.licenses.some((item) => item.normalizedLicense === 'MIT'), 'license compliance matrix summarizes detected package licenses')
    assert(licenseReport.components.some((component) => component.status === 'unknown'), 'license compliance matrix tracks unknown license components')
    const exportedLicenseReport = await supplyChain.exportLicenseMarkdown(cwd)
    const exportedLicenseText = await readFile(exportedLicenseReport.path, 'utf-8')
    assert(exportedLicenseText.includes('License Compliance Matrix') && exportedLicenseText.includes('Component Review'), 'license compliance matrix exports markdown review artifacts')
    const thirdPartyNotices = new ThirdPartyNoticesService({ supplyChainService: supplyChain })
    const thirdPartyNoticeReport = await thirdPartyNotices.report(cwd)
    assert(thirdPartyNoticeReport.summary.noticeCount === licenseReport.summary.componentCount && thirdPartyNoticeReport.entries.some((entry) => entry.licenseExpression.includes('MIT')) && thirdPartyNoticeReport.entries.some((entry) => entry.licenseExpression === 'UNKNOWN'), 'third-party notices derive dependency attribution entries from the license compliance matrix')
    const exportedThirdPartyText = await thirdPartyNotices.exportText(cwd)
    const exportedThirdPartyTextBody = await readFile(exportedThirdPartyText.path, 'utf-8')
    assert(exportedThirdPartyText.path.endsWith('THIRD-PARTY-NOTICES.txt') && exportedThirdPartyTextBody.includes('THIRD-PARTY-NOTICES') && exportedThirdPartyTextBody.includes('License text is not embedded'), 'third-party notices export distribution-ready text attribution artifacts')
    const exportedThirdPartyMarkdown = await thirdPartyNotices.exportMarkdown(cwd)
    const exportedThirdPartyMarkdownBody = await readFile(exportedThirdPartyMarkdown.path, 'utf-8')
    assert(exportedThirdPartyMarkdownBody.includes('Third-Party Notices') && exportedThirdPartyMarkdownBody.includes('Notice Index') && exportedThirdPartyMarkdownBody.includes('License Summary'), 'third-party notices export markdown review artifacts')
    const exportedThirdPartyJson = await thirdPartyNotices.exportJson(cwd)
    const exportedThirdPartyJsonData = JSON.parse(await readFile(exportedThirdPartyJson.path, 'utf-8'))
    assert(exportedThirdPartyJsonData.summary.noticeCount === thirdPartyNoticeReport.summary.noticeCount && exportedThirdPartyJsonData.entries.some((entry) => entry.notice && entry.licenseTextIncluded === false), 'third-party notices export JSON attribution metadata')

    const snapshot = await supplyChain.createSnapshot(cwd, {
      reason: 'framework verifier baseline',
      source: 'manual'
    })
    assert(snapshot.reason === 'framework verifier baseline' && snapshot.source === 'manual', 'snapshot stores source and reason metadata')
    assert(snapshot.files.some((file) => file.file === 'package.json'), 'snapshot captures manifest files')

    await writeJson(join(cwd, 'package.json'), {
      name: 'fixture-app',
      version: '2.0.0',
      dependencies: { react: '^20.0.0-alpha.1', antd: '^6.0.0' }
    })
    const diff = await supplyChain.diffLatestSnapshot(cwd)
    assert(Boolean(diff?.changed.some((file) => file.file === 'package.json')), 'snapshot diff detects changed manifests')
    const componentDiff = await supplyChain.dependencyDiffLatestSnapshot(cwd)
    assert(Boolean(componentDiff?.changes.some((change) => change.kind === 'added' && change.name === 'antd')), 'dependency component diff detects added dependencies')
    assert(Boolean(componentDiff?.changes.some((change) => change.kind === 'updated' && change.name === 'react' && change.risk === 'high')), 'dependency component diff flags high-risk prerelease updates')
    assert(componentDiff?.summary.added && componentDiff.summary.updated && componentDiff.summary.prereleaseChanges > 0, 'dependency component diff summarizes change and risk counts')
    const exportedDependencyDiff = await supplyChain.exportDependencyDiffMarkdown(cwd)
    const exportedDependencyDiffText = await readFile(exportedDependencyDiff.path, 'utf-8')
    assert(exportedDependencyDiffText.includes('Dependency Change Risk Report') && exportedDependencyDiffText.includes('antd'), 'dependency component diff exports markdown risk reports')
    const reachableRegistry = new RegistryReachabilityService({
      checker: async () => ({
        status: 'reachable',
        statusCode: 200,
        message: 'fixture registry reachable'
      })
    })
    const riskReadiness = new ReadinessGateService({
      supplyChainService: supplyChain,
      registryReachabilityService: reachableRegistry,
      checkTool: async (tool) => ({ tool, available: true, version: String(tool) + ' 1.0.0' }),
      credentialVault: {
        status: () => ({ available: true, encrypted: true, storage: 'test-adapter' }),
        list: async () => []
      }
    })
    await riskReadiness.savePolicy(cwd, DEFAULT_READINESS_POLICY)
    const riskReadinessReport = await riskReadiness.report(cwd)
    assert(riskReadinessReport.summary.dependencyHighRiskCount > 0, 'readiness gate summary includes high-risk dependency diff counts')
    assert(riskReadinessReport.checks.some((item) => item.id === 'dependency-change-risk' && item.status === 'blocked'), 'readiness gate blocks release on high-risk dependency diffs')
    const relaxedReadinessPolicy = await riskReadiness.savePolicy(cwd, {
      ...DEFAULT_READINESS_POLICY,
      maxHighRiskDependencyChanges: 100,
      maxMediumRiskDependencyChanges: 100
    })
    assert(relaxedReadinessPolicy.path.replace(/\\/g, '/').endsWith('.npmDesktopManager/readiness-policy.json'), 'readiness gate saves project-level policy thresholds')
    const relaxedRiskReadinessReport = await riskReadiness.report(cwd)
    assert(relaxedRiskReadinessReport.policy.policy.maxHighRiskDependencyChanges === 100, 'readiness gate report includes configured policy thresholds')
    assert(relaxedRiskReadinessReport.checks.some((item) => item.id === 'dependency-change-risk' && item.status !== 'blocked'), 'readiness gate honors configured dependency-risk thresholds')

    const restored = await supplyChain.restoreSnapshot(cwd, snapshot.path)
    assert(restored.restoredCount > 0 && restored.preRestoreSnapshot.source === 'restore', 'snapshot restore creates a pre-restore safety snapshot')
    const restoredPackage = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'))
    assert(restoredPackage.version === '1.0.0' && !restoredPackage.dependencies.antd, 'snapshot restore writes the selected manifest state')

    const snapshotList = await supplyChain.listSnapshots(cwd)
    assert(snapshotList.some((item) => item.reason === 'framework verifier baseline'), 'snapshot listing includes reason metadata')
    assert(snapshotList.some((item) => item.source === 'restore'), 'snapshot listing includes restore safety snapshots')

    await recordOperationHistory({
      id: 'verify-history-1',
      command: 'pnpm add left-pad@1.3.0 -D',
      cwd,
      status: 'success',
      startedAt: new Date(Date.now() - 1200).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 1200,
      stdout: 'added left-pad'
    })
    await recordOperationHistory({
      id: 'verify-history-secret',
      command: 'twine upload -u __token__ -p pypi-super-secret-token dist/pkg.whl --repository-token=hidden-token',
      cwd,
      status: 'error',
      startedAt: new Date(Date.now() - 600).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 600,
      stderr: 'Authorization: Bearer pypi-super-secret-token\\npassword=hidden-token'
    })
    const history = await listOperationHistory(cwd, 10)
    assert(history.some((item) => item.id === 'verify-history-1' && item.status === 'success'), 'operation history persists project command records')
    const historyRecord = history.find((item) => item.id === 'verify-history-1')
    assert(historyRecord?.classification?.managerId === 'pnpm' && historyRecord.classification.operation === 'install', 'operation history classifies manager and operation kind')
    assert(historyRecord?.classification?.mutating === true && historyRecord.summary === 'added left-pad', 'operation history marks mutating commands and stores a summary')
    const readOnlyClassification = classifyOperationHistoryRecord({
      command: 'pip list --outdated',
      status: 'success',
      stdout: ''
    })
    assert(readOnlyClassification.managerId === 'pip' && readOnlyClassification.operation === 'list' && !readOnlyClassification.mutating, 'operation history classifies read-only tool commands')
    const runtimeClassification = classifyOperationHistoryRecord({
      command: 'winget install --id Git.Git -e',
      status: 'success',
      stdout: ''
    })
    assert(runtimeClassification.managerId === 'winget' && runtimeClassification.operation === 'install' && runtimeClassification.mutating, 'operation history classifies system package and runtime manager commands')
    const gitOpsClassification = classifyOperationHistoryRecord({
      command: 'flux check',
      status: 'success',
      stdout: ''
    })
    assert(gitOpsClassification.managerId === 'flux' && gitOpsClassification.operation === 'audit' && !gitOpsClassification.mutating, 'operation history classifies GitOps deployment manager commands')
    const linuxRuntimeClassification = classifyOperationHistoryRecord({
      command: 'apt-get install -y curl',
      status: 'success',
      stdout: ''
    })
    assert(linuxRuntimeClassification.managerId === 'apt' && linuxRuntimeClassification.operation === 'install' && linuxRuntimeClassification.mutating, 'operation history classifies Linux system package manager commands')
    const exportedHistory = await exportOperationHistory(cwd, 'markdown')
    const exportedHistoryText = await readFile(exportedHistory.path, 'utf-8')
    assert(exportedHistory.count >= 1 && exportedHistoryText.includes('Operation History Report'), 'operation history exports markdown audit reports')
    const secretHistory = history.find((item) => item.id === 'verify-history-secret')
    assert(Boolean(secretHistory) && !JSON.stringify(secretHistory).includes('pypi-super-secret-token') && !JSON.stringify(secretHistory).includes('hidden-token'), 'operation history redacts credential-like command data')
    assert(!exportedHistoryText.includes('pypi-super-secret-token') && !exportedHistoryText.includes('hidden-token'), 'operation history exports redact credential-like data')

    const vault = new CredentialVaultStore(join(cwd, '.vault-test'), createBase64CredentialCipher())
    const savedCredential = await vault.save({
      managerId: 'pip',
      service: 'https://upload.pypi.org/legacy/',
      account: '__token__',
      label: 'PyPI verifier token',
      kind: 'token',
      secret: 'pypi-verifier-secret'
    })
    await vault.save({
      managerId: 'npm',
      service: 'https://registry.example.test/npm/',
      account: 'fixture-token',
      label: 'Fixture npm registry token',
      kind: 'token',
      secret: 'npm-registry-verifier-secret'
    })
    const credentialList = await vault.list({ managerId: 'pip' })
    const resolvedCredential = await vault.resolve(savedCredential.id)
    assert(credentialList.some((item) => item.id === savedCredential.id && item.secretPreview.endsWith('cret')), 'credential vault stores metadata without exposing secrets')
    assert(!JSON.stringify(credentialList).includes('pypi-verifier-secret') && resolvedCredential.secret === 'pypi-verifier-secret', 'credential vault resolves secrets only through explicit resolution')
    const credentialUsage = new CredentialUsageService({
      registryReachabilityService: new RegistryReachabilityService(),
      credentialVault: vault
    })
    const credentialUsageReport = await credentialUsage.report(cwd)
    assert(credentialUsageReport.endpoints.some((endpoint) => endpoint.endpoint.url.includes('registry.example.test') && endpoint.matches.some((match) => match.matchType === 'exact-service')), 'credential usage map links registry endpoints to scoped credential metadata')
    assert(credentialUsageReport.endpoints.some((endpoint) => endpoint.endpoint.url.includes('registry.internal') && endpoint.status === 'missing'), 'credential usage map flags private registry endpoints without credentials')
    assert(credentialUsageReport.summary.insecureStorageEndpointCount > 0 && credentialUsageReport.summary.unusedCredentialCount > 0, 'credential usage map summarizes insecure storage and unused credential metadata')
    assert(!JSON.stringify(credentialUsageReport).includes('npm-registry-verifier-secret'), 'credential usage map never exposes credential secrets')
    const exportedCredentialUsage = await credentialUsage.exportMarkdown(cwd)
    const exportedCredentialUsageText = await readFile(exportedCredentialUsage.path, 'utf-8')
    assert(exportedCredentialUsageText.includes('Credential Usage Report') && exportedCredentialUsageText.includes('registry.internal'), 'credential usage map exports markdown review artifacts')
    const exportedCredentialUsageJson = await credentialUsage.exportJson(cwd)
    const exportedCredentialUsageData = JSON.parse(await readFile(exportedCredentialUsageJson.path, 'utf-8'))
    assert(exportedCredentialUsageData.summary.endpointCount === credentialUsageReport.summary.endpointCount && !JSON.stringify(exportedCredentialUsageData).includes('npm-registry-verifier-secret'), 'credential usage map exports JSON without secrets')
    const credentialRotation = new CredentialRotationPlanService({
      credentialUsageService: credentialUsage,
      dependencyAutomationPlanService: new DependencyAutomationPlanService({
        workspaceDiscoveryService: new WorkspaceDiscoveryService()
      })
    })
    const credentialRotationPlan = await credentialRotation.plan(cwd)
    assert(credentialRotationPlan.status === 'blocked' && credentialRotationPlan.summary.actionCount > 0, 'credential rotation plan summarizes blocking credential rotation actions')
    assert(credentialRotationPlan.actions.some((item) => item.kind === 'create-credential' && item.severity === 'blocked') && credentialRotationPlan.actions.some((item) => item.kind === 'rotate-credential'), 'credential rotation plan flags missing endpoint credentials and insecure stored credentials')
    assert(credentialRotationPlan.automationSecrets.includes('NPM_TOKEN') && credentialRotationPlan.automationSecrets.includes('PYPI_TOKEN'), 'credential rotation plan inherits automation secret placeholders from dependency automation plans')
    assert(!JSON.stringify(credentialRotationPlan).includes('npm-registry-verifier-secret') && !JSON.stringify(credentialRotationPlan).includes('pypi-verifier-secret'), 'credential rotation plan never exposes credential secrets')
    const exportedCredentialRotation = await credentialRotation.exportMarkdown(cwd)
    const exportedCredentialRotationText = await readFile(exportedCredentialRotation.path, 'utf-8')
    assert(exportedCredentialRotationText.includes('Credential Rotation Plan') && exportedCredentialRotationText.includes('Automation Secrets') && exportedCredentialRotationText.includes('registry.internal'), 'credential rotation plan exports Markdown review artifacts')
    const exportedCredentialRotationJson = await credentialRotation.exportJson(cwd)
    const exportedCredentialRotationData = JSON.parse(await readFile(exportedCredentialRotationJson.path, 'utf-8'))
    assert(exportedCredentialRotationData.summary.actionCount === credentialRotationPlan.summary.actionCount && !JSON.stringify(exportedCredentialRotationData).includes('npm-registry-verifier-secret'), 'credential rotation plan exports JSON without secrets')

    const ciEvidence = new CiEvidenceService()
    const ciPass = await ciEvidence.record(cwd, {
      source: 'manual',
      provider: 'verifier',
      workflow: 'dependency-framework',
      job: 'smoke',
      status: 'success',
      finishedAt: new Date(Date.now() - 120000).toISOString(),
      totalTests: 12,
      passedTests: 12,
      failedTests: 0,
      summary: 'framework smoke checks passed'
    })
    assert(ciPass.status === 'success' && ciPass.totalTests === 12, 'CI evidence records manual verification results')
    const junitPath = join(cwd, 'junit.xml')
    await writeFile(junitPath, '<testsuite name="verify" tests="4" failures="1" errors="0" skipped="1" time="2.5"></testsuite>', 'utf-8')
    const importedCi = await ciEvidence.importFromFile(cwd, junitPath, {
      workflow: 'junit dependency tests',
      provider: 'junit'
    })
    assert(importedCi.records[0].status === 'failed' && importedCi.records[0].failedTests === 1, 'CI evidence imports JUnit reports and failure counts')
    const ciRecords = await ciEvidence.list(cwd, 10)
    assert(ciRecords.length >= 2 && ciRecords[0].status === 'failed', 'CI evidence persists and sorts latest records')
    const exportedCi = await ciEvidence.exportMarkdown(cwd)
    const exportedCiText = await readFile(exportedCi.path, 'utf-8')
    assert(exportedCiText.includes('CI Evidence Report') && exportedCi.summary.failed >= 1, 'CI evidence exports markdown release artifacts')
    const changeExecutionRecord = await dependencyChangeExecutionRecord.report(cwd)
    assert(changeExecutionRecord.summary.recordCount === changeCalendar.summary.windowCount && changeExecutionRecord.summary.ciEvidenceCount >= 2 && changeExecutionRecord.records.some((item) => item.relatedCiEvidence.length > 0 || item.gaps.some((gap) => gap.includes('CI evidence'))), 'dependency change execution record maps calendar windows to CI evidence and evidence gaps')
    assert(changeExecutionRecord.records.some((item) => item.gaps.length > 0 || item.relatedOperations.length > 0) && ['ready', 'warning', 'blocked'].includes(changeExecutionRecord.status), 'dependency change execution record carries operation history evidence, missing-operation gaps, and execution status')
    const exportedChangeExecutionRecord = await dependencyChangeExecutionRecord.exportMarkdown(cwd)
    const exportedChangeExecutionRecordText = await readFile(exportedChangeExecutionRecord.path, 'utf-8')
    assert(exportedChangeExecutionRecordText.includes('Dependency Change Execution Record') && exportedChangeExecutionRecordText.includes('Execution Records') && exportedChangeExecutionRecordText.includes('Evidence Gaps'), 'dependency change execution record exports Markdown execution audits')
    const exportedChangeExecutionRecordJson = await dependencyChangeExecutionRecord.exportJson(cwd)
    const exportedChangeExecutionRecordJsonData = JSON.parse(await readFile(exportedChangeExecutionRecordJson.path, 'utf-8'))
    assert(exportedChangeExecutionRecordJsonData.summary.recordCount === changeExecutionRecord.summary.recordCount && exportedChangeExecutionRecordJsonData.records.some((item) => item.verificationStatus === 'failed' || item.verificationStatus === 'missing' || item.verificationStatus === 'passed'), 'dependency change execution record exports JSON execution audits')
    const executionArtifactLibrary = await reportArtifactIndex.report(cwd)
    assert(executionArtifactLibrary.artifacts.some((artifact) => artifact.relativePath.endsWith('dependency-change-execution-record.json') && artifact.category === 'operations'), 'report artifact library indexes dependency change execution records as operations evidence')

    const releaseApprovals = new ReleaseApprovalService()
    const approval = await releaseApprovals.record(cwd, {
      reviewer: 'alice',
      decision: 'approved',
      scope: 'release',
      decidedAt: new Date(Date.now() - 90000).toISOString(),
      summary: 'dependency update reviewed'
    })
    assert(approval.decision === 'approved' && approval.reviewer === 'alice', 'release approval records reviewer sign-off')
    const rejection = await releaseApprovals.record(cwd, {
      reviewer: 'bob',
      decision: 'rejected',
      scope: 'dependency-change',
      decidedAt: new Date().toISOString(),
      summary: 'blocked pending changelog review'
    })
    const approvalRecords = await releaseApprovals.list(cwd, 10)
    assert(approvalRecords.length >= 2 && approvalRecords[0].id === rejection.id, 'release approvals persist and sort latest decisions')
    const exportedApprovals = await releaseApprovals.exportMarkdown(cwd)
    const exportedApprovalsText = await readFile(exportedApprovals.path, 'utf-8')
    assert(exportedApprovalsText.includes('Release Approval Report') && exportedApprovals.summary.rejected >= 1, 'release approvals export markdown review artifacts')

    const registryReachability = new RegistryReachabilityService({
      checker: async (endpoint) => ({
        status: endpoint.url.includes('down.example.test') ? 'unreachable' : 'reachable',
        statusCode: endpoint.url.includes('down.example.test') ? 503 : 200,
        message: endpoint.url.includes('down.example.test') ? 'fixture registry unavailable' : 'fixture registry reachable'
      })
    })
    const registryEndpoints = await registryReachability.discover(cwd)
    assert(registryEndpoints.some((endpoint) => endpoint.managerId === 'npm' && endpoint.url.includes('registry.example.test')), 'registry reachability discovers npm registry configuration')
    assert(registryEndpoints.some((endpoint) => endpoint.managerId === 'pip' && endpoint.url.includes('pypi')), 'registry reachability discovers Python index configuration')
    const registryReport = await registryReachability.check(cwd)
    assert(registryReport.summary.endpointCount >= 3 && registryReport.summary.unreachable >= 1, 'registry reachability checks configured endpoints and summarizes failures')
    const exportedRegistry = await registryReachability.exportMarkdown(cwd)
    const exportedRegistryText = await readFile(exportedRegistry.path, 'utf-8')
    assert(exportedRegistryText.includes('Registry Reachability Report') && exportedRegistry.summary.unreachable >= 1, 'registry reachability exports markdown release artifacts')

    await supplyChain.savePolicy(cwd, {
      requirePinnedVersions: true,
      disallowPrerelease: true,
      requireKnownLicenses: false,
      blockedManagers: [],
      blockedPackages: ['react'],
      blockedLicenses: ['MIT'],
      allowedLicenses: [],
      allowedManagers: [],
      packageRules: [
        {
          id: 'python-api-family',
          description: 'Python API framework dependencies',
          packagePatterns: ['fastapi*'],
          managers: ['pip'],
          severity: 'high',
          blocked: true
        }
      ]
    })
    const blockedLicenseReport = await supplyChain.licenseReport(cwd)
    assert(blockedLicenseReport.summary.blockedLicenseComponentCount > 0 && blockedLicenseReport.licenses.some((item) => item.normalizedLicense === 'MIT' && item.status === 'blocked'), 'license compliance matrix applies blocked-license policy')
    const packageRuleEvaluation = await supplyChain.evaluatePolicy(cwd)
    assert(packageRuleEvaluation.violations.some((item) => item.title === 'Package family rule blocks dependency' && item.packageName === 'fastapi'), 'dependency policy package-family rules match package patterns and managers')
    assert(packageRuleEvaluation.violations.some((item) => item.title === 'Execution dependency uses floating reference' && item.managerId === 'github-actions' && item.packageName === 'actions/setup-python' && item.version === 'main' && item.severity === 'high'), 'dependency policy flags floating GitHub Actions refs as high-risk execution dependencies')
    assert(packageRuleEvaluation.violations.some((item) => item.title === 'Execution dependency uses floating reference' && item.managerId === 'pre-commit' && item.packageName === 'https://github.com/example/floating-hooks' && item.version === 'master' && item.severity === 'high'), 'dependency policy flags floating pre-commit hook refs as high-risk execution dependencies')
    assert(packageRuleEvaluation.violations.some((item) => item.title === 'Execution dependency uses floating reference' && item.managerId === 'docker' && item.packageName === 'postgres' && item.version === 'latest' && item.severity === 'high'), 'dependency policy flags floating container image tags as high-risk execution dependencies')
    const readiness = new ReadinessGateService({
      supplyChainService: supplyChain,
      ciEvidenceService: ciEvidence,
      releaseApprovalService: releaseApprovals,
      registryReachabilityService: registryReachability,
      checkTool: async (tool) => ({ tool, available: true, version: String(tool) + ' 1.0.0' }),
      credentialVault: {
        status: () => ({ available: true, encrypted: true, storage: 'test-adapter' }),
        list: async () => []
      }
    })
    const readinessReport = await readiness.report(cwd)
    assert(readinessReport.status === 'blocked' && readinessReport.score < 100, 'readiness gate blocks production release on critical policy violations')
    assert(readinessReport.checks.some((item) => item.id === 'dependency-policy' && item.status === 'blocked'), 'readiness gate exposes blocking dependency policy checks')
    assert(readinessReport.checks.some((item) => item.id === 'dependency-snapshots' && item.status === 'passed'), 'readiness gate recognizes available rollback snapshots')
    assert(readinessReport.summary.ciEvidenceCount >= 2 && readinessReport.summary.latestCiStatus === 'failed', 'readiness gate summarizes CI evidence status')
    assert(readinessReport.checks.some((item) => item.id === 'ci-evidence' && item.status === 'blocked'), 'readiness gate blocks release on failed CI evidence')
    assert(readinessReport.summary.releaseApprovalCount >= 2 && readinessReport.summary.latestReleaseApprovalDecision === 'rejected', 'readiness gate summarizes release approval status')
    assert(readinessReport.checks.some((item) => item.id === 'release-approvals' && item.status === 'blocked'), 'readiness gate blocks release on rejected approval evidence')
    assert(readinessReport.summary.registryEndpointCount >= 3 && readinessReport.summary.unreachableRegistryCount >= 1, 'readiness gate summarizes registry reachability failures')
    assert(readinessReport.checks.some((item) => item.id === 'registry-reachability' && item.status === 'blocked'), 'readiness gate blocks release on unreachable registries')
    assert(readinessReport.summary.workspaceCount >= 7 && readinessReport.summary.workspaceManagerCount >= 3, 'readiness gate summarizes workspace topology')
    assert(readinessReport.checks.some((item) => item.id === 'workspace-topology' && item.status === 'passed'), 'readiness gate includes workspace topology evidence')
    assert(readinessReport.summary.lockfileDriftFindingCount > 0 && readinessReport.checks.some((item) => item.id === 'lockfile-drift'), 'readiness gate consumes lockfile drift reproducibility evidence')
    assert(readinessReport.summary.runtimePinningFindingCount > 0 && readinessReport.summary.floatingContainerTagCount > 0 && readinessReport.checks.some((item) => item.id === 'runtime-pinning'), 'readiness gate consumes runtime pinning and floating image evidence')
    assert(readinessReport.summary.deploymentReferenceCount > 0 && readinessReport.summary.floatingDeploymentRefCount > 0 && readinessReport.checks.some((item) => item.id === 'deployment-references'), 'readiness gate consumes deployment image, chart, and GitOps reference evidence')
    assert(readinessReport.summary.missingDeploymentBaselineCount > 0 && readinessReport.checks.some((item) => item.id === 'deployment-baselines'), 'readiness gate consumes deployment baseline evidence for image digest, chart lock, and GitOps immutability review')
    assert(readinessReport.summary.missingCredentialEndpointCount > 0 && readinessReport.checks.some((item) => item.id === 'credential-usage'), 'readiness gate consumes credential usage coverage evidence')
    await readiness.savePolicy(cwd, {
      ...readinessReport.policy.policy,
      blockOnLockfileDrift: true,
      blockOnRuntimePinning: true,
      blockOnFloatingContainerTags: true,
      blockOnFloatingDeploymentRefs: true,
      blockOnMissingDeploymentBaselines: true,
      blockOnMissingCredentialEndpoints: true
    })
    const strictReproducibilityReport = await readiness.report(cwd)
    assert(strictReproducibilityReport.checks.some((item) => item.id === 'lockfile-drift' && item.status === 'blocked'), 'readiness gate can block release on lockfile drift policy')
    assert(strictReproducibilityReport.checks.some((item) => item.id === 'runtime-pinning' && item.status === 'blocked'), 'readiness gate can block release on runtime pinning and floating container policy')
    assert(strictReproducibilityReport.checks.some((item) => item.id === 'deployment-references' && item.status === 'blocked'), 'readiness gate can block release on floating deployment and GitOps refs')
    assert(strictReproducibilityReport.checks.some((item) => item.id === 'deployment-baselines' && item.status === 'blocked'), 'readiness gate can block release when deployment baseline evidence is missing')
    assert(strictReproducibilityReport.checks.some((item) => item.id === 'credential-usage' && item.status === 'blocked'), 'readiness gate can block release on missing credential coverage policy')
    let publishBlocked = false
    try {
      await readiness.assertPublishAllowed(cwd, 'npm publish')
    } catch (error) {
      publishBlocked = String(error?.message || error).includes('Production readiness gate blocked npm publish')
    }
    assert(publishBlocked, 'readiness gate blocks publish operations when release gates are blocked')
    const overrideGate = await readiness.assertPublishAllowed(cwd, 'npm publish', { overrideReadinessGate: true })
    assert(overrideGate === null, 'readiness gate allows explicit publish override after manual approval')
    const dryRunGate = await readiness.assertPublishAllowed(cwd, 'flutter pub publish', { allowDryRun: true, dryRun: true })
    assert(dryRunGate === null, 'readiness gate allows publish dry-runs without blocking')
    const exportedReadiness = await readiness.exportMarkdown(cwd)
    const exportedReadinessText = await readFile(exportedReadiness.path, 'utf-8')
    assert(exportedReadinessText.includes('Production Readiness Report') && exportedReadiness.status === 'blocked', 'readiness gate exports markdown production reports')

    const noSnapshotCwd = await createFixture()
    try {
      const readinessPolicy = await readiness.getPolicy(noSnapshotCwd)
      assert(readinessPolicy.policy.snapshotStaleDays === DEFAULT_READINESS_POLICY.snapshotStaleDays, 'readiness gate initializes default project readiness policy')
      const noSnapshotReport = await readiness.report(noSnapshotCwd)
      assert(noSnapshotReport.checks.some((item) => item.id === 'dependency-snapshots' && item.status === 'warning'), 'readiness gate warns when rollback snapshots are missing')
      await readiness.savePolicy(noSnapshotCwd, {
        ...DEFAULT_READINESS_POLICY,
        blockOnMissingSnapshots: true
      })
      const strictNoSnapshotReport = await readiness.report(noSnapshotCwd)
      assert(strictNoSnapshotReport.checks.some((item) => item.id === 'dependency-snapshots' && item.status === 'blocked'), 'readiness gate applies snapshot blocking from project policy')
      await readiness.savePolicy(noSnapshotCwd, {
        ...DEFAULT_READINESS_POLICY,
        requiredReleaseApprovals: 1,
        blockOnMissingReleaseApprovals: true
      })
      const strictApprovalReport = await readiness.report(noSnapshotCwd)
      assert(strictApprovalReport.checks.some((item) => item.id === 'release-approvals' && item.status === 'blocked'), 'readiness gate applies missing release approval blocking from project policy')
    } finally {
      await rm(noSnapshotCwd, { recursive: true, force: true })
    }
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }

  console.log('framework verification passed (' + checks.length + ' checks)')
  phaseEnd('framework-main')
  console.log('[legacy:slowest] ' + phaseDurations.sort((a, b) => b.durationMs - a.durationMs).slice(0, 5).map((item) => item.phase + '=' + item.durationMs + 'ms').join(', '))
}

await main()
`

try {
  await build({
    stdin: {
      contents: runner,
      resolveDir: repoRoot,
      sourcefile: 'framework-verifier.ts',
      loader: 'ts'
    },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
    },
    plugins: [
      {
        name: 'framework-verifier-stubs',
        setup(buildApi) {
          buildApi.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => {
            if (!args.importer.endsWith('extendedManager.ts')) return undefined
            return { path: args.path, namespace: 'framework-verifier-stub' }
          })
          buildApi.onLoad({ filter: /.*/, namespace: 'framework-verifier-stub' }, (args) => {
            if (args.path === './toolchain') {
              return {
                loader: 'ts',
                contents: "export type ToolName = string; export async function resolveToolBin(tool: string) { return tool; }"
              }
            }
            return {
              loader: 'ts',
              contents: "export async function runLoggedCommand() { return { stdout: '', stderr: '' }; }"
            }
          })
        }
      }
    ]
  })

  await import(pathToFileURL(outputFile).href)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await rm(workDir, { recursive: true, force: true })
}
