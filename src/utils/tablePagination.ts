import type { LabelTranslator } from '../i18n'

/** Rows rendered per page for long dependency and endpoint tables. */
export const LIST_PAGE_SIZE = 50

/**
 * Page any table that grew past {@link LIST_PAGE_SIZE} instead of mounting every
 * row: a mid-sized project easily carries several hundred dependencies, and
 * rendering them all made typing, filtering and selection stutter.
 *
 * Small tables keep `false` so they stay compact and fully visible.
 */
export function pagedPagination<T>(rows: readonly T[], t: LabelTranslator) {
  return rows.length > LIST_PAGE_SIZE
    ? {
        pageSize: LIST_PAGE_SIZE,
        showSizeChanger: true,
        showTotal: (total: number) => t('health.paginationTotal', { total })
      }
    : false
}
