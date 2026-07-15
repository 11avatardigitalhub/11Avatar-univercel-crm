/**
 * ==========================================
 * FILE: retrieval.js
 * MODULE: AI Module
 * CODE: AI-MEM-3
 * PRIORITY: P1
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Retrieval service for semantic search and knowledge retrieval.
 * Combines vector search with filtering, ranking, and reranking
 * to provide accurate and relevant results.
 * 
 * DEPENDENCIES:
 * - vectorStore.js (for vector search)
 * - embeddings.js (for embedding generation)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize retrieval service
 * - retrieve(query, options): Retrieve relevant items
 * - retrieveByVector(vector, options): Retrieve by vector
 * - retrieveWithFilter(query, filter, options): Retrieve with filter
 * - retrieveWithRerank(query, topK, options): Retrieve and rerank
 * - getRelevantDocuments(query, topK): Get relevant documents
 * - getRelevantKnowledge(query, topK): Get relevant knowledge
 * - getRelevantLeads(query, topK): Get relevant leads
 * - getRelevantCustomers(query, topK): Get relevant customers
 * - getRelevantDeals(query, topK): Get relevant deals
 * - getRelevantTasks(query, topK): Get relevant tasks
 * - getRelevantNotes(query, topK): Get relevant notes
 * - getRelevantHistory(query, topK): Get relevant history
 * - getRelevantConversations(query, topK): Get relevant conversations
 * - getRetrievalStats(): Get statistics
 * 
 * USAGE EXAMPLE:
 * import { retrieval } from './modules/ai/retrieval.js';
 * 
 * // Initialize retrieval
 * await retrieval.initialize();
 * 
 * // Retrieve relevant items
 * const results = await retrieval.retrieve(
 *   'Lead qualification process',
 *   { topK: 10, types: ['knowledge', 'documents'] }
 * );
 * 
 * // Retrieve with filter
 * const results = await retrieval.retrieveWithFilter(
 *   'Customer churn',
 *   { status: 'active', industry: 'IT' },
 *   { topK: 5 }
 * );
 * 
 * // Retrieve and rerank
 * const results = await retrieval.retrieveWithRerank(
 *   'Sales pipeline optimization',
 *   10
 * );
 * ==========================================
 */

import { vectorStore } from './vectorStore.js';
import { embeddings } from './embeddings.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Default configuration
const DEFAULT_CONFIG = {
    topK: 10,
    minScore: 0.3,
    rerank: true,
    rerankTopK: 30,
    enableCaching: true,
    cacheTTL: 300000, // 5 minutes
    similarityMetric: 'cosine',
    filters: {
        enabled: true,
        maxFilters: 10
    },
    types: {
        knowledge: { weight: 1.0, collection: 'knowledge' },
        documents: { weight: 0.9, collection: 'documents' },
        leads: { weight: 0.8, collection: 'leads' },
        customers: { weight: 0.8, collection: 'customers' },
        deals: { weight: 0.7, collection: 'deals' },
        tasks: { weight: 0.6, collection: 'tasks' },
        notes: { weight: 0.7, collection: 'notes' },
        history: { weight: 0.5, collection: 'history' },
        conversations: { weight: 0.8, collection: 'conversations' }
    }
};

// Retrieval type priorities
const TYPE_PRIORITIES = {
    knowledge: 10,
    documents: 9,
    leads: 8,
    customers: 8,
    deals: 7,
    conversations: 7,
    notes: 6,
    tasks: 5,
    history: 4
};

class Retrieval {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = { ...DEFAULT_CONFIG };
        this.resultsCache = new Map();
        this.cacheTimestamps = new Map();
        this.feedback = new Map();
        
        // Statistics
        this.stats = {
            totalRetrievals: 0,
            avgRetrievalTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            byType: {},
            avgResults: 0
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize retrieval service
     * @param {object} options - Initialization options
     * @returns {boolean} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }

