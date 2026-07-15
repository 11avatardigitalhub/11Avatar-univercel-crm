/**
 * ==========================================
 * FILE: vectorStore.js
 * MODULE: AI Module
 * CODE: AI-MEM-2
 * PRIORITY: P1
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Vector store service for storing and retrieving embeddings.
 * Provides efficient similarity search, indexing, and management
 * of vector embeddings for AI memory and retrieval.
 * 
 * DEPENDENCIES:
 * - embeddings.js (for embedding generation)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize vector store
 * - addVector(id, vector, metadata): Add vector
 * - addVectors(vectors): Add multiple vectors
 * - updateVector(id, vector, metadata): Update vector
 * - deleteVector(id): Delete vector
 * - getVector(id): Get vector
 * - search(query, topK): Search similar vectors
 * - searchByVector(vector, topK): Search by vector
 * - searchByText(text, topK): Search by text
 * - getStats(): Get statistics
 * - clear(): Clear all vectors
 * - optimize(): Optimize index
 * - export(): Export vectors
 * - import(data): Import vectors
 * - getCollection(collection): Get collection
 * - createCollection(collection): Create collection
 * - deleteCollection(collection): Delete collection
 * - listCollections(): List collections
 * 
 * USAGE EXAMPLE:
 * import { vectorStore } from './modules/ai/vectorStore.js';
 * 
 * // Initialize vector store
 * await vectorStore.initialize();
 * 
 * // Add vectors
 * await vectorStore.addVector('doc_1', embedding, {
 *   text: 'Lead scoring algorithm',
 *   type: 'knowledge'
 * });
 * 
 * // Search similar vectors
 * const results = await vectorStore.search(
 *   'Lead qualification methods',
 *   5
 * );
 * 
 * // Search by vector
 * const results = await vectorStore.searchByVector(embedding, 5);
 * ==========================================
 */

import { embeddings } from './embeddings.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// In-memory vector storage (for MVP)
// In production, this would be a real vector database
class VectorStorage {
    constructor() {
        this.vectors = new Map();
        this.metadata = new Map();
        this.collections = new Map();
        this.index = null;
        this.isIndexed = false;
        this.totalVectors = 0;
    }

    add(id, vector, metadata = {}) {
        this.vectors.set(id, vector);
        this.metadata.set(id, metadata);
        this.totalVectors++;
        this.isIndexed = false;
    }

    get(id) {
        return this.vectors.get(id) || null;
    }

    getMetadata(id) {
        return this.metadata.get(id) || null;
    }

    delete(id) {
        const deleted = this.vectors.delete(id);
        this.metadata.delete(id);
        this.totalVectors--;
        this.isIndexed = false;
        return deleted;
    }

    update(id, vector, metadata = {}) {
        if (!this.vectors.has(id)) {
            return false;
        }
        this.vectors.set(id, vector);
        if (metadata) {
            this.metadata.set(id, { ...this.metadata.get(id), ...metadata });
        }
        this.isIndexed = false;
        return true;
    }

    getAll() {
        const result = [];
        for (const [id, vector] of this.vectors) {
            result.push({
                id,
                vector,
                metadata: this.metadata.get(id) || {}
            });
        }
        return result;
    }

    clear() {
        this.vectors.clear();
        this.metadata.clear();
        this.totalVectors = 0;
        this.isIndexed = false;
    }

    get size() {
        return this.totalVectors;
    }
}

