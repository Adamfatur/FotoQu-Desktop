export interface FrameSlot {
    x: number;
    y: number;
    width: number;
    height: number;
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
}

// Helper to load image via fetch/blob to avoid CORS issues with canvas
const loadImage = async (src: string): Promise<HTMLImageElement> => {
    try {
        // If it's a data URL, load directly
        if (src.startsWith('data:')) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        }

        // Otherwise fetch as blob
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url); // Clean up
                resolve(img);
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    } catch (error) {
        console.error("Error loading image:", src, error);
        throw error;
    }
};

// Helper to draw image with "cover" fit
const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
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

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
};

export const generateFinalFrame = async (
    photoPaths: string[],
    frameTemplatePath: string,
    config?: FrameConfig
): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Load frame template first to get dimensions
    const frameImg = await loadImage(frameTemplatePath);

    // Set canvas to frame size
    canvas.width = frameImg.width;
    canvas.height = frameImg.height;

    // 1. Draw Frame Template (Background)
    // We draw it first because the template is opaque (JPG).
    // Photos must be drawn ON TOP.
    ctx.drawImage(frameImg, 0, 0);

    // Load all photos
    const photos = await Promise.all(photoPaths.map(src => loadImage(src)));

    if (config?.slots && Array.isArray(config.slots) && config.slots.length > 0) {
        // --- SLOT BASED LAYOUT ---
        // We will manually enforce a layout that fits the "Strip" design (Header + 3 Photos + Footer).
        // BUT, allow customization via config overrides if present

        // Defaults for "Strip"
        const DEFAULT_HEADER_HEIGHT = 450;
        const DEFAULT_PHOTO_HEIGHT = 330;
        const DEFAULT_PHOTO_WIDTH = 500;
        const DEFAULT_GAP = 40;


        const HEADER_HEIGHT = config.top_margin ?? DEFAULT_HEADER_HEIGHT;
        const PHOTO_HEIGHT = config.photo_height ?? DEFAULT_PHOTO_HEIGHT;
        const PHOTO_WIDTH = config.photo_width ?? DEFAULT_PHOTO_WIDTH;
        const GAP = config.gap ?? DEFAULT_GAP;
        const COLUMN_GAP = 80; // Keep hardcoded for now or add to DB config

        // Calculate centering
        const totalContentWidth = (PHOTO_WIDTH * 2) + COLUMN_GAP;
        const startX = (canvas.width - totalContentWidth) / 2;

        // DETERMINISTIC LAYOUT: 2 columns, 3 rows
        // For 6 photos [A, A, B, B, C, C]:
        // - Index 0 (A) -> Left col, Row 0
        // - Index 1 (A) -> Right col, Row 0  
        // - Index 2 (B) -> Left col, Row 1
        // - Index 3 (B) -> Right col, Row 1
        // - Index 4 (C) -> Left col, Row 2
        // - Index 5 (C) -> Right col, Row 2

        const numPhotos = Math.min(photos.length, 6);

        for (let i = 0; i < numPhotos; i++) {
            const photo = photos[i];
            if (!photo) continue;

            // Column: even index = left (0), odd index = right (1)
            const col = i % 2;
            // Row: 0,1 -> row 0; 2,3 -> row 1; 4,5 -> row 2
            const row = Math.floor(i / 2);

            const finalX = startX + (col * (PHOTO_WIDTH + COLUMN_GAP));
            const finalY = HEADER_HEIGHT + (row * (PHOTO_HEIGHT + GAP));

            drawImageCover(ctx, photo, finalX, finalY, PHOTO_WIDTH, PHOTO_HEIGHT);
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

    return canvas.toDataURL('image/jpeg', 0.95);
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

    return canvas.toDataURL('image/jpeg', 0.90);
};

export const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};
