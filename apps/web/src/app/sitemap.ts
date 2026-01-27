import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/picks`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/lists`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/subscriptions`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/social`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/friends`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];
}
