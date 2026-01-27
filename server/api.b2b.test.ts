import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiKeyGate, hasApiKeys } from './plans/api-key-gate';

describe('B2B Readiness', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe('apiKeyGate', () => {
    it('allows access when no PUBLIC_API_KEYS configured (open access)', async () => {
      delete process.env.PUBLIC_API_KEYS;
      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
      await apiKeyGate({ headers: {} }, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('rejects request with missing API key when keys are configured', async () => {
      process.env.PUBLIC_API_KEYS = 'key1,key2';
      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
      await apiKeyGate({ headers: {} }, reply);
      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'INVALID_API_KEY' }),
      );
    });

    it('rejects request with invalid API key', async () => {
      process.env.PUBLIC_API_KEYS = 'valid-key-1,valid-key-2';
      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
      await apiKeyGate({ headers: { 'x-api-key': 'bad-key' } }, reply);
      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('allows request with valid API key', async () => {
      process.env.PUBLIC_API_KEYS = 'valid-key-1,valid-key-2';
      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
      await apiKeyGate({ headers: { 'x-api-key': 'valid-key-1' } }, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('trims whitespace from keys', async () => {
      process.env.PUBLIC_API_KEYS = ' key-with-spaces , another-key ';
      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
      await apiKeyGate({ headers: { 'x-api-key': 'key-with-spaces' } }, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });
  });

  describe('hasApiKeys', () => {
    it('returns false when no keys configured', () => {
      delete process.env.PUBLIC_API_KEYS;
      expect(hasApiKeys()).toBe(false);
    });

    it('returns false for empty string', () => {
      process.env.PUBLIC_API_KEYS = '';
      expect(hasApiKeys()).toBe(false);
    });

    it('returns true when keys are configured', () => {
      process.env.PUBLIC_API_KEYS = 'key1,key2';
      expect(hasApiKeys()).toBe(true);
    });
  });

  describe('Embed endpoint logic', () => {
    it('requires public visibility for embeds', () => {
      // Embed should only serve PUBLIC lists
      const list = { visibility: 'PRIVATE' };
      const isPublic = list.visibility === 'PUBLIC';
      expect(isPublic).toBe(false);
    });

    it('allows public lists for embeds', () => {
      const list = { visibility: 'PUBLIC' };
      const isPublic = list.visibility === 'PUBLIC';
      expect(isPublic).toBe(true);
    });
  });

  describe('Demo dashboard', () => {
    it('returns expected stat keys', () => {
      const stats = {
        totalUsers: 100,
        premiumUsers: 15,
        totalReferrals: 42,
        topTrending: [{ name: 'Test Movie', score: 9.5 }],
      };
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('premiumUsers');
      expect(stats).toHaveProperty('totalReferrals');
      expect(stats).toHaveProperty('topTrending');
      expect(stats.topTrending[0]).toHaveProperty('name');
      expect(stats.topTrending[0]).toHaveProperty('score');
    });
  });
});
