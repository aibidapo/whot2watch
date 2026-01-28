// Minimal fetch-based client scaffold for our OpenAPI REST, to be replaced if needed
export type ClientConfig = { baseUrl?: string; headers?: Record<string, string> };

export default function createClient(cfg: ClientConfig = {}) {
  const baseUrl = (cfg.baseUrl || 'http://localhost:4000/v1').replace(/\/$/, '');
  async function request<T>(method: string, path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { ...(cfg.headers ?? {}) };
    if (method === 'GET') {
      // no content-type header on GET to avoid CORS preflight
    } else {
      headers['content-type'] = 'application/json';
    }
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      ...init,
    });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return (await res.json()) as T;
      const textBody: unknown = await res.text();
      return textBody as T;
    }
    throw new Error(`${method} ${path} ${res.status}`);
  }
  return {
    get: <T = unknown>(path: string) => request<T>('GET', path),
    post: <T = unknown>(path: string, body?: unknown) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      return request<T>('POST', path, { body: payload });
    },
    put: <T = unknown>(path: string, body?: unknown) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      return request<T>('PUT', path, { body: payload });
    },
    patch: <T = unknown>(path: string, body?: unknown) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      return request<T>('PATCH', path, { body: payload });
    },
    delete: <T = unknown>(path: string, body?: unknown) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      return request<T>('DELETE', path, { body: payload });
    },
  };
}
