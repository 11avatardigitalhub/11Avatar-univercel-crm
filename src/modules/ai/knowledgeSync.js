/**
 * ==========================================
 * FILE: knowledgeSync.js
 * MODULE: AI Module
 * CODE: AI-MEM-5
 * PRIORITY: P1
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Knowledge synchronization service that manages the AI knowledge base.
 * Handles ingestion, indexing, updating, and synchronization of
 * knowledge documents, FAQs, and learning content.
 * 
 * DEPENDENCIES:
 * - embeddings.js (for embedding generation)
 * - vectorStore.js (for vector storage)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize knowledge sync
 * - syncKnowledge(): Sync all knowledge
 * - syncDocuments(): Sync documents
 * - syncFAQs(): Sync FAQs
 * - syncLearning(): Sync learning content
 * - ingestDocument(document): Ingest a document
 * - ingestFAQ(faq): Ingest an FAQ
 * - ingestLearning(learning): Ingest learning content
 * - updateKnowledge(id, data): Update knowledge
 * - deleteKnowledge(id): Delete knowledge
 * - getKnowledge(id): Get knowledge
 * - searchKnowledge(query): Search knowledge
 * - getKnowledgeStats(): Get statistics
 * - scheduleSync(): Schedule sync
 * - validateKnowledge(data): Validate knowledge
 * - exportKnowledge(): Export all knowledge
 * - importKnowledge(data): Import knowledge
 * 
 * USAGE EXAMPLE:
 * import { knowledgeSync } from './modules/ai/knowledgeSync.js';
 * 
 * // Initialize knowledge sync
 * await knowledgeSync.initialize();
 * 
 * // Sync all knowledge
 * await knowledgeSync.syncKnowledge();
 * 
 * // Ingest a document
 * await knowledgeSync.ingestDocument({
 *   id: 'doc_1',
 *   title: 'Lead Scoring Guide',
 *   content: 'Lead scoring is the process of...',
 *   category: 'guide'
 * });
 * 
 * // Search knowledge
 * const results = await knowledgeSync.searchKnowledge('lead scoring');
 * ==========================================
 */

import { embeddings } from './embeddings.js';
import { vectorStore } from './vectorStore.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Default configuration
const DEFAULT_CONFIG = {
    collectionName: 'knowledge',
    chunkSize: 500,
    chunkOverlap: 50,
    maxDocuments: 10000,
    syncInterval: 3600000, // 1 hour
    enableAutoSync: true,
    enableDeduplication: true,
    enableValidation: true,
    enableIndexing: true,
    embeddingsModel: 'llama3-70b-8192',
    batchSize: 10,
    retryAttempts: 3,
    retryDelay: 5000
};

// Knowledge types
const KNOWLEDGE_TYPES = {
    DOCUMENT: 'document',
    FAQ: 'faq',
    LEARNING: 'learning',
    ARTICLE: 'article',
    GUIDE: 'guide',
    TUTORIAL: 'tutorial',
    CASE_STUDY: 'case_study',
    BEST_PRACTICE: 'best_practice'
};

// Knowledge categories
const KNOWLEDGE_CATEGORIES = {
    SALES: 'sales',
    MARKETING: 'marketing',
    SUPPORT: 'support',
    PRODUCT: 'product',
    TECHNICAL: 'technical',
    BUSINESS: 'business',
    TRAINING: 'training',
    GENERAL: 'general'
};

class KnowledgeSync {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = { ...DEFAULT_CONFIG };
        this.knowledgeBase = new Map();
        this.syncHistory = [];
        this.syncInProgress = false;
        this.chunkCache = new Map();
        this.knowledgeMetadata = new Map();
        
