// Provider alias map → canonical enum names used in our schema (Service)
const providerAliasToCanonical = {
  netflix: 'NETFLIX',
  'netflix, inc.': 'NETFLIX',
  prime: 'AMAZON_PRIME_VIDEO',
  'amazon prime video': 'AMAZON_PRIME_VIDEO',
  'amazon video': 'AMAZON_PRIME_VIDEO',
  disney: 'DISNEY_PLUS',
  'disney+': 'DISNEY_PLUS',
  hulu: 'HULU',
  max: 'MAX',
  'hbo max': 'MAX',
  'apple tv+': 'APPLE_TV_PLUS',
  'apple tv plus': 'APPLE_TV_PLUS',
  paramount: 'PARAMOUNT_PLUS',
  peacock: 'PEACOCK',
  crunchyroll: 'CRUNCHYROLL',
  tubi: 'TUBI',
  youtube: 'YOUTUBE',
  'youtube tv': 'YOUTUBE',
  'youtube premium': 'YOUTUBE',
};

function canonicalizeProvider(raw) {
  if (!raw) return 'OTHER';
  const key = String(raw).trim().toLowerCase();
  return providerAliasToCanonical[key] || 'OTHER';
}

module.exports = { canonicalizeProvider };
