# Project Blueprint: FotoQu - Professional Desktop Photobooth

## 1. Project Overview
**Nama Aplikasi:** FotoQu
**Tipe:** Aplikasi Desktop Cross-Platform (macOS & Windows).
**Tujuan:** Menyediakan solusi photobooth profesional yang "Plug-and-Play". Aplikasi harus berjalan stabil, mendeteksi hardware otomatis, dan mudah digunakan oleh orang awam tanpa konfigurasi teknis yang rumit.

## 2. Tech Stack & Architecture
Gunakan teknologi berikut untuk menjamin performa, kemudahan pengembangan, dan stabilitas:

* **Core:** Electron (Latest Stable Version).
* **Frontend Framework:** React (menggunakan Vite untuk performa tinggi).
* **Language:** TypeScript (Wajib, untuk meminimalisir bug saat runtime).
* **Styling:** Tailwind CSS (Untuk styling responsif dan cepat).
* **Build Tool:** Electron-Builder (Untuk output .exe dan .dmg yang siap pakai).

## 3. UI/UX Design System
Desain harus terlihat bersih, modern, dan profesional.
* **Warna Dominan:** Biru (Royal/Modern Blue) sebagai warna utama elemen interaktif.
* **Warna Sekunder:** Putih (Clean White) sebagai background utama.
* **Layout:**
    * **Responsive:** Elemen UI harus menyesuaikan diri dengan berbagai ukuran layar (dari layar laptop hingga monitor eksternal besar).
    * **Kiosk Mode:** Aplikasi didesain untuk berjalan Fullscreen tanpa border window standar OS.
    * **Touch Friendly:** Tombol harus besar dan jelas, meminimalisir penggunaan mouse/keyboard.

## 4. Fitur Fungsional & Logika Bisnis

### A. Manajemen Hardware (Kamera)
1.  **Auto-Detection:** Saat aplikasi dijalankan, sistem harus memindai semua input video (`videoinput`) yang tersedia.
2.  **Smart Selection:** Secara default, sistem memilih kamera dengan kapabilitas resolusi tertinggi.
3.  **Manual Override:** Sediakan menu pengaturan (tersembunyi atau kecil di pojok) yang memungkinkan user memilih kamera secara spesifik dari daftar drop-down jika terdapat lebih dari satu kamera.
4.  **Hot-Plug:** Aplikasi harus mampu mendeteksi jika kamera dicabut atau dicolok ulang tanpa crash.

### B. Alur Pengguna (User Flow)
1.  **Standby Screen:** Menampilkan animasi atau teks ajakan (misal: "Sentuh Layar untuk Foto") dengan tema Biru/Putih.
2.  **Live Preview:** Menampilkan feed kamera secara real-time (Mirroring aktif).
3.  **Countdown:** Menampilkan hitung mundur (3, 2, 1) visual di tengah layar sebelum capture.
4.  **Capture Action:** Layar berkedip putih (Flash effect) saat foto diambil.
5.  **Review Result:** Menampilkan hasil foto statis.
6.  **Action:** Opsi "Simpan" (lanjut ke sesi baru) atau "Ulang" (kembali ke preview).

### C. Manajemen Penyimpanan (Local Storage)
* **Tanpa Database Rumit:** Jangan gunakan SQL/LocalDB yang kompleks.
* **File System:** Simpan hasil foto langsung ke hard drive lokal komputer.
* **Path Otomatis:**
    * Buat folder bernama `FotoQu_Gallery` di direktori `Pictures` atau `Documents` milik user.
    * Jangan meminta user memilih folder setiap kali foto diambil (Zero friction).
* **Format File:** `.jpg` atau `.png` dengan penamaan berbasis waktu (`YYYY-MM-DD_HH-mm-ss.jpg`).

## 5. Deployment & Distribusi (Zero Config)
Agen harus memastikan struktur proyek mendukung kemudahan instalasi:
* Aplikasi harus dibungkus menjadi **Single Installer** (`setup.exe` untuk Windows, `.dmg` untuk Mac).
* Hindari keharusan user menginstall Python, Node.js, atau driver tambahan secara manual. Semua dependensi harus ter-bundle di dalam aplikasi Electron.
* Aplikasi harus bisa berjalan **Offline** total.

## 6. Instruksi Khusus untuk AI Agent
* **Prioritas:** Fokus pada stabilitas akses kamera. Gunakan Web API standar (`navigator.mediaDevices`) yang dibungkus dalam Electron.
* **Keamanan:** Pastikan `Context Isolation` aktif dan gunakan `IPC Bridge` untuk komunikasi antara UI (React) dan System (Electron/Node.js) saat proses penyimpanan file.
* **Simplicity:** Jangan menambahkan fitur login, cloud upload, atau sosial media share kecuali diminta. Fokus pada kecepatan capture dan save.