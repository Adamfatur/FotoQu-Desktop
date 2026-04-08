import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { blobToObjectURL, generateFinalFrameBlob } from '../utils/frameProcessing';
import type { FrameConfig } from '../utils/frameProcessing';
import { generateGif } from '../utils/gifGenerator';
import QRCode from 'react-qr-code';
import type { SessionMedia, CapturedImage } from '../types/media';
import { buildDesktopApiUrl, DEFAULT_SERVER_BASE_URL, normalizeServerBaseUrl } from '../utils/serverConfig';

interface PreviewProps {
    images: CapturedImage[];
    sessionMediaList?: SessionMedia[];
    onSave: () => void;
    onRetake: () => void;
    session: {
        session_code?: string;
        isTestMode?: boolean;
        frame_slots?: string | number;
        frame_design?: string | number;
        package?: {
            print_type?: string;
            print_count?: string | number;
        };
    };
}

interface FrameTemplate {
    id?: string | number;
    name?: string;
    image_url: string;
    preview_url?: string;
    config?: FrameConfig;
    frame_slots?: string | number;
    updated_at?: string;
}

interface GeneratedFrame {
    url: string;
    blob: Blob;
}

type TemplatePreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

const getFrameSlotCount = (frameSlots?: string | number, fallback: number = 3): number => {
    const numericFrameSlots = Number(frameSlots);

    if (Number.isFinite(numericFrameSlots) && numericFrameSlots > 0) {
        return numericFrameSlots;
    }

    return fallback;
};

const getRequiredSelectionCount = (frameSlots: number): number => frameSlots === 2 ? 2 : 3;

const getPhotosToProcessForFrame = (photos: CapturedImage[], frameSlots: number): string[] | null => {
    const requiredSelectionCount = getRequiredSelectionCount(frameSlots);

    if (photos.length < requiredSelectionCount) {
        return null;
    }

    const selectedPhotoUrls = photos
        .slice(0, requiredSelectionCount)
        .map((photo) => photo.url);

    if (frameSlots === 6 && selectedPhotoUrls.length === 3) {
        return selectedPhotoUrls.flatMap((photoUrl) => [photoUrl, photoUrl]);
    }

    return selectedPhotoUrls;
};

const getTemplateKey = (template: FrameTemplate): string => {
    if (template.id != null) {
        return String(template.id);
    }

    return template.image_url;
};