class VectorStore {
    constructor() {
        // Service state
        this.initialized = false;
        this.storage = new VectorStorage();
        this.collections = new Map();
        this.collections.set('default', this.storage);
        
        // Configuration
        this.config = {
            defaultCollection: 'default',
            similarityMetric: 'cosine',
            topK: 10,
            threshold: 0.6,
            enableCaching: true,
            cacheTTL: 300000, // 5 minutes
            maxVectors: 100000,
            autoOptimize: true,
            optimizeThreshold: 1000
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalVectors: 0,
            totalCollections: 1,
            searches: 0,
            avgSearchTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize vector store
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

            // Load data from persistent storage (if any)
            await this.loadPersistentData();

            logger.info('Vector store initialized', {
                totalVectors: this.storage.size,
                collections: this.collections.size,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Vector store initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load persistent data
     */
    async loadPersistentData() {
        // In production, this would load from Firestore or Redis
        // For MVP, use in-memory storage
        if (this.debugMode) {
            logger.debug('[VectorStore] Persistent data loaded');
        }
    }

    /**
     * Add vector
     * @param {string} id - Vector ID
     * @param {Array} vector - Embedding vector
     * @param {object} metadata - Additional metadata
     * @param {string} collection - Collection name
     * @returns {boolean} Success
     */
    async addVector(id, vector, metadata = {}, collection = this.config.defaultCollection) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        // Validate vector
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error('Vector must be a non-empty array');
        }

        const store = this.getCollection(collection);
        if (!store) {
            throw new Error(`Collection ${collection} not found`);
        }

        // Check limit
        if (store.size >= this.config.maxVectors) {
            throw new Error(`Maximum vectors (${this.config.maxVectors}) reached`);
        }

        // Add vector
        store.add(id, vector, metadata);

        // Update stats
        this.stats.totalVectors++;

        // Invalidate cache
        this.invalidateCache();

        // Auto-optimize if needed
        if (this.config.autoOptimize && store.size >= this.config.optimizeThreshold) {
            await this.optimize(collection);
        }

        // Log to audit
        await auditLogger.log(
            metadata.userId || 'system',
            'vector_store.added',
            'ai',
            { vectorId: id, collection: collection }
        );

        // Emit event
        eventBus.publish('vector.added', {
            id: id,
            collection: collection,
            metadata: metadata
        });

        if (this.debugMode) {
            logger.debug(`[VectorStore] Vector added: ${id}`);
        }

        return true;
    }

    /**
     * Add multiple vectors
     * @param {Array} vectors - Array of {id, vector, metadata}
     * @param {string} collection - Collection name
     * @param {object} options - Additional options
     * @returns {object} Results
     */
    async addVectors(vectors, collection = this.config.defaultCollection, options = {}) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        const results = {
            added: 0,
            failed: 0,
            errors: []
        };

        for (const item of vectors) {
            try {
                await this.addVector(item.id, item.vector, item.metadata, collection);
                results.added++;
            } catch (error) {
                results.failed++;
                results.errors.push({ id: item.id, error: error.message });
            }
        }

        return results;
    }

    /**
     * Update vector
     * @param {string} id - Vector ID
     * @param {Array} vector - New embedding vector
     * @param {object} metadata - New metadata
     * @param {string} collection - Collection name
     * @returns {boolean} Success
     */
    async updateVector(id, vector, metadata = {}, collection = this.config.defaultCollection) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        const store = this.getCollection(collection);
        if (!store) {
            throw new Error(`Collection ${collection} not found`);
        }

        const success = store.update(id, vector, metadata);
        if (success) {
            this.invalidateCache();
            
            // Log to audit
            await auditLogger.log(
                metadata.userId || 'system',
                'vector_store.updated',
                'ai',
                { vectorId: id, collection: collection }
            );
        }

        return success;
    }

    /**
     * Delete vector
     * @param {string} id - Vector ID
     * @param {string} collection - Collection name
     * @returns {boolean} Success
     */
    async deleteVector(id, collection = this.config.defaultCollection) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        const store = this.getCollection(collection);
        if (!store) {
            throw new Error(`Collection ${collection} not found`);
        }

        const success = store.delete(id);
        if (success) {
            this.stats.totalVectors--;
            this.invalidateCache();

            // Log to audit
            await auditLogger.log(
                'system',
                'vector_store.deleted',
                'ai',
                { vectorId: id, collection: collection }
            );
        }

