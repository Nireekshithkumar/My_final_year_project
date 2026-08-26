# NeuralCanvas Desktop

A standalone Windows desktop application for **NeuralCanvas** — visual drag-and-drop machine learning pipeline builder.

## Overview

- **Architecture:** Electron + React (shared UI) + Deployed Django Backend
- **Target OS:** Windows 10 / 11 (x64)
- **Security:** `nodeIntegration: false`, `contextIsolation: true`, Preload IPC sandbox
- **Backend:** Communicates with the deployed NeuralCanvas backend (`https://neuralcanvas-backend.onrender.com/api`) and WebSocket server (`wss://neuralcanvas-backend.onrender.com/ws`)

> **Note:** The desktop application requires an active internet connection to communicate with the deployed Django REST API and Daphne WebSocket backend.

---

## Prerequisites

1. **Node.js** v18+ (tested on Node.js v22.20.0 and npm 10.9.3)
2. **Git**
3. **Windows 10 / 11** for packaging `.exe` installers

---

## Installation

From the repository root:

```bash
# Install desktop dependencies
cd desktop
npm install
```

Or from the root workspace:

```bash
npm run desktop:install
```

---

## Development Mode

1. **Start the local Vite frontend** (in one terminal):
   ```bash
   cd neuralcanvas-frontend
   npm run dev
   ```

2. **Start Electron in dev mode** (in another terminal):
   ```bash
   cd desktop
   npm run desktop:dev
   ```

Electron will launch and load `http://localhost:5173` with DevTools enabled.

---

## Production Build & Packaging

To package the desktop application into a Windows installer and portable `.exe`:

```bash
cd desktop
npm run desktop:dist
```

### Generated Artifacts

Outputs are placed in the `desktop/dist-electron/` folder:

| File | Description |
|---|---|
| `NeuralCanvas Setup 1.0.0.exe` | Standard Windows NSIS Installer (with Desktop shortcut & Start Menu entry) |
| `NeuralCanvas-1.0.0-portable.exe` | Portable standalone executable (no installation required) |

---

## Configuration (`.env`)

Create a `.env` file inside `/desktop` (or copy from `.env.example`):

```env
# URL to load in the Electron window
DESKTOP_FRONTEND_URL=https://neuralcanvasteam.vercel.app

# Backend API
VITE_API_BASE_URL=https://neuralcanvas-backend.onrender.com/api

# WebSocket Server
VITE_WS_BASE_URL=wss://neuralcanvas-backend.onrender.com/ws
```

---

## Features

- ⚡ **Native File Dialogs:** Seamlessly browse `.csv`, `.xlsx`, and `.xls` files directly using Windows Explorer.
- 📐 **Persistent Window State:** Remembers window geometry and maximized state between sessions.
- 🔄 **Reconnection & Resilience:** Automatic WebSocket reconnection with capped exponential backoff.
- 🔒 **Enterprise-Grade Isolation:** Secure preload bridge prevents renderer code from accessing Node.js internals.
- 🌐 **Offline Protection:** Graceful fallback screen when the internet or backend is unreachable with a one-click Retry button.
