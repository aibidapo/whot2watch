export function slugifyTitle(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 200);
}

function providerSearchUrl(service: string, query: string): string | undefined {
  const q = encodeURIComponent(query);
  switch (service) {
    case 'NETFLIX':
      return `https://www.netflix.com/search?q=${q}`;
    case 'DISNEY_PLUS':
      return `https://www.disneyplus.com/search?q=${q}`;
    case 'HULU':
      return `https://www.hulu.com/search?q=${q}`;
    case 'MAX':
      return `https://play.max.com/search?q=${q}`;
    case 'AMAZON_PRIME_VIDEO':
      return `https://www.primevideo.com/search?phrase=${q}`;
    case 'APPLE_TV_PLUS':
      return `https://tv.apple.com/search?term=${q}`;
    case 'PARAMOUNT_PLUS':
      return `https://www.paramountplus.com/search/?q=${q}`;
    case 'PEACOCK':
      return `https://www.peacocktv.com/search?q=${q}`;
    default:
      return undefined;
  }
}

export interface DeepLinkContext {
  service: string;
  titleName: string;
  tmdbId?: bigint | number | string;
  type?: 'MOVIE' | 'SHOW';
  releaseYear?: number;
}

export function normalizeDeepLink(ctx: DeepLinkContext): string | undefined {
  // Prefer provider search by title for portability. Include year for precision when present.
  const titleQuery = ctx.releaseYear ? `${ctx.titleName} (${ctx.releaseYear})` : ctx.titleName;
  const search = providerSearchUrl(ctx.service, titleQuery);
  if (search) return search;
  // Fallback to TMDB page when available
  if (ctx.tmdbId) {
    const id = String(ctx.tmdbId);
    const seg = ctx.type === 'SHOW' ? 'tv' : 'movie';
    return `https://www.themoviedb.org/${seg}/${id}`;
  }
  return undefined;
}