        return success;
    }

    /**
     * Get vector
     * @param {string} id - Vector ID
     * @param {string} collection - Collection name
     * @returns {object|null} Vector data
     */
    async getVector(id, collection = this.config.defaultCollection) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        const store = this.getCollection(collection);
        if (!store) {
            return null;
        }

        const vector = store.get(id);
        if (!vector) {
            return null;
        }

        return {
            id: id,
            vector: vector,
            metadata: store.getMetadata(id) || {}
        };
    }

    /**
     * Search similar vectors by text
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async search(query, topK = this.config.topK, options = {}) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(query, topK);
        if (this.config.enableCaching && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.config.cacheTTL) {
                this.stats.cacheHits++;
                return cached;
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }
        this.stats.cacheMisses++;

        try {
            // Generate embedding for query
            const queryEmbedding = await embeddings.getEmbedding(query, options);

            // Search by vector
            const results = await this.searchByVector(queryEmbedding, topK, options);

            // Cache results
            if (this.config.enableCaching) {
                this.cache.set(cacheKey, results);
                this.cacheTimestamps.set(cacheKey, Date.now());
            }

            // Update stats
            const duration = Date.now() - startTime;
            this.updateSearchStats(duration);

            return results;
        } catch (error) {
            logger.error('[VectorStore] Search failed:', error);
            return [];
        }
    }

    /**
     * Search by vector
     * @param {Array} vector - Query vector
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async searchByVector(vector, topK = this.config.topK, options = {}) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        const collection = options.collection || this.config.defaultCollection;
        const store = this.getCollection(collection);
        if (!store) {
            return [];
        }

        const threshold = options.threshold || this.config.threshold;
        const metric = options.metric || this.config.similarityMetric;

        // Get all vectors
        const allVectors = store.getAll();
        if (allVectors.length === 0) {
            return [];
        }

        // Calculate similarities
        const similarities = allVectors.map(item => {
            const score = this.calculateSimilarity(vector, item.vector, metric);
            return {
                ...item,
                score: score
            };
        });

        // Filter by threshold
        const filtered = similarities.filter(item => item.score >= threshold);

        // Sort by score descending
        filtered.sort((a, b) => b.score - a.score);

        // Return top K
        return filtered.slice(0, topK);
    }

    /**
     * Search by text (alias for search)
     * @param {string} text - Search text
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async searchByText(text, topK = this.config.topK, options = {}) {
        return await this.search(text, topK, options);
    }

    /**
     * Calculate similarity between vectors
     * @param {Array} vec1 - First vector
     * @param {Array} vec2 - Second vector
     * @param {string} metric - Similarity metric
     * @returns {number} Similarity score
     */
    calculateSimilarity(vec1, vec2, metric = this.config.similarityMetric) {
        switch (metric) {
            case 'cosine':
                return this.cosineSimilarity(vec1, vec2);
            case 'dot':
                return this.dotProduct(vec1, vec2);
            case 'euclidean':
                return 1 / (1 + this.euclideanDistance(vec1, vec2));
            default:
                return this.cosineSimilarity(vec1, vec2);
        }
    }

    /**
     * Cosine similarity
     * @param {Array} vec1 - First vector
     * @param {Array} vec2 - Second vector
     * @returns {number} Cosine similarity
     */
    cosineSimilarity(vec1, vec2) {
        const dot = this.dotProduct(vec1, vec2);
        const norm1 = Math.sqrt(this.dotProduct(vec1, vec1));
        const norm2 = Math.sqrt(this.dotProduct(vec2, vec2));
        
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        
        return dot / (norm1 * norm2);
    }

    /**
     * Dot product
     * @param {Array} vec1 - First vector
     * @param {Array} vec2 - Second vector
     * @returns {number} Dot product
     */
    dotProduct(vec1, vec2) {
        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
            sum += vec1[i] * vec2[i];
        }
        return sum;
    }

    /**
     * Euclidean distance
     * @param {Array} vec1 - First vector
     * @param {Array} vec2 - Second vector
     * @returns {number} Euclidean distance
     */
    euclideanDistance(vec1, vec2) {
        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
            const diff = vec1[i] - vec2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    /**
     * Get collection
     * @param {string} name - Collection name
     * @returns {object} Collection
     */
    getCollection(name) {
        return this.collections.get(name) || null;
    }

    /**
     * Create collection
     * @param {string} name - Collection name
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async createCollection(name, options = {}) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        if (this.collections.has(name)) {
            return false;
        }

        this.collections.set(name, new VectorStorage());
        this.stats.totalCollections++;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'vector_store.collection_created',
            'ai',
            { collection: name }
        );

        if (this.debugMode) {
            logger.debug(`[VectorStore] Collection created: ${name}`);
        }

        return true;
    }

    /**
     * Delete collection
     * @param {string} name - Collection name
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async deleteCollection(name, options = {}) {
        if (!this.initialized) {
            throw new Error('Vector store not initialized');
        }

        if (name === this.config.defaultCollection) {
            throw new Error('Cannot delete default collection');
        }

        if (!this.collections.has(name)) {
            return false;
        }

        const size = this.collections.get(name).size;
        this.collections.delete(name);
        this.stats.totalCollections--;
        this.stats.totalVectors -= size;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'vector_store.collection_deleted',
            'ai',
            { collection: name }
        );

        if (this.debugMode) {
            logger.debug(`[VectorStore] Collection deleted: ${name}`);
        }

        return true;
    }

    /**
     * List collections
     * @returns {Array} Collection names
     */
    async listCollections() {
        return Array.from(this.collections.keys());
    }

    /**
     * Optimize index
     * @param {string} collection - Collection name
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async optimize(collection = this.config.defaultCollection, options = {}) {
        const store = this.getCollection(collection);
        if (!store) {
            return false;
        }

        // In production, this would rebuild the index
        // For MVP, just mark as indexed
        store.isIndexed = true;

        if (this.debugMode) {
            logger.debug(`[VectorStore] Index optimized for collection: ${collection}`);
        }

        return true;
    }

    /**
     * Export vectors
     * @param {string} collection - Collection name
     * @param {object} options - Additional options
     * @returns {object} Exported data
     */
    async export(collection = this.config.defaultCollection, options = {}) {
        const store = this.getCollection(collection);
        if (!store) {
            throw new Error(`Collection ${collection} not found`);
        }

        const data = {
            collection: collection,
            vectors: store.getAll(),
            metadata: {
                exportedAt: new Date().toISOString(),
                totalVectors: store.size,
                version: '1.0'
            }
        };

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'vector_store.exported',
            'ai',
            { collection: collection, count: store.size }
        );

        return data;
    }

    /**
     * Import vectors
     * @param {object} data - Import data
     * @param {object} options - Additional options
     * @returns {object} Import results
     */
    async import(data, options = {}) {
        if (!data || !data.vectors) {
            throw new Error('Invalid import data');
        }

        const collection = data.collection || this.config.defaultCollection;
        const results = {
            added: 0,
            failed: 0,
            errors: []
        };

        for (const item of data.vectors) {
            try {
                await this.addVector(item.id, item.vector, item.metadata, collection);
                results.added++;
            } catch (error) {
                results.failed++;
                results.errors.push({ id: item.id, error: error.message });
            }
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'vector_store.imported',
            'ai',
            { collection: collection, count: results.added }
        );

        return results;
    }

    /**
     * Clear all vectors
     * @param {string} collection - Collection name
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async clear(collection = this.config.defaultCollection, options = {}) {
        const store = this.getCollection(collection);
        if (!store) {
            return false;
        }

        const count = store.size;
        store.clear();
        this.stats.totalVectors -= count;
        this.invalidateCache();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'vector_store.cleared',
            'ai',
            { collection: collection, count: count }
        );

        if (this.debugMode) {
            logger.debug(`[VectorStore] Vectors cleared from: ${collection}`);
        }

        return true;
    }

    /**
     * Get statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getStats(options = {}) {
        return {
            ...this.stats,
            config: this.config,
            collections: await this.listCollections(),
            totalVectors: this.storage.size,
            initialized: this.initialized
        };
    }

    /**
     * Invalidate cache
     */
    invalidateCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Get cache key
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @returns {string} Cache key
     */
    getCacheKey(query, topK) {
        const hash = this.hashText(query);
        return `search_${hash}_${topK}`;
    }

    /**
     * Hash text
     * @param {string} text - Text to hash
     * @returns {string} Hash
     */
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    /**
     * Update search statistics
     * @param {number} duration - Search duration
     */
    updateSearchStats(duration) {
        this.stats.searches++;
        this.stats.avgSearchTime = 
            (this.stats.avgSearchTime * (this.stats.searches - 1) + duration) / 
            this.stats.searches;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[VectorStore] Debug mode enabled');
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
            logger.debug('[VectorStore] Configuration updated');
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
        this.invalidateCache();
        this.initialized = false;
        logger.info('Vector store cleaned up');
    }
}

// Create and export singleton instance
export const vectorStore = new VectorStore();

// Export class for testing
export default VectorStore;
