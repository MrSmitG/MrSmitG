export type DesktopMenuAction =
  | { type: 'settings' }
  | { type: 'open-workspace' }
  | { type: 'save' }
  | { type: 'new-file' }
  | { type: 'reveal-workspace' }
  | { type: 'palette' }
  | { type: 'search' }
  | { type: 'graph' }
  | { type: 'terminal' }
  | { type: 'model-hub' }
  | { type: 'mode'; mode: 'ask' | 'edit' | 'agent' }
  | { type: 'toggle-offline' }
  | { type: 'shortcuts' }

export interface LocalForgeDesktop {
  isElectron: boolean
  getInfo: () => Promise<{
    platform: string
    isMac: boolean
    isElectron: boolean
    version: string
    dark: boolean
  }>
  pickFolder: (opts?: { title?: string; defaultPath?: string }) => Promise<string | null>
  revealInFinder: (targetPath: string) => Promise<boolean>
  notify: (title: string, body: string) => Promise<boolean>
  onMenuAction: (handler: (action: DesktopMenuAction) => void) => () => void
}

declare global {
  interface Window {
    localforgeDesktop?: LocalForgeDesktop
  }
}

export function getDesktop(): LocalForgeDesktop | null {
  if (typeof window === 'undefined') return null
  return window.localforgeDesktop ?? null
}

export function isDesktopMacApp(): boolean {
  return Boolean(getDesktop()?.isElectron)
}
