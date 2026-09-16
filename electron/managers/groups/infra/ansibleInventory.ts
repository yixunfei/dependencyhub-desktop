import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asRecord, asArray, asString, parseYamlDocument, readTextIfExists } from '../../structuredData'

const FILES = ['requirements.yml', 'requirements.yaml', 'collections/requirements.yml', 'roles/requirements.yml']
export async function readAnsibleInventory(cwd: string): Promise<ManagerDependency[]> {
  const result: ManagerDependency[] = []
  for (const file of FILES) {
    const content = await readTextIfExists(join(cwd, file)); if (!content) continue
    const root = parseYamlDocument(content, file)
    const rootRecord = asRecord(root)
    const sections = rootRecord
      ? Object.entries(rootRecord).flatMap(([section, value]) => asArray(value).map((item) => ({ section, item })))
      : asArray(root).map((item) => ({ section: file.includes('collections') ? 'collections' : 'roles', item }))
    for (const { section, item } of sections) {
      const record = typeof item === 'string' ? { name: item } : asRecord(item)
      if (!record) continue
      const name = asString(record.name) || asString(record.src); if (!name) continue
      result.push({ managerId: 'ansible', name, version: asString(record.version), requestedVersion: asString(record.version), type: section === 'collections' ? 'collection' : 'role', source: asString(record.src) || asString(record.source), file, direct: true, metadata: { scm: asString(record.scm) || null } })
    }
  }
  return result
}
