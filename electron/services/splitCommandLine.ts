// Quote-aware command line tokenizer shared by all manager services. Splitting
// on whitespace alone corrupts quoted arguments such as `git commit -m "fix
// thing"` or credentials containing spaces.
//
// Scope: double and single quotes, spaces preserved inside quotes, and a
// backslash escaping a double quote (the one escape users actually hit).
// Backslashes elsewhere stay literal so Windows paths (C:\foo) survive, and
// cmd.exe-specific %VAR% / ^ handling is left to commandRunner.
export function splitCommandLine(commandLine: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inToken = false
  let quote: '"' | "'" | null = null

  for (let index = 0; index < commandLine.length; index += 1) {
    const char = commandLine[index]

    if (quote === "'") {
      // Single quotes have no escapes, matching POSIX behavior.
      if (char === "'") quote = null
      else current += char
      continue
    }

    if (char === '\\' && commandLine[index + 1] === '"') {
      current += '"'
      inToken = true
      index += 1
      continue
    }

    if (quote === '"') {
      if (char === '"') quote = null
      else current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      inToken = true
      continue
    }

    if (/\s/.test(char)) {
      if (inToken) {
        tokens.push(current)
        current = ''
        inToken = false
      }
      continue
    }

    current += char
    inToken = true
  }

  if (inToken || current) tokens.push(current)
  return tokens
}
