/**
 * V1.4.0 - Image Processor
 * Client-side image preprocessing utilities using image-js
 *
 * Responsibilities:
 * - Format normalization (PNG/JPG/WebP → base64)
 * - Size limit enforcement (4MB max)
 * - Dimension scaling (2048x2048 max)
 * - Thumbnail generation (200px)
 */

import {
  DEFAULT_PREPROCESS_OPTIONS,
  type ImagePreprocessOptions,
  type SupportedImageType,
  SUPPORTED_IMAGE_TYPES,
} from '../types/multimodal';

// Dynamic import of image-js to avoid SSR issues
async function loadImageJS() {
  const imageJS = await import('image-js');
  return imageJS.default;
}

// image-js Image class type
type IJSImage = InstanceType<(typeof import('image-js'))['default']>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check if a MIME type is supported
 */
export function isSupportedImageType(mimeType: string): mimeType is SupportedImageType {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageType);
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Not an image file' };
  }

  const supportedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: `Unsupported format: ${file.type}. Supported: PNG, JPG, WebP` };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File too large (max 10MB before processing)' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

/**
 * Load image from various sources
 */
async function loadImage(source: File | Blob | string): Promise<IJSImage> {
  const ImageJS = await loadImageJS();
  let image: IJSImage;

  if (source instanceof File || source instanceof Blob) {
    const arrayBuffer = await source.arrayBuffer();
    image = await ImageJS.load(arrayBuffer);
  } else if (source.startsWith('data:')) {
    // Base64 data URL
    const base64 = source.split(',')[1];
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    image = await ImageJS.load(array);
  } else {
    throw new Error('Unknown image source type');
  }

  return image;
}

// ---------------------------------------------------------------------------
// Preprocessing pipeline
// ---------------------------------------------------------------------------

export interface ProcessedImage {
  imageData: string;      // Base64 data URL (full size)
  thumbnailData: string; // Base64 data URL (thumbnail)
  mimeType: string;      // Output MIME type
  width: number;         // Original width
  height: number;          // Original height
  originalSize: number;    // Original file size in bytes
  processedSize: number;  // Processed file size in bytes
}

export interface ProcessOptions extends Partial<Omit<ImagePreprocessOptions, 'outputMimeType'>> {
  outputMimeType?: SupportedImageType;
}

/**
 * Process image through the full pipeline:
 * 1. Load → 2. Scale → 3. Compress → 4. Generate thumbnail
 */
export async function processImage(
  source: File | Blob | string,
  options: ProcessOptions = {}
): Promise<ProcessedImage> {
  const opts: ImagePreprocessOptions = {
    ...DEFAULT_PREPROCESS_OPTIONS,
    ...options,
  };

  let image: IJSImage = await loadImage(source);

  const originalWidth = image.width;
  const originalHeight = image.height;
  const originalSize = source instanceof File ? source.size :
    source instanceof Blob ? source.size :
      Math.round((source.length - source.indexOf(',') - 1) * 0.75); // Rough base64 estimate

  // Step 1: Scale down if too large
  if (image.width > opts.maxDimension || image.height > opts.maxDimension) {
    const scale = Math.min(
      opts.maxDimension / image.width,
      opts.maxDimension / image.height
    );
    image = image.resize({
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
    });
  }

  // Step 2: Compress (convert to output format)
  const outputMimeType = opts.outputMimeType || 'image/png';
  const mimeForEncoder = outputMimeType === 'image/jpeg' ? 'jpg' : outputMimeType.replace('image/', '');

  // Encode to base64
  const fullBase64 = await image.toBase64(mimeForEncoder as 'png' | 'jpg' | 'gif' | 'bmp');

  // Step 3: Generate thumbnail
  const thumbScale = Math.min(
    opts.thumbnailSize / originalWidth,
    opts.thumbnailSize / originalHeight,
    1
  );
  const thumbImage: IJSImage = await loadImage(source);
  const thumb = thumbImage.resize({
    width: Math.round(thumbImage.width * thumbScale),
    height: Math.round(thumbImage.height * thumbScale),
  });
  const thumbnailBase64 = await thumb.toBase64('jpg');

  // Estimate processed size
  const processedSize = Math.round(fullBase64.length * 0.75);

  return {
    imageData: fullBase64,
    thumbnailData: thumbnailBase64,
    mimeType: outputMimeType,
    width: originalWidth,
    height: originalHeight,
    originalSize,
    processedSize,
  };
}

// ---------------------------------------------------------------------------
// Pixel-based similarity analysis
// ---------------------------------------------------------------------------

/**
 * Calculate perceptual similarity between two images using pixel comparison
 *
 * Algorithm:
 * 1. Resize both images to same dimensions
 * 2. Compare pixel values
 * 3. Return 0-100 similarity score
 */
