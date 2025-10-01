// Minimal fetch-based client scaffold for our OpenAPI REST, to be replaced if needed
export type ClientConfig = { baseUrl?: string; headers?: Record<string, string> };

export default function createClient(cfg: ClientConfig = {}) {
  const baseUrl = (cfg.baseUrl || 'http://localhost:4000/v1').replace(/\/$/, '');
  async function request<T>(method: string, path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cfg.headers ?? {}) },
      ...init,
    });
    if (!res.ok) throw new Error(`${method} ${path} ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return (await res.json()) as T;
    // @ts-expect-error allow non-json
    return (await res.text()) as T;
  }
  return {
    get: request.bind(undefined, 'GET') as <T>(path: string) => Promise<T>,
    post: request.bind(undefined, 'POST') as <T>(path: string, body?: unknown) => Promise<T>,
  };
}
