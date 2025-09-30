// Ambient module shims for CJS helpers used via dynamic import in server code

declare module '../services/catalog/tmdb.js' {
  export function fetchExternalIds(
    mediaType: string,
    tmdbId: number,
  ): Promise<{ imdb_id?: string; [key: string]: unknown }>;
}

declare module '../services/catalog/tmdb' {
  export function fetchExternalIds(
    mediaType: string,
    tmdbId: number,
  ): Promise<{ imdb_id?: string; [key: string]: unknown }>;
}

declare module '../services/catalog/omdb.js' {
  export function fetchOmdbByImdb(imdbId: string): Promise<any>;
  export function mapOmdbRatings(
    omdbJson: any,
  ): Array<{ source: string; valueText: string; valueNum?: number | null }>;
}

declare module '../services/catalog/omdb' {
  export function fetchOmdbByImdb(imdbId: string): Promise<any>;
  export function mapOmdbRatings(
    omdbJson: any,
  ): Array<{ source: string; valueText: string; valueNum?: number | null }>;
}

// Fallback wildcard for any other helpers in services/catalog
declare module '../services/catalog/*' {
  const mod: any;
  export = mod;
}
