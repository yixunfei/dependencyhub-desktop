import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { writeFileAtomic } from './atomicWrite'

const REPORT_DIR = '.npmDesktopManager/reports'

/**
 * Exported reports are evidence: they get attached to change tickets and read
 * during incident reviews, so a truncated file caused by a crash mid write is
 * worse than no file at all. They therefore use the same atomic writer as the
 * manifests themselves.
 */
export async function writeTextReport(cwd: string, fileName: string, content: string): Promise<string> {
  return await writeIntoReports(cwd, fileName, content)
}

export async function writeJsonReport(cwd: string, fileName: string, payload: unknown): Promise<string> {
  return await writeIntoReports(cwd, fileName, JSON.stringify(payload, null, 2))
}

async function writeIntoReports(cwd: string, fileName: string, content: string): Promise<string> {
  const path = join(cwd, REPORT_DIR, fileName)
  await mkdir(dirname(path), { recursive: true })
  await writeFileAtomic(path, content)
  return path
}
