import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub redis client before importing the app
const stubClient: any = {
  on: vi.fn(),
  connect: vi.fn(async () => {}),
  get: vi.fn(async () => null),
  setEx: vi.fn(async () => {}),
};

vi.mock('redis', () => ({
  createClient: () => stubClient,
}));

describe('search substring and DB fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).fetch;
    } catch {}
  });

  it('builds ngrams and wildcard should clauses for substring search', async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit | null) => {
      const bodyText = String((init as any)?.body);
      const body = JSON.parse(bodyText);
      const should: any[] = body.query?.bool?.should || [];
      const hasNgrams = should.some((c) => c.match && c.match['name.ngrams']);
      const hasWildcard = should.some((c) => c.wildcard && c.wildcard['name.keyword']);
      expect(hasNgrams || hasWildcard).toBe(true);
      return new Response(
        JSON.stringify({
          took: 1,
          hits: { total: { value: 1 }, hits: [{ _id: 'x', _source: { name: 'Demo' } }] },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', spy);
    const mod = await import('./api');
    const app = mod.default;
    (app as any).redis = stubClient;
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=own&size=1' });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalled();
  });

  it('falls back to DB when OpenSearch hits are empty', async () => {
    vi.mock('@prisma/client', () => ({
      PrismaClient: vi.fn().mockImplementation(() => ({
        title: {
          findMany: vi.fn(async () => [
            {
              id: 'db1',
              name: 'DB Only Title',
              type: 'MOVIE',
              releaseYear: 2024,
              availability: [],
              externalRatings: [],
            },
          ]),
        },
      })),
    }));

    const fetchStub = vi.fn(
      async () =>
        new Response(JSON.stringify({ took: 1, hits: { total: { value: 0 }, hits: [] } }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const mod = await import('./api');
    const app = mod.default;
    (app as any).redis = stubClient;
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=zzzz&size=1' });
    expect(res.statusCode).toBe(200);
    const payload = res.payload;
    const json = JSON.parse(payload as string) as any;
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items[0]?.name).toBe('DB Only Title');
  });
});
