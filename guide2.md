# Technical Implementation Guide: FotoQu
**Doc Type:** Technical Standards & Architecture Rules
**Target:** AI Agent (Cursor/Copilot/Devin)

## 1. Project Structure & Tech Stack
**Pattern:** Monorepo-style (Vite + Electron)
Agent wajib mengikuti struktur direktori ini untuk memisahkan *Main Process* dan *Renderer Process* demi keamanan dan performa build.

```text
root/
├── electron/
│   ├── main.ts              # Electron Entry Point (Window creation, Native Handlers)
│   └── preload.ts           # Context Bridge (Secure IPC Expose)
├── src/                     # React Renderer (UI)
│   ├── assets/              # Static files (images, fonts)
│   ├── components/          # Shared Components (Button, Card, Modal)
│   ├── hooks/               # Custom Logic (useCamera, useFileSystem)
│   ├── pages/               # Route Views (Home, Capture, Preview)
│   ├── styles/              # Global CSS & Tailwind Directives
│   ├── App.tsx              # Root Component
│   └── main.tsx             # React Entry Point
├── dist/                    # Build output (Renderer)
├── dist-electron/           # Build output (Main Process)
├── electron-builder.yml     # Configuration for .exe/.dmg
└── package.json             # Scripts & Dependencies
2. Security & Communication Rules (IPC)
CRITICAL RULE: UI (React) DILARANG mengakses module Node.js (seperti fs, path, child_process) secara langsung.

A. Preload Script (electron/preload.ts)
Gunakan contextBridge untuk mengekspos API secara aman ke window.

Namespace: window.fotoQuAPI

Allowed Methods:

savePhoto(base64Data: string): Promise<string> -> Mengembalikan file path.

getAppInfo(): Promise<Object> -> Versi app, dll.

onCameraChange(callback): void -> Listener jika USB dicabut/pasang.

B. Main Process (electron/main.ts)
Gunakan ipcMain untuk menangani logika berat.

Image Processing: Konversi Base64 ke Buffer dan penulisan file ke disk (fs.writeFileSync) harus terjadi di sini, bukan di UI.

Pathing: Gunakan app.getPath('pictures') agar dinamis mengikuti OS user (Windows/Mac).

3. Hardware Management (Camera Logic)
Implementasi kamera harus ditangani menggunakan React Custom Hooks untuk memisahkan UI dan Logika.

Hook Spec: useCamera

Initialization: Jalankan navigator.mediaDevices.enumerateDevices() saat mount.

Filtering: Hanya ambil device dengan kind === 'videoinput'.

Auto-Select Logic:

Jika 1 kamera: Pilih otomatis.

Jika >1 kamera: Pilih yang memiliki label "USB" atau resolusi tertinggi (opsional), atau default ke index 0.

Error Handling: Tangani error NotAllowedError (Permission denied) dan NotFoundError (Kamera dicabut).

Stream Management: Pastikan .getTracks().forEach(t => t.stop()) dipanggil sebelum mengganti source kamera atau saat komponen unmount (Memory Leak prevention).

4. UI/UX Implementation Standards
Gunakan Tailwind CSS dengan panduan berikut untuk mencapai nuansa "Profesional & Kiosk":

No Select: Terapkan class select-none pada body/root agar user tidak bisa memblok teks/gambar.

No Drag: Terapkan -webkit-user-drag: none pada elemen <img> agar user tidak bisa men-drag gambar hantu.

Responsive Layout:

Gunakan flex atau grid untuk centering konten.

Gunakan unit vh dan vw agar elemen proporsional di layar laptop maupun monitor besar.

Touch Targets: Semua tombol interaktif minimal memiliki min-h-[44px] dan min-w-[44px] (standar aksesibilitas layar sentuh).

5. Build Configuration (Zero-Config Deployment)
Konfigurasi electron-builder.yml harus disiapkan untuk menghasilkan installer mandiri.

AppId: com.fotoqu.app

Directories:

output: release

Mac:

target: dmg

hardenedRuntime: true (Agar bisa jalan di macOS modern).

entitlements: Pastikan meminta izin kamera di entitlements.mac.plist.

Windows:

target: nsis (Standard Installer).

oneClick: false (Agar user bisa memilih lokasi install jika mau, tapi default tetap C:).

allowToChangeInstallationDirectory: true.

6. Development Checklist
Sebelum menandai tugas selesai, Agent harus memverifikasi:

[ ] Aplikasi berjalan tanpa error di console DevTools.

[ ] Kamera bisa di-switch jika ada lebih dari satu input.

[ ] Foto tersimpan di folder Pictures/FotoQu_Gallery secara otomatis.

[ ] Tampilan tidak "pecah" saat window di-resize.

[ ] Tidak ada warning keamanan Electron (seperti remote module enabled).