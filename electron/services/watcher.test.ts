// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it } from 'vitest'
import { FileWatcher, type FileChangeEvent } from './watcher'

const watcher = new FileWatcher()
const directories: string[] = []
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'dependencyhub-watcher-test-'))
  directories.push(directory)
  return directory
}
afterEach(async () => {
  watcher.unwatchAll()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

it('does not register pending watchers after a project has been unwatched', async () => {
  const cwd = await fixture()
  const registrations = [watcher.watchProject(cwd, () => {}), watcher.watchProject(cwd, () => {})]
  watcher.unwatchAll()
  await Promise.all(registrations)
  expect(watcher.watchedProjects()).toEqual([])
})

it('refreshes when a supported Python lockfile is created', async () => {
  const cwd = await fixture()
  let receive!: (event: FileChangeEvent) => void
  const changed = new Promise<FileChangeEvent>((resolve) => { receive = resolve })
  await watcher.watchProject(cwd, receive)
  await writeFile(join(cwd, 'uv.lock'), 'version = 1')
  await expect(changed).resolves.toMatchObject({ file: 'uv.lock', path: cwd })
}, 3000)
