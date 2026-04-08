export interface FrameSlot {
    x: number;
    y: number;
    width: number;
    height: number;
    border_radius?: number;
    position?: number;
    strip?: number;
    position_in_strip?: number | string;
    is_logo?: boolean;
    type?: string;
    is_duplicate?: boolean;
}

export interface FrameConfig {
    // Legacy/Simple config
    top_margin?: number;
    gap?: number;
    photo_width?: number;
    photo_height?: number;
    left_center_x?: number;
    right_center_x?: number;

    // New Slot-based config
    type?: string;
    slots?: FrameSlot[];
    format?: string;
    strips?: number;
    photos_per_strip?: number;

    // Canvas dimensions the slots were designed for (from layout editor)
    canvas_width?: number;
    canvas_height?: number;
}

interface GenerateFrameOptions {
    targetWidth?: number;
    targetHeight?: number;
    quality?: number;
}

const loadedImageCache = new Map<string, Promise<HTMLImageElement>>();

const resolveTargetDimensions = (
    sourceWidth: number,
    sourceHeight: number,
    options?: GenerateFrameOptions,
) => {
    const targetWidth = options?.targetWidth;
    const targetHeight = options?.targetHeight;

    if (!targetWidth && !targetHeight) {
        return {
            width: sourceWidth,
            height: sourceHeight,
        };
    }

    if (targetWidth && targetHeight) {
        return {
            width: Math.max(1, Math.round(targetWidth)),
            height: Math.max(1, Math.round(targetHeight)),
        };
    }

    if (targetWidth) {
        return {
            width: Math.max(1, Math.round(targetWidth)),
            height: Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth)),
        };
    }

    return {
        width: Math.max(1, Math.round((sourceWidth / sourceHeight) * (targetHeight || sourceHeight))),
        height: Math.max(1, Math.round(targetHeight || sourceHeight)),
    };
};

// Helper to load image via fetch/blob to avoid CORS issues with canvas
const loadImage = async (src: string): Promise<HTMLImageElement> => {
    const cachedImagePromise = loadedImageCache.get(src);
    if (cachedImagePromise) {
        return await cachedImagePromise;
    }

    const nextImagePromise = (async () => {
        try {
        // If it's a data URL, load directly
            if (src.startsWith('data:')) {
                return await new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                });
            }

        // Otherwise fetch as blob
            const response = await fetch(src, { cache: 'no-store', mode: 'cors' });
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            return await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(img);
                };
                img.onerror = (e) => {
                    URL.revokeObjectURL(url);
                    reject(e);
                };
                img.src = url;
            });
        } catch (error) {
            console.error('Error loading image:', src, error);
            loadedImageCache.delete(src);
            throw error;
        }
    })();

    loadedImageCache.set(src, nextImagePromise);
    return await nextImagePromise;
};

const buildRoundedRectPath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) => {
    const nextRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

    ctx.beginPath();
    if (nextRadius === 0) {
        ctx.rect(x, y, width, height);
        ctx.closePath();
        return;
    }

    ctx.moveTo(x + nextRadius, y);
    ctx.lineTo(x + width - nextRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
    ctx.lineTo(x + width, y + height - nextRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
    ctx.lineTo(x + nextRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
    ctx.lineTo(x, y + nextRadius);
    ctx.quadraticCurveTo(x, y, x + nextRadius, y);
    ctx.closePath();
};

// Helper to draw image with "cover" fit
const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number = 0
) => {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;

    let sx, sy, sWidth, sHeight;

    if (imgRatio > targetRatio) {
        // Image is wider than target: crop sides
        sHeight = img.height;
        sWidth = sHeight * targetRatio;
        sy = 0;
        sx = (img.width - sWidth) / 2;
    } else {
        // Image is taller than target: crop top/bottom
        sWidth = img.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }

    ctx.save();
    buildRoundedRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    ctx.restore();
};

const canvasToBlob = async (canvas: HTMLCanvasElement, type: string = 'image/jpeg', quality: number = 1.0): Promise<Blob> => {
    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error('Failed to create canvas blob'));
        }, type, quality);
    });
};

export const blobToObjectURL = (blob: Blob): string => URL.createObjectURL(blob);

