/** Contents of a double-quoted R string literal, not shell escaping. */
export function rString(value: string): string {
  return JSON.stringify(value).slice(1, -1)
}

/** Julia additionally interpolates dollar expressions inside string literals. */
export function juliaString(value: string): string {
  return rString(value).replace(/\$/g, '\\$')
}