export const Preview = ({ images, sessionMediaList, onSave, session }: PreviewProps) => {
    const [isSaving, setIsSaving] = useState(false);
    const [printCount, setPrintCount] = useState(0);

    // Extract package info
    const packageInfo = session?.package || {};
    // If package is missing, default to 'none' to be safe, or 'strip'?
    // If it's an event mode, we should trust the backend.
    const printType = packageInfo.print_type || 'strip';

    // Explicitly check for 'none'
    const isDigitalOnly = printType === 'none';

    const maxPrints = printType === 'custom' ? Number(packageInfo.print_count ?? 1) : 1;

    // Check if printing is allowed based on current count
    // Check if printing is allowed based on current count
    const canPrint = !isDigitalOnly && printCount < maxPrints;

    // Add AnimatePresence import
    // Note: Assuming AnimatePresence is imported from 'framer-motion' at top of file
    // If not, we might need to add it, but usually it is. In this case, we rely on it being available or added.
    // Wait, let's just make sure it's used correctly in return.

    const [finalImage, setFinalImage] = useState<GeneratedFrame | null>(null);
    const [templates, setTemplates] = useState<FrameTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<FrameTemplate | null>(null);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [templateFetchError, setTemplateFetchError] = useState<string | null>(null);
    const [templatePreviewUrls, setTemplatePreviewUrls] = useState<Record<string, string>>({});
    const [templatePreviewStatus, setTemplatePreviewStatus] = useState<Record<string, TemplatePreviewStatus>>({});
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [step, setStep] = useState<'review' | 'frame' | 'preview'>('review');
    const [statusMessage, setStatusMessage] = useState('');
    const [uploadFailed, setUploadFailed] = useState(false);
    const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
    const [showTestResult, setShowTestResult] = useState(false);
    const [serverBaseUrl, setServerBaseUrl] = useState(DEFAULT_SERVER_BASE_URL);

    // Photo Selection State
    const [selectedPhotos, setSelectedPhotos] = useState<CapturedImage[]>([]);

    // Determine how many photos are needed.
    // Logic:
    // 2 slots -> 2 photos
    // 6 slots -> 3 photos (duplicated)
    // Default fallback -> 3
    // Use Number() to handle potential string values from backend
    // Also check printType: if 'strip', default to 6 slots if not specified
    let frameSlots = session?.frame_slots
        ? getFrameSlotCount(session.frame_slots, 3)
        : getFrameSlotCount(selectedTemplate?.frame_slots, 3);

    if (printType === 'strip' && (!session?.frame_slots)) {
        frameSlots = 6;
    }

    const requiredSelection = getRequiredSelectionCount(frameSlots);

    // Auto-select if count matches
    useEffect(() => {
        if (images.length === requiredSelection && selectedPhotos.length === 0) {
            setSelectedPhotos([...images]);
        }
    }, [images, requiredSelection, selectedPhotos.length]);

    const togglePhotoSelection = (img: CapturedImage) => {
        if (selectedPhotos.some((photo) => photo.id === img.id)) {
            setSelectedPhotos(prev => prev.filter(p => p.id !== img.id));
        } else {
            if (selectedPhotos.length < requiredSelection) {
                setSelectedPhotos(prev => [...prev, img]);
            }
        }
    };

    const [savedLocalPath, setSavedLocalPath] = useState<string | null>(null);

    const [errorMessage, setErrorMessage] = useState('');
    const templatePreviewUrlsRef = useRef<Record<string, string>>({});

    useEffect(() => {
        const loadServerSettings = async () => {
            if (!window.fotoQuAPI) {
                return;
            }

            const settings = await window.fotoQuAPI.getSettings();
            setServerBaseUrl(normalizeServerBaseUrl(settings.serverBaseUrl));
        };

        void loadServerSettings();
    }, []);

    useEffect(() => {
        return () => {
            Object.values(templatePreviewUrlsRef.current).forEach((previewUrl) => {
                URL.revokeObjectURL(previewUrl);
            });
        };
    }, []);

    // Fetch templates when entering the frame step so admin edits are picked up immediately.
    useEffect(() => {
        if (step !== 'frame') {
            return;
        }

        let cancelled = false;

        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            setTemplateFetchError(null);

            try {
                const apiUrl = buildDesktopApiUrl(serverBaseUrl, `/api/v1/desktop/frames?ts=${Date.now()}`);
                console.log('[FotoQu] Fetching templates from:', apiUrl);

                const response = await fetch(apiUrl, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                });

                console.log('[FotoQu] Template API response status:', response.status);

                if (response.ok) {
                    const data: { success?: boolean; templates?: FrameTemplate[] } = await response.json();
                    const nextTemplates = data.templates ?? [];
                    console.log('[FotoQu] Templates received:', nextTemplates.length);

                    if (!cancelled && data.success && nextTemplates.length > 0) {
                        const preferredTemplateId = session?.frame_design != null
                            ? String(session.frame_design)
                            : null;

                        setTemplates(nextTemplates);
                        setSelectedTemplate((currentTemplate) => {
                            const currentTemplateId = currentTemplate?.id != null
                                ? String(currentTemplate.id)
                                : null;

                            const preferredTemplate = preferredTemplateId
                                ? nextTemplates.find((template) => String(template.id) === preferredTemplateId)
                                : null;
                            const preservedTemplate = currentTemplateId
                                ? nextTemplates.find((template) => String(template.id) === currentTemplateId)
                                : null;

                            return preferredTemplate ?? preservedTemplate ?? nextTemplates[0];
                        });
                    } else if (!cancelled && nextTemplates.length === 0) {
                        setTemplateFetchError('Server tidak memiliki template frame aktif.');
                    }
                } else {
                    if (!cancelled) {
                        setTemplateFetchError(`Server error: ${response.status} ${response.statusText}`);
                    }
                }
            } catch (error) {
                console.error('[FotoQu] Failed to fetch templates:', error);
                if (!cancelled) {
                    setTemplateFetchError(
                        error instanceof Error
                            ? `Gagal memuat template: ${error.message}`
                            : 'Gagal memuat template frame.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingTemplates(false);
                }
            }
        };

        void fetchTemplates();

        return () => {
            cancelled = true;
        };
    }, [serverBaseUrl, session?.frame_design, step]);

    useEffect(() => {
        if (step !== 'frame' || templates.length === 0) {
            return;
        }

        const photosToProcess = getPhotosToProcessForFrame(selectedPhotos, frameSlots);
        if (!photosToProcess) {
            return;
        }

        let cancelled = false;

        Object.values(templatePreviewUrlsRef.current).forEach((previewUrl) => {
            URL.revokeObjectURL(previewUrl);
        });
        templatePreviewUrlsRef.current = {};
        setTemplatePreviewUrls({});
        setTemplatePreviewStatus(
            Object.fromEntries(templates.map((template) => [getTemplateKey(template), 'loading'])) as Record<string, TemplatePreviewStatus>
        );

        const generateTemplatePreviews = async () => {
            await Promise.allSettled(templates.map(async (template) => {
                const templateKey = getTemplateKey(template);
                const previewSourceUrl = template.preview_url || template.image_url;

                try {
                    const previewBlob = await generateFinalFrameBlob(
                        photosToProcess,
                        previewSourceUrl,
                        template.config,
                        {
                            targetHeight: 960,
                            quality: 0.92,
                        },
                    );
                    const previewUrl = blobToObjectURL(previewBlob);

                    if (cancelled) {
                        URL.revokeObjectURL(previewUrl);
                        return;
                    }

                    setTemplatePreviewUrls((previousUrls) => {
                        const previousUrl = previousUrls[templateKey];
                        if (previousUrl && previousUrl !== previewUrl) {
                            URL.revokeObjectURL(previousUrl);
                        }

                        const nextUrls = {
                            ...previousUrls,
                            [templateKey]: previewUrl,
                        };
                        templatePreviewUrlsRef.current = nextUrls;
                        return nextUrls;
                    });
                    setTemplatePreviewStatus((previousStatus) => ({
                        ...previousStatus,
                        [templateKey]: 'ready',
                    }));
                } catch (error) {
                    console.error('[FotoQu] Failed to generate template preview:', template.name, error);
                    if (!cancelled) {
                        setTemplatePreviewStatus((previousStatus) => ({
                            ...previousStatus,
                            [templateKey]: 'error',
                        }));
                    }
                }
            }));
        };

        void generateTemplatePreviews();

        return () => {
            cancelled = true;
        };
    }, [frameSlots, selectedPhotos, step, templates]);

    useEffect(() => {
        return () => {
            if (finalImage) {
                URL.revokeObjectURL(finalImage.url);
            }
        };
    }, [finalImage]);

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

        const sessionCode = session.session_code;
        if (!session.isTestMode && !sessionCode) {
            setErrorMessage('Session code tidak tersedia.');
            setUploadFailed(true);
            setIsSaving(false);
            return;
        }

        try {
            // 1. Generate Final Frame with selected images
            setStatusMessage('Membuat Frame Final...');

            const photosToProcess = getPhotosToProcessForFrame(selectedPhotos, frameSlots);
            if (!photosToProcess) {
                setErrorMessage('Jumlah foto terpilih belum sesuai dengan frame.');
                setUploadFailed(true);
                setIsSaving(false);
                return;
            }

            // Use exact 4R dimensions (100x148mm @ 300dpi = 1181x1748)
            let currentFinalImageBlob = await generateFinalFrameBlob(photosToProcess, selectedTemplate.image_url, selectedTemplate.config);

            // Resize to exact 4R borderless (1181x1748)
            try {
                const frameImg = new Image();
                const loadPromise = new Promise((resolve, reject) => {
                    frameImg.onload = resolve;
                    frameImg.onerror = reject;
                });
                const currentFinalImageUrl = blobToObjectURL(currentFinalImageBlob);
                frameImg.src = currentFinalImageUrl;
                await loadPromise;

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = 1181;
                finalCanvas.height = 1748;
                const finalCtx = finalCanvas.getContext('2d');
                if (finalCtx) {
                    finalCtx.imageSmoothingEnabled = true;
                    finalCtx.imageSmoothingQuality = 'high';
                    finalCtx.drawImage(frameImg, 0, 0, 1181, 1748);
                    currentFinalImageBlob = await new Promise<Blob>((resolve, reject) => {
                        finalCanvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                                return;
                            }

                            reject(new Error('Failed to create resized frame blob'));
                        }, 'image/jpeg', 1.0);
                    });
                }
                URL.revokeObjectURL(currentFinalImageUrl);
            } catch (resizeErr) {
                console.error("Resize failed, using original:", resizeErr);
            }

            const nextFinalImage = {
                blob: currentFinalImageBlob,
                url: blobToObjectURL(currentFinalImageBlob),
            };

            setFinalImage((previousFrame) => {
                if (previousFrame) {
                    URL.revokeObjectURL(previousFrame.url);
                }

                return nextFinalImage;
            });

            // 3. Save locally (CRITICAL STEP - Must succeed)
            if (window.fotoQuAPI?.savePhoto) {
                setStatusMessage('Menyimpan ke komputer...');
                const savedPath = await window.fotoQuAPI.savePhoto({
                    data: new Uint8Array(await currentFinalImageBlob.arrayBuffer()),
                    mimeType: currentFinalImageBlob.type || 'image/jpeg',
                    extension: 'jpg',
                });
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

            // 4. Upload all media (photos, frame, GIF, boomerang)
            // Await ALL uploads before completing session to ensure everything is saved
            setStatusMessage('Mengunggah foto...');
            try {
                // Upload raw photos
                const photoUploadPromises = images.map(async (image, i) => {
                    const file = new File([image.blob], `photo_${i + 1}.jpg`, {
                        type: image.blob.type || 'image/jpeg',
                    });
                    const formData = new FormData();
                    formData.append('session_code', sessionCode ?? '');
                    formData.append('photo', file);
                    formData.append('sequence', (i + 1).toString());
                    return fetch(buildDesktopApiUrl(serverBaseUrl, '/api/v1/desktop/upload-photo'), {
                        method: 'POST',
                        body: formData,
                    });
                });

                // Upload Frame
                const frameFile = new File([currentFinalImageBlob], 'final_frame.jpg', {
                    type: currentFinalImageBlob.type || 'image/jpeg',
                });
                const frameFormData = new FormData();
                frameFormData.append('session_code', sessionCode ?? '');
                frameFormData.append('frame', frameFile);
                const frameUploadPromise = fetch(buildDesktopApiUrl(serverBaseUrl, '/api/v1/desktop/upload-frame'), {
                    method: 'POST',
                    body: frameFormData,
                });

                // Generate GIF animation (photo slideshow as MP4) — always
                setStatusMessage('Membuat GIF animasi...');
                const gifBlob = await generateGif(images.map((image) => image.url));
                const gifFilename = gifBlob.type.startsWith('video/')
                    ? `animation.${gifBlob.type.includes('mp4') ? 'mp4' : 'webm'}`
                    : 'animation.gif';
                const gifFormData = new FormData();
                gifFormData.append('session_code', sessionCode ?? '');
                gifFormData.append('media_kind', 'gif');
                gifFormData.append('gif', gifBlob, gifFilename);
                const gifUploadPromise = fetch(buildDesktopApiUrl(serverBaseUrl, '/api/v1/desktop/upload-gif'), {
                    method: 'POST',
                    body: gifFormData,
                });

                // Upload boomerang media captured during the session
                const mediaUploadPromises = (sessionMediaList ?? []).map((media) => {
                    const ext = media.blob.type.includes('mp4') ? 'mp4' : 'webm';
                    const filename = `${media.kind}.${ext}`;
                    const formData = new FormData();
                    formData.append('session_code', sessionCode ?? '');
                    formData.append('media_kind', media.kind);
                    formData.append('gif', media.blob, filename);
                    return fetch(buildDesktopApiUrl(serverBaseUrl, '/api/v1/desktop/upload-gif'), {
                        method: 'POST',
                        body: formData,
                    });
                });

                // Execute all uploads concurrently and AWAIT completion
                setStatusMessage('Mengunggah semua media...');
                const uploadResults = await Promise.allSettled([
                    ...photoUploadPromises,
                    frameUploadPromise,
                    gifUploadPromise,
                    ...mediaUploadPromises,
                ]);

                const failedUploads = uploadResults.filter((r) => r.status === 'rejected');
                if (failedUploads.length > 0) {
                    console.warn(`${failedUploads.length} upload(s) failed:`, failedUploads);
                }
            } catch (uploadError) {
                console.error('Media upload error:', uploadError);
                // Continue to session completion even if some uploads fail
                // Local files are safe and S3 sync will retry
            }

            // 5. Complete Session & Get QR
            setStatusMessage('Finalisasi...');
            try {
                const response = await fetchWithTimeout(buildDesktopApiUrl(serverBaseUrl, '/api/v1/desktop/complete-session'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_code: sessionCode })
                }, 10000);

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setQrCodeUrl(data.qr_code_url);
                        setStep('preview');
                        return;
                    }
                }
                throw new Error('Gagal mendapatkan QR Code');
            } catch (completionError) {
                console.warn("Session completion signal failed:", completionError);
                setUploadFailed(true);
                setErrorMessage('Koneksi lambat. Foto tersimpan di komputer & sedang diunggah.');
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
                            <img src={finalImage.url} alt="Final Result" className="max-h-full max-w-full object-contain shadow-sm rounded-lg" />
                        )}
                    </div>

                    <div className="flex gap-3">
                        {savedLocalPath && !isDigitalOnly && (
                            <Button
                                onClick={handleManualPrint}
                                disabled={!canPrint}
                                variant="outline"
                                className="flex-1 border-brand-picton/50 text-brand-teal hover:bg-brand-picton/10 disabled:opacity-50"
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
                                <Button onClick={handleSave} className="w-full bg-brand-curious hover:bg-brand-teal text-white">
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
                                        className="w-full mb-2 border-brand-picton/50 text-brand-teal hover:bg-brand-picton/10 disabled:opacity-50 disabled:cursor-not-allowed"
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

    const selectedTemplatePreviewUrl = selectedTemplate
        ? templatePreviewUrls[getTemplateKey(selectedTemplate)]
            || selectedTemplate.preview_url
            || selectedTemplate.image_url
        : null;

    return (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
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
            <div className="flex shrink-0 justify-center mb-6 pt-6 px-4">
                <div className="flex items-center bg-white rounded-full shadow-2xl p-2 px-10 relative overflow-hidden">

                    {/* Active Background Pill */}
                    <div className="absolute inset-0 z-0">
                        <div className={`absolute top-2 bottom-2 rounded-full bg-brand-curious transition-all duration-500 ease-in-out
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
            <div className="flex-1 min-h-0 flex flex-col items-center justify-start overflow-hidden">
                {step === 'review' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full max-w-4xl flex flex-1 min-h-0 flex-col"
                    >
                        <h2 className="text-4xl font-black text-center text-slate-800 mb-2">Review Hasil Fotomu</h2>
                        <p className="text-center text-slate-500 mb-6 text-lg">
                            {selectedPhotos.length === requiredSelection
                                ? 'Foto siap dicetak!'
                                : `Pilih ${requiredSelection} foto terbaikmu (${selectedPhotos.length}/${requiredSelection})`}
                        </p>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-6 custom-scrollbar">
                            <div className="flex flex-wrap justify-center gap-8 perspective-[1000px]">
                            {images.map((img, idx) => {
                                const isSelected = selectedPhotos.some((photo) => photo.id === img.id);
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
                                            ${isSelected ? 'border-4 border-brand-curious ring-4 ring-brand-picton/50 scale-105 z-10' : 'border-4 border-white hover:scale-105 shadow-md shadow-brand-curious/20 hover:shadow-xl'}
                                        `}
                                        >
                                            <img src={img.url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />

                                            {/* Selection Overlay */}
                                            {isSelected && (
                                                <div className="absolute top-4 right-4 bg-brand-curious text-white rounded-full p-2 shadow-lg z-10">
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
                                                            : 'bg-brand-curious text-white hover:bg-brand-teal'}
                                                    `}
                                                >
                                                    {isSelected ? 'Batal Pilih' : 'Pilih Foto'}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomedPhoto(img.url);
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
                        </div>
                    </motion.div>
                )}

                {step === 'frame' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full max-w-7xl flex flex-1 min-h-0 flex-col"
                    >
                        <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Pilih Frame Favoritmu</h2>
                        <p className="text-center text-slate-500 mb-6 text-lg">
                            {isLoadingTemplates
                                ? 'Memuat template frame...'
                                : templateFetchError
                                    ? templateFetchError
                                    : 'Setiap card menampilkan preview slot dari foto yang baru diambil.'}
                        </p>

                        {isLoadingTemplates && (
                            <div className="flex flex-1 items-center justify-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-curious" />
                                    <p className="text-slate-500">Memuat frame dari server...</p>
                                    <p className="text-xs text-slate-400">{serverBaseUrl}</p>
                                </div>
                            </div>
                        )}

                        {!isLoadingTemplates && templateFetchError && (
                            <div className="flex flex-1 items-center justify-center">
                                <div className="flex flex-col items-center gap-4 text-center max-w-md">
                                    <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                                        <span className="text-3xl">⚠️</span>
                                    </div>
                                    <p className="text-red-600 font-medium">{templateFetchError}</p>
                                    <p className="text-sm text-slate-400">Server: {serverBaseUrl}</p>
                                </div>
                            </div>
                        )}

                        {!isLoadingTemplates && !templateFetchError && templates.length === 0 && (
                            <div className="flex flex-1 items-center justify-center">
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <p className="text-slate-500 text-lg">Tidak ada template frame yang tersedia.</p>
                                    <p className="text-sm text-slate-400">Hubungi admin untuk menambahkan template.</p>
                                </div>
                            </div>
                        )}

                        {!isLoadingTemplates && !templateFetchError && templates.length > 0 && (
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1.15fr)_400px]">
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                {templates.map((template) => {
                                    const isSelected = selectedTemplate?.id === template.id;
                                    const templateKey = getTemplateKey(template);
                                    const previewImageUrl = templatePreviewUrls[templateKey] || template.preview_url || template.image_url;
                                    const previewStatus = templatePreviewStatus[templateKey] ?? 'idle';

                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => setSelectedTemplate(template)}
                                            className={`group flex w-full flex-col rounded-[28px] border bg-white p-3 text-left shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:shadow-lg ${isSelected
                                                ? 'border-brand-curious ring-4 ring-brand-picton/25'
                                                : 'border-slate-200/80'
                                                }`}
                                        >
                                            <div className={`relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-2xl border bg-slate-100 p-3 ${isSelected
                                                ? 'border-brand-curious/40'
                                                : 'border-slate-200/80'
                                                }`}>
                                                <img
                                                    src={previewImageUrl}
                                                    alt={template.name}
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        if (!target.dataset.retried && template.preview_url && target.src !== template.preview_url) {
                                                            target.dataset.retried = '1';
                                                            target.src = template.preview_url;
                                                        } else if (!target.dataset.retried) {
                                                            target.dataset.retried = '1';
                                                            target.src = template.image_url;
                                                        } else {
                                                            target.style.display = 'none';
                                                            target.parentElement?.insertAdjacentHTML('beforeend',
                                                                '<div class="flex flex-col items-center justify-center gap-1 text-slate-400 text-xs p-2"><span class="text-2xl">🖼️</span><span>Gagal memuat gambar</span></div>'
                                                            );
                                                        }
                                                    }}
                                                />
                                                {previewStatus === 'loading' && !templatePreviewUrls[templateKey] && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/82 backdrop-blur-[1px]">
                                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-curious" />
                                                        <p className="text-xs font-medium text-slate-500">Menyusun preview...</p>
                                                    </div>
                                                )}
                                                {previewStatus === 'error' && (
                                                    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-amber-50/95 px-3 py-2 text-center text-xs font-medium text-amber-700 shadow-sm">
                                                        Preview otomatis gagal, frame asli ditampilkan.
                                                    </div>
                                                )}
                                                {isSelected && (
                                                    <div className="absolute right-4 top-4 flex items-center justify-center rounded-full bg-white p-2 shadow-lg">
                                                        <div className="bg-white rounded-full p-2 shadow-lg">
                                                            <Check className="w-6 h-6 text-brand-curious" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-1 pb-1 pt-4">
                                                <p className="text-base font-semibold text-slate-800">{template.name || 'Frame Template'}</p>
                                                <p className="mt-1 text-sm text-slate-500">Klik untuk memilih preview frame ini.</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                                <div className="lg:sticky lg:top-0">
                                    <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
                                        <div className="border-b border-slate-200/80 px-6 py-5">
                                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-picton">Preview Frame</p>
                                            <h3 className="mt-2 text-2xl font-black text-slate-900">{selectedTemplate?.name || 'Pilih frame dulu'}</h3>
                                            <p className="mt-2 text-sm text-slate-500">Panel ini menunjukkan hasil komposit foto yang akan diproses saat frame dipilih.</p>
                                        </div>

                                        <div className="p-5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (selectedTemplatePreviewUrl) {
                                                        setZoomedPhoto(selectedTemplatePreviewUrl);
                                                    }
                                                }}
                                                className="flex w-full items-center justify-center overflow-hidden rounded-[28px] border border-slate-200/80 bg-slate-100 p-4"
                                            >
                                                {selectedTemplatePreviewUrl ? (
                                                    <div className="relative flex w-full items-center justify-center">
                                                        <img
                                                            src={selectedTemplatePreviewUrl}
                                                            alt={selectedTemplate?.name || 'Preview frame terpilih'}
                                                            className="aspect-[2/3] h-full w-full object-contain"
                                                            onError={(e) => {
                                                                const target = e.currentTarget;
                                                                if (!target.dataset.retried && selectedTemplate?.preview_url) {
                                                                    target.dataset.retried = '1';
                                                                    target.src = selectedTemplate.preview_url;
                                                                } else if (!target.dataset.retried && selectedTemplate?.image_url) {
                                                                    target.dataset.retried = '1';
                                                                    target.src = selectedTemplate.image_url;
                                                                }
                                                            }}
                                                        />
                                                        {selectedTemplate && templatePreviewStatus[getTemplateKey(selectedTemplate)] === 'loading' && !templatePreviewUrls[getTemplateKey(selectedTemplate)] && (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/82 backdrop-blur-[1px]">
                                                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-curious" />
                                                                <p className="text-xs font-medium text-slate-500">Merakit preview frame...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex h-full items-center justify-center px-8 text-center text-sm font-medium text-slate-500">
                                                        Preview frame akan muncul di sini setelah frame dipilih.
                                                    </div>
                                                )}
                                            </button>

                                            <p className="mt-4 text-sm leading-6 text-slate-500">
                                                Preview ini memakai foto yang tadi dipilih, jadi user bisa membandingkan hasil tiap frame sebelum diproses.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="shrink-0 border-t border-slate-200/80 bg-white/90 backdrop-blur-md px-4 py-4">
                {step === 'review' && (
                    <div className="flex justify-center w-full">
                        <Button
                            size="lg"
                            onClick={() => setStep('frame')}
                            disabled={selectedPhotos.length !== requiredSelection}
                            className={`min-w-[200px] shadow-lg transition-all
                                ${selectedPhotos.length === requiredSelection
                                    ? 'bg-brand-curious hover:bg-brand-teal text-white shadow-brand-curious/30'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}
                            `}
                        >
                            {selectedPhotos.length === requiredSelection ? 'Lanjut Pilih Frame' : `Pilih ${requiredSelection} Foto`}
                        </Button>
                    </div>
                )}

                {step === 'frame' && (
                    <div className="flex w-full justify-center gap-6">
                        <Button size="lg" variant="secondary" onClick={() => setStep('review')} className="min-w-[160px] bg-white text-slate-700 hover:bg-slate-50">
                            Kembali
                        </Button>
                        <Button
                            size="lg"
                            onClick={handleSave}
                            disabled={!selectedTemplate || isSaving}
                            className="min-w-[160px] bg-gradient-to-r from-brand-curious to-brand-teal hover:from-brand-teal hover:to-[#042e4f] text-white shadow-xl shadow-brand-curious/30 border-none"
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
                    </div>
                )}
            </div>

        </div>
    );
};
