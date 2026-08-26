/**
 * NeuralCanvas Desktop — Window State Persistence
 *
 * Saves and restores the main window's size and position between sessions
 * using electron-store so nothing is written to the registry or home dir manually.
 */

'use strict'

const { screen } = require('electron')

let Store
try {
  // electron-store v8+ uses ESM. We use a dynamic require workaround for CJS main.
  Store = require('electron-store')
  if (Store.default) Store = Store.default
} catch {
  Store = null
}

const DEFAULTS = {
  width: 1280,
  height: 800,
  x: undefined,
  y: undefined,
  isMaximized: false,
}

let store = null
function getStore() {
  if (!store && Store) {
    store = new Store({
      name: 'window-state',
      defaults: { windowState: DEFAULTS },
    })
  }
  return store
}

/**
 * Load the saved window state.
 * Falls back to centered defaults if the saved position is off-screen.
 */
function load() {
  const s = getStore()
  const saved = s ? s.get('windowState', DEFAULTS) : { ...DEFAULTS }

  // Validate that the saved position is still on a visible display
  if (saved.x !== undefined && saved.y !== undefined) {
    const displays = screen.getAllDisplays()
    const visible = displays.some((d) => {
      const b = d.bounds
      return (
        saved.x >= b.x &&
        saved.y >= b.y &&
        saved.x + saved.width <= b.x + b.width &&
        saved.y + saved.height <= b.y + b.height
      )
    })
    if (!visible) {
      // Reset to defaults
      return { ...DEFAULTS }
    }
  }

  return {
    width: Math.max(saved.width || DEFAULTS.width, 1024),
    height: Math.max(saved.height || DEFAULTS.height, 680),
    x: saved.x,
    y: saved.y,
    isMaximized: Boolean(saved.isMaximized),
  }
}

/**
 * Save the current window geometry.
 * Must be called before the window is destroyed.
 */
function save(win) {
  if (!win) return
  const s = getStore()
  if (!s) return

  const isMaximized = win.isMaximized()
  // Only save bounds when not maximized — restore to a sensible size
  if (!isMaximized) {
    const b = win.getBounds()
    s.set('windowState', {
      width: b.width,
      height: b.height,
      x: b.x,
      y: b.y,
      isMaximized: false,
    })
  } else {
    // Keep previous non-maximized size, only record maximized flag
    const prev = s.get('windowState', DEFAULTS)
    s.set('windowState', { ...prev, isMaximized: true })
  }
}

module.exports = { load, save }
