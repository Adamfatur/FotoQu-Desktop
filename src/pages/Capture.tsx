import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useCamera } from '../hooks/useCamera';
import { Button } from '../components/Button';

// Import sound assets
import timerSoundFile from '../assets/timer.mp3';
import shutterSoundFile from '../assets/camera.wav';

interface CaptureProps {
    onCapture: (images: string[]) => void;
    onBack: () => void;
    settings?: any;
}

export const Capture = ({ onCapture, onBack, settings }: CaptureProps) => {
    const { videoRef, activeDeviceId, setActiveDeviceId, devices, captureImage, error } = useCamera();

    const [status, setStatus] = useState<'idle' | 'countdown' | 'capturing'>('idle');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [currentShot, setCurrentShot] = useState(1);
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [flash, setFlash] = useState(false);
    const [message, setMessage] = useState("");

    // Use settings or defaults
    // Prioritize passed settings
    const TOTAL_SHOTS = parseInt(settings?.total_photos) || 3;
    const COUNTDOWN_SECONDS = parseInt(settings?.countdown_seconds) || 3;
    const INTERVAL_SECONDS = parseInt(settings?.photo_interval_seconds) || 3;

    // Sound Effects
    const [timerSound] = useState(new Audio(timerSoundFile));
    const [shutterSound] = useState(new Audio(shutterSoundFile));

    useEffect(() => {
        // Preload sounds
        timerSound.load();
        shutterSound.load();
    }, []);

    const startSession = () => {
        setCapturedPhotos([]);
        setCurrentShot(1);
        startCountdown();
    };

    const startCountdown = () => {
        setStatus('countdown');
        setCountdown(COUNTDOWN_SECONDS);
        updateMessageForShot(capturedPhotos.length + 1);

        // Play timer sound from start
        timerSound.currentTime = 0;
        timerSound.play().catch(e => console.log("Audio play failed", e));
    };

    const updateMessageForShot = (shotNum: number) => {
        switch (shotNum) {
            case 1:
                setMessage("Ayo senyum yang manis! 😊");
                break;
            case 2:
                setMessage("Gaya bebas dong! ✌️");
                break;
            case 3:
                setMessage("Terakhir, yang paling keren! 😎");
                break;
            default:
                setMessage("Siap-siap...");
        }
    };

    useEffect(() => {
        // Auto start session when component mounts
        startSession();

        // Cleanup sounds on unmount
        return () => {
            timerSound.pause();
            timerSound.currentTime = 0;
        };
    }, []);

    useEffect(() => {
        if (status !== 'countdown' || countdown === null) return;

        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            capture();
        }
    }, [countdown, status]);

    // Handle flow after a photo is captured
    useEffect(() => {
        if (capturedPhotos.length === 0) return;

        if (capturedPhotos.length < TOTAL_SHOTS) {
            // Prepare next shot
            setFlash(false);
            setCurrentShot(capturedPhotos.length + 1);

            // Start next countdown after interval
            const intervalTimer = setTimeout(() => {
                startCountdown();
            }, INTERVAL_SECONDS * 1000);
            return () => clearTimeout(intervalTimer);
        } else {
            // Finished
            setFlash(false);
            setMessage("Sempurna! ✨");

            // Ensure timer sound is stopped
            timerSound.pause();
            timerSound.currentTime = 0;

            setTimeout(() => {
                onCapture(capturedPhotos);
            }, 1000);
        }
    }, [capturedPhotos]);

    const capture = () => {
        // Stop timer sound immediately when capturing
        timerSound.pause();
        timerSound.currentTime = 0;

        setStatus('capturing');
        setFlash(true);
        setMessage("Cekrek! 📸");

        // Play shutter sound
        shutterSound.currentTime = 0;
        shutterSound.play().catch(e => console.log("Shutter sound failed", e));

        setTimeout(() => {
            const image = captureImage();
            if (image) {
                setCapturedPhotos(prev => [...prev, image]);
            } else {
                setFlash(false);
                setStatus('idle');
            }
        }, 150);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-black relative overflow-hidden">
            {/* Flash Overlay */}
            <AnimatePresence>
                {flash && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 bg-white z-50 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* DEBUG OVERLAY - REMOVE IN PRODUCTION */}
            <div className="absolute top-2 left-2 z-[100] text-[10px] text-white/50 font-mono pointer-events-none">
                CAM: {TOTAL_SHOTS} shots | CD: {COUNTDOWN_SECONDS}s
            </div>

            {/* Camera View */}
            <div className="flex-1 relative h-full flex items-center justify-center bg-black">
                <div className="relative w-full h-full max-w-[177.78vh] aspect-video overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                    />
                </div>

                {/* Countdown Overlay */}
                <AnimatePresence>
                    {status === 'countdown' && countdown !== null && countdown > 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/10 backdrop-blur-[2px]">
                            <motion.div
                                key={countdown}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1.5, opacity: 1 }}
                                exit={{ scale: 2, opacity: 0 }}
                                className="text-[12rem] font-black text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] leading-none"
                                style={{ textShadow: '0 0 60px rgba(255,255,255,0.8)' }}
                            >
                                {countdown}
                            </motion.div>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl text-white font-bold mt-8 drop-shadow-lg text-center px-4"
                            >
                                {message}
                            </motion.p>
                        </div>
                    )}
                </AnimatePresence>

                {/* Session Progress & Message Overlay */}
                {status !== 'idle' && (
                    <div className="absolute top-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
                        <div className="bg-black/30 backdrop-blur-md px-8 py-4 rounded-full border border-white/20 shadow-lg flex flex-col items-center gap-1">
                            <p className="text-white font-bold text-xl tracking-wide">
                                Foto {currentShot} / {TOTAL_SHOTS}
                            </p>
                            {status !== 'countdown' && (
                                <p className="text-yellow-300 font-medium text-lg animate-pulse">
                                    {message}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
                        <div className="text-white text-center p-8">
                            <p className="text-xl mb-4 text-red-400">{error}</p>
                            <Button onClick={onBack} variant="outline">Kembali</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute inset-0 flex flex-col justify-center items-center z-40 pointer-events-none">
                {/* Only show back button if needed, or hidden controls */}
                <div className="absolute top-8 left-8 pointer-events-auto">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onBack}
                        className="bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-md px-6 rounded-full"
                    >
                        Batal
                    </Button>
                </div>
            </div>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl p-6 z-40 shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Pengaturan Kamera</h3>
                            <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)}>Tutup</Button>
                        </div>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                            {devices.map(device => (
                                <button
                                    key={device.deviceId}
                                    onClick={() => {
                                        setActiveDeviceId(device.deviceId);
                                        setShowSettings(false);
                                    }}
                                    className={`w-full p-4 text-left rounded-xl transition-colors ${activeDeviceId === device.deviceId
                                        ? 'bg-blue-50 text-blue-600 font-semibold'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                >
                                    {device.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
