// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { splitCommandLine } from './splitCommandLine'

describe('splitCommandLine', () => {
  it('splits plain arguments on whitespace', () => {
    expect(splitCommandLine('npm install -g typescript')).toEqual(['npm', 'install', '-g', 'typescript'])
    expect(splitCommandLine('  cargo   build  ')).toEqual(['cargo', 'build'])
    expect(splitCommandLine('')).toEqual([])
    expect(splitCommandLine('   ')).toEqual([])
  })

  it('keeps spaces inside double and single quotes', () => {
    expect(splitCommandLine('git commit -m "fix the thing"')).toEqual(['git', 'commit', '-m', 'fix the thing'])
    expect(splitCommandLine("echo 'hello world'")).toEqual(['echo', 'hello world'])
    expect(splitCommandLine('a "b  c" d')).toEqual(['a', 'b  c', 'd'])
  })

  it('supports escaped double quotes', () => {
    expect(splitCommandLine('msg \\"quoted\\"')).toEqual(['msg', '"quoted"'])
    expect(splitCommandLine('"he said \\"hi\\""')).toEqual(['he said "hi"'])
  })

  it('keeps empty quoted arguments', () => {
    expect(splitCommandLine('run ""')).toEqual(['run', ''])
  })

  it('treats backslashes outside escapes literally for Windows paths', () => {
    expect(splitCommandLine('go build C:\\src\\app')).toEqual(['go', 'build', 'C:\\src\\app'])
    expect(splitCommandLine('"C:\\Program Files\\tool" --flag')).toEqual(['C:\\Program Files\\tool', '--flag'])
  })

  it('joins quoted and unquoted fragments within one token', () => {
    expect(splitCommandLine('pre"mid dle"post')).toEqual(['premid dlepost'])
  })

  it('flushes an unterminated quoted token instead of dropping it', () => {
    expect(splitCommandLine('echo "unterminated')).toEqual(['echo', 'unterminated'])
  })
})
