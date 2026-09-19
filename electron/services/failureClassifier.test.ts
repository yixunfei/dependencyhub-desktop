// @vitest-environment node
import { expect, it } from 'vitest'
import { classifyFailureText } from './failureClassifier'

it('reports a registry that cannot be resolved as a network failure', () => {
  const result = classifyFailureText('request to https://registry.npmjs.org/lodash failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org')
  expect(result?.category).toBe('network')
  expect(result?.retryable).toBe(true)
  expect(result?.evidence?.host).toBe('https://registry.npmjs.org/lodash')
  expect(result?.evidence?.errorCode).toBe('EAI_AGAIN')
})

it('does not offer a retry for expired credentials', () => {
  const result = classifyFailureText('npm ERR! code E401\nUnable to authenticate, need: Basic realm="registry"')
  expect(result?.category).toBe('auth')
  expect(result?.retryable).toBe(false)
  expect(result?.evidence?.statusCode).toBe(401)
})

it('names the missing tool when a command cannot be launched', () => {
  const result = classifyFailureText('Error: spawn mvn ENOENT')
  expect(result?.category).toBe('toolchain-missing')
  expect(result?.retryable).toBe(false)
  expect(result?.evidence?.tool).toBe('mvn')
})

it('separates filesystem permission errors from authentication errors', () => {
  const result = classifyFailureText("EACCES: permission denied, open '/project/package.json'")
  expect(result?.category).toBe('permission')
  expect(result?.evidence?.errorCode).toBe('EACCES')
})

it('treats a rejected certificate as its own cause', () => {
  const result = classifyFailureText('request to https://internal.registry failed, reason: self signed certificate in certificate chain')
  expect(result?.category).toBe('certificate')
  expect(result?.retryable).toBe(false)
})

it('recognises a registry that does not carry the package', () => {
  const result = classifyFailureText('npm ERR! 404 Not Found - GET https://registry.npmjs.org/no-such-package - Not found')
  expect(result?.category).toBe('registry')
  expect(result?.evidence?.statusCode).toBe(404)
})

it('stays silent instead of guessing when nothing matches', () => {
  expect(classifyFailureText('something completely unexpected')).toBeUndefined()
  expect(classifyFailureText('')).toBeUndefined()
})
