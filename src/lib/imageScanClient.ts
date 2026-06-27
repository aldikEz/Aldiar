import { runWithClientTimeout } from './clientTimeout';
import { compressImageForUpload, type CompressedImage } from './imageCompression';
import { supabase } from './supabase';

export type Rating = 'Safe' | 'Caution' | 'Avoid';
export type ScanConfidenceLevel = 'high' | 'medium' | 'low';
export type ScanConfidenceSource = 'label_read' | 'visual_estimate' | 'database_match' | 'manual_text' | 'fallback' | 'user_corrected';

export type NutritionFacts = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
};

export type ScanConfidence = {
  level: ScanConfidenceLevel;
  source: ScanConfidenceSource;
  score: number;
  label: string;
  detail: string;
};

export type ScanBasis = {
  portionBasis?: string;
  decisionBasis?: string;
};

export type ImageScanPayload = {
  result: {
    productName: string;
    overallRating: Rating;
    score: number;
    nutrition?: NutritionFacts;
    confidence?: ScanConfidence;
    basis?: ScanBasis;
    flaggedChemicals: Array<{
      chemicalName: string;
      severity: Rating;
      reason: string;
    }>;
  };
};

export type ImageScanResult = {
  scan: ImageScanPayload;
  compressedImage: CompressedImage;
  usedFallback: boolean;
};

export type ProgressiveImageScan = {
  instant: ImageScanPayload;
  compressedImage: Promise<CompressedImage>;
  refined: Promise<ImageScanResult>;
};

type ScanOptions = {
  userLang?: 'English' | 'Russian';
  userTriggers?: string[];
  slowAfterMs?: number;
  hardTimeoutMs?: number;
  onSlow?: () => void;
  onTimeout?: () => void;
};

type BrowserBarcodeDetector = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

type FoodTextScanOptions = ScanOptions & {
  labelText?: string;
  dishName?: string;
  productKey?: string;
};

export async function scanImageWithClientTimeout(file: File, options: ScanOptions = {}): Promise<ImageScanResult> {
  const compressedImage = await compressImageForUpload(file);
  const barcode = await detectBarcodeFromImage(compressedImage);

  let slowTimer: number | undefined;
  if (options.slowAfterMs && options.onSlow) {
    slowTimer = window.setTimeout(options.onSlow, options.slowAfterMs);
  }

  try {
    const { data, error } = await supabase.functions.invoke<ImageScanPayload>('ai', {
      body: {
        imageBase64: compressedImage.imageBase64,
        mimeType: compressedImage.mimeType,
        barcode,
        userTriggers: options.userTriggers ?? [],
        userLang: options.userLang ?? 'English',
      },
    });

    if (error || !data?.result) {
      throw new Error(error?.message ?? 'AI scan failed');
    }

    return {
      scan: data,
      compressedImage,
      usedFallback: false,
    };
  } finally {
    if (slowTimer !== undefined) {
      window.clearTimeout(slowTimer);
    }
  }
}

export async function scanFoodTextWithClientTimeout(options: FoodTextScanOptions): Promise<ImageScanPayload> {
  const fallback = makeFoodTextFallback(options.productKey ?? options.labelText ?? options.dishName ?? 'Food check');

  return await runWithClientTimeout<ImageScanPayload>({
    slowAfterMs: options.slowAfterMs ?? 1_500,
    hardTimeoutMs: options.hardTimeoutMs ?? 6_000,
    onSlow: options.onSlow,
    onTimeout: options.onTimeout,
    fallback: () => fallback,
    task: async () => {
      const { data, error } = await supabase.functions.invoke<ImageScanPayload>('ai', {
        body: {
          labelText: options.labelText,
          dishName: options.dishName,
          productKey: options.productKey,
          userTriggers: options.userTriggers ?? [],
          userLang: options.userLang ?? 'English',
        },
      });

      if (error || !data?.result) {
        return fallback;
      }

      return data;
    },
  });
}

