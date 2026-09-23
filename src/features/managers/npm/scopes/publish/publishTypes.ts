// Shared types for the npm publish scope. The preload contract returns the
// readiness check payload as `Promise<any>`, so the renderer owns the shape it
// actually consumes instead of threading `any` through the component tree.

/** The `package.json` summary surfaced by the pre-publish readiness check. */
export interface PublishPackageInfo {
  name: string
  version: string
  description?: string
  license?: string
  author?: string | { name?: string }
  homepage?: string
  repository?: string | { url?: string }
  main?: string
}

/** Result of `window.electronAPI.publish.check`. */
export interface PublishCheckResult {
  canPublish: boolean
  packageInfo: PublishPackageInfo | null
  errors: string[]
  warnings: string[]
}

/**
 * Loose shape of the `package.json` document the editor round-trips through
 * `project.readPackage` / `project.writePackage`.
 */
export type PackageJsonDocument = Record<string, unknown>

/**
 * One antd form instance backs both the package editor fields and the publish
 * config fields (they are never rendered at the same time), so this interface
 * covers the union of both field sets.
 */
export interface PublishFormValues {
  // Package editor fields (PublishCheckCard, edit mode)
  name?: string
  version?: string
  description?: string
  license?: string
  author?: string
  homepage?: string
  repository?: string
  // Publish config fields (PublishConfigCard)
  tag?: string
  access?: 'public' | 'restricted'
  registry?: string
  credentialId?: string
  token?: string
  saveCredential?: boolean
  overrideReadinessGate?: boolean
}

/** antd Select option for a stored npm credential. */
export interface CredentialOption {
  value: string
  label: string
}
