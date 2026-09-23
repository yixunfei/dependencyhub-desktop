import { readFile, writeFile } from 'node:fs/promises'
import { measureProject } from './source-metrics.mjs'

// Tighten measured debt only. A regression must be reviewed explicitly;
// running this maintenance command must never make a failing gate green.
const baselinePath = new URL('./engineering-debt-baseline.json', import.meta.url)
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
const metrics = await measureProject()
const files = {}
const failures = []
for (const [file, current] of Object.entries(metrics)) {
  const previous = baseline.files[file] || {}
  if (current.lines > (previous.maxLines || 1500)) failures.push(`${file}: line limit exceeded`)
  if (current.anyTypes > (previous.anyTypes || 0)) failures.push(`${file}: explicit any increased`)
  current.longFunctions.forEach((lines, index) => {
    if (lines > (previous.longFunctions?.[index] || 100)) failures.push(`${file}: function size increased`)
  })
  const entry = {}
  if (current.lines > 1500) entry.maxLines = current.lines
  if (current.anyTypes > 0) entry.anyTypes = current.anyTypes
  if (current.longFunctions.length) entry.longFunctions = current.longFunctions
  if (Object.keys(entry).length) files[file] = entry
}
if (failures.length) throw new Error(`Refusing to raise engineering debt allowances:\n${failures.join('\n')}`)
await writeFile(baselinePath, `${JSON.stringify({ ...baseline, files }, null, 2)}\n`, 'utf8')
console.log('[engineering-debt] baseline tightened; no allowances raised')
