import { createHash } from 'node:crypto'

/**
 * The character class that decides what counts as "CJK copy" for the i18n guards.
 *
 * Both `verify-i18n.mjs` (the ratchet) and `i18n-coverage.mjs` (the measurement) need
 * this, and they must agree: the ratchet freezes the number the coverage report breaks
 * down, so two definitions would silently drift apart. It lives here for that reason.
 *
 * Deliberately EXCLUDED, because they are ordinary English typography and appear in
 * English strings in this repo — counting them would report English copy as
 * untranslated and then freeze that miscount in the baseline:
 *
 *   U+00B7 middle dot   "· preview" (ManagerHub)
 *   U+2013 en dash
 *   U+2014 em dash      "—" (HealthReportFailures)
 *   U+2026 ellipsis
 *
 * INCLUDED, because they only occur in Chinese copy here:
 *
 *   U+3000-U+303F  CJK symbols and punctuation: 、。〈〉《》「」【】
 *   U+3400-U+4DBF  CJK unified ideographs extension A
 *   U+4E00-U+9FFF  CJK unified ideographs
 *   U+FF01-U+FF60  fullwidth forms: ，！？（）：；and fullwidth ASCII
 *   U+2018 U+2019  curly single quotes  ' '
 *   U+201C U+201D  curly double quotes  " "
 *
 * The earlier class was `[\u4e00-\u9fff]` alone, which missed 210 occurrences of
 * Chinese punctuation across 16 files — so a file whose only remaining Chinese was
 * "；" counted as zero and dropped out of the ratchet entirely.
 */
export const CJK_CHARACTERS = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff01-\uff60\u2018\u2019\u201c\u201d]/g

/**
 * Identity of the class above, so a baseline can record which definition produced it.
 *
 * Without this, changing the class silently invalidates every recorded count: the
 * ratchet reports a confusing "grew from 671 to 701" across 15 files that nobody
 * edited, and a *narrowed* class would drop files out of the ratchet with no signal
 * at all. `verify-i18n.mjs` compares this against the baseline and asks for an
 * explicit `--rebaseline` when they differ, which prints the per-file delta.
 */
export const CJK_CLASS_ID = createHash('sha256')
  .update(CJK_CHARACTERS.source)
  .digest('hex')
  .slice(0, 12)

/** Count CJK characters in a string. */
export const countCjk = (text) => (text.match(CJK_CHARACTERS) || []).length