export const generateFinalFrameBlob = async (
    photoPaths: string[],
    frameTemplatePath: string,
    config?: FrameConfig,
    options?: GenerateFrameOptions,
): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Ensure high quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Load frame template first to get dimensions
    const frameImg = await loadImage(frameTemplatePath);
    const targetDimensions = resolveTargetDimensions(frameImg.width, frameImg.height, options);

    // Set canvas to frame size
    canvas.width = targetDimensions.width;
    canvas.height = targetDimensions.height;

    // 1. Draw Frame Template (Background)
    // We draw it first because the template is opaque (JPG).
    // Photos must be drawn ON TOP.
    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

    // Load all photos
    const photos = await Promise.all(photoPaths.map(src => loadImage(src)));

    if (config?.slots && Array.isArray(config.slots) && config.slots.length > 0) {
        // Calculate scaling factors if canvas dimensions differ from actual image
        const designWidth = config.canvas_width || canvas.width;
        const designHeight = config.canvas_height || canvas.height;
        const scaleX = canvas.width / designWidth;
        const scaleY = canvas.height / designHeight;

        const orderedPhotoSlots = config.slots
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => !(slot.is_logo || slot.type === 'logo'))
            .sort((a, b) => {
                const aRow = typeof a.slot.position_in_strip === 'number' ? a.slot.position_in_strip : Number.MAX_SAFE_INTEGER;
                const bRow = typeof b.slot.position_in_strip === 'number' ? b.slot.position_in_strip : Number.MAX_SAFE_INTEGER;

                if (aRow !== bRow) {
                    return aRow - bRow;
                }

                const aStrip = typeof a.slot.strip === 'number' ? a.slot.strip : Number.MAX_SAFE_INTEGER;
                const bStrip = typeof b.slot.strip === 'number' ? b.slot.strip : Number.MAX_SAFE_INTEGER;

                if (aStrip !== bStrip) {
                    return aStrip - bStrip;
                }

                const aPosition = typeof a.slot.position === 'number' ? a.slot.position : Number.MAX_SAFE_INTEGER;
                const bPosition = typeof b.slot.position === 'number' ? b.slot.position : Number.MAX_SAFE_INTEGER;

                if (aPosition !== bPosition) {
                    return aPosition - bPosition;
                }

                return a.index - b.index;
            })
            .map(({ slot }) => slot);

        const numPhotos = Math.min(photos.length, orderedPhotoSlots.length);

        for (let i = 0; i < numPhotos; i++) {
            const photo = photos[i];
            const slot = orderedPhotoSlots[i];

            if (!photo || !slot) {
                continue;
            }

            // Scale slot coordinates from design canvas to actual image dimensions
            const scaledX = Math.round(slot.x * scaleX);
            const scaledY = Math.round(slot.y * scaleY);
            const scaledW = Math.round(slot.width * scaleX);
            const scaledH = Math.round(slot.height * scaleY);
            const scaledRadius = Math.round((slot.border_radius ?? 0) * Math.min(scaleX, scaleY));

            drawImageCover(ctx, photo, scaledX, scaledY, scaledW, scaledH, scaledRadius);
        }
    } else {
        // --- LEGACY LAYOUT ---
        const defaultConfig: FrameConfig = {
            top_margin: 100,
            gap: 50,
            photo_width: 800,
            photo_height: 600,
            left_center_x: canvas.width * 0.25,
            right_center_x: canvas.width * 0.75
        };

        const layout = { ...defaultConfig, ...config };
        const centers = [];
        if (layout.left_center_x) centers.push(layout.left_center_x);
        if (layout.right_center_x) centers.push(layout.right_center_x);
        if (centers.length === 0) centers.push(canvas.width / 2);

        centers.forEach(centerX => {
            let currentY = layout.top_margin || 0;
            photos.forEach((photo) => {
                const pWidth = layout.photo_width || 800;
                const pHeight = layout.photo_height || 600;
                const x = (centerX || 0) - (pWidth / 2);
                const y = currentY;

                drawImageCover(ctx, photo, x, y, pWidth, pHeight);
                currentY += pHeight + (layout.gap || 0);
            });
        });
    }

    return await canvasToBlob(canvas, 'image/jpeg', options?.quality ?? 0.99);
};

export const generateWatermarkedPhoto = async (photoPath: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const img = await loadImage(photoPath);

    canvas.width = img.width;
    canvas.height = img.height;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Add Watermark
    const text = "FotoQu";
    const fontSize = Math.floor(canvas.height * 0.05); // 5% of height
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    // Shadow for better visibility
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const padding = fontSize * 0.5;
    ctx.fillText(text, canvas.width - padding, canvas.height - padding);

    return canvas.toDataURL('image/jpeg', 0.99);
};
