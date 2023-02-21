const {app, BrowserWindow,} = require('electron');
const { on } = require('events');
const path = require('path');
const express = require('./server');
let mainWindow;
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 750,
    minWidth: 1366,
    minHeight: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      nativeWindowOpen: true, 
      allowRunningInsecureContent:  true 
    },
    autoHideMenuBar: true,
    fullscreen: false,
    show: false,
    icon: "dist/assets/img/fingerprint.png"
  });

  mainWindow.maximize();

  mainWindow.show(); 
  mainWindow.loadURL('http://localhost:3000/');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // TODO: find out what the user is downloading and set options accordingly
    item.setSaveDialogOptions({
      filters: [
        {name: "Data Base", extensions: ["db"]},
        {name: "JSON", extensions: ["json"]},
        {name: "Excel File", extensions: ["xlsx"]},
        {name: 'All Files', extensions: ['*']}
      ],
      message: "حفظ الملف"
    });
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
 if (mainWindow === null) createWindow();
});
