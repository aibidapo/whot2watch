// Shared OpenSearch mapping for titles index
// Keep in sync with docs at docs/search/OpenSearchMappings.md
const titlesMapping = {
  settings: {
    analysis: {
      analyzer: {
        title_edge: { tokenizer: 'edge_ngram', filter: ['lowercase'] },
      },
      tokenizer: {
        edge_ngram: { type: 'edge_ngram', min_gram: 2, max_gram: 15 },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      tmdbId: { type: 'long' },
      name: { type: 'text', analyzer: 'title_edge', search_analyzer: 'standard' },
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
