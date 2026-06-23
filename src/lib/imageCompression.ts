export type CompressedImage = {
  imageBase64: string;
  mimeType: 'image/jpeg';
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
};

type CompressionOptions = {
  maxDimension?: number;
  maxBytes?: number;
  initialQuality?: number;
  minQuality?: number;
};

const DEFAULT_MAX_DIMENSION = 960;
const DEFAULT_MAX_BYTES = 550_000;
const DEFAULT_INITIAL_QUALITY = 0.76;
const DEFAULT_MIN_QUALITY = 0.48;
const OUTPUT_MIME_TYPE = 'image/jpeg';

export async function compressImageForUpload(file: File, options: CompressionOptions = {}): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be compressed.');
  }

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const initialQuality = options.initialQuality ?? DEFAULT_INITIAL_QUALITY;
  const minQuality = options.minQuality ?? DEFAULT_MIN_QUALITY;

  const source = await loadImage(file);
  const { width, height } = fitInside(source.width, source.height, maxDimension);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    throw new Error('Image compression is not supported in this browser.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source.image, 0, 0, width, height);
  source.cleanup();

  let quality = clampQuality(initialQuality);
  const floorQuality = clampQuality(minQuality);
  let dataUrl = canvas.toDataURL(OUTPUT_MIME_TYPE, quality);

  while (estimateDataUrlBytes(dataUrl) > maxBytes && quality > floorQuality) {
    quality = Math.max(floorQuality, quality - 0.08);
    dataUrl = canvas.toDataURL(OUTPUT_MIME_TYPE, quality);
  }

  return {
    imageBase64: dataUrl,
    mimeType: OUTPUT_MIME_TYPE,
    originalBytes: file.size,
    compressedBytes: estimateDataUrlBytes(dataUrl),
    width,
    height,
  };
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;

  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not load image.'));
    });
  }

  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

function fitInside(sourceWidth: number, sourceHeight: number, maxDimension: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Image has invalid dimensions.');
  }

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function clampQuality(value: number) {
  return Math.max(0.1, Math.min(0.95, value));
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
