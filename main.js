const { app, Tray, Menu, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { startExpressServer } = require('./print-server');
require('dotenv').config();

let tray = null;
let win = null;

const logPath = path.join(app.getPath('userData'), 'log.txt');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + '\n');
}

function createHiddenWindow() {
  log('Creating hidden window...');
  win = new BrowserWindow({
    show: false,
    skipTaskbar: true,
  });
}

app.whenReady().then(() => {
  log('App is ready. Starting server...');
  try {
  startExpressServer();
  log('Express server started.');
} catch (err) {
  log('❌ Failed to start server: ' + err.message);
}

  createHiddenWindow();

  let iconPath;
  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, 'icon.ico');
  } else {
    iconPath = path.join(__dirname, 'icon.ico');
  }

  log('Icon path: ' + iconPath);

  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    log('❌ Failed to load icon, using fallback.');
    trayIcon = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABcUlEQVQ4T7XTP0hCURjH8Y8/1klAo7LgFjECLMIKXQ9YIYpkIBYmlRzLZ0jcVjZh6HESoIfAHV0S4IggQfgSBjQsHF5cSPeTezuea7tn0m8mV0fP08rOeB70YJ7LEmSloMf8E1x6oNW/8VwwV3Umu8r2f4tROt9C3yGOBv4UVRYPchFuhbhqYV4ml/wEY0poAN8z7Hdc61RfW6dYrLIVfM5vOEcegMpsYr/wFu52yqV9URCM5kNd5rX8I0p5zYba1i3+JR1nFjLshZ1KmwNZqbiHb+FzLgBnIdQv6v9E7CqD+L6RbdNJ7C1qYH4HcobIUfjfELeSv4pnZg9/AuL7xJrLU7QRAAAAAElFTkSuQmCC',
        'base64'
      )
    ); // tiny PNG fallback
  }

  tray = new Tray(trayIcon);
  log('✅ Tray created.');

  const Port = process.env.PORT || 3001;
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Printer Server is running', enabled: false },
    { label: 'Port: ' + Port, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('Asas Print App');
  tray.setContextMenu(contextMenu);

  if (process.platform === 'darwin') app.dock.hide();

  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
  });

  log('Tray setup finished.');
});

// catch crashes
process.on('uncaughtException', (err) => {
  log('Uncaught Exception: ' + err.message);
  log(err.stack);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
