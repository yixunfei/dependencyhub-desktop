/**
 * Classifies a package-manager argv (without the binary) as mutating the
 * project on disk or read-only. The write-queue / backup decisions for
 * planned operations, free-form commands and diagnostic fixes all hinge on
 * this single implementation.
 *
 * Read-only detection deliberately inspects only the leading verb token:
 * checking the whole normalized string made `add tree-kill` look read-only
 * because the package name contains the word "tree", which silently skipped
 * the mutation queue and the pre-write backup.
 */
const READ_ONLY_VERBS = new Set([
  'dry-run', 'check', 'validate', 'list', 'ls', 'show', 'info', 'tree', 'graph', 'outdated', 'audit', 'search', 'why'
])

export function commandMutatesProjectFiles(args: string[]): boolean {
  if (args.includes('--dry-run') || args.includes('--simulate') || args.includes('--assumeno')) return false
  const tokens = args.filter((arg) => !arg.startsWith('-'))
  const verb = (tokens[0] || '').toLowerCase()

  if (!verb) {
    // An argv with no positional token at all (flags only, e.g. a malformed
    // runCustom input) cannot be proven read-only; classify it as mutating so
    // it still receives the write queue and backup.
    return args.length > 0
  }
  // `audit fix` mutates even though it starts with a read-only verb.
  const hasFix = tokens.some((token) => token.toLowerCase() === 'fix')
  if (READ_ONLY_VERBS.has(verb) && !hasFix) return false

  const normalized = tokens.join(' ').toLowerCase()
  return /\b(install|add|require|remove|rm|uninstall|update|autoupdate|upgrade|sync|restore|resolve|lock|freeze|snapshot|instantiate|init|tidy|get|deps|fetch|fix|edit|prune|clean|purge|apply|destroy|rollback|deploy|up|down|cache|dedupe|import|dependency update|repo update|generate-lockfiles)\b/.test(normalized)
  // Over-classification (e.g. `pip cache dir` or `terraform apply` previews) is
  // an acceptable safety bias: a false "mutating" only adds a backup + mutation
  // queue, never data loss.
}
