import { runWithClientTimeout } from './clientTimeout';
import { compressImageForUpload, type CompressedImage } from './imageCompression';
import { supabase } from './supabase';

export type Rating = 'Safe' | 'Caution' | 'Avoid';

export type ImageScanPayload = {
  result: {
    productName: string;
    overallRating: Rating;
    score: number;
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

type FoodTextScanOptions = ScanOptions & {
  labelText?: string;
  dishName?: string;
  productKey?: string;
};

export async function scanImageWithClientTimeout(file: File, options: ScanOptions = {}): Promise<ImageScanResult> {
  const compressedImage = await compressImageForUpload(file);

  let slowTimer: number | undefined;
  if (options.slowAfterMs && options.onSlow) {
    slowTimer = window.setTimeout(options.onSlow, options.slowAfterMs);
  }

  try {
    const { data, error } = await supabase.functions.invoke<ImageScanPayload>('ai', {
      body: {
        imageBase64: compressedImage.imageBase64,
        mimeType: compressedImage.mimeType,
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
      const { data, error } = await supabase.functions.invoke<ImageScanPayload>('ai', {
        body: {
          imageBase64: compressedImage.imageBase64,
          mimeType: compressedImage.mimeType,
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

function makeInstantScan(fileName: string): ImageScanPayload {
  return {
    result: {
      productName: fileName.replace(/\.[^.]+$/, '') || 'Quick scan',
      overallRating: 'Caution',
      score: 50,
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
