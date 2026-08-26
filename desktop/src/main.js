/**
 * NeuralCanvas Desktop — Electron Main Process
 *
 * Architecture:
 *   - nodeIntegration: false
 *   - contextIsolation: true
 *   - All Node.js APIs exposed through allowlisted preload IPC bridge only
 *   - Loads the deployed frontend (or local dev Vite) — no bundled Django
 *
 * Desktop-only code NEVER touches shared React components.
 * Browser users continue using the web version unchanged.
 */

'use strict'

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  nativeTheme,
} = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')

// ---------------------------------------------------------------------------
// Window state persistence (size + position)
// ---------------------------------------------------------------------------
const WindowState = require('./window-state')

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged

/**
 * The URL Electron will load.
 * Dev  → local Vite dev server (must be running separately or via concurrently)
 * Prod → deployed Vercel frontend (uses deployed Django backend, requires internet)
 */
const FRONTEND_URL =
  process.env.DESKTOP_FRONTEND_URL ||
  (IS_DEV
    ? 'http://localhost:5173'
    : 'https://neuralcanvasteam.vercel.app')

const BACKEND_URL =
  process.env.VITE_API_BASE_URL ||
  'https://neuralcanvas-backend.onrender.com/api'

// ---------------------------------------------------------------------------
// Single instance lock — prevent opening two windows
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
let mainWindow = null

function createWindow() {
  const state = WindowState.load()

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 1024,
    minHeight: 680,
    title: 'NeuralCanvas',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    backgroundColor: '#090d16',
    show: false, // show after ready-to-show to prevent flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,      // SECURITY: never expose Node to renderer
      contextIsolation: true,      // SECURITY: isolate preload from renderer
      sandbox: true,               // SECURITY: enable renderer sandbox
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  })

  // Restore maximized state
  if (state.isMaximized) mainWindow.maximize()

  // Show once content is ready to avoid blank flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (IS_DEV) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // ---------------------------------------------------------------------------
  // Navigation security — block any navigation away from our trusted origin
  // ---------------------------------------------------------------------------
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url)
    const trustedOrigins = [
      'http://localhost:5173',
      'https://neuralcanvasteam.vercel.app',
      'https://neuralcanvas-backend.onrender.com',
    ]
    const isTrusted = trustedOrigins.some(
      (o) => url.startsWith(o)
    )
    if (!isTrusted) {
      event.preventDefault()
      shell.openExternal(url) // open in default browser
    }
  })

  // Prevent opening new BrowserWindows from renderer (e.g., target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // ---------------------------------------------------------------------------
  // Persist window state on close
  // ---------------------------------------------------------------------------
  mainWindow.on('close', (event) => {
    // Save geometry before closing
    WindowState.save(mainWindow)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // ---------------------------------------------------------------------------
  // Load the app
  // ---------------------------------------------------------------------------
  mainWindow.loadURL(FRONTEND_URL).catch((err) => {
    console.error('[NeuralCanvas] Failed to load URL:', FRONTEND_URL, err.message)
    // Show offline page when Vite isn't running in dev mode
    mainWindow.loadFile(path.join(__dirname, '..', 'assets', 'offline.html'))
  })
}

// ---------------------------------------------------------------------------
// Second instance — focus existing window
// ---------------------------------------------------------------------------
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // Disable CSP violation reporting noise in dev
  if (!IS_DEV) {
    app.enableSandbox()
  }

  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // On Windows/Linux, quit when all windows are closed
  if (process.platform !== 'darwin') app.quit()
})

// ---------------------------------------------------------------------------
// IPC Handlers — allowlisted API surface exposed to renderer via preload
// ---------------------------------------------------------------------------

/**
 * IPC: open-file-dialog
 * Opens a native file picker for CSV/Excel datasets.
 * Returns { canceled, filePaths } — never exposes raw Node APIs.
 */
ipcMain.handle('open-file-dialog', async (_event, options = {}) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Select Dataset',
    filters: [
      { name: 'Dataset files', extensions: ['csv', 'xls', 'xlsx'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  return { canceled, filePaths }
})

/**
 * IPC: save-file-dialog
 * Opens a native save dialog for model exports, reports, pipeline JSON.
 */
ipcMain.handle('save-file-dialog', async (_event, options = {}) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath || 'export',
    filters: options.filters || [
      { name: 'JSON', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  return { canceled, filePath }
})

/**
 * IPC: write-file
 * Writes data to a path returned by save-file-dialog.
 * Accepts base64 or plain text content.
 */
ipcMain.handle('write-file', async (_event, { filePath, content, encoding }) => {
  const fs = require('fs')
  try {
    const buf = encoding === 'base64'
      ? Buffer.from(content, 'base64')
      : Buffer.from(content, 'utf-8')
    fs.writeFileSync(filePath, buf)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/**
 * IPC: read-file
 * Reads a file selected via open-file-dialog.
 */
ipcMain.handle('read-file', async (_event, { filePath }) => {
  const fs = require('fs')
  try {
    const content = fs.readFileSync(filePath)
    return { success: true, content: content.toString('base64'), encoding: 'base64' }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/**
 * IPC: ping-backend
 * Checks if the deployed backend is reachable.
 */
ipcMain.handle('ping-backend', async () => {
  return new Promise((resolve) => {
    const url = new URL(BACKEND_URL)
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(
      { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: '/api/auth/me/', method: 'GET', timeout: 8000 },
      (res) => resolve({ reachable: true, status: res.statusCode })
    )
    req.on('error', () => resolve({ reachable: false }))
    req.on('timeout', () => { req.destroy(); resolve({ reachable: false, reason: 'timeout' }) })
    req.end()
  })
})

/**
 * IPC: get-app-info
 * Returns app version, platform, and config.
 */
ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
  isDev: IS_DEV,
  frontendUrl: FRONTEND_URL,
  backendUrl: BACKEND_URL,
}))

/**
 * IPC: open-external
 * Safe way for renderer to open URLs in the default browser.
 */
ipcMain.handle('open-external', async (_event, url) => {
  // Only allow http/https
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url)
    return { success: true }
  }
  return { success: false, error: 'Only http/https URLs allowed' }
})

/**
 * IPC: show-confirm-dialog
 * Native confirmation dialog (e.g. unsaved changes before close).
 */
ipcMain.handle('show-confirm-dialog', async (_event, { message, detail }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Leave', 'Stay'],
    defaultId: 1,
    cancelId: 1,
    title: 'NeuralCanvas',
    message: message || 'You have unsaved changes.',
    detail: detail || 'Are you sure you want to close?',
  })
  return { confirmed: result.response === 0 }
})

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------
function buildMenu() {
  const template = [
    {
      label: 'NeuralCanvas',
      submenu: [
        { label: 'About NeuralCanvas', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
        IS_DEV ? { label: 'DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() } : null,
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ].filter(Boolean),
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open NeuralCanvas on the Web',
          click: () => shell.openExternal('https://neuralcanvasteam.vercel.app'),
        },
        {
          label: 'View on GitHub',
          click: () => shell.openExternal('https://github.com/Nireekshithkumar/My_final_year_project'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