        try {
            // Update config if provided
            if (options.config) {
                this.config = { ...this.config, ...options.config };
            }

            // Initialize collections if they don't exist
            await this.initializeCollections();

            // Setup event listeners
            this.setupEventListeners();

            logger.info('Retrieval service initialized', {
                types: Object.keys(this.config.types).length,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Retrieval service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize collections
     */
    async initializeCollections() {
        for (const [type, config] of Object.entries(this.config.types)) {
            const collection = config.collection || type;
            if (!(await vectorStore.listCollections()).includes(collection)) {
                await vectorStore.createCollection(collection);
                if (this.debugMode) {
                    logger.debug(`[Retrieval] Created collection: ${collection}`);
                }
            }
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for feedback on retrieval results
        const feedbackSub = eventBus.subscribe('retrieval.feedback', async (data) => {
            if (data.queryId && data.rating) {
                await this.recordFeedback(data.queryId, data.rating, data.itemId);
            }
        });
        this.subscriptions.push(feedbackSub);
    }

    /**
     * Retrieve relevant items
     * @param {string} query - Search query
     * @param {object} options - Additional options
     * @returns {Array} Retrieved items
     */
    async retrieve(query, options = {}) {
        if (!this.initialized) {
            throw new Error('Retrieval service not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(query, options);
        if (this.config.enableCaching && this.resultsCache.has(cacheKey)) {
            const cached = this.resultsCache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.config.cacheTTL) {
                this.stats.cacheHits++;
                return cached;
            }
            this.resultsCache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }
        this.stats.cacheMisses++;

        try {
            // Determine types to search
            const types = options.types || Object.keys(this.config.types);
            const topK = options.topK || this.config.topK;
            const minScore = options.minScore || this.config.minScore;

            // Search each type
            let allResults = [];
            for (const type of types) {
                const config = this.config.types[type];
                if (!config) continue;

                const results = await this.searchType(query, type, config, options);
                allResults = allResults.concat(results);
            }

            // Apply filters if provided
            if (options.filters && this.config.filters.enabled) {
                allResults = this.applyFilters(allResults, options.filters);
            }

            // Rerank if enabled
            if (this.config.rerank && options.rerank !== false) {
                allResults = await this.rerankResults(query, allResults, options);
            }

            // Sort by score
            allResults.sort((a, b) => b.score - a.score);

            // Apply threshold
            const filtered = allResults.filter(item => item.score >= minScore);

            // Get top K
            const finalResults = filtered.slice(0, topK);

            // Add metadata
            const result = {
                query: query,
                results: finalResults,
                total: allResults.length,
                filtered: filtered.length,
                timestamp: new Date().toISOString(),
                metadata: {
                    types: types,
                    topK: topK,
                    minScore: minScore,
                    reranked: this.config.rerank
                }
            };

            // Cache results
            if (this.config.enableCaching) {
                this.resultsCache.set(cacheKey, result);
                this.cacheTimestamps.set(cacheKey, Date.now());
            }

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(result, duration);

            // Log retrieval
            if (this.debugMode) {
                logger.debug(`[Retrieval] Retrieved ${finalResults.length} items (${duration}ms)`);
            }

            return result;
        } catch (error) {
            logger.error('[Retrieval] Retrieval failed:', error);
            return { query, results: [], total: 0, filtered: 0, error: error.message };
        }
    }

    /**
     * Search a specific type
     * @param {string} query - Search query
     * @param {string} type - Item type
     * @param {object} config - Type configuration
     * @param {object} options - Additional options
     * @returns {Array} Results
     */
    async searchType(query, type, config, options) {
        const collection = config.collection || type;
        const topK = options.topK || this.config.topK;
        const weight = config.weight || 1.0;

        try {
            const results = await vectorStore.search(query, topK * 2, {
                collection: collection,
                threshold: options.minScore || this.config.minScore
            });

            // Add type and score with weight
            return results.map(item => ({
                ...item,
                type: type,
                score: item.score * weight,
                originalScore: item.score,
                weight: weight
            }));
        } catch (error) {
            logger.warn(`[Retrieval] Search failed for type ${type}:`, error);
            return [];
        }
    }

    /**
     * Retrieve by vector
     * @param {Array} vector - Query vector
     * @param {object} options - Additional options
     * @returns {Array} Retrieved items
     */
    async retrieveByVector(vector, options = {}) {
        if (!this.initialized) {
            throw new Error('Retrieval service not initialized');
        }

        const types = options.types || Object.keys(this.config.types);
        const topK = options.topK || this.config.topK;
        const minScore = options.minScore || this.config.minScore;

        let allResults = [];
        for (const type of types) {
            const config = this.config.types[type];
            if (!config) continue;

            const collection = config.collection || type;
            const weight = config.weight || 1.0;

            try {
                const results = await vectorStore.searchByVector(vector, topK * 2, {
                    collection: collection,
                    threshold: minScore
                });

                const typedResults = results.map(item => ({
                    ...item,
                    type: type,
                    score: item.score * weight,
                    originalScore: item.score,
                    weight: weight
                }));

                allResults = allResults.concat(typedResults);
            } catch (error) {
                logger.warn(`[Retrieval] Vector search failed for type ${type}:`, error);
            }
        }

        // Sort and filter
        allResults.sort((a, b) => b.score - a.score);
        const filtered = allResults.filter(item => item.score >= minScore);
        const finalResults = filtered.slice(0, topK);

        return {
            query: 'vector',
            results: finalResults,
            total: allResults.length,
            filtered: filtered.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Retrieve with filter
     * @param {string} query - Search query
     * @param {object} filter - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Retrieved items
     */
    async retrieveWithFilter(query, filter, options = {}) {
        if (!this.initialized) {
            throw new Error('Retrieval service not initialized');
        }

        // Validate filters
        if (Object.keys(filter).length > this.config.filters.maxFilters) {
            throw new Error(`Maximum ${this.config.filters.maxFilters} filters allowed`);
        }

        const results = await this.retrieve(query, {
            ...options,
            filters: filter
        });

        return results;
    }

    /**
     * Retrieve and rerank results
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Reranked results
     */
    async retrieveWithRerank(query, topK = this.config.topK, options = {}) {
        const rerankTopK = options.rerankTopK || this.config.rerankTopK;
        const results = await this.retrieve(query, {
            ...options,
            topK: rerankTopK,
            rerank: false
        });

        if (results.results.length === 0) {
            return results;
        }

        const reranked = await this.rerankResults(query, results.results, options);
        results.results = reranked.slice(0, topK);
        results.metadata.reranked = true;

        return results;
    }

    /**
     * Rerank results using cross-encoder
     * @param {string} query - Search query
     * @param {Array} results - Results to rerank
     * @param {object} options - Additional options
     * @returns {Array} Reranked results
     */
    async rerankResults(query, results, options = {}) {
        if (results.length === 0) {
            return results;
        }

        // In production, this would use a cross-encoder model
        // For MVP, use heuristic reranking
        const reranked = results.map(item => {
            let score = item.score;

            // Boost based on type priority
            const priority = TYPE_PRIORITIES[item.type] || 5;
            score += priority / 100;

            // Boost based on metadata recency
            if (item.metadata && item.metadata.timestamp) {
                const age = Date.now() - new Date(item.metadata.timestamp).getTime();
                const recencyBoost = Math.max(0, 1 - (age / (30 * 24 * 60 * 60 * 1000)));
                score += recencyBoost * 0.1;
            }

            // Boost based on feedback
            const feedbackScore = this.getFeedbackScore(item.id);
            score += feedbackScore * 0.05;

            return {
                ...item,
                score: Math.min(1, score),
                originalScore: item.score,
                rerankedScore: score
            };
        });

        reranked.sort((a, b) => b.score - a.score);
        return reranked;
    }

    /**
     * Get relevant documents
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant documents
     */
    async getRelevantDocuments(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['documents'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant knowledge
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant knowledge
     */
    async getRelevantKnowledge(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['knowledge'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant leads
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant leads
     */
    async getRelevantLeads(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['leads'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant customers
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant customers
     */
    async getRelevantCustomers(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['customers'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant deals
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant deals
     */
    async getRelevantDeals(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['deals'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant tasks
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant tasks
     */
    async getRelevantTasks(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['tasks'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant notes
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant notes
     */
    async getRelevantNotes(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['notes'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant history
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant history
     */
    async getRelevantHistory(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['history'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Get relevant conversations
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Relevant conversations
     */
    async getRelevantConversations(query, topK = this.config.topK, options = {}) {
        const results = await this.retrieve(query, {
            ...options,
            types: ['conversations'],
            topK: topK
        });
        return results.results;
    }

    /**
     * Apply filters to results
     * @param {Array} results - Results to filter
     * @param {object} filters - Filter criteria
     * @returns {Array} Filtered results
     */
    applyFilters(results, filters) {
        return results.filter(item => {
            for (const [key, value] of Object.entries(filters)) {
                const metadata = item.metadata || {};
                if (metadata[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Record feedback for a result
     * @param {string} queryId - Query ID
     * @param {number} rating - Rating (1-5)
     * @param {string} itemId - Item ID
     */
    async recordFeedback(queryId, rating, itemId) {
        if (!this.feedback.has(itemId)) {
            this.feedback.set(itemId, { ratings: [], count: 0 });
        }

        const feedback = this.feedback.get(itemId);
        feedback.ratings.push(rating);
        feedback.count++;

        // Log feedback
        await auditLogger.log(
            'system',
            'retrieval.feedback',
            'ai',
            { queryId, rating, itemId }
        );

        if (this.debugMode) {
            logger.debug(`[Retrieval] Feedback recorded for ${itemId}: ${rating}`);
        }
    }

    /**
     * Get feedback score for an item
     * @param {string} itemId - Item ID
     * @returns {number} Feedback score (0-1)
     */
    getFeedbackScore(itemId) {
        if (!this.feedback.has(itemId)) {
            return 0;
        }

        const feedback = this.feedback.get(itemId);
        const avgRating = feedback.ratings.reduce((sum, r) => sum + r, 0) / feedback.ratings.length;
        return (avgRating - 1) / 4; // Normalize to 0-1
    }

    /**
     * Get retrieval statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getRetrievalStats(options = {}) {
        return {
            ...this.stats,
            config: this.config,
            cacheSize: this.resultsCache.size,
            feedbackCount: this.feedback.size,
            initialized: this.initialized
        };
    }

    /**
     * Get cache key
     * @param {string} query - Search query
     * @param {object} options - Additional options
     * @returns {string} Cache key
     */
    getCacheKey(query, options) {
        const keyParts = [
            query,
            options.types ? options.types.join(',') : 'all',
            options.topK || this.config.topK,
            options.minScore || this.config.minScore
        ];
        return 'retrieval_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Update statistics
     * @param {object} result - Retrieval result
     * @param {number} duration - Retrieval duration
     */
    updateStats(result, duration) {
        this.stats.totalRetrievals++;
        this.stats.avgRetrievalTime = 
            (this.stats.avgRetrievalTime * (this.stats.totalRetrievals - 1) + duration) / 
            this.stats.totalRetrievals;

        const count = result.results ? result.results.length : 0;
        this.stats.avgResults = 
            (this.stats.avgResults * (this.stats.totalRetrievals - 1) + count) / 
            this.stats.totalRetrievals;

        // Update by type
        if (result.results) {
            for (const item of result.results) {
                const type = item.type || 'unknown';
                this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
            }
        }
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[Retrieval] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.debugMode) {
            logger.debug('[Retrieval] Configuration updated');
        }
    }

    /**
     * Get configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Cleanup service resources
     */
    cleanup() {
        // Unsubscribe from events
        for (const subscription of this.subscriptions) {
            if (typeof subscription === 'function') {
                subscription();
            }
        }
        this.subscriptions = [];

        this.resultsCache.clear();
        this.cacheTimestamps.clear();
        this.initialized = false;
        logger.info('Retrieval service cleaned up');
    }
}

// Create and export singleton instance
export const retrieval = new Retrieval();

// Export class for testing
export default Retrieval;
