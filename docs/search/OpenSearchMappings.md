# OpenSearch Index Mappings — Titles

Index: titles

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "title_edge": {
          "tokenizer": "edge_ngram",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "edge_ngram": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 15
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text", "analyzer": "title_edge", "search_analyzer": "standard" },
      "type": { "type": "keyword" },
      "releaseYear": { "type": "integer" },
      "runtimeMin": { "type": "integer" },
      "genres": { "type": "keyword" },
      "moods": { "type": "keyword" },
      "availabilityServices": { "type": "keyword" },
      "availabilityRegions": { "type": "keyword" },
      "popularity": { "type": "float" },
      "availability": {
        "type": "nested",
        "properties": {
          "service": { "type": "keyword" },
          "region": { "type": "keyword" },
          "offerType": { "type": "keyword" }
        }
      }
    }
  }
}
```

Notes

- Use nested availability to filter on service/region.
- Edge n-gram analyzer supports typeahead for title names.
