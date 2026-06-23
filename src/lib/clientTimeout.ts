type TimeoutOptions<T> = {
  task: () => Promise<T>;
  fallback: () => T;
  slowAfterMs?: number;
  hardTimeoutMs?: number;
  onSlow?: () => void;
  onTimeout?: () => void;
};

export async function runWithClientTimeout<T>({
  task,
  fallback,
  slowAfterMs = 8_000,
  hardTimeoutMs = 12_000,
  onSlow,
  onTimeout,
}: TimeoutOptions<T>): Promise<T> {
  let slowTimer: number | undefined;
  let hardTimer: number | undefined;

  try {
    slowTimer = window.setTimeout(() => {
      onSlow?.();
    }, slowAfterMs);

    const timeoutPromise = new Promise<T>((resolve) => {
      hardTimer = window.setTimeout(() => {
        onTimeout?.();
        resolve(fallback());
      }, hardTimeoutMs);
    });

    return await Promise.race([task(), timeoutPromise]);
  } finally {
    if (slowTimer !== undefined) {
      window.clearTimeout(slowTimer);
    }

    if (hardTimer !== undefined) {
      window.clearTimeout(hardTimer);
    }
  }
}
