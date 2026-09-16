import { readdir, readFile } from 'node:fs/promises'
import ts from 'typescript'

export async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return await sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  }))
  return nested.flat().sort()
}

export async function measureSource(path) {
  const source = await readFile(path, 'utf8')
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const metrics = {
    lines: source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0),
    anyTypes: 0,
    longFunctions: []
  }
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) metrics.anyTypes += 1
    if (ts.isFunctionLike(node) && node.body) {
      const start = file.getLineAndCharacterOfPosition(node.getStart(file)).line
      const end = file.getLineAndCharacterOfPosition(node.end).line
      if (end - start + 1 > 100) metrics.longFunctions.push(end - start + 1)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  metrics.longFunctions.sort((a, b) => b - a)
  return metrics
}

export async function measureProject() {
  const files = (await Promise.all(['electron', 'shared', 'src'].map(sourceFiles))).flat()
  return Object.fromEntries(await Promise.all(files.map(async (path) => [path, await measureSource(path)])))
}
