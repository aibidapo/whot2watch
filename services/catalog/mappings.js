// Shared OpenSearch mapping for titles index
// Keep in sync with docs at docs/search/OpenSearchMappings.md
const titlesMapping = {
  settings: {
    analysis: {
      analyzer: {
        title_edge: { tokenizer: 'edge_ngram', filter: ['lowercase'] },
        title_ngram: { tokenizer: 'ngram_token', filter: ['lowercase'] },
      },
      tokenizer: {
        edge_ngram: { type: 'edge_ngram', min_gram: 2, max_gram: 15 },
        // OpenSearch default max_ngram_diff=1, so use 2..3 to stay within limit
        ngram_token: { type: 'ngram', min_gram: 2, max_gram: 3 },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      tmdbId: { type: 'long' },
      name: {
        type: 'text',
        analyzer: 'title_edge',
        search_analyzer: 'standard',
        fields: {
          ngrams: { type: 'text', analyzer: 'title_ngram', search_analyzer: 'standard' },
          keyword: { type: 'keyword', ignore_above: 256 },
        },
      },
      type: { type: 'keyword' },
      releaseYear: { type: 'integer' },
      runtimeMin: { type: 'integer' },
      genres: { type: 'keyword' },
      moods: { type: 'keyword' },
      posterUrl: { type: 'keyword' },
      backdropUrl: { type: 'keyword' },
      voteAverage: { type: 'float' },
      availabilityServices: { type: 'keyword' },
      availabilityRegions: { type: 'keyword' },
      popularity: { type: 'float' },
      ratingsImdb: { type: 'float' },
      ratingsRottenTomatoes: { type: 'float' },
      ratingsMetacritic: { type: 'float' },
      availability: {
        type: 'nested',
        properties: {
          service: { type: 'keyword' },
          region: { type: 'keyword' },
          offerType: { type: 'keyword' },
          deepLink: { type: 'keyword' },
        },
      },
    },
  },
};

module.exports = { titlesMapping };
