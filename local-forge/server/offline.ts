/** Network / offline guards for LocalForge air-gapped operation. */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

export function isLocalBaseUrl(baseUrl: string): boolean {
  if (!baseUrl || baseUrl.startsWith('local://')) return true
  try {
    const u = new URL(baseUrl)
    return LOCAL_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

export function assertLocalProvider(baseUrl: string, offlineMode: boolean): void {
  if (!offlineMode) return
  if (!isLocalBaseUrl(baseUrl)) {
    throw new Error(
      'Offline mode is on: provider URL must be localhost / 127.0.0.1 (or use the Offline engine).',
    )
  }
}

export function assertCanUseInternet(offlineMode: boolean, action: string): void {
  if (offlineMode) {
    throw new Error(
      `Offline mode is on: ${action} needs the internet. Turn Offline mode off to download models, then turn it back on.`,
    )
  }
}

export function offlineSafeConfigPatch(patch: {
  offlineMode?: boolean
  provider?: string
  baseUrl?: string
  selectedModel?: string
}): Record<string, unknown> {
  if (!patch.offlineMode) return {}
  const extras: Record<string, unknown> = {}
  // Prefer staying on current local provider; if remote URL, fall back to offline engine
  if (patch.baseUrl && !isLocalBaseUrl(patch.baseUrl)) {
    extras.provider = 'demo'
    extras.baseUrl = 'local://demo'
    extras.selectedModel = 'demo-coder'
  }
  return extras
}
