const { app, BrowserWindow, Menu, dialog, shell, ipcMain, Notification, nativeTheme } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const http = require('node:http')

const isDev = !app.isPackaged
const SERVER_PORT = Number(process.env.LOCALFORGE_PORT || 8787)
const DEV_UI = process.env.LOCALFORGE_DEV_UI || 'http://127.0.0.1:5173'

let mainWindow = null
let serverProc = null

function serverUrl() {
  return `http://127.0.0.1:${SERVER_PORT}`
}

function appRoot() {
  if (isDev) return path.join(__dirname, '..')
  const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked')
  if (fs.existsSync(path.join(unpacked, 'server'))) return unpacked
  return app.getAppPath()
}

function waitForServer(url, attempts = 80) {
  return new Promise((resolve, reject) => {
    let left = attempts
    const tick = () => {
      const req = http.get(url + '/api/health', (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) resolve(true)
        else retry()
      })
      req.on('error', retry)
      req.setTimeout(800, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      left -= 1
      if (left <= 0) reject(new Error('LocalForge server did not start'))
      else setTimeout(tick, 400)
    }
    tick()
  })
}

function startEmbeddedServer() {
  if (isDev) return Promise.resolve()

  const root = appRoot()
  const entry = path.join(root, 'server', 'index.ts')
  const tsxCandidates = [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(app.getAppPath(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]
  const tsxCli = tsxCandidates.find((p) => fs.existsSync(p))
  if (!tsxCli || !fs.existsSync(entry)) {
    return Promise.reject(new Error('Packaged LocalForge server entry or tsx CLI missing'))
  }

  serverProc = spawn(process.execPath, [tsxCli, entry], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(SERVER_PORT),
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProc.stdout?.on('data', (d) => console.log(`[server] ${d}`))
  serverProc.stderr?.on('data', (d) => console.error(`[server] ${d}`))
  serverProc.on('exit', (code) => console.log(`[server] exited ${code}`))
  return waitForServer(serverUrl())
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#071411',
    title: 'LocalForge',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const target = isDev ? DEV_UI : serverUrl()
  mainWindow.loadURL(target)
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[window] failed to load ${url}: ${code} ${desc}`)
    if (isDev && url.startsWith(DEV_UI)) {
      // Last resort: open API landing (redirects to Vite) instead of a blank error page.
      setTimeout(() => mainWindow?.loadURL(serverUrl() + '/'), 800)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function send(channel, payload) {
  mainWindow?.webContents.send(channel, payload)
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Preferences…',
                accelerator: 'CmdOrCtrl+,',
                click: () => send('menu:action', { type: 'settings' }),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('menu:action', { type: 'open-workspace' }),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:action', { type: 'save' }),
        },
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('menu:action', { type: 'new-file' }),
        },
        { type: 'separator' },
        {
          label: 'Reveal Workspace in Finder',
          click: () => send('menu:action', { type: 'reveal-workspace' }),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+P',
          click: () => send('menu:action', { type: 'palette' }),
        },
        {
          label: 'Find in Files',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('menu:action', { type: 'search' }),
        },
        {
          label: 'Graph LLM',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => send('menu:action', { type: 'graph' }),
        },
        {
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => send('menu:action', { type: 'terminal' }),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'LLM',
      submenu: [
        {
          label: 'Model Hub',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => send('menu:action', { type: 'model-hub' }),
        },
        {
          label: 'Mode: Ask',
          click: () => send('menu:action', { type: 'mode', mode: 'ask' }),
        },
        {
          label: 'Mode: Edit',
          click: () => send('menu:action', { type: 'mode', mode: 'edit' }),
        },
        {
          label: 'Mode: Agent',
          click: () => send('menu:action', { type: 'mode', mode: 'agent' }),
        },
        { type: 'separator' },
        {
          label: 'Toggle Offline Mode',
          click: () => send('menu:action', { type: 'toggle-offline' }),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => send('menu:action', { type: 'shortcuts' }),
        },
        {
          label: 'LocalForge on GitHub',
          click: () => shell.openExternal('https://github.com/MrSmitG/MrSmitG'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('desktop:info', () => ({
  platform: process.platform,
  isMac: process.platform === 'darwin',
  isElectron: true,
  version: app.getVersion(),
  dark: nativeTheme.shouldUseDarkColors,
}))

ipcMain.handle('desktop:pickFolder', async (_e, opts = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || 'Choose folder',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: opts.defaultPath,
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

ipcMain.handle('desktop:reveal', async (_e, targetPath) => {
  if (!targetPath) return false
  shell.showItemInFolder(targetPath)
  return true
})

ipcMain.handle('desktop:notify', async (_e, { title, body }) => {
  if (!Notification.isSupported()) return false
  new Notification({ title: title || 'LocalForge', body: body || '' }).show()
  return true
})

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.setName('LocalForge')
    app.setAboutPanelParameters({
      applicationName: 'LocalForge',
      applicationVersion: app.getVersion(),
      copyright: 'Local LLM IDE for Mac',
      credits: 'Ask · Edit · Agent · Graph LLM · Offline mode · Mac desktop',
    })
  }
  buildMenu()
  try {
    if (!isDev) await startEmbeddedServer()
    else await waitForServer(serverUrl()).catch(() => undefined)
  } catch (err) {
    console.error(err)
    dialog.showErrorBox(
      'LocalForge',
      err instanceof Error ? err.message : 'Failed to start LocalForge server',
    )
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM')
    serverProc = null
  }
})
