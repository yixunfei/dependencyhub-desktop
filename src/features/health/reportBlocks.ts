import type { TranslationKey } from '../../i18n'
import type { ReportStatusListener } from './reportStatus'

export interface HealthReportBlock {
  key: string
  /**
   * A dictionary key rather than a resolved label: the loader resolves it at
   * render time, so switching language relabels the failure list immediately
   * instead of leaving it in the previous language until the next refresh.
   */
  labelKey: TranslationKey
  run: (isCurrent: () => boolean) => Promise<void>
}

/** Capture the payload type before collecting heterogeneous report blocks. */
export function createHealthReportBlock<T>(
  key: string,
  labelKey: TranslationKey,
  load: () => Promise<T>,
  apply: (value: T) => void
): HealthReportBlock {
  return {
    key, labelKey,
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
