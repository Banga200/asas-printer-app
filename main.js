const { app, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { startExpressServer } = require('./print-server'); // ← Your Express API

let tray = null;

app.whenReady().then(() => {
  startExpressServer(); // Start the print server

  tray = new Tray(path.join(__dirname, 'icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Printer Server is running', enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('Asas Print App');
  tray.setContextMenu(contextMenu);

  // Remove dock icon on macOS
  if (process.platform === 'darwin') app.dock.hide();
});
 app.setLoginItemSettings({
  openAtLogin: true,
  path: process.execPath,
 })
// Don't quit on window close
app.on('window-all-closed', (e) => {
  e.preventDefault();
});
