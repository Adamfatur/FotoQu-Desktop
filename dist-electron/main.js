import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}
let mainWindow = null;
// Settings Management
const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const loadSettings = () => {
    try {
        const settingsPath = getSettingsPath();
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }
    }
    catch (error) {
        console.error('Error loading settings:', error);
    }
    // Default settings
    return {
        outputFolder: path.join(app.getPath('pictures'), 'FotoQu_Gallery'),
        printerName: '',
        accessToken: ''
    };
};
const saveSettingsToDisk = (settings) => {
    try {
        fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
        return true;
    }
    catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
};
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        // Kiosk mode settings
        // fullscreen: true, // Uncomment for production kiosk mode
        // kiosk: true, // Uncomment for production kiosk mode
        // autoHideMenuBar: true,
        icon: path.join(__dirname, process.env.NODE_ENV === 'development' ? '../public/icon.png' : '../dist/icon.png'),
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// IPC Handlers
ipcMain.handle('save-photo', async (event, base64Data) => {
    try {
        const settings = loadSettings();
        const galleryPath = settings.outputFolder;
        if (!fs.existsSync(galleryPath)) {
            fs.mkdirSync(galleryPath, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `FotoQu_${timestamp}.jpg`;
        const filePath = path.join(galleryPath, filename);
        const base64Image = base64Data.split(';base64,').pop();
        if (base64Image) {
            fs.writeFileSync(filePath, base64Image, { encoding: 'base64' });
            return filePath;
        }
        else {
            throw new Error('Invalid base64 data');
        }
    }
    catch (error) {
        console.error('Error saving photo:', error);
        throw error;
    }
});
ipcMain.handle('get-app-info', () => {
    return {
        version: app.getVersion(),
        name: app.getName(),
    };
});
// New IPC Handlers for Settings & Printing
ipcMain.handle('get-settings', () => {
    return loadSettings();
});
ipcMain.handle('save-settings', (event, settings) => {
    return saveSettingsToDisk(settings);
});
ipcMain.handle('get-printers', async () => {
    if (mainWindow) {
        return mainWindow.webContents.getPrintersAsync();
    }
    return [];
});
ipcMain.handle('select-output-folder', async () => {
    if (!mainWindow)
        return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});
ipcMain.handle('print-file', async (event, filePath) => {
    if (!mainWindow)
        return false;
    const settings = loadSettings();
    const printerName = settings.printerName;
    // In a real Electron app, printing an image file silently to a specific printer 
    // can be tricky without using a hidden window or specific print logic.
    // For simplicity, we'll try to use the built-in print function on a hidden window
    // or just print the current window content if that was the request, but here we want to print a file.
    // A common approach is to create a hidden window, load the image, and print it.
    return new Promise((resolve, reject) => {
        const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        printWindow.loadFile(filePath);
        printWindow.webContents.on('did-finish-load', () => {
            printWindow.webContents.print({
                silent: true,
                deviceName: printerName || undefined,
                printBackground: true,
                color: true,
                // Adjust these for 4R/Postcard if needed, but usually printer driver handles it
                // copies: 1
            }, (success, errorType) => {
                if (!success) {
                    console.error("Print failed:", errorType);
                    resolve(false);
                }
                else {
                    resolve(true);
                }
                printWindow.close();
            });
        });
        // Handle load errors
        printWindow.webContents.on('did-fail-load', () => {
            printWindow.close();
            resolve(false);
        });
    });
});
