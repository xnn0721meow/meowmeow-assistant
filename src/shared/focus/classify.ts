export type AppClassification = 'allowed' | 'blocked' | 'neutral' | 'unknown'

function matches(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => {
    const value = needle.trim().toLowerCase()
    return value.length > 0 && haystack.includes(value)
  })
}

/**
 * The rule layer is intentionally simple and explainable: users can see why
 * the mascot spoke. It is not a classifier and does not pretend to be one.
 */
export function classifyApp(
  appName: string | null,
  windowTitle: string | null,
  allowedApps: string[],
  blockedApps: string[]
): AppClassification {
  if (!appName && !windowTitle) return 'unknown'

  const haystack = `${appName ?? ''} ${windowTitle ?? ''}`.toLowerCase()

  // Blocked wins over allowed: a browser tab titled Bilibili is not study time.
  if (matches(haystack, blockedApps)) return 'blocked'
  if (matches(haystack, allowedApps)) return 'allowed'
  return 'neutral'
}
