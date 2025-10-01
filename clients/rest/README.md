# REST SDK (generated)

This folder holds a TypeScript client generated from the OpenAPI spec.

Usage (Node/Next.js):

```ts
import createClient from './client';

const client = createClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1',
});

async function getPicks(profileId: string) {
  const res = await client.GET('/picks', { params: { query: { profileId } } });
  if (!res.data) throw new Error('No data');
  return res.data;
}
```

Regenerate after spec changes:

```bash
pnpm gen:sdk && pnpm gen:sdk:client
```
