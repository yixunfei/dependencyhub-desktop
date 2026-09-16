import { spawn } from 'child_process'
import { resolve } from 'path'

const GROUPS = {
  contracts: {
    description: 'shared manager registry and adapter capability contracts',
    script: 'scripts/verify-manager-contracts.mjs',
    timeoutMs: 60_000
  },
  node: {
    description: 'pnpm, Yarn, and Bun preview adapter behavior',
    script: 'scripts/verify-node-managers.mjs',
    timeoutMs: 60_000
  },
  deno: {
    description: 'Deno preview adapter behavior',
    script: 'scripts/verify-deno-manager.mjs',
    timeoutMs: 60_000
  },
  cocoapods: {
    description: 'CocoaPods platform adapter behavior',
    script: 'scripts/verify-cocoapods-manager.mjs',
    timeoutMs: 60_000
  },
  python: {
    description: 'uv, Poetry, Pipenv, and Conda preview adapter behavior',
    script: 'scripts/verify-python-managers.mjs',
    timeoutMs: 60_000
  },
  ansible: {
    description: 'Ansible Galaxy infrastructure adapter behavior',
    script: 'scripts/verify-ansible-manager.mjs',
    timeoutMs: 60_000
  },
  backend: {
    description: 'NuGet, Composer, and Bundler preview adapter behavior',
    script: 'scripts/verify-backend-managers.mjs',
    timeoutMs: 60_000
  },
  cloud: {
    description: 'Helm preview adapter behavior',
    script: 'scripts/verify-cloud-managers.mjs',
    timeoutMs: 60_000
  },
  swiftpm: {
    description: 'SwiftPM platform adapter behavior',
    script: 'scripts/verify-swiftpm-manager.mjs',
    timeoutMs: 60_000
  },
  terraform: {
    description: 'Terraform and OpenTofu infrastructure adapter behavior',
    script: 'scripts/verify-terraform-managers.mjs',
    timeoutMs: 60_000
  },
  helmfile: {
    description: 'Helmfile cloud adapter behavior',
    script: 'scripts/verify-helmfile-manager.mjs',
    timeoutMs: 60_000
  },
  core: {
    description: 'core F1-F4 behavior and recovery regression scenarios',
    script: 'scripts/verify-core-behaviors.mjs',
    timeoutMs: 120_000
  },
  legacy: {
    description: 'existing full framework regression fixture',
    script: 'scripts/verify-framework.mjs',
    timeoutMs: 600_000
  }
}

const options = parseArgs(process.argv.slice(2))

if (options.list) {
  for (const [name, group] of Object.entries(GROUPS)) {
    console.log(`${name}\t${group.description}`)
  }
  process.exit(0)
}

const selectedGroups = options.groups.length > 0
  ? options.groups.map(normalizeGroup)
  : options.manager
    ? ['contracts']
    : Object.keys(GROUPS)

for (const groupName of [...new Set(selectedGroups)]) {
  const group = GROUPS[groupName]
  if (!group) throw new Error(`Unknown verification group: ${groupName}`)
  const args = options.manager && groupName === 'contracts'
    ? ['--manager', options.manager]
    : []
  await runGroup(groupName, group, args, options.timeoutMs)
}

console.log(`[verify] completed ${[...new Set(selectedGroups)].length} group(s)`)

function parseArgs(args) {
  const result = {
    groups: [],
    list: false,
    manager: undefined,
    timeoutMs: undefined
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === 'list') {
      result.list = true
      continue
    }
    if (argument in GROUPS || argument === 'full') {
      result.groups.push(argument)
      continue
    }
    if (argument.startsWith('--group=')) {
      result.groups.push(argument.slice('--group='.length))
      continue
    }
    if (argument.startsWith('--manager=')) {
      result.manager = argument.slice('--manager='.length)
      continue
    }
    if (argument.startsWith('--timeout-ms=')) {
      const value = Number(argument.slice('--timeout-ms='.length))
      if (!Number.isFinite(value) || value < 1_000) {
        throw new Error('--timeout-ms must be a number greater than or equal to 1000')
      }
      result.timeoutMs = Math.trunc(value)
      continue
    }
    if (argument === '--list') {
      result.list = true
      continue
    }
    if (argument === '--group') {
      result.groups.push(requiredValue(args, ++index, '--group'))
      continue
    }
    if (argument === '--manager') {
      result.manager = requiredValue(args, ++index, '--manager')
      continue
    }
    if (argument === '--timeout-ms') {
      const value = Number(requiredValue(args, ++index, '--timeout-ms'))
      if (!Number.isFinite(value) || value < 1_000) {
        throw new Error('--timeout-ms must be a number greater than or equal to 1000')
      }
      result.timeoutMs = Math.trunc(value)
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  return result
}

function normalizeGroup(value) {
  return value === 'full' ? 'legacy' : value
}

function requiredValue(args, index, option) {
  const value = args[index]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`)
  return value
}

async function runGroup(name, group, args, timeoutOverride) {
  const startedAt = Date.now()
  const timeoutMs = timeoutOverride || group.timeoutMs
  const script = resolve(process.cwd(), group.script)
  console.log(`[verify:${name}] starting (${group.description}; timeout ${timeoutMs}ms)`)

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true
    })
    let settled = false
    const heartbeat = setInterval(() => {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
      console.log(`[verify:${name}] still running after ${elapsedSeconds}s`)
    }, 15_000)
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      clearInterval(heartbeat)
      child.kill('SIGTERM')
      rejectPromise(new Error(`${name} verification timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearInterval(heartbeat)
      clearTimeout(timeout)
      rejectPromise(error)
    })

    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearInterval(heartbeat)
      clearTimeout(timeout)
      if (code !== 0) {
        rejectPromise(new Error(`${name} verification failed with code ${code ?? 'none'}${signal ? ` (${signal})` : ''}`))
        return
      }
      const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.log(`[verify:${name}] passed in ${elapsedSeconds}s`)
      resolvePromise()
    })
  })
}
