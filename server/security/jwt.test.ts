import { describe, it, expect } from 'vitest';
import { verifyJwtWithDeps } from './jwtCore';

const deps = {
  jwksClientFactory: (_uri: string) => ({
    getSigningKey: (
      _kid: string,
      cb: (err: Error | null, key?: { getPublicKey: () => string }) => void,
    ) => {
      cb(null, { getPublicKey: () => 'public-key' });
    },
  }),
  jwtVerify: (
    token: string,
    _getKey: any,
    _opts: any,
    cb: (err: Error | null, decoded?: unknown) => void,
  ) => {
    if (token === 'bad') return cb(new Error('bad token'));
    cb(null, { sub: 'user-1' });
  },
};

describe('verifyJwtWithDeps', () => {
  it('resolves decoded payload on success', async () => {
    const decoded = await verifyJwtWithDeps(
      'good',
      { issuer: 'iss', audience: 'aud', jwksUri: 'https://jwks' },
      deps,
    );
    expect(decoded.sub).toBe('user-1');
  });

  it('rejects on token error', async () => {
    await expect(
      verifyJwtWithDeps('bad', { issuer: 'iss', audience: 'aud', jwksUri: 'https://jwks' }, deps),
    ).rejects.toThrow('bad token');
  });

  it('rejects on missing kid', async () => {
    const depsMissingKid = {
      ...deps,
      jwtVerify: (_token: string, getKey: any, _opts: any, cb: any) => {
        getKey({}, (err: Error | null) => cb(err));
      },
    };
    await expect(
      verifyJwtWithDeps(
        'good',
        { issuer: 'iss', audience: 'aud', jwksUri: 'https://jwks' },
        depsMissingKid as any,
      ),
    ).rejects.toThrow('Missing kid');
  });
});
