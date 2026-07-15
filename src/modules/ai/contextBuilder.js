/**
 * ==========================================
 * FILE: contextBuilder.js
 * MODULE: AI Module
 * CODE: AI-MEM-4
 * PRIORITY: P1
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Context builder service that builds intelligent context
 * for AI interactions by combining user data, conversation
 * history, relevant knowledge, and situational awareness.
 * 
 * DEPENDENCIES:
 * - retrieval.js (for relevant knowledge retrieval)
 * - vectorStore.js (for vector search)
 * - embeddings.js (for embedding generation)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize context builder
 * - buildContext(userId, query): Build context for query
 * - buildConversationContext(userId, messages): Build conversation context
 * - buildUserContext(userId): Build user context
 * - buildEntityContext(entityType, entityId): Build entity context
 * - buildSituationContext(userId): Build situation context
 * - buildIntentContext(query, intent): Build intent context
 * - buildHistoryContext(userId, limit): Build history context
 * - buildKnowledgeContext(query): Build knowledge context
 * - mergeContexts(contexts): Merge multiple contexts
 * - getContextStats(): Get statistics
 * 
 * USAGE EXAMPLE:
 * import { contextBuilder } from './modules/ai/contextBuilder.js';
 * 
 * // Initialize context builder
 * await contextBuilder.initialize();
 * 
 * // Build context for a query
 * const context = await contextBuilder.buildContext('user_123', 'Show me hot leads');
 * 
 * // Build conversation context
 * const context = await contextBuilder.buildConversationContext('user_123', [
 *   { role: 'user', content: 'I need help with leads' },
 *   { role: 'assistant', content: 'Sure, how can I help?' }
 * ]);
 * 
 * // Build entity context
 * const context = await contextBuilder.buildEntityContext('lead', 'lead_456');
 * ==========================================
 */

import { retrieval } from './retrieval.js';
import { vectorStore } from './vectorStore.js';
import { embeddings } from './embeddings.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Default configuration
const DEFAULT_CONFIG = {
    maxHistory: 20,
    maxKnowledge: 10,
    maxContextLength: 4000,
    includeUserContext: true,
    includeConversationContext: true,
    includeKnowledgeContext: true,
    includeEntityContext: true,
    includeSituationContext: true,
    includeHistoryContext: true,
    includeIntentContext: true,
    contextTTL: 300000, // 5 minutes
    enableCaching: true,
    cacheTTL: 600000, // 10 minutes
    priority: {
        user: 10,
        conversation: 9,
        knowledge: 8,
        entity: 7,
        situation: 6,
        history: 5,
        intent: 4
    }
};

// Context priorities
const CONTEXT_PRIORITIES = {
    CRITICAL: 10,
    HIGH: 8,
    MEDIUM: 6,
    LOW: 4,
    MINIMAL: 2
};

class ContextBuilder {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = { ...DEFAULT_CONFIG };
        this.contextCache = new Map();
        this.cacheTimestamps = new Map();
        this.conversationContexts = new Map();
        this.userContexts = new Map();
        