export async function calculateImageSimilarity(
  image1: File | Blob | string,
  image2: File | Blob | string
): Promise<number> {
  const [img1, img2] = await Promise.all([
    loadImage(image1),
    loadImage(image2),
  ]);

  // Resize to same dimensions for comparison
  const targetWidth = Math.min(img1.width, img2.width, 256);
  const targetHeight = Math.min(img1.height, img2.height, 256);

  const resized1 = img1.resize({ width: targetWidth, height: targetHeight });
  const resized2 = img2.resize({ width: targetWidth, height: targetHeight });

  // Get pixel data via canvas
  const canvas1 = resized1.getCanvas();
  const canvas2 = resized2.getCanvas();
  const ctx1 = canvas1.getContext('2d')!;
  const ctx2 = canvas2.getContext('2d')!;
  const data1 = ctx1.getImageData(0, 0, targetWidth, targetHeight).data;
  const data2 = ctx2.getImageData(0, 0, targetWidth, targetHeight).data;

  let totalDiff = 0;
  const totalPixels = targetWidth * targetHeight;

  for (let i = 0; i < data1.length; i += 4) {
    const r1 = data1[i];
    const g1 = data1[i + 1];
    const b1 = data1[i + 2];
    const r2 = data2[i];
    const g2 = data2[i + 1];
    const b2 = data2[i + 2];

    // Euclidean distance in RGB space
    const diff = Math.sqrt(
      (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
    );
    totalDiff += diff;
  }

  // Normalize to 0-100 scale
  // Max diff per pixel is sqrt(255^2 * 3) ≈ 441
  const maxDiff = totalPixels * 441;
  const similarity = 100 * (1 - totalDiff / maxDiff);

  return Math.max(0, Math.min(100, similarity));
}

// ---------------------------------------------------------------------------
// Layout analysis (simple heuristic)
// ---------------------------------------------------------------------------

/**
 * Detect layout characteristics from an image
 * Used for UI verification comparison
 */
export async function analyzeImageLayout(
  source: File | Blob | string
): Promise<LayoutAnalysis> {
  const image: IJSImage = await loadImage(source);

  const width = image.width;
  const height = image.height;
  const aspectRatio = width / height;

  // Sample grid analysis (4x4 grid)
  const gridResults = analyzeGrid(image, 4);

  return {
    width,
    height,
    aspectRatio,
    isWide: aspectRatio > 1.5,
    isTall: aspectRatio < 0.7,
    dominantColors: extractDominantColors(image),
    gridDistribution: gridResults,
  };
}

interface LayoutAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  isWide: boolean;
  isTall: boolean;
  dominantColors: string[];
  gridDistribution: number[];
}

function analyzeGrid(image: IJSImage, gridSize: number): number[] {
  const results: number[] = new Array(gridSize * gridSize).fill(0);
  const cellWidth = Math.floor(image.width / gridSize);
  const cellHeight = Math.floor(image.height / gridSize);

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let cellActivity = 0;

      // Sample pixels in cell
      for (let y = gy * cellHeight; y < (gy + 1) * cellHeight; y += 4) {
        for (let x = gx * cellWidth; x < (gx + 1) * cellWidth; x += 4) {
          if (x < image.width && y < image.height) {
            const pixel = image.getPixelXY(x, y);
            // Activity = variance from average color
            const avg = (pixel[0] + pixel[1] + pixel[2]) / 3;
            const variance = Math.abs(pixel[0] - avg) + Math.abs(pixel[1] - avg) + Math.abs(pixel[2] - avg);
            cellActivity += variance;
          }
        }
      }

      results[gy * gridSize + gx] = cellActivity;
    }
  }

  return results;
}

function extractDominantColors(image: IJSImage): string[] {
  const colorMap = new Map<string, number>();
  const sampleStep = Math.max(1, Math.floor(image.width * image.height / 1000));

  let idx = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (idx % sampleStep !== 0) {
        idx++;
        continue;
      }
      const pixel = image.getPixelXY(x, y);
      // Quantize to reduce unique colors
      const r = Math.round(pixel[0] / 32) * 32;
      const g = Math.round(pixel[1] / 32) * 32;
      const b = Math.round(pixel[2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
      idx++;
    }
  }

  // Get top 5 colors
  return [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => `rgb(${color})`);
}

// ---------------------------------------------------------------------------
// Electron screenshot capture (via preload bridge)
// ---------------------------------------------------------------------------

/**
 * Capture screenshot of the app window using Electron's desktopCapturer
 * Returns base64 PNG data
 */
export async function captureWindowScreenshot(): Promise<string> {
  // Check if we're in Electron
  if (typeof window !== 'undefined' && window.electronAPI?.captureWindow) {
    return window.electronAPI.captureWindow();
  }

  // Fallback: use browser's canvas capture (limited)
  console.warn('[ImageProcessor] Not in Electron environment, using canvas fallback');
  return captureVisibleAreaFallback();
}

/**
 * Browser fallback: capture visible area
 */
async function captureVisibleAreaFallback(): Promise<string> {
  try {
    // Create a simple canvas with a message
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Canvas context not available');

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e2e2ef';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Screenshot capture requires Electron', canvas.width / 2, canvas.height / 2);
    ctx.fillText('Run the desktop app to use UI verification', canvas.width / 2, canvas.height / 2 + 30);

    return canvas.toDataURL('image/png');
  } catch {
    throw new Error('Failed to capture screenshot');
  }
}
