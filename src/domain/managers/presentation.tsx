import React from 'react'
import {
  ApiOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  DockerOutlined,
  ExperimentOutlined,
  MobileOutlined,
  PythonOutlined,
  RubyOutlined,
  ToolOutlined
} from '@ant-design/icons'
import type { LabelTranslator } from '../../i18n'
import type { DependencyManagerId, ManagerImplementationStatus } from './registry'

export function managerIcon(id: DependencyManagerId): React.ReactNode {
  if (id === 'npm' || id === 'pnpm' || id === 'yarn' || id === 'bun' || id === 'deno') return <AppstoreOutlined />
  if (id === 'pip' || id === 'uv' || id === 'poetry' || id === 'pipenv' || id === 'conda') return <PythonOutlined />
  if (id === 'renv' || id === 'julia') return <ExperimentOutlined />
  if (id === 'maven' || id === 'gradle' || id === 'sbt' || id === 'leiningen') return <ApartmentOutlined />
  if (id === 'mix' || id === 'rebar3') return <CodeOutlined />
  if (id === 'cabal' || id === 'stack') return <BranchesOutlined />
  if (id === 'cargo') return <BranchesOutlined />
  if (id === 'go') return <CodeOutlined />
  if (id === 'flutter' || id === 'swiftpm' || id === 'cocoapods') return <MobileOutlined />
  if (id === 'native') return <ApiOutlined />
  if (id === 'nuget') return <ExperimentOutlined />
  if (id === 'composer') return <CodeOutlined />
  if (id === 'bundler') return <RubyOutlined />
  if (id === 'helm' || id === 'kustomize' || id === 'helmfile' || id === 'skaffold' || id === 'argocd' || id === 'flux') return <CloudServerOutlined />
  if (id === 'docker') return <DockerOutlined />
  if (id === 'terraform' || id === 'opentofu' || id === 'ansible') return <CloudServerOutlined />
  if (id === 'github-actions' || id === 'gitlab-ci' || id === 'pre-commit') return <DeploymentUnitOutlined />
  if (id === 'mcp' || id === 'skills' || id === 'ai-agents') return <ExperimentOutlined />
  if (id === 'bazel' || id === 'pants' || id === 'buck') return <ToolOutlined />
  if (id === 'opam' || id === 'cpan' || id === 'luarocks' || id === 'shards' || id === 'zig') return <ApiOutlined />
  if (id === 'homebrew' || id === 'chocolatey' || id === 'scoop' || id === 'winget' || id === 'asdf' || id === 'mise' || id === 'sdkman' || id === 'apt' || id === 'dnf' || id === 'apk' || id === 'pacman' || id === 'nix') return <ToolOutlined />
  return <AppstoreOutlined />
}

export function managerColor(id: DependencyManagerId): string {
  if (id === 'npm' || id === 'pnpm' || id === 'yarn' || id === 'bun' || id === 'deno') return 'blue'
  if (id === 'pip' || id === 'uv' || id === 'poetry' || id === 'pipenv' || id === 'conda') return 'cyan'
  if (id === 'renv' || id === 'julia') return 'magenta'
  if (id === 'maven' || id === 'sbt' || id === 'leiningen') return 'purple'
  if (id === 'gradle' || id === 'mix' || id === 'rebar3') return 'green'
  if (id === 'cabal' || id === 'stack') return 'lime'
  if (id === 'cargo') return 'volcano'
  if (id === 'go') return 'geekblue'
  if (id === 'flutter') return 'processing'
  if (id === 'native') return 'gold'
  if (id === 'kustomize' || id === 'helmfile' || id === 'skaffold' || id === 'argocd' || id === 'flux') return 'blue'
  if (id === 'terraform' || id === 'opentofu' || id === 'ansible') return 'blue'
  if (id === 'github-actions' || id === 'gitlab-ci' || id === 'pre-commit') return 'geekblue'
  if (id === 'mcp' || id === 'skills' || id === 'ai-agents') return 'purple'
  if (id === 'bazel' || id === 'pants' || id === 'buck') return 'gold'
  if (id === 'opam' || id === 'cpan' || id === 'luarocks' || id === 'shards' || id === 'zig') return 'volcano'
  if (id === 'homebrew' || id === 'chocolatey' || id === 'scoop' || id === 'winget' || id === 'asdf' || id === 'mise' || id === 'sdkman' || id === 'apt' || id === 'dnf' || id === 'apk' || id === 'pacman' || id === 'nix') return 'cyan'
  return 'default'
}

export function implementationStatusText(status: ManagerImplementationStatus, t: LabelTranslator): string {
  if (status === 'stable') return t('status.available')
  if (status === 'preview') return t('status.preview')
  return t('status.planned')
}
