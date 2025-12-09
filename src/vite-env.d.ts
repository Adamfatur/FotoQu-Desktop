/// <reference types="vite/client" />

interface Window {
    fotoQuAPI: {
        savePhoto: (base64Data: string) => Promise<string>;
        getAppInfo: () => Promise<{ version: string; name: string }>;
        getSettings: () => Promise<{ outputFolder: string; printerName: string; accessToken: string; cameraDeviceId?: string; testMode?: boolean }>;
        saveSettings: (settings: { outputFolder: string; printerName: string; accessToken: string; cameraDeviceId?: string; testMode?: boolean }) => Promise<boolean>;
        getPrinters: () => Promise<Electron.PrinterInfo[]>;
        selectOutputFolder: () => Promise<string | null>;
        print: (filePath: string) => Promise<boolean>;
        onCameraChange: (callback: () => void) => void;
    }
}
