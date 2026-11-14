const getDefaultApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  const isProd = import.meta.env.PROD;
  const isBrowser = typeof window !== "undefined" && !!window.location?.hostname;
  const isLocalhost =
    isBrowser &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  // In production on a deployed domain (like *.vercel.app), never use a baked-in localhost URL
  if (
    isProd &&
    envUrl &&
    (envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) &&
    isBrowser &&
    !isLocalhost
  ) {
    return "/api";
  }

  if (envUrl) {
    return envUrl;
  }
  if (isProd) {
    return "/api";
  }
  // In development, preserve the current hostname (localhost vs 127.0.0.1)
  const host = isBrowser ? window.location.hostname : "localhost";
  return `http://${host}:4000/api`;
};

const rawBase = getDefaultApiBase();

export const API_BASE = rawBase.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  isForm?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { isForm, headers, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include", // send the httpOnly session cookie
      headers: isForm
        ? headers
        : { "Content-Type": "application/json", ...headers },
      ...rest,
    });
  } catch (err: any) {
    console.error("[apiClient] Network request failed:", err);
    throw new ApiError(
      `Backend server is not reachable at ${API_BASE}. Please ensure the backend is running.`,
      0,
      "NETWORK_ERROR"
    );
  }

  let body: unknown = null;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    body = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error || `Request failed (${res.status})`;
    const code = (body as { code?: string } | null)?.code;
    throw new ApiError(message, res.status, code);
  }

  return body as T;
}

export interface HealthStatus {
  ok: boolean;
  message?: string;
  url: string;
}

export async function checkBackendHealth(): Promise<HealthStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const healthRes = await fetch(`${API_BASE}/health`, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (healthRes.ok) {
      const data = await healthRes.json().catch(() => ({}));
      return {
        ok: true,
        message: data.message || data.service || "NutriSnap AI API is running",
        url: `${API_BASE}/health`,
      };
    }

    const res = await fetch(`${API_BASE}`, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: true,
        message: data.message || "NutriSnap AI API is running",
        url: API_BASE,
      };
    }
    return {
      ok: false,
      message: `Backend returned status ${healthRes.status}`,
      url: `${API_BASE}/health`,
    };
  } catch {
    clearTimeout(timeoutId);
    return {
      ok: false,
      message: `Backend server is not reachable at ${API_BASE}. Please ensure the backend is running.`,
      url: API_BASE,
    };
  }
}

