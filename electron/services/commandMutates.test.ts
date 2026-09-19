// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { commandMutatesProjectFiles } from './commandMutates'

describe('commandMutatesProjectFiles', () => {
  it('does not let package names containing read-only words look read-only', () => {
    // Regression: the old whole-string check classified `add tree-kill` as
    // read-only and skipped the mutation queue plus the pre-write backup.
    expect(commandMutatesProjectFiles(['add', 'tree-kill'])).toBe(true)
    expect(commandMutatesProjectFiles(['add', 'check-types'])).toBe(true)
    expect(commandMutatesProjectFiles(['install', 'info-cli'])).toBe(true)
    expect(commandMutatesProjectFiles(['install', 'why-is-node-running'])).toBe(true)
  })

  it('keeps genuine read-only commands read-only', () => {
    expect(commandMutatesProjectFiles(['ls', '--all'])).toBe(false)
    expect(commandMutatesProjectFiles(['ls', 'tree-kill'])).toBe(false)
    expect(commandMutatesProjectFiles(['list'])).toBe(false)
    expect(commandMutatesProjectFiles(['dependency', 'list'])).toBe(false)
    expect(commandMutatesProjectFiles(['show', '--outdated'])).toBe(false)
    expect(commandMutatesProjectFiles([])).toBe(false)
  })

  it('honours dry-run flags and audit fix', () => {
    expect(commandMutatesProjectFiles(['update', '--all', '--dry-run'])).toBe(false)
    expect(commandMutatesProjectFiles(['audit', 'fix'])).toBe(true)
    expect(commandMutatesProjectFiles(['mod', 'tidy'])).toBe(true)
  })
})
