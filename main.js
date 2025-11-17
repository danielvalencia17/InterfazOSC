const { app, BrowserWindow, ipcMain } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 530,
    height: 420,
    frame: false,
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile("index.html");

  // --- Cerrar ventana ---
  ipcMain.on("cerrar-ventana", () => {
    win.close();
  });

  // --- Minimizar ventana ---
  ipcMain.on("minimizar-ventana", () => {
    win.minimize();
  });
}

app.whenReady().then(createWindow);
