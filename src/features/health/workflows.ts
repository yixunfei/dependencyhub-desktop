export type HealthWorkflowSectionId =
  | 'health-inventory'
  | 'health-risk'
  | 'health-automation'
  | 'health-policy'
  | 'health-workspaces'
  | 'health-evidence'
  | 'health-reproducibility'
  | 'health-operations'

export interface HealthWorkflowSectionDefinition {
  id: HealthWorkflowSectionId
  label: string
}

export const HEALTH_WORKFLOW_SECTIONS: HealthWorkflowSectionDefinition[] = [
  { id: 'health-inventory', label: 'Inventory' },
  { id: 'health-risk', label: 'Risk' },
  { id: 'health-automation', label: 'Automation' },
  { id: 'health-policy', label: 'Policy' },
  { id: 'health-workspaces', label: 'Workspaces' },
  { id: 'health-evidence', label: 'Evidence' },
  { id: 'health-reproducibility', label: 'Reproducibility' },
  { id: 'health-operations', label: 'Operations' }
]

export function healthWorkflowLabel(id: HealthWorkflowSectionId): string {
  return HEALTH_WORKFLOW_SECTIONS.find((section) => section.id === id)?.label || id
}
