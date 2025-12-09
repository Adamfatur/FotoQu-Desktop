import { useState, useEffect, useCallback, useRef } from 'react';

export interface CameraDevice {
    deviceId: string;
    label: string;
}

export const useCamera = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<CameraDevice[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

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
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, [getDevices]);

    useEffect(() => {
        let currentStream: MediaStream | null = null;

        const initStream = async () => {
            if (!activeDeviceId) return;

            try {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }

                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: activeDeviceId },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });

                currentStream = newStream;
                setStream(newStream);

                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
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
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [activeDeviceId]);

    const captureImage = useCallback(() => {
        if (!videoRef.current || !stream) return null;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Flip horizontally if mirrored (usually front cams are mirrored in UI, but saved image should be as seen or flipped? 
        // Standard photobooth mirrors preview, and saves mirrored result so it looks like what user saw)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        ctx.drawImage(video, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.95);
    }, [stream]);

    return {
        stream,
        devices,
        activeDeviceId,
        setActiveDeviceId,
        error,
        videoRef,
        captureImage
    };
};
