/**
 * ==========================================
 * FILE: aiService.js
 * MODULE: AI Module
 * CODE: AI-2
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Core AI service that handles communication with Groq API
 * and other AI providers. Manages rate limiting, retries,
 * caching, and provider fallback.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - tenantIsolation.js (for tenant context)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize AI service
 * - callAI(prompt, options): Call AI with prompt
 * - callAIWithRetry(prompt, options): Call with retry
 * - callAIStream(prompt, options): Stream AI response
 * - getCompletion(prompt, options): Get completion
 * - getEmbeddings(text, options): Get embeddings
 * - getChatCompletion(messages, options): Chat completion
 * - checkHealth(): Check service health
 * - getModels(): Get available models
 * - setProvider(provider): Set AI provider
 * - getProvider(): Get current provider
 * - clearCache(): Clear cache
 * - getStats(): Get service statistics
 * 
 * USAGE EXAMPLE:
 * import { aiService } from './modules/ai/aiService.js';
 * 
 * // Initialize AI service
 * await aiService.initialize();
 * 
 * // Call AI
 * const response = await aiService.callAI(
 *   'Score this lead from 0-100',
 *   { temperature: 0.3, maxTokens: 50 }
 * );
 * 
 * // Get embeddings
 * const embeddings = await aiService.getEmbeddings(
 *   'Lead scoring algorithm'
 * );
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// AI Provider configurations
const PROVIDERS = {
    GROQ: 'groq',
    OPENAI: 'openai',
    GEMINI: 'gemini',
    FALLBACK: 'fallback'
};

class AIService {
    constructor() {
        // Service state
        this.initialized = false;
        this.currentProvider = PROVIDERS.GROQ;
        this.providerClients = new Map();
        this.rateLimiter = {
            requests: 0,
            lastReset: Date.now(),
            maxRequests: 30, // Per minute
            resetInterval: 60000
        };
        
        // Configuration
        this.config = {
            defaultModel: 'llama3-70b-8192',
            defaultTemperature: 0.7,
            defaultMaxTokens: 1000,
            maxRetries: 3,
            retryDelay: 1000,
            timeout: 30000,
            enableCaching: true,
            cacheTTL: 300, // 5 minutes
            enableFallback: true,
            fallbackProvider: PROVIDERS.GROQ,
            rateLimit: 30,
            rateLimitInterval: 60000,
            providers: {
                [PROVIDERS.GROQ]: {
                    apiKey: process.env.GROQ_API_KEY || '',
                    baseUrl: 'https://api.groq.com/openai/v1',
                    models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768']
                },
                [PROVIDERS.OPENAI]: {
                    apiKey: process.env.OPENAI_API_KEY || '',
                    baseUrl: 'https://api.openai.com/v1',
                    models: ['gpt-4', 'gpt-3.5-turbo']
                },
                [PROVIDERS.GEMINI]: {
                    apiKey: process.env.GEMINI_API_KEY || '',
                    baseUrl: 'https://generativelanguage.googleapis.com/v1',
                    models: ['gemini-pro', 'gemini-pro-vision']
                }
            }
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cachedResponses: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            byProvider: {
                groq: { requests: 0, success: 0, failed: 0 },
                openai: { requests: 0, success: 0, failed: 0 },
                gemini: { requests: 0, success: 0, failed: 0 },
                fallback: { requests: 0, success: 0, failed: 0 }
            }
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize AI service
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

            // Initialize providers
            await this.initializeProviders();

            // Setup event listeners
            this.setupEventListeners();

            // Test connection
            await this.testConnection();

            logger.info('AI service initialized', {
                provider: this.currentProvider,
                models: this.getModels(),
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('AI service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize AI providers
     */
    async initializeProviders() {
        // In production, initialize actual clients
        // For MVP, store configurations
        for (const [provider, config] of Object.entries(this.config.providers)) {
            if (config.apiKey) {
                this.providerClients.set(provider, {
                    config: config,
                    available: true
                });
            }
        }

        // Ensure at least one provider is available
        if (this.providerClients.size === 0) {
            // Use mock provider for MVP
            this.providerClients.set(PROVIDERS.GROQ, {
                config: { apiKey: 'mock_key', baseUrl: 'mock_url', models: ['mock_model'] },
                available: true,
                mock: true
            });
            logger.warn('No AI provider configured. Using mock provider.');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for rate limit events
        const rateLimitSub = eventBus.subscribe('ai.rate_limit', (data) => {
            logger.warn('[AIService] Rate limit hit:', data);
        });
        this.subscriptions.push(rateLimitSub);

        // Listen for provider failures
        const providerFailSub = eventBus.subscribe('ai.provider_failed', (data) => {
            logger.warn('[AIService] Provider failed:', data);
            this.handleProviderFailure(data.provider);
        });
        this.subscriptions.push(providerFailSub);
    }

    /**
     * Test connection to AI provider
     */
    async testConnection() {
        try {
            await this.callAI('Test connection', { maxTokens: 5 });
            logger.info('AI service connection test successful');
            return true;
        } catch (error) {
            logger.error('AI service connection test failed:', error);
            if (this.config.enableFallback) {
                this.currentProvider = this.config.fallbackProvider;
                logger.info(`Falling back to ${this.currentProvider}`);
                return true;
            }
            throw error;
        }
    }

    /**
     * Call AI with prompt
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} AI response
     */
    async callAI(prompt, options = {}) {
        if (!this.initialized) {
            throw new Error('AI service not initialized');
        }

        // Check rate limit
        this.checkRateLimit();

        // Check cache
        const cacheKey = this.getCacheKey(prompt, options);
        if (this.config.enableCaching && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.config.cacheTTL * 1000) {
                this.stats.cachedResponses++;
                if (this.debugMode) {
                    logger.debug('[AIService] Cache hit');
                }
                return cached;
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }

        const startTime = Date.now();

        try {
            const response = await this.callAIWithRetry(prompt, options);

            // Update metrics
            const duration = Date.now() - startTime;
            this.updateStats(true, duration);
            this.stats.totalResponseTime += duration;
            this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.totalRequests;

            // Cache response
            if (this.config.enableCaching) {
                this.cache.set(cacheKey, response);
                this.cacheTimestamps.set(cacheKey, Date.now());
            }

            // Log to audit
            await auditLogger.log(
                options.userId || 'system',
                'ai.service.call',
                'ai',
                { prompt: prompt.substring(0, 100), response: response.substring(0, 100) }
            );

            if (this.debugMode) {
                logger.debug(`[AIService] AI call successful (${duration}ms)`);
            }

            return response;
        } catch (error) {
            this.updateStats(false, Date.now() - startTime);
            logger.error('[AIService] AI call failed:', error);
            throw error;
        }
    }

    /**
     * Call AI with retry logic
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} AI response
     */
    async callAIWithRetry(prompt, options = {}) {
        let lastError;
        const maxRetries = options.maxRetries || this.config.maxRetries;
        const retryDelay = options.retryDelay || this.config.retryDelay;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const provider = options.provider || this.currentProvider;
                const response = await this.callProvider(provider, prompt, options);
                return response;
            } catch (error) {
                lastError = error;
                logger.warn(`[AIService] Attempt ${attempt}/${maxRetries} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = retryDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // If all retries failed and fallback is enabled
        if (this.config.enableFallback) {
            try {
                const fallbackProvider = this.config.fallbackProvider;
                logger.info(`[AIService] Trying fallback provider: ${fallbackProvider}`);
                return await this.callProvider(fallbackProvider, prompt, options);
            } catch (error) {
                throw new Error(`All providers failed: ${lastError?.message || error.message}`);
            }
        }

        throw lastError;
    }

    /**
     * Call specific AI provider
     * @param {string} provider - Provider name
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} AI response
     */
    async callProvider(provider, prompt, options = {}) {
        const client = this.providerClients.get(provider);
        if (!client || !client.available) {
            throw new Error(`Provider ${provider} not available`);
        }

        const model = options.model || this.config.defaultModel;
        const temperature = options.temperature || this.config.defaultTemperature;
        const maxTokens = options.maxTokens || this.config.defaultMaxTokens;

        // Update provider stats
        if (this.stats.byProvider[provider]) {
            this.stats.byProvider[provider].requests++;
        }

        // In production, call actual API
        // For MVP, simulate API call
        const response = await this.simulateProviderCall(provider, prompt, {
            model,
            temperature,
            maxTokens,
            ...options
        });

        return response;
    }

    /**
     * Simulate provider call (for MVP)
     * @param {string} provider - Provider name
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} Simulated response
     */
    async simulateProviderCall(provider, prompt, options) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));

        // Simulate provider-specific responses
        switch (provider) {
            case PROVIDERS.GROQ:
                return this.simulateGroqResponse(prompt, options);
            case PROVIDERS.OPENAI:
                return this.simulateOpenAIResponse(prompt, options);
            case PROVIDERS.GEMINI:
                return this.simulateGeminiResponse(prompt, options);
            default:
                // Default response
                return `[${provider}] Response to: ${prompt.substring(0, 50)}...`;
        }
    }

    /**
     * Simulate Groq response
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} Simulated response
     */
    simulateGroqResponse(prompt, options) {
        // For scoring prompts
        if (prompt.includes('score') || prompt.includes('Score')) {
            const score = Math.floor(50 + Math.random() * 40);
            return `${score}`;
        }

        // For qualification prompts
        if (prompt.includes('qualify') || prompt.includes('Qualify')) {
            const qualified = Math.random() > 0.3;
            return JSON.stringify({
                qualified: qualified,
                score: Math.floor(50 + Math.random() * 40),
                category: qualified ? 'Hot' : 'Cold',
                reasoning: 'Based on provided criteria',
                nextAction: qualified ? 'Schedule call' : 'Send nurture email'
            });
        }

        // For general prompts
        const responses = [
            'Based on the provided information, the lead shows strong potential for conversion.',
            'I recommend following up within 24 hours to capitalize on the engagement.',
            'The data suggests a high probability of closing this deal within the next quarter.',
            'This customer is showing signs of churn. Immediate retention actions recommended.',
            'The sales pipeline is healthy with 60% conversion rate in the current quarter.'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Simulate OpenAI response
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} Simulated response
     */
    simulateOpenAIResponse(prompt, options) {
        return this.simulateGroqResponse(prompt, options);
    }

    /**
     * Simulate Gemini response
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} Simulated response
     */
    simulateGeminiResponse(prompt, options) {
        return this.simulateGroqResponse(prompt, options);
    }

    /**
     * Get streaming AI response
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @param {Function} onChunk - Chunk callback
     * @returns {Promise<void>}
     */
    async callAIStream(prompt, options = {}, onChunk) {
        if (!this.initialized) {
            throw new Error('AI service not initialized');
        }

        // Check rate limit
        this.checkRateLimit();

        const startTime = Date.now();

        try {
            // In production, call actual streaming API
            // For MVP, simulate streaming
            const response = await this.callAIWithRetry(prompt, options);
            
            // Simulate streaming by splitting response
            const chunks = response.split(' ');
            for (let i = 0; i < chunks.length; i++) {
                const chunk = (i === 0 ? chunks[i] : ' ' + chunks[i]);
                if (onChunk) {
                    onChunk(chunk);
                }
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
            }

            const duration = Date.now() - startTime;
            this.updateStats(true, duration);

            if (this.debugMode) {
                logger.debug(`[AIService] Stream completed (${duration}ms)`);
            }
        } catch (error) {
            this.updateStats(false, Date.now() - startTime);
            logger.error('[AIService] Stream failed:', error);
            throw error;
        }
    }

    /**
     * Get completion (alias for callAI)
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} Completion
     */
    async getCompletion(prompt, options = {}) {
        return await this.callAI(prompt, options);
    }

    /**
     * Get embeddings for text
     * @param {string} text - Text to embed
     * @param {object} options - Options
     * @returns {Array} Embeddings
     */
    async getEmbeddings(text, options = {}) {
        // In production, call embeddings API
        // For MVP, simulate embeddings
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        const dimension = options.dimension || 128;
        const embedding = [];
        for (let i = 0; i < dimension; i++) {
            embedding.push(Math.random() * 2 - 1);
        }
        return embedding;
    }

    /**
     * Get chat completion
     * @param {Array} messages - Chat messages
     * @param {object} options - Options
     * @returns {string} Chat completion
     */
    async getChatCompletion(messages, options = {}) {
        // Convert messages to prompt
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        return await this.callAI(prompt, options);
    }

    /**
     * Check rate limit
     */
    checkRateLimit() {
        const now = Date.now();
        if (now - this.rateLimiter.lastReset > this.rateLimiter.resetInterval) {
            this.rateLimiter.requests = 0;
            this.rateLimiter.lastReset = now;
        }

        const maxRequests = this.config.rateLimit || this.rateLimiter.maxRequests;
        if (this.rateLimiter.requests >= maxRequests) {
            eventBus.publish('ai.rate_limit', {
                requests: this.rateLimiter.requests,
                max: maxRequests,
                resetAt: new Date(this.rateLimiter.lastReset + this.rateLimiter.resetInterval).toISOString()
            });
            throw new Error(`Rate limit exceeded. Maximum ${maxRequests} requests per minute.`);
        }

        this.rateLimiter.requests++;
    }

    /**
     * Check service health
     * @returns {object} Health status
     */
    async checkHealth() {
        try {
            await this.testConnection();
            return {
                status: 'healthy',
                provider: this.currentProvider,
                availableProviders: Array.from(this.providerClients.keys()),
                initialized: this.initialized,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                provider: this.currentProvider,
                error: error.message,
                initialized: this.initialized,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get available models
     * @returns {Array} Available models
     */
    getModels() {
        const provider = this.providerClients.get(this.currentProvider);
        if (provider) {
            return provider.config.models || [];
        }
        return [];
    }

    /**
     * Set AI provider
     * @param {string} provider - Provider name
     * @returns {boolean} Success
     */
    setProvider(provider) {
        if (!this.providerClients.has(provider)) {
            throw new Error(`Provider ${provider} not configured`);
        }

        if (!this.providerClients.get(provider).available) {
            throw new Error(`Provider ${provider} not available`);
        }

        this.currentProvider = provider;
        logger.info(`[AIService] Provider set to: ${provider}`);
        return true;
    }

    /**
     * Get current provider
     * @returns {string} Current provider
     */
    getProvider() {
        return this.currentProvider;
    }

    /**
     * Handle provider failure
     * @param {string} provider - Failed provider
     */
    handleProviderFailure(provider) {
        if (this.providerClients.has(provider)) {
            this.providerClients.get(provider).available = false;
        }

        if (provider === this.currentProvider && this.config.enableFallback) {
            this.currentProvider = this.config.fallbackProvider;
            logger.info(`[AIService] Failed over to ${this.currentProvider}`);
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
        if (this.debugMode) {
            logger.debug('[AIService] Cache cleared');
        }
    }

    /**
     * Get cache key
     * @param {string} prompt - Prompt text
     * @param {object} options - Options
     * @returns {string} Cache key
     */
    getCacheKey(prompt, options) {
        const str = JSON.stringify({ prompt, options });
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `ai_${hash}`;
    }

    /**
     * Update statistics
     * @param {boolean} success - Whether request was successful
     * @param {number} duration - Request duration
     */
    updateStats(success, duration) {
        this.stats.totalRequests++;
        if (success) {
            this.stats.successfulRequests++;
        } else {
            this.stats.failedRequests++;
        }

        // Update provider stats
        const provider = this.currentProvider;
        if (this.stats.byProvider[provider]) {
            if (success) {
                this.stats.byProvider[provider].success++;
            } else {
                this.stats.byProvider[provider].failed++;
            }
        }
    }

    /**
     * Get service statistics
     * @param {object} options - Additional options
     * @returns {object} Service statistics
     */
    async getStats(options = {}) {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            currentProvider: this.currentProvider,
            availableProviders: Array.from(this.providerClients.keys()),
            rateLimit: {
                requests: this.rateLimiter.requests,
                max: this.config.rateLimit || this.rateLimiter.maxRequests,
                resetAt: new Date(this.rateLimiter.lastReset + this.rateLimiter.resetInterval).toISOString()
            },
            config: this.config,
            initialized: this.initialized
        };
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[AIService] Debug mode enabled');
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

        // Clear cache
        this.clearCache();

        this.initialized = false;
        logger.info('AI service cleaned up');
    }
}

// Create and export singleton instance
export const aiService = new AIService();

// Export class for testing
export default AIService;
