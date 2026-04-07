import { Injectable, Logger } from '@nestjs/common';
import { ISearchProvider } from './search-provider.interface';
import { SearchFilters, SearchResult, SearchService } from './search.service';

/**
 * Elasticsearch search provider.
 *
 * When ELASTICSEARCH_URL is configured, this provider will use the
 * @elastic/elasticsearch client. Until then it logs a notice and
 * delegates every call to the MongoDB-backed SearchService.
 *
 * TODO: Full Elasticsearch implementation
 * - Connect to the cluster via `new Client({ node: process.env.ELASTICSEARCH_URL })`
 * - Create / update the index mapping on module init
 * - Build the Elasticsearch query from SearchFilters
 * - Return results with highlighting
 */

// ── Index configuration (ready for when ES is wired up) ──

/** Elasticsearch index name for chat messages. */
export const ES_INDEX_NAME = 'nexora_messages';

/** Elasticsearch mapping for the messages index. */
export const ES_INDEX_MAPPING = {
  properties: {
    conversationId: { type: 'keyword' as const },
    senderId: { type: 'keyword' as const },
    organizationId: { type: 'keyword' as const },
    content: { type: 'text' as const, analyzer: 'standard' },
    contentPlainText: { type: 'text' as const, analyzer: 'standard' },
    type: { type: 'keyword' as const },
    createdAt: { type: 'date' as const },
    isDeleted: { type: 'boolean' as const },
  },
};

/**
 * Build an Elasticsearch query body from SearchFilters.
 * TODO: Wire this into the real ES client when ready.
 */
export function buildEsQuery(filters: SearchFilters, conversationIds: string[]) {
  const must: any[] = [];
  const filter: any[] = [
    { terms: { conversationId: conversationIds } },
    { term: { isDeleted: false } },
  ];

  if (filters.q) {
    must.push({
      multi_match: {
        query: filters.q,
        fields: ['content', 'contentPlainText'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  if (filters.from) {
    filter.push({ term: { senderId: filters.from } });
  }

  if (filters.in) {
    // Override the conversation filter with specific conversation
    filter[0] = { term: { conversationId: filters.in } };
  }

  if (filters.type) {
    filter.push({ term: { type: filters.type } });
  }

  const range: any = {};
  if (filters.before) range.lt = filters.before;
  if (filters.after) range.gt = filters.after;
  if (Object.keys(range).length > 0) {
    filter.push({ range: { createdAt: range } });
  }

  return {
    bool: {
      must: must.length > 0 ? must : [{ match_all: {} }],
      filter,
    },
  };
}

@Injectable()
export class ElasticsearchProvider implements ISearchProvider {
  private readonly logger = new Logger(ElasticsearchProvider.name);
  private readonly esConfigured: boolean;

  constructor(private readonly mongoSearchService: SearchService) {
    this.esConfigured = !!process.env.ELASTICSEARCH_URL;

    if (!this.esConfigured) {
      this.logger.warn(
        'Elasticsearch not configured (ELASTICSEARCH_URL not set), using MongoDB search provider as fallback.',
      );
    } else {
      this.logger.log(`Elasticsearch configured at ${process.env.ELASTICSEARCH_URL}`);
      // TODO: Initialize @elastic/elasticsearch Client here
      // const { Client } = require('@elastic/elasticsearch');
      // this.esClient = new Client({ node: process.env.ELASTICSEARCH_URL });
      // this.ensureIndex();
    }
  }

  /**
   * TODO: Create or update the Elasticsearch index if it doesn't exist.
   */
  // private async ensureIndex(): Promise<void> {
  //   const exists = await this.esClient.indices.exists({ index: ES_INDEX_NAME });
  //   if (!exists) {
  //     await this.esClient.indices.create({
  //       index: ES_INDEX_NAME,
  //       body: { mappings: ES_INDEX_MAPPING },
  //     });
  //     this.logger.log(`Created Elasticsearch index: ${ES_INDEX_NAME}`);
  //   }
  // }

  async search(
    query: SearchFilters,
    userId: string,
    orgId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ results: SearchResult[]; total: number }> {
    if (!this.esConfigured) {
      // Delegate to MongoDB provider
      return this.mongoSearchService.search(query, userId, orgId, page, limit);
    }

    // TODO: Implement actual Elasticsearch search
    // const esQuery = buildEsQuery(query, conversationIds);
    // const response = await this.esClient.search({
    //   index: ES_INDEX_NAME,
    //   body: {
    //     query: esQuery,
    //     from: (page - 1) * limit,
    //     size: limit,
    //     highlight: { fields: { content: {}, contentPlainText: {} } },
    //   },
    // });
    // return { results: mapEsHits(response.hits.hits), total: response.hits.total.value };

    this.logger.warn('Elasticsearch search not yet implemented, falling back to MongoDB');
    return this.mongoSearchService.search(query, userId, orgId, page, limit);
  }
}
