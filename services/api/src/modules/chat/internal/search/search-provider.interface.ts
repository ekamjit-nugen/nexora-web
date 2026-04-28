import { SearchFilters, SearchResult } from './search.service';

/**
 * Search provider abstraction.
 * Allows swapping between MongoDB full-text search and Elasticsearch
 * without changing consumer code.
 */
export interface ISearchProvider {
  /**
   * Execute a search query and return matching messages.
   */
  search(
    query: SearchFilters,
    userId: string,
    orgId: string,
    page?: number,
    limit?: number,
  ): Promise<{ results: SearchResult[]; total: number }>;
}

/**
 * Injection token used by the search module factory provider.
 */
export const SEARCH_PROVIDER = 'SEARCH_PROVIDER';
