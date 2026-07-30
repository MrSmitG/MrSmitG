const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('localforgeDesktop', {
  isElectron: true,
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  pickFolder: (opts) => ipcRenderer.invoke('desktop:pickFolder', opts || {}),
  revealInFinder: (targetPath) => ipcRenderer.invoke('desktop:reveal', targetPath),
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  onMenuAction: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  },
})
