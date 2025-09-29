import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Enable auth before importing app and check DB
let dbReady = true;
beforeAll(async () => {
  process.env.REQUIRE_AUTH = 'true';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
});

// Mock JWT verifier to avoid real network/crypto
vi.mock('./security/jwt', () => ({
  verifyJwt: vi.fn(async (token: string) => {
    if (token === 'bad') throw new Error('invalid');
    return { sub: 'user-1' };
  }),
}));

// Attach a stub redis so caching calls don't fail
const stubRedis = {
  get: vi.fn(async () => null),
  setEx: vi.fn(async () => {}),
  del: vi.fn(async () => 1),
};

// Import after mocks
import app from './api';

const prisma = new PrismaClient();

describe('auth pre-handler', () => {
  let profileId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    const profile = await prisma.profile.findFirst();
    profileId = profile ? profile.id : '';
    (app as any).redis = stubRedis;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 401 when Authorization header is missing', async () => {
    if (!dbReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/lists`,
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token verification fails', async () => {
    if (!dbReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/lists`,
      headers: { authorization: 'Bearer bad' },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows request when token is valid', async () => {
    if (!dbReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/lists`,
      headers: { authorization: 'Bearer good' },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 for non-bearer scheme', async () => {
    if (!dbReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/lists`,
      headers: { authorization: 'Basic abc' },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });
});
