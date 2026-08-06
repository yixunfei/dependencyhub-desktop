import React from 'react'
import { ApiOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['opam', 'cpan', 'luarocks', 'shards', 'zig'],
  defaultManagerId: 'opam',
  title: 'Systems & Scripting Dependencies',
  titleIcon: <ApiOutlined />,
  subtitle: 'Manage OCaml/opam, Perl/CPAN, LuaRocks, Crystal Shards, and Zig dependency manifests from the shared one-stop workspace.',
  noDetectionMessage: 'No OCaml, Perl, Lua, Crystal, or Zig dependency manifest was detected in the selected project.',
  detectionHint: 'Supported manifests include *.opam, dune-project, cpanfile, *.rockspec, shard.yml, build.zig.zon, and build.zig.',
  operationOptions: [
    { value: 'sync', label: 'Sync / restore' },
    { value: 'install', label: 'Add / install' },
    { value: 'remove', label: 'Remove' },
    { value: 'update', label: 'Update' },
    { value: 'outdated', label: 'Outdated' },
    { value: 'audit', label: 'Audit / lint' },
    { value: 'tree', label: 'Tree / list' },
    { value: 'lock', label: 'Lock / resolve' }
  ],
  quickCommands: {
    opam: ['opam install . --deps-only', 'opam list --outdated', 'opam lock'],
    cpan: ['cpanm --installdeps .', 'cpanm --info Mojolicious'],
    luarocks: ['luarocks make', 'luarocks list', 'luarocks lint *.rockspec'],
    shards: ['shards install', 'shards update', 'shards list'],
    zig: ['zig build', 'zig build --summary all', 'zig fetch --help']
  },
  packageLabel: 'Package / module',
  packagePlaceholder: 'Example: lwt, Mojolicious, luasocket, kemal, zig package URL',
  versionPlaceholder: 'Example: >=5.7.0, 9.37, ~> 1.0.0, latest',
  commandPlaceholder: (managerId) => `${managerId} command`,
  typeColumnTitle: 'Source',
  dependencyEmptyDescription: 'No dependencies parsed from systems or scripting manifests.',
  riskDescription: 'Use this workspace to track native-adjacent package manifests, lockfiles, and toolchain evidence alongside application dependencies.',
  restoreSuccessMessage: 'Systems dependency manifest backup restored',
  overviewErrorMessage: 'Failed to load systems dependency workspace',
  secondaryAction: { label: 'Open health', route: '/health' }
}

const SystemsManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default SystemsManagersPage