        // Statistics
        this.stats = {
            totalContexts: 0,
            avgBuildTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            byType: {},
            byPriority: {}
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize context builder
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

            // Setup event listeners
            this.setupEventListeners();

            // Warm up cache
            await this.warmUpCache();

            logger.info('Context builder initialized', {
                config: this.config,
                maxHistory: this.config.maxHistory,
                maxKnowledge: this.config.maxKnowledge
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Context builder initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen to user activity
        const activitySub = eventBus.subscribe('user.activity', async (data) => {
            if (data.userId) {
                await this.updateUserContext(data.userId, data);
            }
        });
        this.subscriptions.push(activitySub);

        // Listen to conversation updates
        const conversationSub = eventBus.subscribe('conversation.updated', async (data) => {
            if (data.userId && data.messages) {
                await this.updateConversationContext(data.userId, data.messages);
            }
        });
        this.subscriptions.push(conversationSub);
    }

    /**
     * Warm up cache
     */
    async warmUpCache() {
        // In production, this would pre-cache common contexts
        if (this.debugMode) {
            logger.debug('[ContextBuilder] Cache warmed up');
        }
    }

    /**
     * Build context for a query
     * @param {string} userId - User ID
     * @param {string} query - User query
     * @param {object} options - Additional options
     * @returns {object} Built context
     */
    async buildContext(userId, query = '', options = {}) {
        if (!this.initialized) {
            throw new Error('Context builder not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(userId, query, options);
        if (this.config.enableCaching && this.contextCache.has(cacheKey)) {
            const cached = this.contextCache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.config.cacheTTL) {
                this.stats.cacheHits++;
                return cached;
            }
            this.contextCache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }
        this.stats.cacheMisses++;

        try {
            // Build individual contexts
            const contexts = {};

            // User context
            if (this.config.includeUserContext) {
                contexts.user = await this.buildUserContext(userId);
            }

            // Conversation context
            if (this.config.includeConversationContext) {
                contexts.conversation = await this.buildConversationContext(userId);
            }

            // Knowledge context
            if (this.config.includeKnowledgeContext && query) {
                contexts.knowledge = await this.buildKnowledgeContext(query);
            }

            // Entity context (if entity specified)
            if (this.config.includeEntityContext && options.entityType && options.entityId) {
                contexts.entity = await this.buildEntityContext(options.entityType, options.entityId);
            }

            // Situation context
            if (this.config.includeSituationContext) {
                contexts.situation = await this.buildSituationContext(userId);
            }

            // History context
            if (this.config.includeHistoryContext) {
                contexts.history = await this.buildHistoryContext(userId);
            }

            // Intent context
            if (this.config.includeIntentContext && query) {
                contexts.intent = await this.buildIntentContext(query);
            }

            // Merge all contexts
            const mergedContext = await this.mergeContexts(contexts);

            // Add metadata
            const result = {
                ...mergedContext,
                userId: userId,
                query: query,
                timestamp: new Date().toISOString(),
                metadata: {
                    contextCount: Object.keys(contexts).length,
                    priority: this.calculatePriority(mergedContext),
                    source: 'builder'
                },
                contexts: contexts // Keep individual contexts for reference
            };

            // Cache the result
            if (this.config.enableCaching) {
                this.contextCache.set(cacheKey, result);
                this.cacheTimestamps.set(cacheKey, Date.now());
            }

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(result, duration);

            // Log context build
            if (this.debugMode) {
                logger.debug(`[ContextBuilder] Context built (${duration}ms)`);
            }

            return result;
        } catch (error) {
            logger.error('[ContextBuilder] Context build failed:', error);
            return this.getFallbackContext(userId, query);
        }
    }

    /**
     * Build user context
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} User context
     */
    async buildUserContext(userId, options = {}) {
        // Check cache
        if (this.userContexts.has(userId)) {
            const cached = this.userContexts.get(userId);
            const timestamp = cached.timestamp || 0;
            if (Date.now() - timestamp < this.config.contextTTL) {
                return cached;
            }
        }

        // In production, this would fetch user data from database
        // For MVP, return sample context
        const userContext = {
            id: userId,
            role: 'user',
            preferences: {
                language: 'en',
                theme: 'light',
                notifications: true
            },
            recentActivity: [],
            lastActive: new Date().toISOString(),
            timestamp: Date.now()
        };

        // Cache the result
        this.userContexts.set(userId, userContext);

        return userContext;
    }

    /**
     * Build conversation context
     * @param {string} userId - User ID
     * @param {Array} messages - Conversation messages
     * @param {object} options - Additional options
     * @returns {object} Conversation context
     */
    async buildConversationContext(userId, messages = [], options = {}) {
        // Check cache
        if (this.conversationContexts.has(userId)) {
            const cached = this.conversationContexts.get(userId);
            const timestamp = cached.timestamp || 0;
            if (Date.now() - timestamp < this.config.contextTTL) {
                return cached;
            }
        }

        // Use provided messages or fetch from history
        const conversationMessages = messages.length > 0 ? messages : await this.getConversationHistory(userId);

        // Analyze conversation
        const topics = await this.extractTopics(conversationMessages);
        const sentiment = await this.analyzeSentiment(conversationMessages);
        const entities = await this.extractEntities(conversationMessages);

        const conversationContext = {
            messages: conversationMessages.slice(-this.config.maxHistory),
            count: conversationMessages.length,
            topics: topics,
            sentiment: sentiment,
            entities: entities,
            timestamp: Date.now()
        };

        // Cache the result
        this.conversationContexts.set(userId, conversationContext);

        return conversationContext;
    }

    /**
     * Build entity context
     * @param {string} entityType - Entity type (lead, customer, deal, etc.)
     * @param {string} entityId - Entity ID
     * @param {object} options - Additional options
     * @returns {object} Entity context
     */
    async buildEntityContext(entityType, entityId, options = {}) {
        // In production, this would fetch entity data from database
        // For MVP, return sample context
        return {
            type: entityType,
            id: entityId,
            name: `${entityType}_${entityId}`,
            status: 'active',
            timestamp: Date.now()
        };
    }

    /**
     * Build situation context
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} Situation context
     */
    async buildSituationContext(userId, options = {}) {
        // In production, this would analyze current situation
        // For MVP, return sample context
        return {
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            isBusinessHours: this.isBusinessHours(),
            userStatus: 'active',
            timestamp: Date.now()
        };
    }

    /**
     * Build history context
     * @param {string} userId - User ID
     * @param {number} limit - Number of items
     * @param {object} options - Additional options
     * @returns {object} History context
     */
    async buildHistoryContext(userId, limit = this.config.maxHistory, options = {}) {
        // In production, this would fetch user history from database
        // For MVP, return sample context
        return {
            recentActivities: [],
            frequentActions: [],
            lastQuery: null,
            timestamp: Date.now()
        };
    }

    /**
     * Build intent context
     * @param {string} query - User query
     * @param {string} intent - Detected intent
     * @param {object} options - Additional options
     * @returns {object} Intent context
     */
    async buildIntentContext(query, intent = '', options = {}) {
        // Detect intent if not provided
        const detectedIntent = intent || await this.detectIntent(query);

        return {
            original: query,
            intent: detectedIntent,
            entities: await this.extractEntitiesFromQuery(query),
            keywords: this.extractKeywords(query),
            sentiment: await this.analyzeSentimentText(query),
            timestamp: Date.now()
        };
    }

    /**
     * Build knowledge context
     * @param {string} query - Search query
     * @param {number} limit - Number of items
     * @param {object} options - Additional options
     * @returns {object} Knowledge context
     */
    async buildKnowledgeContext(query, limit = this.config.maxKnowledge, options = {}) {
        try {
            const results = await retrieval.retrieve(query, {
                types: ['knowledge', 'documents'],
                topK: limit
            });

            return {
                query: query,
                results: results.results,
                count: results.results.length,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error('[ContextBuilder] Knowledge context failed:', error);
            return {
                query: query,
                results: [],
                count: 0,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Merge multiple contexts
     * @param {object} contexts - Contexts to merge
     * @param {object} options - Additional options
     * @returns {object} Merged context
     */
    async mergeContexts(contexts, options = {}) {
        const merged = {
            user: contexts.user || {},
            conversation: contexts.conversation || {},
            knowledge: contexts.knowledge || {},
            entity: contexts.entity || {},
            situation: contexts.situation || {},
            history: contexts.history || {},
            intent: contexts.intent || {}
        };

        // Build priority-based summary
        const summary = this.buildPrioritySummary(merged);

        // Build context string
        const contextString = this.buildContextString(merged);

        return {
            ...merged,
            summary: summary,
            contextString: contextString,
            priority: this.calculatePriority(merged),
            timestamp: Date.now()
        };
    }

    /**
     * Build priority-based summary
     * @param {object} contexts - Contexts
     * @returns {string} Summary
     */
    buildPrioritySummary(contexts) {
        const parts = [];

        // User context (highest priority)
        if (contexts.user && contexts.user.role) {
            parts.push(`User: ${contexts.user.role}`);
        }

        // Intent context
        if (contexts.intent && contexts.intent.intent) {
            parts.push(`Intent: ${contexts.intent.intent}`);
        }

        // Conversation context
        if (contexts.conversation && contexts.conversation.topics) {
            parts.push(`Topics: ${contexts.conversation.topics.join(', ')}`);
        }

        // Knowledge context
        if (contexts.knowledge && contexts.knowledge.results) {
            parts.push(`Knowledge: ${contexts.knowledge.results.length} items`);
        }

        // Entity context
        if (contexts.entity && contexts.entity.name) {
            parts.push(`Entity: ${contexts.entity.name}`);
        }

        return parts.join(' | ');
    }

    /**
     * Build context string
     * @param {object} contexts - Contexts
     * @returns {string} Context string
     */
    buildContextString(contexts) {
        const parts = [];

        // User context
        if (contexts.user && contexts.user.role) {
            parts.push(`User is ${contexts.user.role}`);
        }

        // Intent context
        if (contexts.intent && contexts.intent.intent) {
            parts.push(`User intent: ${contexts.intent.intent}`);
        }

        // Conversation context
        if (contexts.conversation && contexts.conversation.topics) {
            parts.push(`Topics: ${contexts.conversation.topics.join(', ')}`);
        }

        // Knowledge context
        if (contexts.knowledge && contexts.knowledge.results && contexts.knowledge.results.length > 0) {
            const topResults = contexts.knowledge.results.slice(0, 3);
            parts.push(`Relevant knowledge: ${topResults.map(r => r.metadata?.title || r.id).join(', ')}`);
        }

        // Entity context
        if (contexts.entity && contexts.entity.name) {
            parts.push(`Related entity: ${contexts.entity.name}`);
        }

        // Situation context
        if (contexts.situation && contexts.situation.isBusinessHours !== undefined) {
            const status = contexts.situation.isBusinessHours ? 'business hours' : 'after hours';
            parts.push(`Time: ${status}`);
        }

        return parts.join('. ');
    }

    /**
     * Calculate priority based on contexts
     * @param {object} contexts - Contexts
     * @returns {string} Priority level
     */
    calculatePriority(contexts) {
        let score = 0;

        // User context importance
        if (contexts.user && contexts.user.role) {
            score += 2;
        }

        // Intent context importance
        if (contexts.intent && contexts.intent.intent) {
            score += 3;
        }

        // Conversation context importance
        if (contexts.conversation && contexts.conversation.messages && contexts.conversation.messages.length > 0) {
            score += 2;
        }

        // Knowledge context importance
        if (contexts.knowledge && contexts.knowledge.results && contexts.knowledge.results.length > 0) {
            score += 2;
        }

        // Entity context importance
        if (contexts.entity && contexts.entity.name) {
            score += 1;
        }

        // Determine priority level
        if (score >= 8) return 'critical';
        if (score >= 6) return 'high';
        if (score >= 4) return 'medium';
        if (score >= 2) return 'low';
        return 'minimal';
    }

    /**
     * Update user context
     * @param {string} userId - User ID
     * @param {object} data - Context data
     * @returns {object} Updated context
     */
    async updateUserContext(userId, data) {
        const context = await this.buildUserContext(userId);
        const updated = {
            ...context,
            ...data,
            timestamp: Date.now()
        };
        this.userContexts.set(userId, updated);
        return updated;
    }

    /**
     * Update conversation context
     * @param {string} userId - User ID
     * @param {Array} messages - Conversation messages
     * @returns {object} Updated context
     */
    async updateConversationContext(userId, messages) {
        const context = await this.buildConversationContext(userId, messages);
        this.conversationContexts.set(userId, context);
        return context;
    }

    /**
     * Get conversation history
     * @param {string} userId - User ID
     * @param {number} limit - Number of messages
     * @returns {Array} Conversation history
     */
    async getConversationHistory(userId, limit = this.config.maxHistory) {
        // In production, this would fetch from database
        // For MVP, return sample history
        return [];
    }

    /**
     * Extract topics from conversation
     * @param {Array} messages - Conversation messages
     * @returns {Array} Topics
     */
    async extractTopics(messages) {
        // In production, this would use NLP
        // For MVP, extract keywords
        const allText = messages.map(m => m.content || '').join(' ');
        return this.extractKeywords(allText).slice(0, 5);
    }

    /**
     * Analyze sentiment
     * @param {Array} messages - Conversation messages
     * @returns {string} Sentiment
     */
    async analyzeSentiment(messages) {
        const allText = messages.map(m => m.content || '').join(' ');
        return await this.analyzeSentimentText(allText);
    }

    /**
     * Analyze sentiment of text
     * @param {string} text - Text to analyze
     * @returns {string} Sentiment
     */
    async analyzeSentimentText(text) {
        // In production, this would use NLP
        // For MVP, return neutral
        return 'neutral';
    }

    /**
     * Extract entities from conversation
     * @param {Array} messages - Conversation messages
     * @returns {Array} Entities
     */
    async extractEntities(messages) {
        const allText = messages.map(m => m.content || '').join(' ');
        // In production, this would use NER
        // For MVP, return empty array
        return [];
    }

    /**
     * Detect intent from query
     * @param {string} query - User query
     * @returns {string} Intent
     */
    async detectIntent(query) {
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('lead') || lowerQuery.includes('prospect')) {
            return 'lead_management';
        }
        if (lowerQuery.includes('deal') || lowerQuery.includes('pipeline')) {
            return 'deal_management';
        }
        if (lowerQuery.includes('customer') || lowerQuery.includes('client')) {
            return 'customer_management';
        }
        if (lowerQuery.includes('report') || lowerQuery.includes('analytics')) {
            return 'reporting';
        }
        if (lowerQuery.includes('task') || lowerQuery.includes('todo')) {
            return 'task_management';
        }
        if (lowerQuery.includes('help') || lowerQuery.includes('how')) {
            return 'help';
        }

        return 'general';
    }

    /**
     * Extract entities from query
     * @param {string} query - User query
     * @returns {Array} Entities
     */
    async extractEntitiesFromQuery(query) {
        // In production, this would use NER
        // For MVP, extract by simple patterns
        const entities = [];
        const words = query.split(' ');

        // Simple entity extraction
        const patterns = {
            lead: ['lead', 'prospect', 'potential'],
            deal: ['deal', 'opportunity', 'pipeline'],
            customer: ['customer', 'client', 'account'],
            task: ['task', 'todo', 'action']
        };

        for (const [type, keywords] of Object.entries(patterns)) {
            for (const keyword of keywords) {
                if (query.toLowerCase().includes(keyword)) {
                    entities.push({ type, value: keyword });
                }
            }
        }

        return entities;
    }

    /**
     * Extract keywords from text
     * @param {string} text - Text to extract keywords from
     * @returns {Array} Keywords
     */
    extractKeywords(text) {
        const words = text.toLowerCase().split(/\s+/);
        const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'for', 'and', 'nor', 'but', 'or', 'yet', 'so', 'as', 'at', 'by', 'for', 'from',
            'in', 'into', 'of', 'on', 'onto', 'to', 'with', 'without'];

        const keywords = words
            .filter(word => word.length > 2 && !stopWords.includes(word))
            .slice(0, 10);

        return [...new Set(keywords)];
    }

    /**
     * Check if it's business hours
     * @returns {boolean} Whether it's business hours
     */
    isBusinessHours() {
        const hour = new Date().getHours();
        const day = new Date().getDay();
        return hour >= 9 && hour < 18 && day >= 1 && day <= 5;
    }

    /**
     * Get fallback context
     * @param {string} userId - User ID
     * @param {string} query - User query
     * @returns {object} Fallback context
     */
    getFallbackContext(userId, query) {
        return {
            userId: userId,
            query: query,
            timestamp: new Date().toISOString(),
            priority: 'low',
            contextString: 'Basic user context',
            summary: 'User requested assistance',
            metadata: {
                contextCount: 0,
                priority: 'low',
                source: 'fallback',
                error: true
            }
        };
    }

    /**
     * Get context statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getContextStats(options = {}) {
        return {
            ...this.stats,
            config: this.config,
            cacheSize: this.contextCache.size,
            userContexts: this.userContexts.size,
            conversationContexts: this.conversationContexts.size,
            initialized: this.initialized
        };
    }

    /**
     * Get cache key
     * @param {string} userId - User ID
     * @param {string} query - User query
     * @param {object} options - Additional options
     * @returns {string} Cache key
     */
    getCacheKey(userId, query, options) {
        const keyParts = [
            userId,
            query,
            options.entityType || '',
            options.entityId || '',
            options.includeUserContext || '',
            options.includeKnowledgeContext || ''
        ];
        return 'context_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Update statistics
     * @param {object} context - Built context
     * @param {number} duration - Build duration
     */
    updateStats(context, duration) {
        this.stats.totalContexts++;
        this.stats.avgBuildTime = 
            (this.stats.avgBuildTime * (this.stats.totalContexts - 1) + duration) / 
            this.stats.totalContexts;

        const priority = context.priority || 'low';
        this.stats.byPriority[priority] = (this.stats.byPriority[priority] || 0) + 1;

        // Count context types
        if (context.contexts) {
            for (const type of Object.keys(context.contexts)) {
                this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
            }
        }
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[ContextBuilder] Debug mode enabled');
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
            logger.debug('[ContextBuilder] Configuration updated');
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

        this.contextCache.clear();
        this.cacheTimestamps.clear();
        this.userContexts.clear();
        this.conversationContexts.clear();
        this.initialized = false;
        logger.info('Context builder cleaned up');
    }
}

// Create and export singleton instance
export const contextBuilder = new ContextBuilder();

// Export class for testing
export default ContextBuilder;
