// Ambient types for CJS module './providerAlias' (relative import)
declare module './providerAlias' {
  export function canonicalizeProvider(input: string): string | undefined;
}
// Some bundler resolutions may append .js in type resolution
declare module './providerAlias.js' {
  export function canonicalizeProvider(input: string): string | undefined;
}
