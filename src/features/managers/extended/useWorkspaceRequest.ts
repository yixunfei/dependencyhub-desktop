import { useEffect, useRef, useState } from 'react'
import type { WorkspaceScope } from './managerWorkspaceCoordinator'

/** Owns one request stream; scope changes and newer requests invalidate older replies. */
export function useWorkspaceRequest(scope: WorkspaceScope) {
  const state = useRef({ scope, sequence: 0, mounted: true })
  const [pending, setPending] = useState(false)
  if (state.current.scope.projectPath !== scope.projectPath || state.current.scope.managerId !== scope.managerId) {
    state.current = { ...state.current, scope, sequence: state.current.sequence + 1 }
  }
  useEffect(() => {
    state.current.mounted = true
    setPending(false)
    return () => {
      state.current.mounted = false
      state.current.sequence += 1
    }
  }, [scope.projectPath, scope.managerId])

  async function run<T>(task: () => Promise<T>, apply: (value: T) => void | Promise<void>, fail: (error: Error) => void) {
    const sequence = ++state.current.sequence
    const accepts = () => state.current.mounted && state.current.sequence === sequence
    setPending(true)
    try {
      const value = await task()
      if (accepts()) await apply(value)
    } catch (cause) {
      if (accepts()) fail(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      if (accepts()) setPending(false)
    }
  }
  return { pending, run }
}
