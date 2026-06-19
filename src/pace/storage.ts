export function readText(key: string, fallback: string) {
  return typeof window === 'undefined' ? fallback : window.localStorage.getItem(key) ?? fallback;
}

export function readBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return value === 'true' ? true : value === 'false' ? false : fallback;
}

export function readJson<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

export function writeText(key: string, value: string, fallback: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (value === fallback) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
}

export function writeBoolean(key: string, value: boolean, fallback: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  if (value === fallback) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, String(value));
  }
}

export function writeJson<T>(key: string, value: T | null, isEmpty: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  if (isEmpty || value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}
