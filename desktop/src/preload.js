/**
 * NeuralCanvas Desktop — Preload Script
 *
 * SECURITY RULES:
 *   - This file runs with Node.js access but is isolated from the renderer.
 *   - Only an explicit, named, allowlisted API surface is exposed via
 *     contextBridge.exposeInMainWorld('electronAPI', { ... }).
 *   - No require(), __dirname, process, or other Node globals are forwarded.
 *   - All communication goes through ipcRenderer.invoke (request/response).
 *
 * In the React app, check  window.electronAPI  before using any desktop API.
 * Browser users will have  window.electronAPI === undefined  — safe fallback.
 */

'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Allowlisted IPC channels that the renderer may invoke.
 * Any channel not listed here is silently blocked.
 */
const ALLOWED_CHANNELS = [
  'open-file-dialog',
  'save-file-dialog',
  'write-file',
  'read-file',
  'ping-backend',
  'get-app-info',
  'open-external',
  'show-confirm-dialog',
]

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Opens a native file picker for CSV/XLS/XLSX datasets.
   * @param {object} [options] - Optional dialog options
   * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
   */
  openFileDialog: (options) =>
    ipcRenderer.invoke('open-file-dialog', options),

  /**
   * Opens a native save dialog for exports (models, reports, pipelines).
   * @param {object} [options] - { title, defaultPath, filters }
   * @returns {Promise<{canceled: boolean, filePath: string}>}
   */
  saveFileDialog: (options) =>
    ipcRenderer.invoke('save-file-dialog', options),

  /**
   * Writes content to a file path obtained from saveFileDialog.
   * @param {object} params - { filePath, content, encoding }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  writeFile: (params) =>
    ipcRenderer.invoke('write-file', params),

  /**
   * Reads a file from disk (e.g. CSV selected via openFileDialog).
   * Returns base64-encoded content.
   * @param {object} params - { filePath }
   * @returns {Promise<{success: boolean, content?: string, encoding?: string}>}
   */
  readFile: (params) =>
    ipcRenderer.invoke('read-file', params),

  /**
   * Pings the deployed Django backend to check internet/backend availability.
   * @returns {Promise<{reachable: boolean, status?: number}>}
   */
  pingBackend: () =>
    ipcRenderer.invoke('ping-backend'),

  /**
   * Returns app metadata (version, platform, isDev, URLs).
   * @returns {Promise<{version: string, platform: string, isDev: boolean, frontendUrl: string, backendUrl: string}>}
   */
  getAppInfo: () =>
    ipcRenderer.invoke('get-app-info'),

  /**
   * Opens a URL in the user's default browser (not in Electron).
   * @param {string} url
   * @returns {Promise<{success: boolean}>}
   */
  openExternal: (url) =>
    ipcRenderer.invoke('open-external', url),

  /**
   * Shows a native confirm dialog.
   * Useful for "unsaved changes" before closing a pipeline.
   * @param {object} [options] - { message, detail }
   * @returns {Promise<{confirmed: boolean}>}
   */
  showConfirmDialog: (options) =>
    ipcRenderer.invoke('show-confirm-dialog', options),

  /**
   * Generic safe invoke — only works for allowlisted channels.
   * @param {string} channel
   * @param {...any} args
   */
  invoke: (channel, ...args) => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Channel '${channel}' is not allowed`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  /**
   * Indicates this window is running inside Electron desktop.
   * React components check this before using desktop-only features:
   *   if (window.electronAPI?.isDesktop) { ... }
   */
  isDesktop: true,
})
