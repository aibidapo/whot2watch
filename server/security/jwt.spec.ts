import { describe, it, expect, vi } from 'vitest';
import * as mod from './jwt';

vi.mock('jwks-rsa', () => ({
  default: () => ({
    getSigningKey: (_kid: string, cb: any) => cb(null, { getPublicKey: () => 'k' }),
  }),
}));
vi.mock('jsonwebtoken', () => ({
  default: { verify: (_t: string, _getKey: any, _opts: any, cb: any) => cb(null, { sub: 'u' }) },
  verify: (_t: string, _getKey: any, _opts: any, cb: any) => cb(null, { sub: 'u' }),
}));

describe('verifyJwt wrapper', () => {
  it('delegates to core and resolves decoded', async () => {
    const res = await mod.verifyJwt('tok', { issuer: 'i', audience: 'a', jwksUri: 'u' });
    expect(res.sub).toBe('u');
  });
});
