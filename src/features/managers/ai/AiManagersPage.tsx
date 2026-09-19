import React from 'react'
import { ExperimentOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['mcp', 'skills', 'ai-agents', 'a2a'],
  defaultManagerId: 'mcp',
  title: 'AI Dependencies',
  titleIcon: <ExperimentOutlined />,
  subtitle: 'MCP servers, agent skills, agent instruction dependencies, and A2A agent endpoints with pinning review, provenance checks, lock evidence, and drift detection.',
  noDetectionMessage: 'No AI dependency files detected yet',
  detectionHint: 'The page can still generate plans. Add .mcp.json or mcp.json, a SKILL.md skill, AGENTS.md, a skills.json/agents.json declaration, or an A2A a2a.json / .well-known/agent-card.json for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Validate configuration' },
    { value: 'install', label: 'Declare dependency' },
    { value: 'remove', label: 'Remove declaration' },
    { value: 'audit', label: 'Security audit' },
    { value: 'tree', label: 'Dependency view' },
    { value: 'list', label: 'List entries' },
    { value: 'lock', label: 'Write lock evidence' }
  ],
  quickCommands: {},
  customCommands: false,
  packageLabel: 'Package / server / skill / agent / endpoint',
  packagePlaceholder: '@modelcontextprotocol/server-filesystem, https://mcp.example.com/sse, code-reviewer, https://agents.example.com/a2a',
  versionPlaceholder: '1.2.3',
  dependencyEmptyDescription: 'No MCP servers, skills, agent instruction files, or A2A endpoints were found for this manager.',
  riskDescription: 'Review the pinning, transport, and provenance diff before changing AI dependencies. Changes are written locally with a backup you can restore.',
  restoreSuccessMessage: 'AI dependency backup restored',
  overviewErrorMessage: 'Failed to load AI dependency overview',
  secondaryAction: { label: 'AI providers', route: '/ai-providers' }
}

const AiManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default AiManagersPage
