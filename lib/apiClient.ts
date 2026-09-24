/**
 * PocketKirana — Centralized Production API Client
 *
 * Single source of truth for all client-side API requests across:
 * - Customer Web
 * - Customer Android APK (Capacitor WebView)
 * - Picker Android APK
 * - Delivery Android APK
 * - Admin Portal
 *
 * Guarantees:
 * 1. Never relies on localhost inside Android APKs (https://localhost is on-device WebView).
 * 2. Injects authoritative production/staging API base URL when running in mobile Capacitor shells.
 * 3. Enforces HTTPS, standard headers, configurable timeouts, and graceful error mapping.
 */

export const DEFAULT_PRODUCTION_API_URL = 'https://pocketkirana.in';

/**
 * Detects whether the current execution context is inside a Capacitor mobile shell
 */
export function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;

  const origin = window.location.origin || '';
  const protocol = window.location.protocol || '';
  const port = window.location.port || '';
  const hostname = window.location.hostname || '';

  // In regular browser development (e.g. http://localhost:3000 or http://localhost:3001), it is NOT Capacitor.
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '' && protocol === 'http:') {
    return false;
  }

  return (
    origin === 'https://localhost' ||
    origin === 'capacitor://localhost' ||
    protocol === 'capacitor:' ||
    protocol === 'file:' ||
    (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.())
  );
}

/**
 * Resolves the authoritative API base URL
 */
export function getApiBaseUrl(): string {
  // 1. If running inside Capacitor APK on mobile device (origin https://localhost)
  if (isCapacitorApp()) {
    return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_PRODUCTION_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  // 2. If running in a local browser (e.g. localhost:3000 vs localhost:3001/3002/3003)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || '';
    const port = window.location.port || '';
    const protocol = window.location.protocol || '';

    if ((hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) && protocol === 'http:') {
      // Main root backend runs on port 3000 (or default port). Relative URL is appropriate.
      if (port === '3000' || !port) {
        return '';
      }
      // Sub-apps (customer-app on 3002, picker on 3001, delivery on 3003) connect to local Next.js backend on 3000
      if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('pocketkirana.in')) {
        return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
      }
      return `http://${hostname}:3000`;
    }
  }

  // 3. Explicit public API URL from build-time environment variable (for static export builds)
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    const raw = process.env.NEXT_PUBLIC_API_URL.trim();
    if (raw) {
      return raw.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
  }

  // 4. Explicit public Site URL
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL) {
    const raw = process.env.NEXT_PUBLIC_SITE_URL.trim();
    if (raw) {
      return raw.replace(/\/$/, '');
    }
  }

  // Default to relative URL for standard web navigation
  return '';
}

/**
 * Builds full API endpoint URL from relative path
 */
export function buildApiUrl(path: string): string {
  if (!path) return '';
  // If already absolute URL, return as-is
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Centralized fetch with base URL resolution, timeout, and response normalization
 */
export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  let fullUrl = buildApiUrl(path);

  // Append query params if provided
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Only set application/json if body is not FormData
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    return response;
  } catch (err: any) {
    // If target was pocketkirana.in and failed (e.g. running in local development), attempt localhost:3000 fallback
    if (typeof window !== 'undefined' && fullUrl.includes('pocketkirana.in')) {
      try {
        const fallbackUrl = fullUrl.replace('https://pocketkirana.in', `${window.location.protocol}//${window.location.hostname}:3000`);
        const fallbackRes = await fetch(fallbackUrl, {
          ...options,
          headers,
          signal: options.signal || controller.signal,
        });
        return fallbackRes;
      } catch {
        // Fallback also failed, re-throw original error
      }
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convenience JSON client methods
 */
export const apiClient = {
  get: async <T = any>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> => {
    try {
      const res = await apiFetch<T>(path, { ...options, method: 'GET' });
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data?.error || data?.message || `Request failed with status ${res.status}`) : undefined,
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      return {
        ok: false,
        status: isTimeout ? 408 : 0,
        error: isTimeout
          ? 'Request timed out. Please check your internet connection.'
          : (err.message || 'Unable to connect to PocketKirana server.'),
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }
  },

  post: async <T = any>(path: string, body?: any, options: ApiFetchOptions = {}): Promise<ApiResult<T>> => {
    try {
      const serializedBody = body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined);
      const res = await apiFetch<T>(path, {
        ...options,
        method: 'POST',
        body: serializedBody,
      });
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data?.error || data?.message || `Request failed with status ${res.status}`) : undefined,
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      return {
        ok: false,
        status: isTimeout ? 408 : 0,
        error: isTimeout
          ? 'Request timed out. Please check your internet connection.'
          : (err.message || 'Unable to connect to PocketKirana server.'),
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }
  },

  put: async <T = any>(path: string, body?: any, options: ApiFetchOptions = {}): Promise<ApiResult<T>> => {
    try {
      const serializedBody = body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined);
      const res = await apiFetch<T>(path, {
        ...options,
        method: 'PUT',
        body: serializedBody,
      });
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data?.error || data?.message || `Request failed with status ${res.status}`) : undefined,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        error: err.message || 'Unable to connect to PocketKirana server.',
        code: 'NETWORK_ERROR',
      };
    }
  },

  patch: async <T = any>(path: string, body?: any, options: ApiFetchOptions = {}): Promise<ApiResult<T>> => {
    try {
      const serializedBody = body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined);
      const res = await apiFetch<T>(path, {
        ...options,
        method: 'PATCH',
        body: serializedBody,
      });
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data?.error || data?.message || `Request failed with status ${res.status}`) : undefined,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        error: err.message || 'Unable to connect to PocketKirana server.',
        code: 'NETWORK_ERROR',
      };
    }
  },

  delete: async <T = any>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> => {
    try {
      const res = await apiFetch<T>(path, { ...options, method: 'DELETE' });
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data?.error || data?.message || `Request failed with status ${res.status}`) : undefined,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        error: err.message || 'Unable to connect to PocketKirana server.',
        code: 'NETWORK_ERROR',
      };
    }
  },
};
