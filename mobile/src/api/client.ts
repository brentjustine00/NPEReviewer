const RAW_API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "").trim();
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "") || "http://localhost:8000";

let authToken: string | null = null;

export const setAuthToken = (token?: string) => {
  authToken = token || null;
};

type Method = "GET" | "POST";

function buildBaseCandidates() {
  const list = [API_BASE_URL];
  if (__DEV__ && (API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1"))) {
    list.push(API_BASE_URL.replace("localhost", "10.0.2.2"));
    list.push(API_BASE_URL.replace("127.0.0.1", "10.0.2.2"));
  }
  if (__DEV__ && !list.some((x) => x.includes("10.0.2.2"))) {
    list.push("http://10.0.2.2:8000");
  }
  return [...new Set(list)];
}

export async function apiRequest<T>(
  path: string,
  method: Method = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  if (!__DEV__ && !RAW_API_BASE_URL) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_URL in release build. Set it in EAS Environment Variables, then rebuild."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const candidates = buildBaseCandidates();
  let res: Response | null = null;
  let lastError: unknown = null;
  for (const base of candidates) {
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!res) {
    const fallback = lastError instanceof Error ? lastError.message : "Network request failed";
    throw new Error(`Network request failed for ${API_BASE_URL}${path}. ${fallback}`);
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return payload as T;
}
