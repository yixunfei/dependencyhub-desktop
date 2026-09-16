import type { ReportStatusListener } from './reportStatus'

export interface HealthReportBlock {
  key: string
  label: string
  run: (isCurrent: () => boolean) => Promise<void>
}

/** Capture the payload type before collecting heterogeneous report blocks. */
export function createHealthReportBlock<T>(
  key: string,
  label: string,
  load: () => Promise<T>,
  apply: (value: T) => void
): HealthReportBlock {
  return {
    key, label,
    run: async (isCurrent) => {
      const value = await load()
      if (isCurrent()) apply(value)
    }
  }
}

/** A generation invalidates older refreshes; per-block tickets isolate retries. */
export class HealthReportLoader {
  private generation = 0
  private tickets = new Map<string, object>()

  invalidate(): void {
    this.generation += 1
    this.tickets.clear()
  }

  async load(block: HealthReportBlock, onStatus: ReportStatusListener): Promise<void> {
    const generation = this.generation
    const ticket = {}
    this.tickets.set(block.key, ticket)
    const isCurrent = () => generation === this.generation && this.tickets.get(block.key) === ticket
    try {
      await block.run(isCurrent)
      if (isCurrent()) onStatus(block.key, 'ready')
    } catch (error) {
      if (isCurrent()) onStatus(block.key, 'error', error)
    }
  }
}
