export type LineEnding = '\r\n' | '\n'

export function detectLineEnding(content: string): LineEnding {
  return content.includes('\r\n') ? '\r\n' : '\n'
}

/** Rewrites every LF in content to the detected ending so edits keep the file's original style. */
export function applyLineEnding(content: string, eol: LineEnding): string {
  return eol === '\r\n' ? content.replace(/\n/g, '\r\n') : content
}
