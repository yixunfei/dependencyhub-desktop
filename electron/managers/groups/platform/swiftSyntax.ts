/** Preserve offsets while hiding comments and strings from structural scans. */
export function maskSwiftTrivia(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"/g,
    (text) => text.startsWith('"')
      ? `"${text.slice(1, -1).replace(/[^\r\n]/g, ' ')}"`
      : text.replace(/[^\r\n]/g, ' '))
}
