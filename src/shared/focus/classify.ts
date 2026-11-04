export type AppClassification = 'blocked' | 'neutral' | 'unknown'

function matches(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => {
    const value = needle.trim().toLowerCase()
    return value.length > 0 && haystack.includes(value)
  })
}

/**
 * The rule layer is intentionally simple and explainable: users can see why
 * the mascot spoke. Everything that is not blocked counts as study time.
 */
export function classifyApp(
  appName: string | null,
  windowTitle: string | null,
  blockedApps: string[]
): AppClassification {
  if (!appName && !windowTitle) return 'unknown'

  const haystack = `${appName ?? ''} ${windowTitle ?? ''}`.toLowerCase()
  if (matches(haystack, blockedApps)) return 'blocked'
  return 'neutral'
}
