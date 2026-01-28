import { describe, it, expect, vi } from 'vitest';
import { hppHook } from './hpp';

function makeReq(query: Record<string, unknown>) {
  return { query } as any;
}

describe('hppHook', () => {
  it('collapses array params to the last value', () => {
    const req = makeReq({ sort: ['name', 'date', 'id'] });
    const done = vi.fn();
    hppHook(req, {} as any, done);
    expect(req.query.sort).toBe('id');
    expect(done).toHaveBeenCalled();
  });

  it('leaves single-value params untouched', () => {
    const req = makeReq({ q: 'hello', page: '2' });
    const done = vi.fn();
    hppHook(req, {} as any, done);
    expect(req.query.q).toBe('hello');
    expect(req.query.page).toBe('2');
    expect(done).toHaveBeenCalled();
  });

  it('handles non-object query safely', () => {
    const req = { query: null } as any;
    const done = vi.fn();
    hppHook(req, {} as any, done);
    expect(done).toHaveBeenCalled();
  });

  it('handles undefined query safely', () => {
    const req = { query: undefined } as any;
    const done = vi.fn();
    hppHook(req, {} as any, done);
    expect(done).toHaveBeenCalled();
  });
});
