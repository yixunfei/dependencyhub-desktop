import semver from 'semver'
import { runLoggedCommand } from './commandRunner'
import { resolveToolBin } from './toolchain'

export interface NpmRuntime {
  nodeVersion: string
  npmVersion: string
}

interface NpmRelease {
  version: string
  engines?: { node?: string }
}

/** Ask the configured npm itself: Electron and PATH may use different Node runtimes. */
export async function getNpmRuntime(cwd?: string): Promise<NpmRuntime> {
  const { stdout } = await runLoggedCommand(await resolveToolBin('npm', cwd), ['version', '--json'], {
    cwd, log: false, displayBin: 'npm'
  })
  const versions = JSON.parse(stdout) as { node?: string; npm?: string }
  if (!versions.node || !semver.valid(versions.node) || !versions.npm || !semver.valid(versions.npm)) {
    throw new Error('Unable to determine the Node.js runtime used by npm')
  }
  return { nodeVersion: versions.node, npmVersion: versions.npm }
}

export function assertNpmEngine(release: NpmRelease, runtime: NpmRuntime): void {
  const required = release.engines?.node
  if (!required) return
  if (!semver.validRange(required)) throw new Error(`Invalid Node.js engine requirement for npm@${release.version}`)
  if (semver.satisfies(runtime.nodeVersion, required, { includePrerelease: true })) return
  throw Object.assign(new Error(
    `npm@${release.version} requires Node.js ${required}; the configured npm uses Node.js ${runtime.nodeVersion} `
    + `(npm ${runtime.npmVersion}). Upgrade the Node.js toolchain or select a compatible npm version.`
  ), { code: 'EBADENGINE', category: 'conflict', retryable: false })
}

/** Validate self-installation before npm can change the global executable. */
export async function checkNpmSelfInstall(spec: string, cwd?: string): Promise<void> {
  if (!/^npm(?:@|$)/.test(spec)) return
  const bin = await resolveToolBin('npm', cwd)
  const { stdout } = await runLoggedCommand(bin, ['view', spec, 'version', 'engines', '--json'], {
    cwd, displayBin: 'npm'
  })
  const data: unknown = JSON.parse(stdout)
  const releases = (Array.isArray(data) ? data : [data]) as NpmRelease[]
  if (!releases.length || releases.some((release) => !release || !semver.valid(release.version))) {
    throw new Error(`Unable to resolve npm engine requirements for ${spec}`)
  }
  const release = [...releases].sort((a, b) => semver.rcompare(a.version, b.version))[0]
  assertNpmEngine(release, await getNpmRuntime(cwd))
}
