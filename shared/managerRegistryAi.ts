import type { DependencyManagerDefinition } from './managerRegistryTypes'

/**
 * AI dependency ecosystems. They are declarative manifests rather than package
 * managers: DependencyHub owns the lock evidence and performs the mutations
 * locally, because these ecosystems ship no package-manager CLI.
 */
export const AI_MANAGER_DEFINITIONS: readonly DependencyManagerDefinition[] = [
  {
    id: 'mcp',
    name: 'MCP Servers',
    shortName: 'MCP',
    language: 'JSON-RPC tool servers',
    ecosystem: 'Model Context Protocol',
    packageManager: 'MCP',
    category: 'ai',
    tools: ['mcp'],
    manifestFiles: ['.mcp.json', 'mcp.json'],
    lockFiles: ['mcp-lock.json'],
    configFiles: ['.cursor/mcp.json', '.vscode/mcp.json', '.workbuddy-ai/mcp.json', '.claude/mcp.json', 'claude_desktop_config.json'],
    detectionFiles: ['.mcp.json', 'mcp.json', 'mcp-lock.json', '.cursor/mcp.json', '.vscode/mcp.json', '.workbuddy-ai/mcp.json', '.claude/mcp.json', 'claude_desktop_config.json'],
    capabilities: ['install', 'uninstall', 'health', 'audit', 'dependency-tree', 'lockfile'],
    scopes: ['project', 'repository'],
    scenarios: ['agent tool servers', 'local AI tooling', 'remote MCP endpoints', 'agent runtime allowlists'],
    productionTools: ['MCP server inventory', 'server pinning policy', 'transport and secret review'],
    route: '/ai',
    builtIn: false,
    implemented: false,
    status: 'preview',
    searchable: false,
    healthSupported: true
  },
  {
    id: 'skills',
    name: 'Agent Skills',
    shortName: 'Skills',
    language: 'Markdown + YAML frontmatter',
    ecosystem: 'Agent Skills',
    packageManager: 'SKILL.md',
    category: 'ai',
    tools: ['skills'],
    manifestFiles: ['skills.json'],
    lockFiles: ['skills.lock.json'],
    detectionFiles: ['skills.json', 'skills.lock.json', 'SKILL.md', 'skills/SKILL.md', '.workbuddy-ai/skills/*', '.claude/skills/*', '.codebuddy/skills/*', '.agents/skills/*', '.cursor/skills/*'],
    capabilities: ['install', 'uninstall', 'health', 'audit', 'dependency-tree', 'lockfile'],
    scopes: ['project', 'repository'],
    scenarios: ['reusable agent capabilities', 'shared skill libraries', 'prompt tooling', 'skill provenance review'],
    productionTools: ['skill inventory', 'frontmatter validation', 'skill source pinning'],
    route: '/ai',
    builtIn: false,
    implemented: false,
    status: 'preview',
    searchable: false,
    healthSupported: true
  },
  {
    id: 'ai-agents',
    name: 'Agent Rules & Prompts',
    shortName: 'Agents',
    language: 'Markdown instructions',
    ecosystem: 'Agent Instructions',
    packageManager: 'AGENTS.md',
    category: 'ai',
    tools: ['agents'],
    manifestFiles: ['agents.json'],
    lockFiles: ['agents.lock.json'],
    detectionFiles: ['agents.json', 'agents.lock.json', 'AGENTS.md', 'CLAUDE.md', '.cursor/rules/*', '.github/copilot-instructions.md', '.github/instructions/*', '.workbuddy-ai/agents/*', '.claude/agents/*', '.codebuddy/agents/*'],
    capabilities: ['install', 'uninstall', 'health', 'audit', 'dependency-tree', 'lockfile'],
    scopes: ['project', 'repository'],
    scenarios: ['coding agent instructions', 'shared rule sets', 'subagent definitions', 'prompt context governance'],
    productionTools: ['instruction inventory', 'rule drift review', 'agent definition validation'],
    route: '/ai',
    builtIn: false,
    implemented: false,
    status: 'preview',
    searchable: false,
    healthSupported: true
  }
]
