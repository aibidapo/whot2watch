import { describe, it, expect, vi } from 'vitest';

vi.mock('./jwtCore', () => ({
  verifyJwtWithDeps: vi.fn(async () => ({ sub: 'u' })),
}));

describe('verifyJwt wrapper', () => {
  it('delegates to core and resolves decoded', async () => {
    const { verifyJwt } = await import('./jwt');
    const res = await verifyJwt('tok', { issuer: 'i', audience: 'a', jwksUri: 'u' });
    expect(res.sub).toBe('u');
  });
});