export function startProgressiveImageScan(file: File, options: ScanOptions = {}): ProgressiveImageScan {
  const instant = makeInstantScan(file.name);
  let compressedImagePromise: Promise<CompressedImage> | null = null;

  function getCompressedImage() {
    compressedImagePromise ??= compressImageForUpload(file);
    return compressedImagePromise;
  }

  const refined = runWithClientTimeout<ImageScanResult>({
    slowAfterMs: options.slowAfterMs ?? 2_500,
    hardTimeoutMs: options.hardTimeoutMs ?? 9_000,
    onSlow: options.onSlow,
    onTimeout: options.onTimeout,
    fallback: () => ({
      scan: instant,
      compressedImage: {
        imageBase64: '',
        mimeType: 'image/jpeg',
        originalBytes: file.size,
        compressedBytes: 0,
        width: 0,
        height: 0,
      },
      usedFallback: true,
    }),
    task: async () => {
      const compressedImage = await getCompressedImage();
      const barcode = await detectBarcodeFromImage(compressedImage);
      const { data, error } = await supabase.functions.invoke<ImageScanPayload>('ai', {
        body: {
          imageBase64: compressedImage.imageBase64,
          mimeType: compressedImage.mimeType,
          barcode,
          userTriggers: options.userTriggers ?? [],
          userLang: options.userLang ?? 'English',
        },
      });

      return {
        scan: error || !data?.result ? instant : data,
        compressedImage,
        usedFallback: Boolean(error || !data?.result),
      };
    },
  });

  return {
    instant,
    compressedImage: getCompressedImage(),
    refined,
  };
}

async function detectBarcodeFromImage(compressedImage: CompressedImage): Promise<string | undefined> {
  const Detector = (window as typeof window & { BarcodeDetector?: BrowserBarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return undefined;

  try {
    const detector = new Detector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    });
    const image = new Image();
    image.decoding = 'async';
    image.src = compressedImage.imageBase64;
    await image.decode();
    const detected = await detector.detect(image);
    const rawValue = detected
      .map((item) => item.rawValue?.replace(/[^\dA-Za-z-]/g, '').trim())
      .find((value): value is string => Boolean(value && value.length >= 6 && value.length <= 32));
    return rawValue;
  } catch {
    return undefined;
  }
}

function makeInstantScan(fileName: string): ImageScanPayload {
  return {
    result: {
      productName: fileName.replace(/\.[^.]+$/, '') || 'Quick scan',
      overallRating: 'Caution',
      score: 50,
      confidence: {
        level: 'low',
        source: 'fallback',
        score: 34,
        label: 'Needs confirmation',
        detail: 'AI is still checking the image in the background',
      },
      basis: {
        portionBasis: 'One normal serving',
        decisionBasis: 'Temporary client estimate while the scan finishes',
      },
      flaggedChemicals: [
        {
          chemicalName: 'Quick estimate',
          severity: 'Caution',
          reason: 'AI is checking the image in the background.',
        },
        {
          chemicalName: 'Not confirmed yet',
          severity: 'Caution',
          reason: 'Use the refined result when it appears.',
        },
      ],
    },
  };
}

function makeFoodTextFallback(name: string): ImageScanPayload {
  return {
    result: {
      productName: name,
      overallRating: 'Caution',
      score: 55,
      confidence: {
        level: 'medium',
        source: 'manual_text',
        score: 68,
        label: 'Text check',
        detail: 'Result is based on typed food or label text',
      },
      basis: {
        portionBasis: 'One normal serving or package',
        decisionBasis: 'Typed food or label text',
      },
      flaggedChemicals: [
        {
          chemicalName: 'Quick estimate',
          severity: 'Caution',
          reason: 'Check ingredients or ask before eating.',
        },
        {
          chemicalName: 'Not medical advice',
          severity: 'Caution',
          reason: 'Use this as a pattern hint only.',
        },
      ],
    },
  };
}
