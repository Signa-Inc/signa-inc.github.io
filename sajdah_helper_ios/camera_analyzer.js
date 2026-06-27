window.webBaselinePixels = null;

window.initWebAnalysis = function() {
    window.videoElement = document.querySelector('video');
    if (!window.videoElement) return false;
    window.offscreenCanvas = document.createElement('canvas');
    window.offscreenCtx = window.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    return true;
};

window.updateWebBaseline = function() {
    if (!window.videoElement || !window.offscreenCanvas) window.initWebAnalysis();
    if (!window.videoElement) return;
    window.offscreenCanvas.width = window.videoElement.videoWidth || 320;
    window.offscreenCanvas.height = window.videoElement.videoHeight || 240;
    window.offscreenCtx.drawImage(window.videoElement, 0, 0, window.offscreenCanvas.width, window.offscreenCanvas.height);
    const imgData = window.offscreenCtx.getImageData(0, 0, window.offscreenCanvas.width, window.offscreenCanvas.height);
    window.webBaselinePixels = new Uint8Array(imgData.data.buffer);
};

window.analyzeWebSajdahFrame = function(pixelStep, sensitivityThreshold) {
    if (!window.videoElement || !window.offscreenCanvas) {
        if (!window.initWebAnalysis()) return null;
    }
    const width = window.videoElement.videoWidth;
    const height = window.videoElement.videoHeight;
    if (!width || !height) return null;

    window.offscreenCanvas.width = width;
    window.offscreenCanvas.height = height;
    window.offscreenCtx.drawImage(window.videoElement, 0, 0, width, height);
    const imgData = window.offscreenCtx.getImageData(0, 0, width, height);
    const bytes = imgData.data;

    let totalBrightness = 0; let count = 0;
    for (let i = 0; i < bytes.length; i += 200) {
        totalBrightness += (bytes[i] + bytes[i+1] + bytes[i+2]) / 3;
        count++;
    }
    const avgBrightness = count > 0 ? totalBrightness / count : 0;

    if (!window.webBaselinePixels || window.webBaselinePixels.length !== bytes.length) {
        window.webBaselinePixels = new Uint8Array(bytes);
        return JSON.stringify({ brightness: avgBrightness, mismatch: 0.0 });
    }

    let changedPixels = 0; let totalChecked = 0;
    let startY = 0; let endY = Math.floor(height / 2); // Берем верхнюю часть кадра
    let bytesPerRow = width * 4;

    for (let y = startY; y < endY; y += pixelStep) {
        let rowOffset = y * bytesPerRow;
        for (let x = 0; x < width; x += pixelStep) {
            let index = rowOffset + (x * 4);
            if (index < bytes.length) {
                totalChecked++;
                let currentV = (bytes[index] + bytes[index+1] + bytes[index+2]) / 3;
                let baselineV = (window.webBaselinePixels[index] + window.webBaselinePixels[index+1] + window.webBaselinePixels[index+2]) / 3;
                if (Math.abs(currentV - baselineV) > sensitivityThreshold) {
                    changedPixels++;
                }
            }
        }
    }
    return JSON.stringify({ brightness: avgBrightness, mismatch: totalChecked > 0 ? (changedPixels / totalChecked) : 0 });
};