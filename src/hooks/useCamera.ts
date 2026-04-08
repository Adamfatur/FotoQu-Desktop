import { useState, useEffect, useCallback, useRef } from 'react';

export interface CameraDevice {
    deviceId: string;
    label: string;
}

export const useCamera = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<CameraDevice[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string>('');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const getDevices = useCallback(async () => {
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices
                .filter(device => device.kind === 'videoinput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || `Camera ${d.deviceId.slice(0, 5)}...`
                }));

            setDevices(videoDevices);

            // Only set active device if not already set
            if (videoDevices.length > 0 && !activeDeviceId) {
                let targetDeviceId = '';

                // 1. Try to get from settings
                if (window.fotoQuAPI) {
                    try {
                        const settings = await window.fotoQuAPI.getSettings();
                        if (settings.cameraDeviceId) {
                            // Verify the saved device still exists
                            const exists = videoDevices.find(d => d.deviceId === settings.cameraDeviceId);
                            if (exists) {
                                targetDeviceId = settings.cameraDeviceId;
                            }
                        }
                    } catch (e) {
                        console.error("Error fetching settings in useCamera:", e);
                    }
                }

                // 2. Fallback to smart selection if no setting or device not found
                if (!targetDeviceId) {
                    const usbCam = videoDevices.find(d => d.label.toLowerCase().includes('usb'));
                    targetDeviceId = usbCam ? usbCam.deviceId : videoDevices[0].deviceId;
                }

                setActiveDeviceId(targetDeviceId);
            }
        } catch (err) {
            console.error("Error enumerating devices:", err);
        }
    }, [activeDeviceId]);

    useEffect(() => {
        const handleDeviceChange = () => {
            void getDevices();
        };

        queueMicrotask(handleDeviceChange);
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [getDevices]);

    useEffect(() => {
        let currentStream: MediaStream | null = null;
        let detachVideoListeners: (() => void) | null = null;

        const initStream = async () => {
            if (!activeDeviceId) return;

            try {
                setIsCameraReady(false);

                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                }

                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: activeDeviceId },
                        width: { ideal: 3840 }, // Try 4K if supported, fallback to lower
                        height: { ideal: 2160 }
                    }
                });

                currentStream = newStream;
                streamRef.current = newStream;
                setStream(newStream);

                if (videoRef.current) {
                    const video = videoRef.current;
                    const markReady = () => {
                        if (video.videoWidth > 0 && video.videoHeight > 0) {
                            setIsCameraReady(true);
                        }
                    };

                    video.srcObject = newStream;
                    video.addEventListener('loadedmetadata', markReady);
                    video.addEventListener('canplay', markReady);
                    video.addEventListener('playing', markReady);

                    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                        markReady();
                    }

                    detachVideoListeners = () => {
                        video.removeEventListener('loadedmetadata', markReady);
                        video.removeEventListener('canplay', markReady);
                        video.removeEventListener('playing', markReady);
                    };
                }
                setError(null);

                // Refresh devices list to get labels now that we have permission
                getDevices();
            } catch (err) {
                console.error("Error starting stream:", err);
                setError("Failed to access camera. Please check if it's in use.");
            }
        };

        initStream();

        return () => {
            setIsCameraReady(false);
            detachVideoListeners?.();
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
                if (streamRef.current === currentStream) {
                    streamRef.current = null;
                }
            }
        };
    }, [activeDeviceId, getDevices]);

    const captureImage = useCallback(async (): Promise<Blob | null> => {
        if (!videoRef.current || !stream) return null;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Ensure high quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(video, 0, 0);

        return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 1.0);
        });
    }, [stream]);

    return {
        stream,
        devices,
        activeDeviceId,
        isCameraReady,
        setActiveDeviceId,
        error,
        videoRef,
        captureImage
    };
};
