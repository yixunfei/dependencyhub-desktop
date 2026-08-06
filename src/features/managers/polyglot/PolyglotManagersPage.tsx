import React from 'react'
import { ApartmentOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['sbt', 'leiningen', 'mix', 'rebar3', 'cabal', 'stack'],
  defaultManagerId: 'sbt',
  title: 'Polyglot Package Managers',
  titleIcon: <ApartmentOutlined />,
  subtitle: 'sbt, Leiningen, Mix, rebar3, Cabal, and Stack workspace for JVM, BEAM, and Haskell dependency manifests, lockfiles, toolchains, backups, and release readiness signals.',
  noDetectionMessage: 'No polyglot JVM/BEAM/Haskell files detected yet',
  detectionHint: 'Add build.sbt, project.clj, mix.exs, rebar.config, a .cabal file, cabal.project, stack.yaml, or package.yaml for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Resolve/sync' },
    { value: 'install', label: 'Add/search package' },
    { value: 'remove', label: 'Remove package' },
    { value: 'update', label: 'Update dependencies' },
    { value: 'outdated', label: 'Check outdated' },
    { value: 'audit', label: 'Audit/vulnerable' },
    { value: 'tree', label: 'Dependency tree' },
    { value: 'list', label: 'List dependencies' },
    { value: 'lock', label: 'Refresh/freeze lock' }
  ],
  quickCommands: {
    sbt: ['update', 'dependencyTree', 'dependencyUpdates'],
    leiningen: ['deps', 'deps :tree', 'ancient'],
    mix: ['deps.get', 'deps.tree', 'hex.outdated', 'hex.audit'],
    rebar3: ['get-deps', 'tree', 'upgrade'],
    cabal: ['build all --dry-run', 'freeze', 'update'],
    stack: ['ls dependencies', 'build --dry-run', 'update']
  },
  packagePlaceholder: 'com.typesafe:config, ring/ring-core, phoenix, cowboy, aeson',
  versionPlaceholder: '1.4.3, 1.12.0, ~> 1.7, >=2.2',
  commandPlaceholder: (managerId) => managerId === 'leiningen' ? 'lein deps' : `${managerId} update`,
  riskDescription: 'Review dependency risk, lockfile drift, runtime pinning, and audit evidence before resolving long-tail language dependencies in production repositories.',
  restoreSuccessMessage: 'Polyglot manager backup restored',
  overviewErrorMessage: 'Failed to load polyglot manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' },
  maxMetricTools: 2
}

const PolyglotManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default PolyglotManagersPage
