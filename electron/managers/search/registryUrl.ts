export function normalizeRegistryUrl(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Registry URL must use HTTP or HTTPS')
  }
  if (url.username || url.password) {
    throw new Error('Registry URL must not contain embedded credentials')
  }
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

export function registryEndpoint(registry: string, path: string): URL {
  const base = `${normalizeRegistryUrl(registry)}/`
  return new URL(path.replace(/^\/+/, ''), base)
}
