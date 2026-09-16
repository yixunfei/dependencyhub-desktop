import { readFile } from 'node:fs/promises'
import { measureProject } from './source-metrics.mjs'

const baseline = JSON.parse(await readFile(new URL('./engineering-debt-baseline.json', import.meta.url), 'utf8'))
const metrics = await measureProject()
const failures = []
for (const [file, current] of Object.entries(metrics)) {
  const previous = baseline.files[file] || {}
  const maximum = previous.maxLines || 1500
  if (current.lines > maximum) failures.push(`${file}: ${current.lines} lines exceeds ${maximum}`)
  if (current.anyTypes > (previous.anyTypes || 0)) {
    failures.push(`${file}: explicit any grew from ${previous.anyTypes || 0} to ${current.anyTypes}`)
  }
  current.longFunctions.forEach((lines, index) => {
    const allowed = previous.longFunctions?.[index] || 100
    if (lines > allowed) failures.push(`${file}: function #${index + 1} is ${lines} lines, exceeds ${allowed}`)
  })
}
if (failures.length) throw new Error(failures.join('\n'))
const values = Object.values(metrics)
console.log(`[engineering-debt] ${values.length} production TypeScript files checked using the AST`)
console.log(`[engineering-debt] remaining: ${values.filter((item) => item.lines > 1500).length} oversized files, ${values.reduce((sum, item) => sum + item.longFunctions.length, 0)} long functions, ${values.reduce((sum, item) => sum + item.anyTypes, 0)} explicit any types`)
console.log('[engineering-debt] passed: new files/functions respect 1500/100-line limits; existing debt does not grow')
