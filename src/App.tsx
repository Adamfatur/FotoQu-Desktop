import { useState } from 'react';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Capture } from './pages/Capture';
import { Preview } from './pages/Preview';
import { Settings } from './pages/Settings';
import { AnimatePresence, motion } from 'framer-motion';

type Screen = 'home' | 'capture' | 'preview' | 'settings';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessionSettings, setSessionSettings] = useState<any>(null);

  const handleStart = (sessionData: any, settings?: any) => {
    setCurrentSession(sessionData);
    if (settings) {
      setSessionSettings(settings);
    }
    setScreen('capture');
  };

  const handleCapture = (images: string[]) => {
    setCapturedImages(images);
    setScreen('preview');
  };

  const handleRetake = () => {
    setCapturedImages([]);
    setScreen('capture');
  };

  const handleSave = () => {
    setCapturedImages([]);
    setCurrentSession(null);
    setScreen('home');
  };

  const handleBackToHome = () => {
    setScreen('home');
  };

  const handleOpenSettings = () => {
    setScreen('settings');
  };

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {screen === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col h-full"
          >
            <Home onStart={handleStart} onSettings={handleOpenSettings} />
          </motion.div>
        )}

        {screen === 'capture' && (
          <motion.div
            key="capture"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col h-full"
          >
            <Capture
              onCapture={handleCapture}
              onBack={handleBackToHome}
              settings={sessionSettings}
            />
          </motion.div>
        )}

        {screen === 'preview' && capturedImages.length > 0 && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col h-full"
          >
            <Preview
              images={capturedImages}
              onRetake={handleRetake}
              onSave={handleSave}
              session={currentSession}
            />
          </motion.div>
        )}

        {screen === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 flex flex-col h-full"
          >
            <Settings onBack={handleBackToHome} />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

export default App;
