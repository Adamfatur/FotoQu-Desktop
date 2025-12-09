import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { generateFinalFrame, generateWatermarkedPhoto, dataURLtoFile } from '../utils/frameProcessing';
import { generateGif } from '../utils/gifGenerator';
import QRCode from 'react-qr-code';

interface PreviewProps {
    images: string[];
    onSave: () => void;
    onRetake: () => void;
    session: any;
}

export const Preview = ({ images, onSave, session }: PreviewProps) => {
    const [isSaving, setIsSaving] = useState(false);
    const [printCount, setPrintCount] = useState(0);

    // Extract package info
    const packageInfo = session?.package || {};
    // If package is missing, default to 'none' to be safe, or 'strip'?
    // If it's an event mode, we should trust the backend.
    const printType = packageInfo.print_type || 'strip';

    // Explicitly check for 'none'
    const isDigitalOnly = printType === 'none';

    const maxPrints = printType === 'custom' ? (packageInfo.print_count || 1) : 1;

    // Check if printing is allowed based on current count
    // Check if printing is allowed based on current count
    const canPrint = !isDigitalOnly && printCount < maxPrints;

    // Add AnimatePresence import
    // Note: Assuming AnimatePresence is imported from 'framer-motion' at top of file
    // If not, we might need to add it, but usually it is. In this case, we rely on it being available or added.
    // Wait, let's just make sure it's used correctly in return.

    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [step, setStep] = useState<'review' | 'frame' | 'preview'>('review');
    const [statusMessage, setStatusMessage] = useState('');
    const [uploadFailed, setUploadFailed] = useState(false);
    const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
    const [showTestResult, setShowTestResult] = useState(false);

    // Photo Selection State
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

    // Determine how many photos are needed.
    // Logic: 
    // 2 slots -> 2 photos
    // 4 slots -> 4 photos
    // 6 slots -> 3 photos (duplicated)
    // Default fallback -> 3
    // Use Number() to handle potential string values from backend
    // Also check printType: if 'strip', default to 6 slots if not specified
    let frameSlots = session?.frame_slots ? Number(session.frame_slots) : (selectedTemplate?.frame_slots ? Number(selectedTemplate.frame_slots) : 3);

    if (printType === 'strip' && (!session?.frame_slots)) {
        frameSlots = 6;
    }

    const requiredSelection = frameSlots === 6 ? 3 : (frameSlots === 2 ? 2 : (frameSlots === 4 ? 4 : 3));

    // Auto-select if count matches
    useEffect(() => {
        if (images.length === requiredSelection && selectedPhotos.length === 0) {
            setSelectedPhotos([...images]);
        }
    }, [images, requiredSelection]);

    const togglePhotoSelection = (img: string) => {
        if (selectedPhotos.includes(img)) {
            setSelectedPhotos(prev => prev.filter(p => p !== img));
        } else {
            if (selectedPhotos.length < requiredSelection) {
                setSelectedPhotos(prev => [...prev, img]);
            }
        }
    };

    const [savedLocalPath, setSavedLocalPath] = useState<string | null>(null);

    const [errorMessage, setErrorMessage] = useState('');

    const uploadPromises = useRef<Promise<any>[]>([]);

    // Fetch templates on mount
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/v1/desktop/frames');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.templates.length > 0) {
                        setTemplates(data.templates);
                        setSelectedTemplate(data.templates[0]); // Select first by default
                    }
                }
            } catch (error) {
                console.error("Failed to fetch templates:", error);
            }
        };
        fetchTemplates();
    }, []);

    // Generate frame when images or selected template changes
    useEffect(() => {
        const generate = async () => {
            // Only generate if we have enough selected photos
            if (!selectedTemplate || selectedPhotos.length !== requiredSelection) return;

            try {
                // IF 6 slots (strips) and we have 3 photos, duplicate them INTERLEAVED
                // [A, B, C] -> [A, A, B, B, C, C] to match Row-Major slots (L, R, L, R...)
                let photosToProcess = [...selectedPhotos];
                if (frameSlots === 6 && selectedPhotos.length === 3) {
                    photosToProcess = selectedPhotos.flatMap(p => [p, p]);
                }

                // Pass the template URL and config to the generator
                const result = await generateFinalFrame(photosToProcess, selectedTemplate.image_url, selectedTemplate.config);
                setFinalImage(result);
            } catch (err) {
                console.error("Failed to generate frame:", err);
            }
        };

        generate();
    }, [selectedPhotos, selectedTemplate, requiredSelection, frameSlots]);

    // Background upload of raw photos
    useEffect(() => {
        if (session && images.length > 0 && uploadPromises.current.length === 0) {
            if (session.isTestMode) {
                console.log("Test Mode: Skipping background upload");
                return;
            }

            const promises = images.map(async (img, i) => {
                try {
                    // Generate watermarked version
                    // Generate watermarked version
                    const watermarkedDataUrl = await generateWatermarkedPhoto(img);
                    const file = dataURLtoFile(watermarkedDataUrl, `photo_${i + 1}.jpg`);

                    const formData = new FormData();
                    formData.append('session_code', session.session_code);
                    formData.append('photo', file);
                    formData.append('sequence', (i + 1).toString());

                    await fetch('http://127.0.0.1:8000/api/v1/desktop/upload-photo', {
                        method: 'POST',
                        body: formData
                    });
                    console.log(`Photo ${i + 1} uploaded in background`);
                } catch (err) {
                    console.error(`Failed to upload photo ${i + 1}: `, err);
                    // We don't throw here to allow other uploads to proceed
                    // handleSave will check/retry if needed or we just accept partial failure in offline mode
                }
            });
            uploadPromises.current = promises;
        }
    }, [session, images]);



    const handleManualPrint = async () => {
        if (!savedLocalPath || !window.fotoQuAPI?.print) return;

        if (canPrint) {
            try {
                await window.fotoQuAPI.print(savedLocalPath);
                setPrintCount(prev => prev + 1);
            } catch (error) {
                console.error("Print failed:", error);
            }
        }
    };

    // Helper: Fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    const handleSave = async () => {
        if (!selectedTemplate || images.length === 0) return;

        setIsSaving(true);
        setStatusMessage('Memproses...');
        setUploadFailed(false);
        setErrorMessage('');

        try {
            // 1. Flip images horizontally (fix mirroring)
            const flippedImages = await Promise.all(images.map(async (src) => {
                const img = new Image();
                img.src = src;
                await new Promise(r => img.onload = r);

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return src;

                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);

                return canvas.toDataURL('image/jpeg', 0.95);
            }));

            // 2. Generate Final Frame with flipped *SELECTED* images
            setStatusMessage('Membuat Frame Final...');

            // Map selected photos to their flipped versions
            const flippedSelectedPhotos = selectedPhotos.map(selectedSrc => {
                const index = images.indexOf(selectedSrc);
                return index !== -1 ? flippedImages[index] : selectedSrc;
            });

            // Handle duplication for strips (INTERLEAVED)
            let photosToProcess = [...flippedSelectedPhotos];
            if (frameSlots === 6 && flippedSelectedPhotos.length === 3) {
                photosToProcess = flippedSelectedPhotos.flatMap(p => [p, p]);
            }

            // Use exact 4R dimensions (100x148mm @ 300dpi = 1181x1748)
            let currentFinalImage = await generateFinalFrame(photosToProcess, selectedTemplate.image_url, selectedTemplate.config);

            // Resize to exact 4R borderless (1181x1748)
            try {
                const frameImg = new Image();
                const loadPromise = new Promise((resolve, reject) => {
                    frameImg.onload = resolve;
                    frameImg.onerror = reject;
                });
                frameImg.src = currentFinalImage;
                await loadPromise;

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = 1181;
                finalCanvas.height = 1748;
                const finalCtx = finalCanvas.getContext('2d');
                if (finalCtx) {
                    finalCtx.drawImage(frameImg, 0, 0, 1181, 1748);
                    currentFinalImage = finalCanvas.toDataURL('image/jpeg', 0.95);
                }
            } catch (resizeErr) {
                console.error("Resize failed, using original:", resizeErr);
            }

            // 3. Save locally (CRITICAL STEP - Must succeed)
            if (window.fotoQuAPI?.savePhoto) {
                setStatusMessage('Menyimpan ke komputer...');
                const savedPath = await window.fotoQuAPI.savePhoto(currentFinalImage);
                setSavedLocalPath(savedPath);

                // Auto print logic
                const settings = await window.fotoQuAPI.getSettings();
                if (settings.printerName && !isDigitalOnly) {
                    setStatusMessage('Mencetak foto...');
                    window.fotoQuAPI.print(savedPath).then(() => {
                        setPrintCount(prev => prev + 1);
                    }).catch(console.error);
                }
            }

            // Test Mode Check
            if (session.isTestMode) {
                setStatusMessage('Mode Testing: Selesai!');
                await new Promise(resolve => setTimeout(resolve, 500));
                setShowTestResult(true);
                setStep('preview');
                return;
            }

            // 4. Background Network Operations (Fire and Forget)
            // Function to handle heavy uploads continuously in the background
            const uploadMediaInBackground = async () => {
                console.log("Starting background media uploads...");
                try {
                    // Upload raw photos
                    const photosToUpload = flippedImages.slice(0, 3);
                    const uploadPromisesList = photosToUpload.map((imgData, i) => {
                        const file = dataURLtoFile(imgData, `photo_${i + 1}.jpg`);
                        const formData = new FormData();
                        formData.append('session_code', session.session_code);
                        formData.append('photo', file);
                        formData.append('sequence', (i + 1).toString());

                        // Remove timeout for background uploads - let them run until completion
                        return fetch('http://127.0.0.1:8000/api/v1/desktop/upload-photo', {
                            method: 'POST',
                            body: formData
                        });
                    });

                    // Upload Frame
                    const frameFile = dataURLtoFile(currentFinalImage, 'final_frame.jpg');
                    const frameFormData = new FormData();
                    frameFormData.append('session_code', session.session_code);
                    frameFormData.append('frame', frameFile);

                    const frameUploadPromise = fetch('http://127.0.0.1:8000/api/v1/desktop/upload-frame', {
                        method: 'POST',
                        body: frameFormData
                    });

                    // Upload GIF
                    const gifPromise = generateGif(flippedImages, 800, 600).then(gifBlob => {
                        const gifFormData = new FormData();
                        gifFormData.append('session_code', session.session_code);
                        gifFormData.append('gif', gifBlob, 'animation.gif');
                        return fetch('http://127.0.0.1:8000/api/v1/desktop/upload-gif', {
                            method: 'POST',
                            body: gifFormData
                        });
                    });

                    // Execute all uploads concurrently
                    await Promise.all([...uploadPromisesList, frameUploadPromise, gifPromise]);
                    console.log("Background uploads completed successfully");
                } catch (bgError) {
                    // We log this but don't disrupt the user as they assume it's working
                    console.error("Background upload encountered an issue:", bgError);
                }
            };

            // TRIGGER BACKGROUND UPLOADS - DO NOT AWAIT
            uploadMediaInBackground();

            // 5. Complete Session & Get QR (Lightweight)
            setStatusMessage('Finalisasi...');
            try {
                // We still want a timeout for the session completion signal
                // so the user isn't stuck waiting for the QR code forever if valid.
                const response = await fetchWithTimeout('http://127.0.0.1:8000/api/v1/desktop/complete-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_code: session.session_code })
                }, 10000); // 10s timeout for status update

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setQrCodeUrl(data.qr_code_url);
                        setStep('preview');
                        return;
                    }
                }
                // If response not ok or success false, fall through to catch
                throw new Error('Gagal mendapatkan QR Code');
            } catch (completionError) {
                console.warn("Session completion signal failed:", completionError);
                // Even if completion signal fails, uploads are running. 
                // We show an offline success state because the local files are safe.
                setUploadFailed(true); // This triggers the 'Offline Success' UI (Checkmark or Warning depending on logic)
                // We customized logic: if uploadFailed=true, it shows warning. 
                // We should probably just show success if we are confident uploads are running?
                // Actually, if we can't get the QR code, we HAVE to show the 'Offline' state 
                // because we can't show the QR code component without a URL.
                // The 'Offline' state in this app acts as a 'Success but check Admin' state.
                setErrorMessage('Koneksi lambat. Foto sedang diunggah di latar belakang & tersimpan di komputer.');
            }

        } catch (error) {
            console.error("Critical processing error:", error);
            setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan sistem');
            setUploadFailed(true);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDone = () => {
        onSave();
    };

    if (showTestResult) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-8 rounded-3xl shadow-xl max-w-2xl w-full text-center flex flex-col max-h-full"
                >
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Mode Testing Selesai</h2>
                    <p className="text-slate-600 mb-4">Hasil foto tidak diunggah ke server.</p>

                    <div className="flex-1 min-h-0 bg-slate-100 rounded-xl border border-slate-200 mb-6 flex items-center justify-center overflow-hidden p-2">
                        {finalImage && (
                            <img src={finalImage} alt="Final Result" className="max-h-full max-w-full object-contain shadow-sm rounded-lg" />
                        )}
                    </div>

                    <div className="flex gap-3">
                        {savedLocalPath && !isDigitalOnly && (
                            <Button
                                onClick={handleManualPrint}
                                disabled={!canPrint}
                                variant="outline"
                                className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                {canPrint ? 'Cetak Lagi' : 'Batas Cetak Tercapai'}
                            </Button>
                        )}
                        <Button onClick={handleDone} className="flex-1 bg-slate-900 text-white hover:bg-slate-800">
                            Selesai & Kembali
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (qrCodeUrl || uploadFailed) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center"
                >
                    {uploadFailed ? (
                        <>
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-4xl">⚠️</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Mode Offline</h2>
                            <p className="text-slate-600 mb-6">
                                Foto tersimpan di komputer, namun gagal upload ke server.
                                <br />
                                <span className="text-sm text-red-500 mt-2 block">{errorMessage}</span>
                            </p>

                            {savedLocalPath && (
                                <div className="bg-green-50 p-4 rounded-xl mb-6 border border-green-100">
                                    <p className="text-sm text-green-700 font-medium mb-2">File tersimpan di:</p>
                                    <code className="text-xs bg-white p-2 rounded border border-green-200 block break-all text-slate-600">
                                        {savedLocalPath}
                                    </code>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                    Coba Upload Lagi
                                </Button>
                                <Button onClick={handleDone} variant="outline" className="w-full">
                                    Selesai & Kembali
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Check className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Sesi Selesai!</h2>
                            <p className="text-slate-600 mb-6">Scan QR code untuk mengunduh foto digital Anda</p>

                            <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-100 inline-block mb-6">
                                <QRCode value={qrCodeUrl || ''} size={200} />
                            </div>

                            {savedLocalPath && !isDigitalOnly && (
                                <div className="mb-6">
                                    <p className="text-sm text-slate-500 mb-2">
                                        {printCount > 0 ? 'Foto telah dicetak' : 'Foto tersimpan'}
                                        {printType === 'custom' && ` (${printCount}/${maxPrints})`}
                                    </p>
                                    <Button
                                        onClick={handleManualPrint}
                                        disabled={!canPrint}
                                        variant="outline"
                                        className="w-full mb-2 border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Printer className="w-4 h-4 mr-2" />
                                        {canPrint ? 'Cetak Foto' : 'Batas Cetak Tercapai'}
                                    </Button>
                                </div>
                            )}

                            <Button onClick={handleDone} size="lg" className="w-full bg-slate-900 text-white hover:bg-slate-800">
                                Selesai & Kembali
                            </Button>
                        </>
                    )}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="relative z-10 flex-1 flex flex-col bg-slate-50/50">
            {/* Zoomed Photo Overlay */}
            <AnimatePresence>
                {zoomedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setZoomedPhoto(null)}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
                    >
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            src={zoomedPhoto}
                            alt="Zoomed"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border-4 border-white/10"
                        />
                        <button
                            className="absolute top-8 right-8 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => setZoomedPhoto(null)}
                        >
                            <span className="sr-only">Close</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Steps Indicator */}
            <div className="flex justify-center mb-10 pt-8">
                <div className="flex items-center bg-white rounded-full shadow-2xl p-2 px-10 relative overflow-hidden">

                    {/* Active Background Pill */}
                    <div className="absolute inset-0 z-0">
                        <div className={`absolute top-2 bottom-2 rounded-full bg-blue-600 transition-all duration-500 ease-in-out
                            ${step === 'review' ? 'left-2 w-[30%]' :
                                step === 'frame' ? 'left-[35%] w-[33%]' :
                                    'left-[72%] w-[26%]'}
                         `} />
                    </div>

                    <div className="relative z-10 flex items-center w-full justify-between gap-12 font-bold text-lg">
                        <div className={`flex items-center gap-3 transition-colors duration-300 ${step === 'review' ? 'text-white' : 'text-slate-300'}`}>
                            <span className="text-2xl font-black">1</span>
                            <span>Review</span>
                        </div>
                        <div className={`h-1 w-12 rounded-full transition-colors duration-300 ${step === 'review' ? 'bg-white/20' : 'bg-slate-100'}`} />
                        <div className={`flex items-center gap-3 transition-colors duration-300 ${step === 'frame' ? 'text-white' : 'text-slate-300'}`}>
                            <span className="text-2xl font-black">2</span>
                            <span>Pilih Frame</span>
                        </div>
                        <div className={`h-1 w-12 rounded-full transition-colors duration-300 ${step === 'frame' || step === 'review' ? 'bg-slate-100' : 'bg-white/20'}`} />
                        <div className={`flex items-center gap-3 transition-colors duration-300 ${step === 'preview' ? 'text-white' : 'text-slate-300'}`}>
                            <span className="text-2xl font-black">3</span>
                            <span>Selesai</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 flex flex-col items-center justify-center">
                {step === 'review' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full max-w-4xl"
                    >
                        <h2 className="text-4xl font-black text-center text-slate-800 mb-2">Review Hasil Fotomu</h2>
                        <p className="text-center text-slate-500 mb-10 text-lg">
                            {selectedPhotos.length === requiredSelection
                                ? 'Foto siap dicetak!'
                                : `Pilih ${requiredSelection} foto terbaikmu (${selectedPhotos.length}/${requiredSelection})`}
                        </p>

                        <div className="flex flex-wrap justify-center gap-8 perspective-[1000px] max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                            {images.map((img, idx) => {
                                const isSelected = selectedPhotos.includes(img);
                                return (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 50, rotateX: 10 }}
                                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="relative group cursor-default"
                                        onClick={() => togglePhotoSelection(img)}
                                    >
                                        <motion.div
                                            whileHover={{ scale: 1.05, y: -10 }}
                                            className={`w-full max-w-[300px] aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl bg-white transform transition-all duration-300 relative
                                            ${isSelected ? 'border-4 border-blue-500 ring-4 ring-blue-200 scale-105 z-10' : 'border-4 border-white hover:scale-105 shadow-md hover:shadow-xl'}
                                        `}
                                        >
                                            <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />

                                            {/* Selection Overlay */}
                                            {isSelected && (
                                                <div className="absolute top-4 right-4 bg-blue-500 text-white rounded-full p-2 shadow-lg z-10">
                                                    <Check className="w-6 h-6" />
                                                </div>
                                            )}

                                            <div
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3"
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePhotoSelection(img);
                                                    }}
                                                    className={`px-6 py-2 rounded-full font-bold shadow-lg transform transition-transform hover:scale-105
                                                        ${isSelected
                                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'}
                                                    `}
                                                >
                                                    {isSelected ? 'Batal Pilih' : 'Pilih Foto'}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomedPhoto(img);
                                                    }}
                                                    className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white text-sm font-medium hover:bg-white/30 transition-colors"
                                                >
                                                    🔍 Perbesar
                                                </button>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}

                {step === 'frame' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full max-w-5xl"
                    >
                        <h2 className="text-3xl font-bold text-center text-slate-800 mb-8">Pilih Frame Favoritmu</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-4 max-h-[60vh] overflow-y-auto p-4">
                            {templates.map((template) => (
                                <div key={template.id} className="relative group">
                                    <button
                                        onClick={() => setSelectedTemplate(template)}
                                        className={`relative w-full aspect-[2/3] rounded-xl overflow-hidden border-4 transition-all shadow-md hover:shadow-xl ${selectedTemplate?.id === template.id
                                            ? 'border-blue-600 scale-105 ring-4 ring-blue-200'
                                            : 'border-white hover:border-blue-300'
                                            } `}
                                    >
                                        <img
                                            src={template.preview_url || template.image_url}
                                            alt={template.name}
                                            className="w-full h-full object-cover"
                                        />
                                        {selectedTemplate?.id === template.id && (
                                            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center backdrop-blur-[2px]">
                                                <div className="bg-white rounded-full p-2 shadow-lg">
                                                    <Check className="w-6 h-6 text-blue-600" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setZoomedPhoto(template.preview_url || template.image_url);
                                        }}
                                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Perbesar Frame"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="h-24 flex items-center justify-center gap-6 mt-4">
                {step === 'review' && (
                    <div className="flex justify-center w-full">
                        <Button
                            size="lg"
                            onClick={() => setStep('frame')}
                            disabled={selectedPhotos.length !== requiredSelection}
                            className={`min-w-[200px] shadow-lg transition-all
                                ${selectedPhotos.length === requiredSelection
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}
                            `}
                        >
                            {selectedPhotos.length === requiredSelection ? 'Lanjut Pilih Frame' : `Pilih ${requiredSelection} Foto`}
                        </Button>
                    </div>
                )}

                {step === 'frame' && (
                    <>
                        <Button size="lg" variant="secondary" onClick={() => setStep('review')} className="min-w-[160px] bg-white text-slate-700 hover:bg-slate-50">
                            Kembali
                        </Button>
                        <Button
                            size="lg"
                            onClick={handleSave}
                            disabled={!selectedTemplate || isSaving}
                            className="min-w-[160px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-600/30 border-none"
                        >
                            {isSaving ? (
                                <span className="flex items-center">
                                    <Printer className="w-5 h-5 mr-2 animate-spin" />
                                    {statusMessage || 'Memproses...'}
                                </span>
                            ) : (
                                <>
                                    <Check className="w-5 h-5 mr-2" />
                                    Simpan & Proses
                                </>
                            )}
                        </Button>
                    </>
                )}
            </div>

        </div>
    );
};
