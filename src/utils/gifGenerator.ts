import GIF from 'gif.js';

export const generateGif = async (images: string[], width: number = 600, height: number = 400): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: width,
            height: height,
            workerScript: '/gif.worker.js'
        });

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        };

        Promise.all(images.map(src => loadImage(src)))
            .then(loadedImages => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                loadedImages.forEach(img => {
                    if (ctx) {
                        // Clear canvas
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);

                        // Draw image with "cover" fit
                        const imgRatio = img.width / img.height;
                        const targetRatio = width / height;
                        let sx, sy, sWidth, sHeight;

                        if (imgRatio > targetRatio) {
                            sHeight = img.height;
                            sWidth = sHeight * targetRatio;
                            sy = 0;
                            sx = (img.width - sWidth) / 2;
                        } else {
                            sWidth = img.width;
                            sHeight = sWidth / targetRatio;
                            sx = 0;
                            sy = (img.height - sHeight) / 2;
                        }

                        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

                        // Add frame to GIF
                        gif.addFrame(ctx, { copy: true, delay: 500 });
                    }
                });

                gif.on('finished', (blob) => {
                    resolve(blob);
                });

                gif.render();
            })
            .catch(reject);
    });
};
