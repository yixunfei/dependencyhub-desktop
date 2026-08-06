import React from 'react'
import { ToolOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['homebrew', 'chocolatey', 'scoop', 'winget', 'asdf', 'mise', 'sdkman', 'apt', 'dnf', 'apk', 'pacman', 'nix'],
  defaultManagerId: 'homebrew',
  title: 'System Packages & Runtime Pins',
  titleIcon: <ToolOutlined />,
  subtitle: 'Manage workstation packages, Linux image baselines, Nix dev shells, CI runner prerequisites, and polyglot runtime version manifests from the same dependency governance workspace.',
  noDetectionMessage: 'No system package or runtime version manifest was detected in the selected project.',
  detectionHint: 'Supported manifests include Brewfile, packages.config, scoopfile.json, winget export JSON, .tool-versions, mise.toml, .sdkmanrc, apt/dnf/apk/pacman package baselines, and Nix flake or shell files.',
  operationOptions: [
    { value: 'sync', label: 'Sync / bootstrap' },
    { value: 'install', label: 'Add / install' },
    { value: 'remove', label: 'Remove' },
    { value: 'update', label: 'Update / upgrade' },
    { value: 'outdated', label: 'Outdated / drift' },
    { value: 'audit', label: 'Audit / doctor' },
    { value: 'tree', label: 'Tree / list' },
    { value: 'lock', label: 'Lock / export' }
  ],
  quickCommands: {
    homebrew: ['brew bundle check', 'brew bundle install', 'brew outdated'],
    chocolatey: ['choco outdated', 'choco list --local-only', 'choco upgrade all -y'],
    scoop: ['scoop status', 'scoop list', 'scoop update *'],
    winget: ['winget export -o winget-export.json', 'winget upgrade', 'winget list'],
    asdf: ['asdf install', 'asdf current', 'asdf plugin list'],
    mise: ['mise install', 'mise outdated', 'mise tasks'],
    sdkman: ['sdk env install', 'sdk current', 'sdk list'],
    apt: ['apt-get update', 'apt-get install -y curl', 'apt list --installed'],
    dnf: ['dnf check-update', 'dnf install -y git', 'dnf list installed'],
    apk: ['apk update', 'apk add curl', 'apk info'],
    pacman: ['pacman -Syu', 'pacman -S --needed git', 'pacman -Q'],
    nix: ['nix develop', 'nix flake show', 'nix flake update']
  },
  packageLabel: 'Package / runtime',
  packagePlaceholder: 'Example: git, Git.Git, nodejs, java, gradle, nixpkgs#nodejs_22',
  versionPlaceholder: 'Example: 2.45.0, 22.13.0, 17.0.10-tem, 3.20.2-r0, latest',
  commandPlaceholder: (managerId) => `${managerId} command`,
  typeColumnTitle: 'Declaration',
  dependencyEmptyDescription: 'No system package, Linux baseline, Nix environment, or runtime pin declarations parsed from the selected project.',
  riskDescription: 'Use this workspace to make local machines, CI runners, Linux images, Nix shells, and release images reproducible before application dependencies are installed.',
  restoreSuccessMessage: 'Runtime and system package manifest backup restored',
  overviewErrorMessage: 'Failed to load runtime and system package workspace',
  secondaryAction: { label: 'Open health', route: '/health' }
}

const RuntimeManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default RuntimeManagersPage
