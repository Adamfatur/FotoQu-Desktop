# 📸 FotoQu Desktop App

A modern, feature-rich **Electron-based desktop application** for automated photobox operations. Built with **React**, **TypeScript**, and **Vite** for optimal performance and developer experience.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Electron](https://img.shields.io/badge/electron-%3E%3D30.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

- 📷 **Real-time Camera Capture** - Capture high-quality photos with customizable settings
- 🎬 **Instant GIF Generation** - Create animated GIFs from captured photos
- 🖼️ **Frame Selection** - Multiple frame designs for professional photobox output
- 📱 **Responsive UI** - Beautiful, intuitive interface built with React & Tailwind CSS
- ⚡ **Fast Performance** - Optimized with Vite for instant HMR and rapid builds
- 🔒 **Secure** - No external dependencies for sensitive operations
- 💾 **Direct Download** - Save photos and GIFs directly to device
- 🎨 **Customizable** - Frame designs, countdown timers, and capture settings

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **macOS** 10.15+ or **Windows** 10+ or **Linux** (Ubuntu 18.04+)

### Installation

```bash
# Clone the repository
git clone https://github.com/Adamfatur/FotoQu-Desktop.git
cd FotoQu-Desktop

# Install dependencies
npm install

# Start development server with Electron
npm run dev
```

### Build for Production

```bash
# Build the application
npm run build

# Package as DMG (macOS)
npm run build:mac

# Package as EXE (Windows)
npm run build:win

# Package as AppImage (Linux)
npm run build:linux
```

---

## 📁 Project Structure

```
FotoQu-Desktop/
├── electron/                 # Electron main process & preload scripts
│   ├── main.ts              # Main process entry point
│   ├── preload.cts          # Preload script for IPC
│   └── tsconfig.json        # TypeScript config for Electron
├── src/                      # React application source
│   ├── components/          # Reusable React components
│   │   ├── Button.tsx
│   │   ├── Layout.tsx
│   │   └── Preloader.tsx
│   ├── pages/               # Page components
│   │   ├── Home.tsx         # Home/welcome page
│   │   ├── Capture.tsx      # Camera capture interface
│   │   ├── Preview.tsx      # Photo/GIF preview
│   │   └── Settings.tsx     # Application settings
│   ├── hooks/               # Custom React hooks
│   │   └── useCamera.ts     # Camera management hook
│   ├── utils/               # Utility functions
│   │   ├── frameProcessing.ts  # Frame composition
│   │   └── gifGenerator.ts     # GIF creation
│   ├── assets/              # Images, audio, fonts
│   │   ├── camera.wav       # Shutter sound
│   │   └── timer.mp3        # Countdown sound
│   └── main.tsx             # React entry point
├── public/                   # Static assets
│   ├── Frame-Fotoqu.jpg     # Frame template
│   ├── icon.png             # App icon
│   └── gif.worker.js        # Web Worker for GIF processing
├── dist/                     # Built React app (web assets)
├── dist-electron/           # Compiled Electron process
├── package.json             # Dependencies & scripts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

---

## 📦 Available Scripts

```bash
# Development
npm run dev              # Start dev server with Electron

# Building
npm run build            # Build React app + Electron
npm run build:mac        # Build macOS distribution
npm run build:win        # Build Windows distribution
npm run build:linux      # Build Linux distribution

# Code Quality
npm run lint             # Run ESLint
npm run preview          # Preview production build

# Cleaning
npm run clean            # Remove build artifacts
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Electron 30+ |
| **UI Framework** | React 18+ |
| **Language** | TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS |
| **IPC** | Electron IPC Channel |
| **GIF Generation** | gif.js |
| **Code Quality** | ESLint |

---

## 🔧 Configuration

### Camera Settings

Edit camera capture parameters in `src/hooks/useCamera.ts`:

```typescript
const CAMERA_CONFIG = {
  width: 1920,
  height: 1080,
  frameRate: 30,
  facingMode: 'user'
};
```

### Frame Templates

Customize frame designs in `src/utils/frameProcessing.ts`:

```typescript
const frames = {
  '6_slots': { cols: 3, rows: 2, spacing: 10 },
  '4_slots': { cols: 2, rows: 2, spacing: 15 },
  '2_slots': { cols: 2, rows: 1, spacing: 20 }
};
```

### GIF Settings

Configure GIF generation in `src/utils/gifGenerator.ts`:

```typescript
const GIF_CONFIG = {
  workers: 2,
  quality: 10,
  fps: 3,
  duration: 1500
};
```

---

## 📋 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| OS | Windows 10 / macOS 10.15 / Ubuntu 18.04 | Latest stable |
| RAM | 2GB | 4GB+ |
| Storage | 200MB | 500MB |
| Camera | USB/Built-in | HD (720p+) |

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🐛 Troubleshooting

### Camera Not Working

- Ensure camera permissions are granted to the application
- Check device camera hardware compatibility
- Restart the application

### GIF Generation Slow

- Close other applications to free up system resources
- Reduce image quality in settings
- Use fewer photo slots

### Build Fails

```bash
# Clear cache and reinstall
rm -rf node_modules dist dist-electron
npm install
npm run build
```

---

## 📞 Support

For issues, questions, or suggestions:
- Open an [Issue](https://github.com/Adamfatur/FotoQu-Desktop/issues)
- Check [Discussions](https://github.com/Adamfatur/FotoQu-Desktop/discussions)
- Email: adam.faturahman@raharja.info

---

## 🔗 Related Projects

- **[FotoQu Web Admin](https://github.com/Adamfatur/Fotoqu-Acaraqu)** - Backend & Web Administration Panel

---

**Made with ❤️ by Adamfatur**
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
