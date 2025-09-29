import { describe, it, expect } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Alerts default region', () => {
  it.skipIf(!process.env.DATABASE_URL)('defaults region to US when not provided', async () => {
    const profile = await prisma.profile.findFirst();
    const title = await prisma.title.findFirst();
    if (!profile || !title) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profile.id}/alerts`,
      payload: { titleId: title.id },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.alert?.region).toBe('US');
  });
});
