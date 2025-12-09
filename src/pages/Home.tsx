import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { Button } from '../components/Button';
import { useCamera } from '../hooks/useCamera';
import { Preloader } from '../components/Preloader';
import logoKotak from '../assets/logo-fotoku-kotak.png';

interface HomeProps {
    onStart: (sessionData: any, settings?: any) => void;
    onSettings?: () => void;
}

export const Home = ({ onStart, onSettings }: HomeProps) => {
    const [isPolling, setIsPolling] = useState(true);
    const [statusMessage, setStatusMessage] = useState('Menunggu sesi dari admin...');
    const [accessToken, setAccessToken] = useState('');
    const [sessionReady, setSessionReady] = useState<any>(null);
    const [branding, setBranding] = useState<{ name?: string, logo?: string } | null>(null);
    const [isTestMode, setIsTestMode] = useState(false);
    const [sessionSettings, setSessionSettings] = useState<any>(null);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        const initAndPoll = async () => {
            // 1. Get configured access token & settings
            let token = accessToken;
            let testMode = false;

            if (window.fotoQuAPI) {
                const settings = await window.fotoQuAPI.getSettings();
                if (settings.accessToken) {
                    token = settings.accessToken;
                    setAccessToken(token);
                }
                if (settings.testMode) {
                    testMode = settings.testMode;
                    setIsTestMode(true);
                }
            }

            // Fetch System Settings (Fallback)
            try {
                const settingsResp = await fetch('https://fotoqu.acaraqu.com/api/v1/desktop/settings');
                if (settingsResp.ok) {
                    const settingsData = await settingsResp.json();
                    if (settingsData.success && settingsData.settings) {
                        // Map specific fields to expected flat format
                        const flatSettings = {
                            total_photos: settingsData.settings.photo?.photo_count,
                            countdown_seconds: settingsData.settings.photo?.countdown_seconds,
                            photo_interval_seconds: settingsData.settings.photo?.photo_interval_seconds,
                            ...settingsData.settings
                        };
                        setSessionSettings(flatSettings);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch system settings", err);
            }

            if (testMode) {
                // Test Mode: Skip polling, show ready state immediately
                setIsPolling(false);
                setSessionReady({
                    session_code: 'TEST-MODE-' + Math.floor(Math.random() * 1000),
                    customer_name: 'Test User',
                    frame_slots: 3, // Default slots
                    isTestMode: true
                });
                setStatusMessage('Mode Testing Aktif');
                return;
            }

            if (!token) {
                setStatusMessage('Token akses belum dikonfigurasi.');
                setIsPolling(false);
                return;
            }

            // 2. Define polling function
            const checkSession = async () => {
                try {
                    const response = await fetch(`https://fotoqu.acaraqu.com/api/v1/desktop/check-session`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                        cache: 'no-store'
                    });

                    if (response.ok) {
                        const data = await response.json();

                        // Update branding if available
                        if (data.photobox) {
                            setBranding({
                                name: data.photobox.name,
                                logo: data.photobox.settings?.logo || data.photobox.settings?.logo_url
                            });
                        }

                        if (data.available && data.session) {
                            // Session found! Stop polling and show ready screen
                            setIsPolling(false);
                            setSessionReady(data.session);
                            setStatusMessage('Sesi Siap!');
                        }
                    } else if (response.status === 401) {
                        setStatusMessage('Token akses tidak valid atau kadaluarsa.');
                        setIsPolling(false);
                    }
                } catch (error) {
                    console.error("Polling error:", error);
                }
            };

            // 3. Start polling
            if (isPolling) {
                intervalId = setInterval(checkSession, 3000);
            }
        };

        initAndPoll();

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isPolling, accessToken]);

    const handleExitTestMode = async () => {
        if (window.fotoQuAPI) {
            const settings = await window.fotoQuAPI.getSettings();
            await window.fotoQuAPI.saveSettings({ ...settings, testMode: false });
            window.location.reload();
        }
    };

    const handleStartSession = async () => {
        if (!sessionReady) return;

        if (isTestMode) {
            // In Test Mode, just start immediately without API call
            onStart(sessionReady, sessionSettings);
            return;
        }

        try {
            setStatusMessage('Memulai sesi...');

            const response = await fetch('https://fotoqu.acaraqu.com/api/v1/desktop/start-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    session_code: sessionReady.session_code
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Merge system settings with session settings
                const mergedSettings = { ...sessionSettings, ...data.settings };
                onStart(data.session, mergedSettings);
            } else {
                setStatusMessage('Gagal memulai sesi. Silakan coba lagi.');
            }
        } catch (error) {
            console.error("Start session error:", error);
            setStatusMessage('Terjadi kesalahan koneksi.');
        }
    };

    const getLogoUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `https://fotoqu.acaraqu.com/storage/${path}`;
    };

    const { videoRef, stream } = useCamera();

    useEffect(() => {
        if (sessionReady && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [sessionReady, stream]);

    if (sessionReady) {
        return (
            <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-black">
                {/* Live Camera Background */}
                <div className="absolute inset-0 z-0">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                </div>

                {/* Test Mode Exit Button (Overlay) */}
                <div className="absolute top-8 right-8 z-50 flex gap-2">
                    {isTestMode && (
                        <Button
                            onClick={handleExitTestMode}
                            variant="outline"
                            className="bg-red-600/90 text-white border-red-500 hover:bg-red-700 backdrop-blur-md shadow-lg"
                        >
                            Keluar Mode Testing
                        </Button>
                    )}
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-12 px-8 text-center">
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl max-w-4xl w-full text-white"
                    >
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 text-left space-y-4">
                                <div>
                                    <h2 className="text-4xl font-black text-white mb-2">
                                        Halo, {sessionReady.customer_name || 'Kakak'}! ✨
                                    </h2>
                                    <p className="text-xl text-blue-100 font-medium">
                                        Wah, kamu kelihatan keren hari ini! Sudah siap untuk berpose?
                                    </p>
                                </div>

                                <div className="inline-block bg-white/10 px-4 py-2 rounded-lg border border-white/10">
                                    <p className="text-sm font-mono text-brand-picton">
                                        {sessionReady.is_event_mode ? (
                                            <span className="text-white font-bold tracking-wider">EVENT MODE: {sessionReady.event_name}</span>
                                        ) : (
                                            <>Kode Sesi: <span className="text-white font-bold tracking-wider">{sessionReady.session_code}</span></>
                                        )}
                                    </p>
                                </div>

                                <div className="space-y-2 text-blue-50">
                                    <p className="font-bold text-lg text-brand-picton">Tips Foto Seru:</p>
                                    <ul className="space-y-1 text-base">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                                            <span>Kita akan ambil <b>{sessionSettings?.total_photos || 3} foto kece</b> berturut-turut.</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                                            <span>Tenang, ada waktu <b>{sessionSettings?.countdown_seconds || 3} detik</b> buat ganti gaya.</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                                            <span>Jadi diri sendiri dan tunjukkan senyum terbaikmu! 📸</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="w-full md:w-auto flex flex-col gap-4">
                                <Button
                                    size="xl"
                                    onClick={handleStartSession}
                                    className="w-full md:w-64 h-16 text-xl bg-brand-curious hover:bg-brand-picton text-white shadow-lg shadow-brand-curious/40 border-0"
                                >
                                    Siap? Yuk Mulai! 🚀
                                </Button>
                                <p className="text-xs text-blue-200/60 text-center">
                                    Pastikan posisi kamu pas di tengah layar ya!
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-slate-50">
            {/* Background Animation */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-curious/30 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-orange/30 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            {/* Settings Button */}
            <div className="absolute top-8 right-8 z-20 flex gap-2">
                {isTestMode && (
                    <Button
                        onClick={handleExitTestMode}
                        variant="outline"
                        className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-sm"
                    >
                        Keluar Mode Testing
                    </Button>
                )}
                {onSettings && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSettings}
                        className="bg-white/50 hover:bg-white/80 backdrop-blur-sm shadow-sm p-2"
                    >
                        <Settings className="w-6 h-6 text-slate-600" />
                    </Button>
                )}
            </div>

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
            >
                <div className="w-40 h-40 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-brand-curious/30 rotate-3 transform transition-transform hover:rotate-6 overflow-hidden border-4 border-brand-curious">
                    {branding?.logo ? (
                        <img
                            src={getLogoUrl(branding.logo)}
                            alt="Logo"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            src={logoKotak}
                            alt="Logo"
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
                <div>
                    {branding?.name && (
                        <p className="text-xl text-slate-600 font-bold mb-2">
                            {branding.name}
                        </p>
                    )}

                    <p className="text-2xl text-slate-500 font-medium">
                        Professional Photobooth
                    </p>
                </div>
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center gap-4"
            >
                <Preloader message={statusMessage} />

                {/* Manual start for testing/fallback */}
                <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => onStart({ session_code: 'MANUAL-' + Date.now() }, sessionSettings)}
                    className="text-slate-400 hover:text-slate-600 text-sm mt-8 opacity-0 hover:opacity-100 transition-opacity"
                >
                    (Debug: Mulai Manual)
                </Button>

                {/* Debug Info */}
                <div className="absolute top-4 left-4 text-xs text-slate-300 pointer-events-none">
                    Inv: {sessionSettings?.total_photos || '-'} | CD: {sessionSettings?.countdown_seconds || '-'}
                </div>
            </motion.div>

            {/* Version Footer */}
            <div className="absolute bottom-6 text-center w-full z-10">
                <p className="text-[10px] text-slate-400/60 font-medium tracking-wide">
                    Version 1.0.1 dibuat oleh Adam - AcaraQu, Build With Love ❤️
                </p>
            </div>
        </div>
    );
};
