import type { DependencyManagerId } from '@shared/managerRegistry'

export interface WorkspaceScope {
  projectPath: string
  managerId?: DependencyManagerId
}

export interface WorkspaceRequestToken {
  id: number
  scope: WorkspaceScope
}

export class ManagerWorkspaceCoordinator {
  private sequence = 0
  private current: WorkspaceRequestToken | null = null

  begin(scope: WorkspaceScope): WorkspaceRequestToken {
    const token = { id: ++this.sequence, scope: { ...scope } }
    this.current = token
    return token
  }

  invalidate(): void {
    this.current = null
    this.sequence += 1
  }

  accepts(token: WorkspaceRequestToken, scope: WorkspaceScope): boolean {
    return this.current?.id === token.id
      && this.current.scope.projectPath === scope.projectPath
      && this.current.scope.managerId === scope.managerId
  }
}
