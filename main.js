const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      allowRunningInsecureContent: true,
      // Esto es clave 👇
      media: {
        audio: true,
        video: true
      }
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
