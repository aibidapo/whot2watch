import { randomUUID } from 'crypto';

export function withRequestId(
  req: { headers?: Record<string, string> },
  res: { setHeader?: (k: string, v: string) => void },
  next: () => void,
) {
  const existing = req.headers?.['x-request-id'];
  const id = existing && existing.length > 0 ? existing : randomUUID();
  if (res.setHeader) res.setHeader('x-request-id', id);
  (req as any).requestId = id;
  next();
}