        // Statistics
        this.stats = {
            totalDocuments: 0,
            totalFAQs: 0,
            totalLearning: 0,
            totalChunks: 0,
            lastSync: null,
            syncCount: 0,
            errors: 0,
            byType: {},
            byCategory: {}
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize knowledge sync
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

            // Ensure collection exists
            await this.ensureCollection();

            // Load existing knowledge
            await this.loadKnowledge();

            // Setup event listeners
            this.setupEventListeners();

            // Start auto-sync
            if (this.config.enableAutoSync) {
                this.startAutoSync();
            }

            logger.info('Knowledge sync initialized', {
                documents: this.knowledgeBase.size,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Knowledge sync initialization failed:', error);
            throw error;
        }
    }

    /**
     * Ensure collection exists
     */
    async ensureCollection() {
        const collections = await vectorStore.listCollections();
        if (!collections.includes(this.config.collectionName)) {
            await vectorStore.createCollection(this.config.collectionName);
            if (this.debugMode) {
                logger.debug(`[KnowledgeSync] Created collection: ${this.config.collectionName}`);
            }
        }
    }

    /**
     * Load existing knowledge
     */
    async loadKnowledge() {
        // In production, this would load from database
        // For MVP, load from file or initialize with sample data
        if (this.debugMode) {
            logger.debug('[KnowledgeSync] Knowledge loaded');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for content updates
        const contentSub = eventBus.subscribe('content.updated', async (data) => {
            if (data.type && data.id) {
                await this.updateKnowledge(data.id, data);
            }
        });
        this.subscriptions.push(contentSub);

        // Listen for content deletion
        const deleteSub = eventBus.subscribe('content.deleted', async (data) => {
            if (data.id) {
                await this.deleteKnowledge(data.id);
            }
        });
        this.subscriptions.push(deleteSub);
    }

    /**
     * Start auto-sync
     */
    startAutoSync() {
        setInterval(() => {
            if (this.initialized && !this.syncInProgress) {
                this.syncKnowledge();
            }
        }, this.config.syncInterval);
    }

    /**
     * Sync all knowledge
     * @param {object} options - Additional options
     * @returns {object} Sync results
     */
    async syncKnowledge(options = {}) {
        if (this.syncInProgress) {
            return { success: false, message: 'Sync already in progress' };
        }

        this.syncInProgress = true;
        const startTime = Date.now();

        try {
            // Sync documents
            const docResults = await this.syncDocuments(options);
            
            // Sync FAQs
            const faqResults = await this.syncFAQs(options);
            
            // Sync learning
            const learningResults = await this.syncLearning(options);

            const duration = Date.now() - startTime;

            // Update stats
            this.stats.syncCount++;
            this.stats.lastSync = new Date().toISOString();

            // Log sync
            await auditLogger.log(
                options.userId || 'system',
                'knowledge.sync',
                'ai',
                { 
                    documents: docResults.processed,
                    faqs: faqResults.processed,
                    learning: learningResults.processed,
                    duration: duration
                }
            );

            if (this.debugMode) {
                logger.debug(`[KnowledgeSync] Sync completed (${duration}ms)`);
            }

            return {
                success: true,
                documents: docResults,
                faqs: faqResults,
                learning: learningResults,
                duration: duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.stats.errors++;
            logger.error('[KnowledgeSync] Sync failed:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync documents
     * @param {object} options - Additional options
     * @returns {object} Sync results
     */
    async syncDocuments(options = {}) {
        // In production, this would fetch documents from database
        // For MVP, use sample documents
        const sampleDocuments = [
            {
                id: 'doc_1',
                title: 'Lead Scoring Guide',
                content: 'Lead scoring is the process of ranking leads based on their likelihood to convert...',
                type: KNOWLEDGE_TYPES.GUIDE,
                category: KNOWLEDGE_CATEGORIES.SALES,
                tags: ['lead', 'scoring', 'qualification'],
                author: 'Sales Team',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'doc_2',
                title: 'Sales Pipeline Best Practices',
                content: 'A well-structured sales pipeline is essential for predictable revenue...',
                type: KNOWLEDGE_TYPES.ARTICLE,
                category: KNOWLEDGE_CATEGORIES.SALES,
                tags: ['pipeline', 'sales', 'best_practices'],
                author: 'Sales Team',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        let processed = 0;
        let failed = 0;

        for (const doc of sampleDocuments) {
            try {
                await this.ingestDocument(doc, options);
                processed++;
            } catch (error) {
                failed++;
                logger.error(`[KnowledgeSync] Document ingestion failed: ${doc.id}`, error);
            }
        }

        return { processed, failed };
    }

    /**
     * Sync FAQs
     * @param {object} options - Additional options
     * @returns {object} Sync results
     */
    async syncFAQs(options = {}) {
        // In production, this would fetch FAQs from database
        // For MVP, return sample
        return { processed: 0, failed: 0 };
    }

    /**
     * Sync learning content
     * @param {object} options - Additional options
     * @returns {object} Sync results
     */
    async syncLearning(options = {}) {
        // In production, this would fetch learning content from database
        // For MVP, return sample
        return { processed: 0, failed: 0 };
    }

    /**
     * Ingest a document
     * @param {object} document - Document data
     * @param {object} options - Additional options
     * @returns {object} Ingested document
     */
    async ingestDocument(document, options = {}) {
        if (!this.initialized) {
            throw new Error('Knowledge sync not initialized');
        }

        // Validate document
        this.validateKnowledge(document);

        // Check for duplicates
        if (this.config.enableDeduplication && this.isDuplicate(document)) {
            throw new Error(`Duplicate document: ${document.id}`);
        }

        // Chunk the document
        const chunks = this.chunkDocument(document);

        // Generate embeddings for each chunk
        const embeddingsResults = await this.generateChunkEmbeddings(chunks, options);

        // Store in vector store
        for (const [index, chunk] of chunks.entries()) {
            const vectorId = `${document.id}_chunk_${index}`;
            await vectorStore.addVector(
                vectorId,
                embeddingsResults[index],
                {
                    documentId: document.id,
                    title: document.title,
                    content: chunk,
                    type: document.type || KNOWLEDGE_TYPES.DOCUMENT,
                    category: document.category || KNOWLEDGE_CATEGORIES.GENERAL,
                    tags: document.tags || [],
                    author: document.author || 'Unknown',
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    metadata: document.metadata || {}
                },
                this.config.collectionName
            );
        }

        // Store in knowledge base
        this.knowledgeBase.set(document.id, {
            ...document,
            chunks: chunks.length,
            status: 'active',
            indexedAt: new Date().toISOString(),
            lastSynced: new Date().toISOString()
        });

        // Update stats
        this.updateStats(document, 'added');

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'knowledge.document_ingested',
            'ai',
            { documentId: document.id, title: document.title, chunks: chunks.length }
        );

        if (this.debugMode) {
            logger.debug(`[KnowledgeSync] Document ingested: ${document.id}`);
        }

        return this.knowledgeBase.get(document.id);
    }

    /**
     * Ingest an FAQ
     * @param {object} faq - FAQ data
     * @param {object} options - Additional options
     * @returns {object} Ingested FAQ
     */
    async ingestFAQ(faq, options = {}) {
        const document = {
            ...faq,
            type: KNOWLEDGE_TYPES.FAQ,
            content: `Q: ${faq.question}\nA: ${faq.answer}`,
            title: `FAQ: ${faq.question}`
        };
        return await this.ingestDocument(document, options);
    }

    /**
     * Ingest learning content
     * @param {object} learning - Learning content data
     * @param {object} options - Additional options
     * @returns {object} Ingested learning
     */
    async ingestLearning(learning, options = {}) {
        const document = {
            ...learning,
            type: KNOWLEDGE_TYPES.LEARNING,
            title: learning.title || 'Learning Content'
        };
        return await this.ingestDocument(document, options);
    }

    /**
     * Update knowledge
     * @param {string} id - Knowledge ID
     * @param {object} data - Updated data
     * @param {object} options - Additional options
     * @returns {object} Updated knowledge
     */
    async updateKnowledge(id, data, options = {}) {
        if (!this.knowledgeBase.has(id)) {
            throw new Error(`Knowledge ${id} not found`);
        }

        // Delete old version
        await this.deleteKnowledge(id, { permanent: true });

        // Create new version with updated data
        const updated = { ...this.knowledgeBase.get(id), ...data };
        return await this.ingestDocument(updated, options);
    }

    /**
     * Delete knowledge
     * @param {string} id - Knowledge ID
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async deleteKnowledge(id, options = {}) {
        if (!this.knowledgeBase.has(id)) {
            throw new Error(`Knowledge ${id} not found`);
        }

        const document = this.knowledgeBase.get(id);

        // Remove from vector store
        for (let i = 0; i < document.chunks; i++) {
            const vectorId = `${id}_chunk_${i}`;
            await vectorStore.deleteVector(vectorId, this.config.collectionName);
        }

        // Remove from knowledge base
        this.knowledgeBase.delete(id);

        // Update stats
        this.updateStats(document, 'removed');

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'knowledge.deleted',
            'ai',
            { documentId: id, title: document.title }
        );

        if (this.debugMode) {
            logger.debug(`[KnowledgeSync] Knowledge deleted: ${id}`);
        }

        return true;
    }

    /**
     * Get knowledge
     * @param {string} id - Knowledge ID
     * @returns {object} Knowledge
     */
    async getKnowledge(id) {
        return this.knowledgeBase.get(id) || null;
    }

    /**
     * Search knowledge
     * @param {string} query - Search query
     * @param {number} topK - Number of results
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async searchKnowledge(query, topK = 5, options = {}) {
        const results = await vectorStore.search(query, topK, {
            collection: this.config.collectionName,
            ...options
        });

        // Group results by document
        const grouped = {};
        for (const result of results) {
            const docId = result.metadata.documentId;
            if (!grouped[docId]) {
                const doc = this.knowledgeBase.get(docId);
                grouped[docId] = {
                    document: doc,
                    chunks: [],
                    score: 0
                };
            }
            grouped[docId].chunks.push(result);
            grouped[docId].score = Math.max(grouped[docId].score, result.score);
        }

        // Sort by score
        const sorted = Object.values(grouped).sort((a, b) => b.score - a.score);

        return sorted.map(item => ({
            document: item.document,
            chunks: item.chunks,
            score: item.score,
            relevance: this.calculateRelevance(item.score)
        }));
    }

    /**
     * Chunk a document
     * @param {object} document - Document to chunk
     * @returns {Array} Chunks
     */
    chunkDocument(document) {
        const content = document.content || '';
        const chunkSize = this.config.chunkSize;
        const overlap = this.config.chunkOverlap;
        const chunks = [];

        if (content.length <= chunkSize) {
            chunks.push(content);
        } else {
            let start = 0;
            while (start < content.length) {
                let end = Math.min(start + chunkSize, content.length);
                // Try to break at sentence boundary
                if (end < content.length) {
                    const lastPeriod = content.lastIndexOf('.', end);
                    if (lastPeriod > start) {
                        end = lastPeriod + 1;
                    }
                }
                chunks.push(content.substring(start, end));
                start = end - overlap;
            }
        }

        return chunks;
    }

    /**
     * Generate embeddings for chunks
     * @param {Array} chunks - Text chunks
     * @param {object} options - Additional options
     * @returns {Array} Embeddings
     */
    async generateChunkEmbeddings(chunks, options = {}) {
        const embeddingsResults = [];
        const batchSize = this.config.batchSize;

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const batchEmbeddings = await embeddings.generateEmbeddings(batch, {
                model: this.config.embeddingsModel,
                ...options
            });
            embeddingsResults.push(...batchEmbeddings);
        }

        return embeddingsResults;
    }

    /**
     * Validate knowledge data
     * @param {object} data - Knowledge data to validate
     * @throws {Error} If validation fails
     */
    validateKnowledge(data) {
        if (!data.id) {
            throw new Error('Knowledge ID is required');
        }
        if (!data.title) {
            throw new Error('Knowledge title is required');
        }
        if (!data.content) {
            throw new Error('Knowledge content is required');
        }
        if (data.content.length < 10) {
            throw new Error('Knowledge content must be at least 10 characters');
        }
    }

    /**
     * Check for duplicate knowledge
     * @param {object} document - Document to check
     * @returns {boolean} Whether duplicate exists
     */
    isDuplicate(document) {
        // Check by ID
        if (this.knowledgeBase.has(document.id)) {
            return true;
        }

        // Check by title (simple)
        for (const [id, existing] of this.knowledgeBase) {
            if (existing.title === document.title) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate relevance score
     * @param {number} score - Raw score
     * @returns {string} Relevance level
     */
    calculateRelevance(score) {
        if (score >= 0.8) return 'high';
        if (score >= 0.6) return 'medium';
        if (score >= 0.4) return 'low';
        return 'minimal';
    }

    /**
     * Update statistics
     * @param {object} document - Document
     * @param {string} action - Action (added, removed, updated)
     */
    updateStats(document, action) {
        const type = document.type || KNOWLEDGE_TYPES.DOCUMENT;
        const category = document.category || KNOWLEDGE_CATEGORIES.GENERAL;

        if (action === 'added') {
            this.stats.totalDocuments++;
            this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
            this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
            this.stats.totalChunks += document.chunks || 0;
        } else if (action === 'removed') {
            this.stats.totalDocuments = Math.max(0, this.stats.totalDocuments - 1);
            this.stats.byType[type] = Math.max(0, (this.stats.byType[type] || 0) - 1);
            this.stats.byCategory[category] = Math.max(0, (this.stats.byCategory[category] || 0) - 1);
            this.stats.totalChunks = Math.max(0, this.stats.totalChunks - (document.chunks || 0));
        }
    }

    /**
     * Export all knowledge
     * @param {object} options - Additional options
     * @returns {object} Exported data
     */
    async exportKnowledge(options = {}) {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            documents: Array.from(this.knowledgeBase.values()),
            stats: { ...this.stats },
            metadata: {
                collection: this.config.collectionName,
                totalDocuments: this.knowledgeBase.size,
                exportedBy: options.userId || 'system'
            }
        };

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'knowledge.exported',
            'ai',
            { count: data.documents.length }
        );

        return data;
    }

    /**
     * Import knowledge
     * @param {object} data - Import data
     * @param {object} options - Additional options
     * @returns {object} Import results
     */
    async importKnowledge(data, options = {}) {
        if (!data.documents || !Array.isArray(data.documents)) {
            throw new Error('Invalid import data');
        }

        const results = {
            imported: 0,
            failed: 0,
            errors: [],
            duplicates: 0
        };

        for (const doc of data.documents) {
            try {
                if (this.knowledgeBase.has(doc.id)) {
                    results.duplicates++;
                    if (!options.overwrite) {
                        continue;
                    }
                    await this.deleteKnowledge(doc.id, { permanent: true });
                }
                await this.ingestDocument(doc, options);
                results.imported++;
            } catch (error) {
                results.failed++;
                results.errors.push({ id: doc.id, error: error.message });
            }
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'knowledge.imported',
            'ai',
            { imported: results.imported, failed: results.failed }
        );

        return results;
    }

    /**
     * Get knowledge statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getKnowledgeStats(options = {}) {
        return {
            ...this.stats,
            totalDocuments: this.knowledgeBase.size,
            initialized: this.initialized,
            syncInProgress: this.syncInProgress,
            config: this.config,
            lastSync: this.stats.lastSync
        };
    }

    /**
     * Schedule a sync
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async scheduleSync(options = {}) {
        if (this.syncInProgress) {
            return false;
        }

        // Clear existing schedule
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }

        // Schedule new sync
        this.syncTimer = setTimeout(() => {
            this.syncKnowledge(options);
        }, options.delay || 5000);

        if (this.debugMode) {
            logger.debug('[KnowledgeSync] Sync scheduled');
        }

        return true;
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
            options.topK || 5,
            options.category || '',
            options.type || ''
        ];
        return 'knowledge_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[KnowledgeSync] Debug mode enabled');
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
            logger.debug('[KnowledgeSync] Configuration updated');
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

        // Clear timers
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }

        this.cache.clear();
        this.cacheTimestamps.clear();
        this.chunkCache.clear();
        this.initialized = false;
        logger.info('Knowledge sync cleaned up');
    }
}

// Create and export singleton instance
export const knowledgeSync = new KnowledgeSync();

// Export class for testing
export default KnowledgeSync;
