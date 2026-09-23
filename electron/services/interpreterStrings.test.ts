// @vitest-environment node
import { expect, it } from 'vitest'
import { rString, juliaString } from './interpreterStrings'

it('keeps quotes, backslashes and control characters inside R literals', () => {
  const input = 'x"); system("injected"); #\\\n'
  expect(JSON.parse(`"${rString(input)}"`)).toBe(input)
  expect(rString(input)).not.toContain('\n')
})

it('escapes Julia interpolation even without a closing quote', () => {
  expect(juliaString('$(run(`injected`))')).toBe('\\$(run(`injected`))')
  expect(juliaString('$name')).toBe('\\$name')
})
